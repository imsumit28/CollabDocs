import { Server as HTTPServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { verifyAccessToken } from '../utils/jwt';
import { CollabDocument } from '../models';
import { resolveJoinPermission, canEdit, DocPermission } from '../utils/documentAccess';
import { plainTextFromDoc } from '../utils/yjsText';
import { notifyDocumentMentions } from '../utils/notifications';
import { logger } from '../utils/logger';
import * as Y from 'yjs';

// ─── Y.Doc room registry ──────────────────────────────────────────────────────
interface DocRoom {
  doc: Y.Doc;
  io: SocketServer;
  saveTimer: NodeJS.Timeout | null;
  lastHash: string;
}

const docRooms = new Map<string, DocRoom>();

// The live Socket.IO server, set by initSocket(). Module-level so REST handlers
// (via refreshDocPermissions) can push permission changes into open rooms.
let ioRef: SocketServer | null = null;

export function getDocRoom(docId: string): DocRoom | undefined {
  return docRooms.get(docId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function userColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 55%)`;
}

// Deduplicate by user ID so the same person in two tabs counts as one
function dedupeUsers(sockets: any[]) {
  const seen = new Set<string>();
  return sockets
    .filter((s: any) => {
      if (seen.has(s.data.user.sub)) return false;
      seen.add(s.data.user.sub);
      return true;
    })
    .map((s: any) => ({
      id: s.data.user.sub,
      username: s.data.user.username || null,
      displayName: s.data.user.displayName,
      color: userColor(s.data.user.sub),
    }));
}

async function flushAndClean(docId: string) {
  const room = docRooms.get(docId);
  if (!room) return;
  if (room.saveTimer) clearTimeout(room.saveTimer);
  const state = Y.encodeStateAsUpdate(room.doc);
  await CollabDocument.findByIdAndUpdate(docId, {
    yjsState: Buffer.from(state),
    contentText: plainTextFromDoc(room.doc),
  });
  docRooms.delete(docId);
}

// Persist every open room — called on graceful shutdown so in-flight edits that
// haven't hit the 1.5 s debounce window aren't lost when the process exits.
export async function flushAllRooms(): Promise<void> {
  const docIds = Array.from(docRooms.keys());
  await Promise.allSettled(docIds.map((docId) => flushAndClean(docId)));
}

/**
 * Re-evaluate every open participant's permission on a document after a sharing
 * change (share link toggled/re-scoped, a collaborator added/removed/re-permed),
 * and push the result live — no page refresh required.
 *
 * For each socket currently in the room we recompute permission from the fresh
 * DB state using the same share token they joined with, then:
 *   - if they lost all access (e.g. link sharing disabled and they aren't a
 *     collaborator) → emit `doc:access-revoked`, drop them from the room, and
 *     stop honoring their edits;
 *   - otherwise update the cached permission (so the `yjs:update` write-gate
 *     takes effect immediately) and, when it changed, emit `doc:permission`.
 *
 * No-ops safely when the socket server isn't running (e.g. under Jest / REST-only
 * tests). Single-instance correct; multi-node would additionally need the trigger
 * fanned out over the Redis adapter.
 */
export async function refreshDocPermissions(docId: string): Promise<void> {
  if (!ioRef) return;

  let dbDoc;
  try {
    dbDoc = await CollabDocument.findById(docId);
  } catch {
    return;
  }

  let revoked = false;
  for (const socket of ioRef.sockets.sockets.values()) {
    if (!socket.rooms.has(docId)) continue;

    const userId = socket.data?.user?.sub;
    const perms: Map<string, DocPermission> | undefined = socket.data?.roomPermissions;
    const tokens: Map<string, string | null> | undefined = socket.data?.roomShareTokens;
    if (!userId || !perms) continue;

    const perm = resolveJoinPermission(dbDoc, userId, tokens?.get(docId) ?? null);

    if (!perm) {
      socket.emit('doc:access-revoked', { docId });
      socket.leave(docId);
      perms.delete(docId);
      tokens?.delete(docId);
      revoked = true;
      continue;
    }

    const prev = perms.get(docId);
    perms.set(docId, perm);
    if (prev !== perm) socket.emit('doc:permission', { docId, permission: perm });
  }

  // If anyone was removed, refresh the presence list for whoever remains.
  if (revoked) {
    const remaining = await ioRef.in(docId).fetchSockets();
    ioRef.to(docId).emit('doc:awareness', { users: dedupeUsers(remaining) });
  }
}

// ─── Main Socket init ─────────────────────────────────────────────────────────
export function initSocket(server: HTTPServer): SocketServer {
  const io = new SocketServer(server, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true },
    maxHttpBufferSize: 5e6,
  });
  ioRef = io;

  // Redis adapter for horizontal scaling (optional)
  if (process.env.REDIS_URL) {
    try {
      const pub = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
      });
      const sub = pub.duplicate();
      pub.on('error', () => {});
      sub.on('error', () => {});
      Promise.all([pub.connect(), sub.connect()])
        .then(() => {
          io.adapter(createAdapter(pub as any, sub as any));
          logger.info('Socket.IO Redis adapter connected');
        })
        .catch(() => logger.warn('Redis not available, using in-memory adapter'));
    } catch {
      logger.warn('Redis not available, using in-memory adapter');
    }
  }

  // ─── Auth middleware ─────────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.data.user = verifyAccessToken(token);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    // Track which doc rooms this socket has joined for disconnect cleanup
    const joinedRooms = new Set<string>();
    // Track this socket's permission + share token per room so we can enforce
    // read-only access AND re-evaluate it live when the owner changes sharing.
    // Stored on socket.data (not a closure) so refreshDocPermissions() — invoked
    // from REST handlers — can reach and update it.
    const roomPermissions = new Map<string, DocPermission>();
    const roomShareTokens = new Map<string, string | null>();
    socket.data.roomPermissions = roomPermissions;
    socket.data.roomShareTokens = roomShareTokens;

    logger.debug({ user: user.displayName, socketId: socket.id }, 'Socket connected');

    // ─── Join document room ────────────────────────────────────────────────────
    socket.on('doc:join', async ({ docId, shareToken }: { docId: string; shareToken?: string }) => {
      try {
        const dbDoc = await CollabDocument.findById(docId);
        if (!dbDoc) return socket.emit('error', { message: 'Document not found' });

        const permission = resolveJoinPermission(dbDoc, user.sub, shareToken);
        if (!permission) return socket.emit('error', { message: 'Access denied' });

        socket.join(docId);
        joinedRooms.add(docId);
        roomPermissions.set(docId, permission);
        roomShareTokens.set(docId, shareToken ?? null);
        socket.emit('doc:permission', { docId, permission });

        // Initialise Y.Doc for this room
        if (!docRooms.has(docId)) {
          const ydoc = new Y.Doc();
          // Re-read yjsState fresh to avoid race condition with concurrent flushAndClean
          const freshDoc = await CollabDocument.findById(docId, 'yjsState');
          if (freshDoc?.yjsState) Y.applyUpdate(ydoc, new Uint8Array(freshDoc.yjsState));
          docRooms.set(docId, { doc: ydoc, io, saveTimer: null, lastHash: '' });
        }

        const room = docRooms.get(docId)!;
        const state = Y.encodeStateAsUpdate(room.doc);
        socket.emit('yjs:sync', { state: Buffer.from(state).toString('base64') });

        const roomSockets = await io.in(docId).fetchSockets();
        io.to(docId).emit('doc:awareness', { users: dedupeUsers(roomSockets) });
      } catch {
        socket.emit('error', { message: 'Failed to join document' });
      }
    });

    // ─── Y.js update relay ─────────────────────────────────────────────────────
    socket.on('yjs:update', ({ docId, update }: { docId: string; update: string }) => {
      const room = docRooms.get(docId);
      if (!room) return;

      // Enforce write access — view-only participants cannot mutate the document
      if (!canEdit(roomPermissions.get(docId) ?? null)) return;

      const uint8 = new Uint8Array(Buffer.from(update, 'base64'));
      Y.applyUpdate(room.doc, uint8);
      socket.to(docId).emit('yjs:update', { update });

      if (room.saveTimer) clearTimeout(room.saveTimer);
      room.saveTimer = setTimeout(async () => {
        const state = Y.encodeStateAsUpdate(room.doc);
        const text = plainTextFromDoc(room.doc);
        await CollabDocument.findByIdAndUpdate(docId, {
          yjsState: Buffer.from(state),
          contentText: text,
        });
        io.to(docId).emit('doc:saved', { timestamp: new Date().toISOString() });
        // Notify anyone newly @mentioned in the document body (best-effort).
        await notifyDocumentMentions({
          documentId: docId,
          actorId: user.sub,
          actorName: user.displayName,
          text,
        });
      }, 1500);
    });

    // ─── Cursor broadcast ──────────────────────────────────────────────────────
    socket.on('cursor:move', ({ docId, anchor, head }: any) => {
      socket.to(docId).emit('cursor:update', {
        userId: user.sub,
        displayName: user.displayName,
        color: userColor(user.sub),
        anchor,
        head,
      });
    });

    // ─── Y.js awareness relay (live cursors via y-protocols) ───────────────────
    socket.on('awareness:update', ({ docId, update }: { docId: string; update: string }) => {
      socket.to(docId).emit('awareness:update', { update });
    });

    // ─── Typing indicator ─────────────────────────────────────────────────────
    socket.on('doc:typing', ({ docId }: { docId: string }) => {
      socket.to(docId).emit('doc:typing', {
        userId: user.sub,
        displayName: user.displayName,
        color: userColor(user.sub),
      });
    });

    // ─── Explicit leave ────────────────────────────────────────────────────────
    socket.on('doc:leave', async ({ docId }: { docId: string }) => {
      socket.leave(docId);
      joinedRooms.delete(docId);
      roomPermissions.delete(docId);
      roomShareTokens.delete(docId);

      const remaining = await io.in(docId).fetchSockets();
      if (remaining.length === 0) {
        await flushAndClean(docId);
      }
      io.to(docId).emit('doc:awareness', { users: dedupeUsers(remaining) });
    });

    // ─── Disconnect — treat as leaving all joined rooms ────────────────────────
    socket.on('disconnect', async () => {
      logger.debug({ user: user.displayName }, 'Socket disconnected');
      // Socket.IO already removed this socket from all rooms before 'disconnect' fires.
      // fetchSockets() will not include this socket, so presence lists are already clean.
      for (const docId of joinedRooms) {
        const remaining = await io.in(docId).fetchSockets();
        if (remaining.length === 0) {
          await flushAndClean(docId);
        }
        io.to(docId).emit('doc:awareness', { users: dedupeUsers(remaining) });
      }
    });
  });

  return io;
}
