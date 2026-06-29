# Design Decisions

The architectural trade-offs behind CollabDocs, and the reasoning for each. For the structural overview (diagrams, data flow, directory layout) see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 1. Y.js CRDT instead of Operational Transformation

The central architecture question for any collaborative editor is: how do you merge concurrent edits?

| | OT (Google Docs approach) | CRDT (CollabDocs) |
|---|---|---|
| Conflict resolution | Server serialises all ops, transforms concurrent ones | Each client merges independently — always converges |
| Server role | Central arbiter required | Dumb relay — no conflict logic needed |
| Offline support | Hard — requires reconnect protocol | Built-in — merge on reconnect automatically |
| Horizontal scaling | Difficult without sticky sessions | Easier in principle — deltas are commutative — though this app's server still holds per-instance state (see note below) |

**Why CRDT:** The server is mostly a relay. It applies deltas to an in-memory `Y.Doc` and broadcasts them, with no conflict-resolution logic. The CRDT model *makes* horizontal scaling tractable (deltas commute, so order doesn't matter), but this implementation still keeps an authoritative `Y.Doc` per instance for persistence — so it targets a single backend instance today. See [Design Decision 4](#4-single-instance-real-time-with-a-redis-adapter-for-event-fan-out) for what multi-instance would require.

**How conflicts resolve in practice:**

```
Initial:  "Hello"
User A (offline): inserts " World" at pos 5  →  "Hello World"
User B (offline): inserts " There" at pos 5  →  "Hello There"

After sync: both clients converge to "Hello World There"
(peer ID ordering determines sequence — same result everywhere)
```

Insertions never destroy each other. Deletions become tombstones internally. Cursor positions are Y.js *relative positions* (anchored to a character identity, not an index), so remote edits never misplace your cursor.

---

## 2. JWT in memory + HttpOnly refresh cookies

Storing JWTs in `localStorage` means any XSS payload can exfiltrate them. The strategy here:

- **Access token (15 min)** — held in React state only. Never written to the DOM or storage. Lost on page refresh (by design).
- **Refresh token (7 days)** — stored in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. JavaScript cannot read it; the browser sends it automatically.

On page load the client silently calls `/api/auth/refresh` — the browser sends the cookie, the server returns a new access token in the JSON body. This gives the "stay logged in" UX without exposing credentials to JS.

---

## 3. Debounced MongoDB writes (5 s)

Naive approach: write to the database on every keystroke. At 5 chars/second, that's 300 writes/minute per active user.

CollabDocs instead keeps a per-room `Y.Doc` in memory and resets a 5-second debounce timer on every update. On expiry, one write happens. This bounds write amplification to **≤ 12 writes/minute regardless of typing speed** while keeping data loss risk to ≤ 5 seconds of edits.

---

## 4. Single-instance real-time, with a Redis adapter for event fan-out

The app is designed to run as a **single backend instance** (Render free tier), and that's the configuration it's correct for.

`@socket.io/redis-adapter` is integrated and activates automatically when `REDIS_URL` is set. It solves *one* part of multi-instance scaling — Socket.IO event fan-out, so presence and relayed updates reach sockets connected to other instances.

**It does not, by itself, make the app safe to run on multiple instances.** Each instance keeps its own authoritative `Y.Doc` for a document in memory and only applies the updates from sockets connected to *that* instance, then debounce-persists the whole state to MongoDB. With two instances editing the same document, their in-memory copies diverge and the periodic save becomes last-writer-wins — edits can be lost.

True horizontal scaling would require one of:
- **Sticky routing per document** (all sockets for a given doc land on the same instance), or
- **A shared Y.js persistence/sync layer** (e.g. a dedicated y-websocket/y-redis service that owns the authoritative document) so no single app instance holds private state.

Both are out of scope for the free single-instance deployment; this is called out honestly rather than claimed as "scale by adding an env var."

---

## 5. TipTap (ProseMirror) over Slate or Quill

TipTap has a first-class `y-prosemirror` binding for Y.js CRDT sync, and its extension system made building comments, suggestions mode, slash commands, and @mentions straightforward. Slate would have required building the Y.js binding from scratch. Quill is significantly more constrained for custom extensions.
