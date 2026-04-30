import * as Y from 'yjs';
import { Socket } from 'socket.io-client';
import { Awareness } from 'y-protocols/awareness';

export class SocketIOProvider {
  public awareness: Awareness;
  private _docId: string;
  private _socket: Socket;
  private _synced: boolean = false;

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
  }

  get synced(): boolean { return this._synced; }

  destroy(): void {
    this._socket.emit('doc:leave', { docId: this._docId });
    this._socket.off('yjs:sync');
    this._socket.off('yjs:update');
    this._socket.off('yjs:reset');
    this.awareness.destroy();
  }
}
