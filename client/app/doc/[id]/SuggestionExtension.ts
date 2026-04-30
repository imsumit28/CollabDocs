import { Mark, mergeAttributes } from '@tiptap/core';

export const SuggestionMark = Mark.create({
  name: 'suggestion',

  addAttributes() {
    return {
      type: {
        default: 'add',
        parseHTML: (element) => element.getAttribute('data-type'),
        renderHTML: (attributes) => ({
          'data-type': attributes.type,
        }),
      },
      user: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="add"]' }, { tag: 'span[data-type="delete"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-type'];
    const extraClass = type === 'add' ? 'suggestion-add' : 'suggestion-delete';
    return ['span', mergeAttributes(HTMLAttributes, { class: extraClass }), 0];
  },
});
