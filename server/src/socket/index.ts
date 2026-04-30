import { Server as HTTPServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { verifyAccessToken } from '../utils/jwt';
import { CollabDocument } from '../models';
import * as Y from 'yjs';

// ─── Y.Doc room registry ──────────────────────────────────────────────────────
interface DocRoom {
  doc: Y.Doc;
  io: SocketServer;
  saveTimer: NodeJS.Timeout | null;
  lastHash: string;
}

const docRooms = new Map<string, DocRoom>();

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
      displayName: s.data.user.displayName,
      color: userColor(s.data.user.sub),
    }));
}

async function flushAndClean(docId: string) {
  const room = docRooms.get(docId);
  if (!room) return;
  if (room.saveTimer) clearTimeout(room.saveTimer);
  const state = Y.encodeStateAsUpdate(room.doc);
  await CollabDocument.findByIdAndUpdate(docId, { yjsState: Buffer.from(state) });
  docRooms.delete(docId);
}

// ─── Main Socket init ─────────────────────────────────────────────────────────
export function initSocket(server: HTTPServer): SocketServer {
  const io = new SocketServer(server, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true },
    maxHttpBufferSize: 5e6,
  });

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
          console.log('✅ Socket.IO Redis adapter connected');
        })
        .catch(() => console.warn('⚠️ Redis not available, using in-memory adapter'));
    } catch {
      console.warn('⚠️ Redis not available, using in-memory adapter');
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

    console.log(`🔌 Connected: ${user.displayName} (${socket.id})`);

    // ─── Join document room ────────────────────────────────────────────────────
    socket.on('doc:join', async ({ docId }: { docId: string }) => {
      try {
        const dbDoc = await CollabDocument.findById(docId);
        if (!dbDoc) return socket.emit('error', { message: 'Document not found' });

        const isAuthorized =
          dbDoc.ownerId.toString() === user.sub ||
          dbDoc.collaborators.some((c: any) => c.userId.toString() === user.sub) ||
          !!dbDoc.shareLink;
        if (!isAuthorized) return socket.emit('error', { message: 'Access denied' });

        socket.join(docId);
        joinedRooms.add(docId);

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

      const uint8 = new Uint8Array(Buffer.from(update, 'base64'));
      Y.applyUpdate(room.doc, uint8);
      socket.to(docId).emit('yjs:update', { update });

      if (room.saveTimer) clearTimeout(room.saveTimer);
      room.saveTimer = setTimeout(async () => {
        const state = Y.encodeStateAsUpdate(room.doc);
        await CollabDocument.findByIdAndUpdate(docId, { yjsState: Buffer.from(state) });
        io.to(docId).emit('doc:saved', { timestamp: new Date().toISOString() });
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

      const remaining = await io.in(docId).fetchSockets();
      if (remaining.length === 0) {
        await flushAndClean(docId);
      }
      io.to(docId).emit('doc:awareness', { users: dedupeUsers(remaining) });
    });

    // ─── Disconnect — treat as leaving all joined rooms ────────────────────────
    socket.on('disconnect', async () => {
      console.log(`🔌 Disconnected: ${user.displayName}`);
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
