import * as Y from 'yjs';
import { Socket } from 'socket.io-client';
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';

export class SocketIOProvider {
  public awareness: Awareness;
  private _docId: string;
  private _socket: Socket;
  private _synced: boolean = false;

  private _onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === 'remote') return;
    const changedClients = added.concat(updated, removed);
    const update = encodeAwarenessUpdate(this.awareness, changedClients);
    const encoded = Buffer.from(update).toString('base64');
    this._socket.emit('awareness:update', { docId: this._docId, update: encoded });
  };

  private _onBeforeUnload = () => {
    removeAwarenessStates(this.awareness, [this.awareness.clientID], 'window unload');
  };

  constructor(doc: Y.Doc, socket: Socket, docId: string) {
    this.awareness = new Awareness(doc);
    this._docId = docId;
    this._socket = socket;

    // Send Y.js updates to server
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === this) return; // don't echo back
      const encoded = Buffer.from(update).toString('base64');
      socket.emit('yjs:update', { docId, update: encoded });
    });

    // Receive initial state sync
    socket.on('yjs:sync', ({ state }: { state: string }) => {
      const uint8 = new Uint8Array(Buffer.from(state, 'base64'));
      Y.applyUpdate(doc, uint8, this);
      this._synced = true;
    });

    // Receive incremental updates
    socket.on('yjs:update', ({ update }: { update: string }) => {
      const uint8 = new Uint8Array(Buffer.from(update, 'base64'));
      Y.applyUpdate(doc, uint8, this);
    });

    // Handle version restore reset
    socket.on('yjs:reset', ({ state }: { state: string }) => {
      const uint8 = new Uint8Array(Buffer.from(state, 'base64'));
      Y.applyUpdate(doc, uint8, this);
    });

    // ── Awareness (cursors / presence) ──
    this.awareness.on('update', this._onAwarenessUpdate);

    socket.on('awareness:update', ({ update }: { update: string }) => {
      const uint8 = new Uint8Array(Buffer.from(update, 'base64'));
      applyAwarenessUpdate(this.awareness, uint8, 'remote');
    });

    socket.on('awareness:sync', ({ update }: { update: string }) => {
      const uint8 = new Uint8Array(Buffer.from(update, 'base64'));
      applyAwarenessUpdate(this.awareness, uint8, 'remote');
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this._onBeforeUnload);
    }
  }

  get synced(): boolean { return this._synced; }

  destroy(): void {
    removeAwarenessStates(this.awareness, [this.awareness.clientID], 'provider destroy');
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this._onBeforeUnload);
    }
    this.awareness.off('update', this._onAwarenessUpdate);
    this._socket.emit('doc:leave', { docId: this._docId });
    this._socket.off('yjs:sync');
    this._socket.off('yjs:update');
    this._socket.off('yjs:reset');
    this._socket.off('awareness:update');
    this._socket.off('awareness:sync');
    this.awareness.destroy();
  }
}
