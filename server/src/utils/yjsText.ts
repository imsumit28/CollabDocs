import * as Y from 'yjs';

// Cap the stored/searchable text so a huge document can't bloat the DB row.
const MAX_TEXT_LENGTH = 50_000;

function collect(el: Y.XmlElement | Y.XmlFragment): string {
  let out = '';
  el.toArray().forEach((child) => {
    if (child instanceof Y.XmlText) {
      out += child.toString() + ' ';
    } else if (child instanceof Y.XmlElement) {
      out += collect(child) + ' ';
    }
  });
  return out;
}

/** Extract a plain-text representation of a TipTap/ProseMirror Y.Doc. */
export function plainTextFromDoc(ydoc: Y.Doc): string {
  const frag = ydoc.getXmlFragment('default');
  return collect(frag).replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH);
}

/** Extract plain text from an encoded Y.js state buffer. */
export function plainTextFromState(state: Buffer | Uint8Array): string {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, new Uint8Array(state));
  return plainTextFromDoc(ydoc);
}
