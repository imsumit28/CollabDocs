import http from 'http';
import type { AddressInfo } from 'net';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import * as Y from 'yjs';
import { Server as SocketIOServer } from 'socket.io';
import { initSocket, refreshDocPermissions } from '../../socket';
import { CollabDocument, User } from '../../models';
import { generateAccessToken } from '../helpers';

/**
 * Integration tests that drive the REAL Socket.IO handlers in src/socket/index.ts
 * (auth middleware, doc:join authorization, the yjs:update write-gate, presence,
 * and persistence-on-leave). The pre-existing sync.test.ts only exercised Y.js in
 * isolation with placeholder assertions — none of the server's socket logic. These
 * tests connect actual socket.io-client instances over a real HTTP server.
 */
describe('Socket handlers (integration)', () => {
  let httpServer: http.Server;
  let io: SocketIOServer;
  let port: number;

  // Reused actors
  let ownerId: string;
  let editorId: string;
  let viewerId: string;
  let strangerId: string;
  let ownerToken: string;
  let editorToken: string;
  let viewerToken: string;
  let strangerToken: string;

  const clients: ClientSocket[] = [];

  beforeAll(async () => {
    httpServer = http.createServer();
    io = initSocket(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(async () => {
    const [owner, editor, viewer, stranger] = await User.create([
      { email: 'owner@sock.test', displayName: 'Owner', passwordHash: 'x', username: 'owner' },
      { email: 'editor@sock.test', displayName: 'Editor', passwordHash: 'x', username: 'editor' },
      { email: 'viewer@sock.test', displayName: 'Viewer', passwordHash: 'x', username: 'viewer' },
      { email: 'stranger@sock.test', displayName: 'Stranger', passwordHash: 'x', username: 'stranger' },
    ]);
    ownerId = owner.id; editorId = editor.id; viewerId = viewer.id; strangerId = stranger.id;
    ownerToken = tokenFor(ownerId, 'Owner', 'owner');
    editorToken = tokenFor(editorId, 'Editor', 'editor');
    viewerToken = tokenFor(viewerId, 'Viewer', 'viewer');
    strangerToken = tokenFor(strangerId, 'Stranger', 'stranger');
  });

  afterEach(async () => {
    // Disconnect every client so rooms drain (which clears debounce timers) and
    // no stray socket leaks into the next test.
    while (clients.length) {
      const c = clients.pop();
      if (c?.connected) c.disconnect();
    }
    // Give the server a tick to run disconnect handlers / flushAndClean.
    await wait(150);
  });

  // ─── helpers ─────────────────────────────────────────────────────────────────
  function tokenFor(id: string, displayName: string, username: string) {
    return generateAccessToken(id, { displayName, username });
  }

  function connect(token?: string): ClientSocket {
    const c = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: token ? { token } : {},
    });
    clients.push(c);
    return c;
  }

  function wait(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  function once<T = any>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), timeoutMs);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  function connected(socket: ClientSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('connect timeout')), 3000);
      socket.once('connect', () => { clearTimeout(timer); resolve(); });
      socket.once('connect_error', (err) => { clearTimeout(timer); reject(err); });
    });
  }

  // Join a room and wait until it's actually ready to accept edits. The server
  // emits `doc:permission` BEFORE the Y.Doc room is created (there's an async DB
  // read in between) and `yjs:sync` AFTER — so a `yjs:update` sent right after
  // `doc:permission` can be dropped (`if (!room) return`). Waiting for `yjs:sync`
  // guarantees the room exists. Listeners are registered before emitting so the
  // events can't be missed. Returns the `doc:permission` payload.
  async function joinAndSync(socket: ClientSocket, docId: string, shareToken?: string) {
    const permP = once<{ docId: string; permission: string }>(socket, 'doc:permission');
    const syncP = once(socket, 'yjs:sync');
    socket.emit('doc:join', shareToken ? { docId, shareToken } : { docId });
    const [perm] = await Promise.all([permP, syncP]);
    return perm;
  }

  // Build a Y.js update (base64) that inserts `text` into the TipTap 'default'
  // XmlFragment, so plainTextFromDoc() will surface it in contentText.
  function makeUpdate(text: string): string {
    const d = new Y.Doc();
    const frag = d.getXmlFragment('default');
    const para = new Y.XmlElement('paragraph');
    const t = new Y.XmlText();
    t.insert(0, text);
    para.insert(0, [t]);
    frag.insert(0, [para]);
    return Buffer.from(Y.encodeStateAsUpdate(d)).toString('base64');
  }

  async function pollDoc(docId: string, predicate: (d: any) => boolean, timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const d = await CollabDocument.findById(docId).lean();
      if (d && predicate(d)) return d;
      await wait(50);
    }
    return CollabDocument.findById(docId).lean();
  }

  async function makeDoc(overrides: Record<string, unknown> = {}) {
    const doc = await CollabDocument.create({
      title: 'Socket Doc',
      ownerId,
      collaborators: [
        { userId: editorId, permission: 'edit' },
        { userId: viewerId, permission: 'view' },
      ],
      ...overrides,
    });
    return doc.id as string;
  }

  // ─── Auth middleware ───────────────────────────────────────────────────────────
  describe('handshake auth', () => {
    it('accepts a connection with a valid JWT', async () => {
      const c = connect(ownerToken);
      await expect(connected(c)).resolves.toBeUndefined();
      expect(c.connected).toBe(true);
    });

    it('rejects a connection with no token', async () => {
      const c = connect(undefined);
      await expect(connected(c)).rejects.toThrow(/Authentication required/);
    });

    it('rejects a connection with an invalid token', async () => {
      const c = connect('not-a-real-jwt');
      await expect(connected(c)).rejects.toThrow(/Invalid token/);
    });
  });

  // ─── doc:join authorization ────────────────────────────────────────────────────
  describe('doc:join authorization', () => {
    it('lets the owner join and returns owner permission + a sync payload', async () => {
      const docId = await makeDoc();
      const c = connect(ownerToken);
      await connected(c);

      const permP = once(c, 'doc:permission');
      const syncP = once(c, 'yjs:sync');
      c.emit('doc:join', { docId });

      await expect(permP).resolves.toEqual({ docId, permission: 'owner' });
      const sync = await syncP;
      expect(typeof sync.state).toBe('string'); // base64
    });

    it('gives an edit collaborator edit permission', async () => {
      const docId = await makeDoc();
      const c = connect(editorToken);
      await connected(c);
      c.emit('doc:join', { docId });
      await expect(once(c, 'doc:permission')).resolves.toEqual({ docId, permission: 'edit' });
    });

    it('gives a view collaborator view permission', async () => {
      const docId = await makeDoc();
      const c = connect(viewerToken);
      await connected(c);
      c.emit('doc:join', { docId });
      await expect(once(c, 'doc:permission')).resolves.toEqual({ docId, permission: 'view' });
    });

    it('denies a stranger with no share token (the IDOR fix)', async () => {
      const docId = await makeDoc();
      const c = connect(strangerToken);
      await connected(c);
      c.emit('doc:join', { docId });
      await expect(once(c, 'error')).resolves.toEqual({ message: 'Access denied' });
    });

    it('emits "Document not found" for a missing document', async () => {
      const c = connect(ownerToken);
      await connected(c);
      c.emit('doc:join', { docId: '507f1f77bcf86cd799439011' });
      await expect(once(c, 'error')).resolves.toEqual({ message: 'Document not found' });
    });

    it('grants a stranger the share-link permission when the correct token is presented', async () => {
      const docId = await makeDoc({ shareLink: 'secret-token', shareLinkPermission: 'edit' });
      const c = connect(strangerToken);
      await connected(c);
      c.emit('doc:join', { docId, shareToken: 'secret-token' });
      await expect(once(c, 'doc:permission')).resolves.toEqual({ docId, permission: 'edit' });
    });

    it('denies a stranger presenting a wrong share token', async () => {
      const docId = await makeDoc({ shareLink: 'secret-token', shareLinkPermission: 'edit' });
      const c = connect(strangerToken);
      await connected(c);
      c.emit('doc:join', { docId, shareToken: 'WRONG' });
      await expect(once(c, 'error')).resolves.toEqual({ message: 'Access denied' });
    });
  });

  // ─── yjs:update relay + write-gate ─────────────────────────────────────────────
  describe('yjs:update', () => {
    it('relays an editor\'s update to other participants', async () => {
      const docId = await makeDoc();
      const ownerC = connect(ownerToken);
      const editorC = connect(editorToken);
      await Promise.all([connected(ownerC), connected(editorC)]);

      await joinAndSync(ownerC, docId);
      await joinAndSync(editorC, docId);

      const relayed = once(ownerC, 'yjs:update');
      const update = makeUpdate('Hello from editor');
      editorC.emit('yjs:update', { docId, update });

      await expect(relayed).resolves.toEqual({ update });
    });

    it('does NOT relay a view-only participant\'s update (security gate)', async () => {
      const docId = await makeDoc();
      const ownerC = connect(ownerToken);
      const viewerC = connect(viewerToken);
      await Promise.all([connected(ownerC), connected(viewerC)]);

      await joinAndSync(ownerC, docId);
      await joinAndSync(viewerC, docId);

      let ownerGotUpdate = false;
      ownerC.on('yjs:update', () => { ownerGotUpdate = true; });

      viewerC.emit('yjs:update', { docId, update: makeUpdate('sneaky viewer edit') });
      await wait(400); // allow any (erroneous) relay to arrive

      expect(ownerGotUpdate).toBe(false);
    });

    it('persists an editor\'s content but NOT a view-only participant\'s content', async () => {
      // Editor writes, then leaves last → content flushed to DB.
      const docId = await makeDoc();
      const editorC = connect(editorToken);
      await connected(editorC);
      await joinAndSync(editorC, docId);
      editorC.emit('yjs:update', { docId, update: makeUpdate('Persisted editor text') });
      await wait(100);
      editorC.emit('doc:leave', { docId });

      const saved = await pollDoc(docId, (d) => !!d.contentText && d.contentText.includes('Persisted editor text'));
      expect(saved?.contentText).toContain('Persisted editor text');

      // Now a viewer joins the (now-clean) room and tries to write; it must be dropped.
      const viewerC = connect(viewerToken);
      await connected(viewerC);
      await joinAndSync(viewerC, docId);
      viewerC.emit('yjs:update', { docId, update: makeUpdate('VIEWER SHOULD NOT PERSIST') });
      await wait(100);
      viewerC.emit('doc:leave', { docId });
      await wait(300);

      const after = await CollabDocument.findById(docId).lean();
      expect(after?.contentText).not.toContain('VIEWER SHOULD NOT PERSIST');
      // The editor's earlier content survives.
      expect(after?.contentText).toContain('Persisted editor text');
    });
  });

  // ─── live permission changes (refreshDocPermissions) ──────────────────────────
  // Mirrors what the REST /share and /collaborators handlers do after a save:
  // re-evaluate everyone already in the room and push the change without a refresh.
  describe('live permission changes', () => {
    it('downgrades a live editor to view and stops honoring their edits', async () => {
      const docId = await makeDoc();
      const ownerC = connect(ownerToken);
      const editorC = connect(editorToken);
      await Promise.all([connected(ownerC), connected(editorC)]);
      await joinAndSync(ownerC, docId);
      await joinAndSync(editorC, docId);

      // Owner re-permissions the editor to view-only, then triggers a live refresh.
      await CollabDocument.findByIdAndUpdate(docId, {
        collaborators: [
          { userId: editorId, permission: 'view' },
          { userId: viewerId, permission: 'view' },
        ],
      });
      const permP = once(editorC, 'doc:permission');
      await refreshDocPermissions(docId);
      await expect(permP).resolves.toEqual({ docId, permission: 'view' });

      // The now-view-only editor's update must no longer be relayed (write-gate flipped).
      let ownerGotUpdate = false;
      ownerC.on('yjs:update', () => { ownerGotUpdate = true; });
      editorC.emit('yjs:update', { docId, update: makeUpdate('edit after downgrade') });
      await wait(400);
      expect(ownerGotUpdate).toBe(false);
    });

    it('upgrades a live viewer to edit and begins relaying their edits', async () => {
      const docId = await makeDoc();
      const ownerC = connect(ownerToken);
      const viewerC = connect(viewerToken);
      await Promise.all([connected(ownerC), connected(viewerC)]);
      await joinAndSync(ownerC, docId);
      await joinAndSync(viewerC, docId);

      await CollabDocument.findByIdAndUpdate(docId, {
        collaborators: [
          { userId: editorId, permission: 'edit' },
          { userId: viewerId, permission: 'edit' },
        ],
      });
      const permP = once(viewerC, 'doc:permission');
      await refreshDocPermissions(docId);
      await expect(permP).resolves.toEqual({ docId, permission: 'edit' });

      const relayed = once(ownerC, 'yjs:update');
      const update = makeUpdate('viewer now edits');
      viewerC.emit('yjs:update', { docId, update });
      await expect(relayed).resolves.toEqual({ update });
    });

    it('revokes a share-link viewer when link sharing is disabled', async () => {
      const docId = await makeDoc({ shareLink: 'live-token', shareLinkPermission: 'view' });
      const strangerC = connect(strangerToken);
      await connected(strangerC);
      await joinAndSync(strangerC, docId, 'live-token');

      await CollabDocument.findByIdAndUpdate(docId, { shareLink: null, shareLinkPermission: null });
      const revokedP = once(strangerC, 'doc:access-revoked');
      await refreshDocPermissions(docId);
      await expect(revokedP).resolves.toEqual({ docId });
    });
  });

  // ─── presence ──────────────────────────────────────────────────────────────────
  describe('presence (doc:awareness)', () => {
    it('broadcasts the deduped participant list on join', async () => {
      const docId = await makeDoc();
      const ownerC = connect(ownerToken);
      await connected(ownerC);
      ownerC.emit('doc:join', { docId });
      const awareness = await once<{ users: any[] }>(ownerC, 'doc:awareness');
      expect(awareness.users).toHaveLength(1);
      expect(awareness.users[0]).toEqual(
        expect.objectContaining({ id: ownerId, displayName: 'Owner' }),
      );
    });

    it('counts the same user in two tabs once (dedupe by user id)', async () => {
      const docId = await makeDoc();
      const tab1 = connect(ownerToken);
      const tab2 = connect(ownerToken);
      await Promise.all([connected(tab1), connected(tab2)]);

      tab1.emit('doc:join', { docId });
      await once(tab1, 'doc:awareness');

      const awarenessP = once<{ users: any[] }>(tab1, 'doc:awareness');
      tab2.emit('doc:join', { docId });
      const awareness = await awarenessP;
      expect(awareness.users).toHaveLength(1); // deduped
    });
  });

  // ─── Live cursor / typing / awareness relays ──────────────────────────────────
  describe('presence relays (cursor / typing / awareness)', () => {
    async function twoInRoom() {
      const docId = await makeDoc();
      const a = connect(ownerToken);
      const b = connect(editorToken);
      await Promise.all([connected(a), connected(b)]);
      await joinAndSync(a, docId);
      await joinAndSync(b, docId);
      return { docId, a, b };
    }

    it('relays cursor:move to the other participant with sender identity', async () => {
      const { docId, a, b } = await twoInRoom();
      const got = once<any>(b, 'cursor:update');
      a.emit('cursor:move', { docId, anchor: 3, head: 7 });
      const payload = await got;
      expect(payload).toEqual(expect.objectContaining({ userId: ownerId, anchor: 3, head: 7 }));
      expect(payload.color).toMatch(/^hsl\(/);
    });

    it('relays doc:typing to the other participant', async () => {
      const { docId, a, b } = await twoInRoom();
      const got = once<any>(b, 'doc:typing');
      a.emit('doc:typing', { docId });
      await expect(got).resolves.toEqual(expect.objectContaining({ userId: ownerId, displayName: 'Owner' }));
    });

    it('relays awareness:update (y-protocols) to the other participant', async () => {
      const { docId, a, b } = await twoInRoom();
      const got = once<any>(b, 'awareness:update');
      a.emit('awareness:update', { docId, update: 'BASE64AWARENESS' });
      await expect(got).resolves.toEqual({ update: 'BASE64AWARENESS' });
    });
  });

  // ─── Debounced auto-save (the setTimeout path, not doc:leave) ──────────────────
  describe('debounced auto-save', () => {
    it('emits doc:saved and persists after the debounce window', async () => {
      const docId = await makeDoc();
      const editorC = connect(editorToken);
      await connected(editorC);
      await joinAndSync(editorC, docId);

      const savedP = once<{ timestamp: string }>(editorC, 'doc:saved', 4000);
      editorC.emit('yjs:update', { docId, update: makeUpdate('debounced save text') });

      const saved = await savedP; // fires ~1.5s later
      expect(typeof saved.timestamp).toBe('string');

      const doc = await CollabDocument.findById(docId).lean();
      expect(doc?.contentText).toContain('debounced save text');
    });
  });
});
