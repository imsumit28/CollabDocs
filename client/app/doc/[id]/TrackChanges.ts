import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// Module-level flag so React state changes are reflected immediately without
// recreating the editor or the extension. The editor is a singleton per page.
let _enabled = false;
export function setTrackChangesEnabled(enabled: boolean) {
  _enabled = enabled;
}

export const TrackChanges = Extension.create({
  name: 'trackChanges',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('trackChanges'),
        props: {
          handleKeyDown: (view, event) => {
            if (!_enabled) return false;

            if (event.key === 'Backspace' || event.key === 'Delete') {
              const { selection } = view.state;
              if (selection.empty) return false;
              view.dispatch(
                view.state.tr.addMark(
                  selection.from,
                  selection.to,
                  view.state.schema.marks.suggestion.create({ type: 'delete' })
                )
              );
              return true;
            }
            return false;
          },
          handleTextInput: (view, from, to, text) => {
            if (!_enabled) return false;
            const { tr } = view.state;
            tr.insertText(text, from, to);
            tr.addMark(from, from + text.length, view.state.schema.marks.suggestion.create({ type: 'add' }));
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});
