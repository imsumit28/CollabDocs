import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

const CommandList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) props.command(item);
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-white rounded-[12px] shadow-apple-lg border border-[rgba(0,0,0,0.08)] py-2 min-w-[220px] max-h-[330px] overflow-y-auto anim-scale-in">
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
          <button
            key={index}
            className={`flex items-center gap-3 w-full text-left px-4 py-2.5 text-[14px] font-medium transition-colors ${
              index === selectedIndex ? 'bg-[#F5F5F7] text-[#1D1D1F]' : 'bg-transparent text-[#3A3A3C] hover:bg-[#F5F5F7]'
            }`}
            onClick={() => selectItem(index)}
          >
            <span className="text-[18px]">{item.icon}</span>
            <div>
              <div className="text-[13px] font-semibold text-[#1D1D1F]">{item.title}</div>
              <div className="text-[11px] text-[#8E8E93] mt-0.5">{item.description}</div>
            </div>
          </button>
        ))
      ) : (
        <div className="px-4 py-2 text-[13px] text-[#8E8E93]">No result</div>
      )}
    </div>
  );
});

CommandList.displayName = 'CommandList';

export default Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.action(editor, range);
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export const getSuggestionItems = () => {
  return [
    {
      title: 'Heading 1',
      description: 'Big section heading',
      icon: 'H1',
      action: (editor: any, range: any) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
      },
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading',
      icon: 'H2',
      action: (editor: any, range: any) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
      },
    },
    {
      title: 'Heading 3',
      description: 'Small section heading',
      icon: 'H3',
      action: (editor: any, range: any) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
      },
    },
    {
      title: 'Bullet List',
      description: 'Simple bulleted list',
      icon: '•',
      action: (editor: any, range: any) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: 'Numbered List',
      description: 'Ordered list with numbers',
      icon: '1.',
      action: (editor: any, range: any) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: 'To-do List',
      description: 'Track tasks with a list',
      icon: '☑',
      action: (editor: any, range: any) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: 'Table',
      description: 'Insert a table',
      icon: '▦',
      action: (editor: any, range: any) => {
        editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      },
    },
    {
      title: 'Image',
      description: 'Upload an image',
      icon: '🖼️',
      action: (editor: any, range: any) => {
        editor.chain().focus().deleteRange(range).run();
        window.dispatchEvent(new CustomEvent('collabdocs:insert-image'));
      },
    },
    {
      title: 'Code Block',
      description: 'Syntax highlighted code',
      icon: '</>',
      action: (editor: any, range: any) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: 'Quote',
      description: 'Capture a quotation',
      icon: '❝',
      action: (editor: any, range: any) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: 'Divider',
      description: 'Horizontal divider line',
      icon: '—',
      action: (editor: any, range: any) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: 'Math',
      description: 'Inline equation (KaTeX)',
      icon: '√x',
      action: (editor: any, range: any) => {
        editor.chain().focus().deleteRange(range).insertContent('$E = mc^2$').run();
      },
    },
    {
      title: 'Ask AI',
      description: 'Open the AI assistant',
      icon: '✨',
      action: (editor: any, range: any) => {
        editor.chain().focus().deleteRange(range).run();
        window.dispatchEvent(new CustomEvent('collabdocs:open-ai'));
      },
    },
  ];
};

export const renderItems = () => {
  let component: ReactRenderer;
  let popup: any;

  return {
    onStart: (props: any) => {
      component = new ReactRenderer(CommandList, {
        props,
        editor: props.editor,
      });

      if (!props.clientRect) {
        return;
      }

      popup = tippy('body', {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      });
    },

    onUpdate(props: any) {
      component.updateProps(props);

      if (!props.clientRect) {
        return;
      }

      popup[0].setProps({
        getReferenceClientRect: props.clientRect,
      });
    },

    onKeyDown(props: any) {
      if (props.event.key === 'Escape') {
        popup[0].hide();
        return true;
      }

      return (component.ref as any)?.onKeyDown(props);
    },

    onExit() {
      popup[0].destroy();
      component.destroy();
    },
  };
};
