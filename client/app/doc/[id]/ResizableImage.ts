// Custom block image node with a React NodeView that provides Google-Docs-style
// inline editing: select + resize handles, in-place non-destructive crop, a
// floating toolbar, rotate/flip, alignment, wrapping, width presets, and a
// caption. Reuses the node name `image` and an `img[src]` parse rule so images
// stored by the old @tiptap/extension-image keep loading (missing attrs fall
// back to schema defaults → they render uncropped/unrotated).
//
// Attribute values are flat primitives (numbers/booleans/strings) so they sync
// cleanly through y-prosemirror (Yjs stores them via ContentAny, preserving
// type). The data-* parseHTML/renderHTML pairs let crop metadata survive
// in-editor copy/paste and getHTML.
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ImageNodeView from './ImageNodeView';

export interface SetImageOptions {
  src: string;
  alt?: string;
  title?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      /** Insert an image at the current selection. */
      setImage: (options: SetImageOptions) => ReturnType;
    };
  }
}

// A numeric attribute persisted as a data-* string for HTML round-trips.
const numAttr = (name: string, def: number | null) => ({
  default: def,
  parseHTML: (el: HTMLElement) => {
    const v = el.getAttribute(`data-${name}`);
    if (v === null || v === '') return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  },
  renderHTML: (attrs: Record<string, any>) =>
    attrs[name] === null || attrs[name] === undefined
      ? {}
      : { [`data-${name}`]: String(attrs[name]) },
});

// A boolean attribute persisted as data-*="true" (absent when false).
const boolAttr = (name: string) => ({
  default: false,
  parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) === 'true',
  renderHTML: (attrs: Record<string, any>) =>
    attrs[name] ? { [`data-${name}`]: 'true' } : {},
});

export const ResizableImage = Node.create({
  name: 'image',
  group: 'block',
  draggable: true,
  selectable: true,
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      caption: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-caption') || '',
        renderHTML: (attrs: Record<string, any>) =>
          attrs.caption ? { 'data-caption': attrs.caption } : {},
      },
      // Display width in px of the visible (cropped) image; null = intrinsic.
      width: numAttr('width', null),
      fullWidth: boolAttr('fullWidth'),
      align: {
        default: 'center',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-align') || 'center',
        renderHTML: (attrs: Record<string, any>) => ({ 'data-align': attrs.align }),
      },
      wrap: {
        default: 'none',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-wrap') || 'none',
        renderHTML: (attrs: Record<string, any>) => ({ 'data-wrap': attrs.wrap }),
      },
      // Non-destructive crop as normalized fractions of the natural image.
      cropX: numAttr('cropX', 0),
      cropY: numAttr('cropY', 0),
      cropW: numAttr('cropW', 1),
      cropH: numAttr('cropH', 1),
      rotate: numAttr('rotate', 0),
      flipH: boolAttr('flipH'),
      flipV: boolAttr('flipV'),
      round: boolAttr('round'),
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },

  addCommands() {
    return {
      setImage:
        (options: SetImageOptions) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
    };
  },
});

export default ResizableImage;
