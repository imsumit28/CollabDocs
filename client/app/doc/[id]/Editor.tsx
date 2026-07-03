'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent, ReactRenderer, BubbleMenu } from '@tiptap/react';
import { Mark, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import ResizableImage from './ResizableImage';
import Mathematics from '@tiptap/extension-mathematics';
import 'katex/dist/katex.min.css';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { getSocket } from '../../../lib/socket';
import { SocketIOProvider } from '../../../lib/SocketIOProvider';
import { api } from '../../../lib/api';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { common, createLowlight } from 'lowlight';
import SlashCommands, { getSuggestionItems, renderItems } from './slashCommands';
import Mention from '@tiptap/extension-mention';
import tippy from 'tippy.js';
import { MentionList } from './MentionList';
import { CommentSidebar } from './CommentSidebar';
import { CommentMark } from './CommentExtension';
import { SuggestionMark } from './SuggestionExtension';
import { TrackChanges, setTrackChangesEnabled } from './TrackChanges';

const lowlight = createLowlight(common);

const OUTLINE_INDENT_CLASSES = [
  'pl-2',
  'pl-5',
  'pl-8',
  'pl-[44px]',
  'pl-[56px]',
  'pl-[68px]',
];

// ─── AI Icons ─────────────────────────────────────────────────────────────────
const IconPanelOpen = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2H3V4Zm0 3h18v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Zm2 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>
  </svg>
);

const IconImproveWriting = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconFixGrammar = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 12l2 2 4-4m6 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconSummarize = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 11h6M9 15h6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconExpand = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4M9 12h6M12 9v6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconSimplify = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 6h16M4 10h10M4 14h7M4 18h5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconTone = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.522 4.82 3.889 6.185L6 20l4.008-2.14A10.23 10.23 0 0 0 12 18c4.97 0 9-3.185 9-7.115C21 6.955 16.97 3 12 3Z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconOutline = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 6h2M4 12h2M4 18h2M8 6h12M8 12h8M8 18h5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconBrainstorm = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9.663 17h4.673M12 3v1M6.268 6.27 5.5 5.5M17.73 6.27l.77-.77M21 13h-1M4 13H3M10 17v1a2 2 0 0 0 4 0v-1M12 5a5 5 0 0 1 5 5c0 1.777-.93 3.337-2.336 4.235A1.98 1.98 0 0 0 14 16H10a1.98 1.98 0 0 0-.964-.265C7.93 15.337 7 13.777 7 12a5 5 0 0 1 5-5Z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconTranslate = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="m5 8 6 6M4 14l6-6 2-3M2 5h7M10 5h2M12 20l4-9 4 9M19.1 18h-6.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconTitle = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 6h16M4 12h8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2"/>
  </svg>
);

function getOutlineIndentClass(level: number): string {
  const index = Math.max(0, Math.min(OUTLINE_INDENT_CLASSES.length - 1, level - 1));
  return OUTLINE_INDENT_CLASSES[index];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (fontFamily: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
    };
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    textColor: {
      setTextColor: (color: string) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
  }
}

const FontFamily = Mark.create({
  name: 'fontFamily',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (element) => element.style.fontFamily?.replace(/['"]/g, ''),
        renderHTML: (attributes) => {
          if (!attributes.fontFamily) return {};
          return { style: `font-family: ${attributes.fontFamily}` };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[style*="font-family"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFontFamily:
        (fontFamily: string) =>
        ({ commands }) => commands.setMark(this.name, { fontFamily }),
      unsetFontFamily:
        () =>
        ({ commands }) => commands.unsetMark(this.name),
    };
  },
});

const FontSize = Mark.create({
  name: 'fontSize',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[style*="font-size"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ commands }) => commands.setMark(this.name, { fontSize }),
      unsetFontSize:
        () =>
        ({ commands }) => commands.unsetMark(this.name),
    };
  },
});

const TextColor = Mark.create({
  name: 'textColor',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        renderHTML: (attributes) => {
          if (!attributes.color) return {};
          return { style: `color: ${attributes.color}` };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span', getAttrs: (el) => ((el as HTMLElement).style.color ? {} : false) }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTextColor:
        (color: string) =>
        ({ commands }) => commands.setMark(this.name, { color }),
      unsetTextColor:
        () =>
        ({ commands }) => commands.unsetMark(this.name),
    };
  },
});

const FONT_OPTIONS = [
  { label: 'System', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Courier', value: '"Courier New", Courier, monospace' },
  { label: 'Trebuchet', value: '"Trebuchet MS", sans-serif' },
  { label: 'Comic Sans', value: '"Comic Sans MS", cursive' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
  { label: 'Palatino', value: '"Palatino Linotype", Palatino, "Book Antiqua", serif' },
  { label: 'Garamond', value: 'Garamond, "Times New Roman", serif' },
  { label: 'Cambria', value: 'Cambria, Georgia, serif' },
  { label: 'Calibri', value: 'Calibri, "Segoe UI", Arial, sans-serif' },
  { label: 'Consolas', value: 'Consolas, "Courier New", monospace' },
  { label: 'Lucida Sans', value: '"Lucida Sans Unicode", "Lucida Grande", sans-serif' },
  { label: 'Lucida Console', value: '"Lucida Console", Monaco, monospace' },
  { label: 'Segoe UI', value: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' },
  { label: 'Gill Sans', value: '"Gill Sans", "Gill Sans MT", Calibri, sans-serif' },
  { label: 'Optima', value: 'Optima, Candara, "Segoe UI", sans-serif' },
  { label: 'Franklin Gothic', value: '"Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif' },
  { label: 'Century Gothic', value: '"Century Gothic", CenturyGothic, AppleGothic, sans-serif' },
  { label: 'Baskerville', value: 'Baskerville, "Times New Roman", serif' },
  { label: 'Didot', value: 'Didot, "Bodoni MT", "Times New Roman", serif' },
  { label: 'Futura', value: 'Futura, "Trebuchet MS", Arial, sans-serif' },
  { label: 'Roboto', value: 'Roboto, "Helvetica Neue", Arial, sans-serif' },
  { label: 'Open Sans', value: '"Open Sans", "Segoe UI", Arial, sans-serif' },
  { label: 'Lato', value: 'Lato, "Helvetica Neue", Arial, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, "Segoe UI", Arial, sans-serif' },
  { label: 'Merriweather', value: 'Merriweather, Georgia, serif' },
  { label: 'Source Sans 3', value: '"Source Sans 3", "Segoe UI", Arial, sans-serif' },
  { label: 'Source Serif 4', value: '"Source Serif 4", Georgia, serif' },
  { label: 'Nunito', value: 'Nunito, "Segoe UI", Arial, sans-serif' },
  { label: 'Poppins', value: 'Poppins, "Segoe UI", Arial, sans-serif' },
];

const SIZE_OPTIONS = [
  { label: 'Size', value: '' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '15', value: '15px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '28', value: '28px' },
  { label: '32', value: '32px' },
];

const TEXT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Gray',    value: '#6E6E73' },
  { name: 'Brown',   value: '#A2845E' },
  { name: 'Red',     value: '#FF3B30' },
  { name: 'Orange',  value: '#FF9500' },
  { name: 'Amber',   value: '#B8860B' },
  { name: 'Green',   value: '#1A7F37' },
  { name: 'Teal',    value: '#0C8599' },
  { name: 'Blue',    value: '#007AFF' },
  { name: 'Indigo',  value: '#5856D6' },
  { name: 'Purple',  value: '#AF52DE' },
  { name: 'Pink',    value: '#FF2D55' },
];

const HIGHLIGHT_COLORS = [
  { name: 'None',   value: '' },
  { name: 'Yellow', value: '#FEF08A' },
  { name: 'Green',  value: '#BBF7D0' },
  { name: 'Blue',   value: '#BFDBFE' },
  { name: 'Purple', value: '#E9D5FF' },
  { name: 'Pink',   value: '#FBCFE8' },
  { name: 'Orange', value: '#FED7AA' },
  { name: 'Red',    value: '#FECACA' },
  { name: 'Gray',   value: '#E5E7EB' },
];

const EMOJIS = [
  '😀','😄','😂','🥹','😊','😍','🤩','😎',
  '🤔','😅','😢','😭','😡','🥳','🤯','😴',
  '👍','👎','👏','🙏','💪','🤝','👀','💡',
  '🔥','⭐','✨','🎉','🎯','🚀','✅','❌',
  '⚠️','❗','❓','💬','📌','📎','📅','⏰',
  '💯','❤️','🧡','💛','💚','💙','💜','🤍',
];

function relativeTime(d: Date): string {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return d.toLocaleDateString();
}

// Shared icon-button styling for the toolbar (26×26, active = blue fill)
const ibtnClass = (active?: boolean) =>
  `w-[26px] h-[26px] flex items-center justify-center rounded-[5px] transition-all duration-150 flex-shrink-0 border ${
    active
      ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-sm'
      : 'text-[#44454A] border-[rgba(0,0,0,0.10)] bg-white hover:bg-[#EBEBEF] hover:text-[#1D1D1F] hover:border-[rgba(0,0,0,0.18)]'
  }`;

// Popover anchored to a toolbar button. Defined at module level so its open
// state survives Toolbar re-renders on every editor transaction.
function ToolbarPopover({ label, active, button, panelClassName, children }: {
  label: string;
  active?: boolean;
  button: React.ReactNode;
  panelClassName?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        title={label}
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className={ibtnClass(active || open)}
      >
        {button}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={(e) => { e.preventDefault(); setOpen(false); }} />
          <div
            className={`absolute top-full left-0 mt-1.5 z-50 bg-white rounded-[12px] shadow-apple-lg border border-[rgba(0,0,0,0.08)] p-2 anim-pop ${panelClassName || ''}`}
            onMouseDown={(e) => e.preventDefault()}
          >
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}

function userColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 55%)`;
}

function getUserLabel(u: any): string {
  return u?.username || u?.displayName || 'Anonymous';
}

function Toolbar({
  editor,
  onAiToggle,
  onVersionsToggle,
  onCommentsToggle,
  onImageUpload,
  commentCount,
  suggestionMode,
  onSuggestionToggle,
  onAcceptAll,
  onRejectAll,
}: {
  editor: any;
  onAiToggle: () => void;
  onVersionsToggle: () => void;
  onCommentsToggle: () => void;
  onImageUpload: () => void;
  commentCount: number;
  suggestionMode: boolean;
  onSuggestionToggle: () => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}) {
  // Mobile: advanced groups collapse behind a "⋯" toggle
  const [moreOpen, setMoreOpen] = useState(false);

  if (!editor) return null;

  // Tooltip
  const Tip = ({ children, label }: { children: React.ReactNode; label: string }) => (
    <div className="relative group inline-flex flex-shrink-0">
      {children}
      <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded-md bg-[#1D1D1F] px-2 py-[3px] text-[11px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-[70] shadow-lg">
        {label}
      </span>
    </div>
  );

  // Icon button — 26×26 touch target, active = blue fill
  const IBtn = ({ children, action, active, label }: {
    children: React.ReactNode; action: () => void; active?: boolean; label: string;
  }) => (
    <Tip label={label}>
      <button
        type="button"
        title={label}
        onMouseDown={(e) => { e.preventDefault(); action(); }}
        className={ibtnClass(active)}
      >
        {children}
      </button>
    </Tip>
  );

  const Sep = () => <div className="w-px h-4 bg-[rgba(0,0,0,0.09)] mx-[3px] flex-shrink-0" />;

  const currentStyle =
    editor.isActive('heading', { level: 1 }) ? 'h1' :
    editor.isActive('heading', { level: 2 }) ? 'h2' :
    editor.isActive('heading', { level: 3 }) ? 'h3' : 'p';

  const setStyle = (val: string) => {
    if (val === 'p') editor.chain().focus().setParagraph().run();
    else editor.chain().focus().toggleHeading({ level: Number(val[1]) as 1|2|3 }).run();
  };

  const setLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL', prev || 'https://');
    if (url === null) return;
    if (!url) { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url, target: '_blank' }).run();
  };

  // Wrap the selection (or a sample) in $…$ so the Mathematics extension renders it
  const insertMath = () => {
    const { from, to } = editor.state.selection;
    const sel = editor.state.doc.textBetween(from, to, ' ');
    const latex = sel.trim() || 'E = mc^2';
    editor.chain().focus().insertContentAt({ from, to }, `$${latex}$`).run();
  };

  const adv = moreOpen ? 'flex' : 'hidden sm:flex';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-0.5 sm:px-3 border-b border-[rgba(0,0,0,0.07)] bg-white/95 backdrop-blur-sm sm:min-h-[42px]">

      {/* Formatting tools — wrap under ⋯ More on mobile, scroll on desktop */}
      <div className="flex items-center px-3 sm:px-0 py-1.5 sm:py-0 flex-1 min-w-0 sm:overflow-x-auto sm:min-h-[42px]">
        {/* Big box wrapping all formatting tools */}
        <div className="flex items-center gap-0.5 border border-[rgba(0,0,0,0.10)] rounded-[8px] bg-[#F5F5F7] px-1.5 py-1 flex-wrap sm:flex-nowrap flex-1 sm:flex-none">

        {/* Group 1 — History */}
        <IBtn label="Undo (⌘Z)" action={() => editor.chain().focus().undo().run()}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6m-6-6l6-6" /></svg>
        </IBtn>
        <IBtn label="Redo (⌘⇧Z)" action={() => editor.chain().focus().redo().run()}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 0 0-8 8v2m18-10l-6 6m6-6l-6-6" /></svg>
        </IBtn>

        <Sep />

        {/* Group 2 — Text style */}
        <select
          title="Paragraph style"
          value={currentStyle}
          onChange={(e) => setStyle(e.target.value)}
          className="h-[26px] w-[94px] rounded-[5px] text-[12px] font-semibold text-[#1D1D1F] bg-white border border-[rgba(0,0,0,0.10)] hover:bg-[#EBEBEF] hover:border-[rgba(0,0,0,0.18)] px-1.5 outline-none cursor-pointer flex-shrink-0 transition-colors appearance-none"
        >
          <option value="p">Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        {/* Heading shortcuts */}
        <div className={`items-center gap-0.5 ${adv}`}>
          <IBtn label="Heading 1" active={editor.isActive('heading', { level: 1 })} action={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <span className="text-[11px] font-bold leading-none">H1</span>
          </IBtn>
          <IBtn label="Heading 2" active={editor.isActive('heading', { level: 2 })} action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <span className="text-[11px] font-bold leading-none">H2</span>
          </IBtn>
          <IBtn label="Heading 3" active={editor.isActive('heading', { level: 3 })} action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <span className="text-[11px] font-bold leading-none">H3</span>
          </IBtn>
        </div>

        {/* Group 3 — Font family & size */}
        <div className={`items-center gap-0.5 ${adv}`}>
          <Sep />
          <select
            title="Font family"
            value={editor.getAttributes('fontFamily').fontFamily || ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v) editor.chain().focus().setFontFamily(v).run();
              else editor.chain().focus().unsetFontFamily().run();
            }}
            className="h-[26px] w-[88px] rounded-[5px] text-[11px] text-[#3A3A3C] bg-white border border-[rgba(0,0,0,0.10)] hover:bg-[#EBEBEF] hover:border-[rgba(0,0,0,0.18)] px-1 outline-none cursor-pointer flex-shrink-0 transition-colors appearance-none truncate"
          >
            {FONT_OPTIONS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
          </select>
          <select
            title="Font size"
            value={editor.getAttributes('fontSize').fontSize || ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v) editor.chain().focus().setFontSize(v).run();
              else editor.chain().focus().unsetFontSize().run();
            }}
            className="h-[26px] w-[56px] rounded-[5px] text-[11px] text-[#3A3A3C] bg-white border border-[rgba(0,0,0,0.10)] hover:bg-[#EBEBEF] hover:border-[rgba(0,0,0,0.18)] px-1 outline-none cursor-pointer flex-shrink-0 transition-colors appearance-none"
          >
            {SIZE_OPTIONS.map((s) => <option key={s.label} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <Sep />

        {/* Group 4 — Inline marks & colors */}
        <IBtn label="Bold (⌘B)" active={editor.isActive('bold')} action={() => editor.chain().focus().toggleBold().run()}>
          <span className="text-[13px] font-black leading-none">B</span>
        </IBtn>
        <IBtn label="Italic (⌘I)" active={editor.isActive('italic')} action={() => editor.chain().focus().toggleItalic().run()}>
          <span className="text-[13px] italic font-semibold leading-none font-serif">I</span>
        </IBtn>
        <IBtn label="Underline (⌘U)" active={editor.isActive('underline')} action={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="text-[13px] underline font-semibold leading-none">U</span>
        </IBtn>
        <IBtn label="Strikethrough" active={editor.isActive('strike')} action={() => editor.chain().focus().toggleStrike().run()}>
          <span className="text-[13px] line-through font-semibold leading-none">S</span>
        </IBtn>
        <div className={`items-center gap-0.5 ${adv}`}>
          <ToolbarPopover
            label="Text color"
            active={!!editor.getAttributes('textColor').color}
            panelClassName="w-[172px]"
            button={
              <span className="flex flex-col items-center justify-center leading-none">
                <span className="text-[11px] font-bold leading-none">A</span>
                <span className="w-3.5 h-[3px] rounded-sm mt-[1px]" style={{ backgroundColor: editor.getAttributes('textColor').color || '#1D1D1F' }} />
              </span>
            }
          >
            {(close) => (
              <div className="grid grid-cols-6 gap-1">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    title={c.name}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (c.value) editor.chain().focus().setTextColor(c.value).run();
                      else editor.chain().focus().unsetTextColor().run();
                      close();
                    }}
                    className={`w-6 h-6 rounded-[6px] flex items-center justify-center text-[12px] font-bold border transition-colors duration-150 hover:bg-[#F5F5F7] ${
                      (editor.getAttributes('textColor').color || '') === c.value ? 'border-[#007AFF]' : 'border-transparent'
                    }`}
                    style={{ color: c.value || '#1D1D1F' }}
                  >
                    A
                  </button>
                ))}
              </div>
            )}
          </ToolbarPopover>
          <ToolbarPopover
            label="Highlight color"
            active={editor.isActive('highlight')}
            panelClassName="w-[152px]"
            button={
              <span
                className="w-4 h-4 rounded-[4px] border border-[rgba(0,0,0,0.15)] flex items-center justify-center text-[10px] font-bold text-[#1D1D1F]"
                style={{ backgroundColor: editor.getAttributes('highlight').color || '#FEF08A' }}
              >
                A
              </span>
            }
          >
            {(close) => (
              <div className="grid grid-cols-5 gap-1">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    title={c.name}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (c.value) editor.chain().focus().setHighlight({ color: c.value }).run();
                      else editor.chain().focus().unsetHighlight().run();
                      close();
                    }}
                    className={`w-6 h-6 rounded-[6px] border flex items-center justify-center transition-transform duration-150 hover:scale-110 ${
                      (editor.getAttributes('highlight').color || '') === c.value ? 'border-[#007AFF]' : 'border-[rgba(0,0,0,0.10)]'
                    }`}
                    style={{ backgroundColor: c.value || '#FFFFFF' }}
                  >
                    {!c.value && (
                      <svg className="w-3.5 h-3.5 text-[#FF3B30]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ToolbarPopover>
        </div>

        {/* Group 5 — Alignment */}
        <div className={`items-center gap-0.5 ${adv}`}>
          <Sep />
          <IBtn label="Align left" active={editor.isActive({ textAlign: 'left' })} action={() => editor.chain().focus().setTextAlign('left').run()}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 12h11M3 18h14" /></svg>
          </IBtn>
          <IBtn label="Align center" active={editor.isActive({ textAlign: 'center' })} action={() => editor.chain().focus().setTextAlign('center').run()}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M6 12h12M4.5 18h15" /></svg>
          </IBtn>
          <IBtn label="Align right" active={editor.isActive({ textAlign: 'right' })} action={() => editor.chain().focus().setTextAlign('right').run()}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M10 12h11M7 18h14" /></svg>
          </IBtn>
        </div>

        {/* Group 6 — Lists, quote & code */}
        <div className={`items-center gap-0.5 ${adv}`}>
          <Sep />
          <IBtn label="Bullet list" active={editor.isActive('bulletList')} action={() => editor.chain().focus().toggleBulletList().run()}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
          </IBtn>
          <IBtn label="Numbered list" active={editor.isActive('orderedList')} action={() => editor.chain().focus().toggleOrderedList().run()}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4a1 1 0 0 1 0-2h1a1 1 0 0 0 0-2H4" /></svg>
          </IBtn>
          <IBtn label="Task list" active={editor.isActive('taskList')} action={() => editor.chain().focus().toggleTaskList().run()}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" /></svg>
          </IBtn>
          <IBtn label="Blockquote" active={editor.isActive('blockquote')} action={() => editor.chain().focus().toggleBlockquote().run()}>
            <span className="text-[15px] leading-none font-serif mt-1">❝</span>
          </IBtn>
          <IBtn label="Inline code" active={editor.isActive('code')} action={() => editor.chain().focus().toggleCode().run()}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l-3 3 3 3m8-6l3 3-3 3" /></svg>
          </IBtn>
        </div>

        {/* Group 7 — Insert */}
        <div className={`items-center gap-0.5 ${adv}`}>
          <Sep />
          <IBtn label="Insert link" active={editor.isActive('link')} action={setLink}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1" /></svg>
          </IBtn>
          <IBtn label="Insert image" action={onImageUpload}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </IBtn>
          <IBtn label="Insert table" action={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm7-3v18" /></svg>
          </IBtn>
          <IBtn label="Horizontal divider" action={() => editor.chain().focus().setHorizontalRule().run()}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M4 12h16M12 5v.01M12 19v.01" /></svg>
          </IBtn>
          <IBtn label="Code block" active={editor.isActive('codeBlock')} action={() => editor.chain().focus().toggleCodeBlock().run()}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </IBtn>
          <ToolbarPopover
            label="Emoji"
            panelClassName="w-[252px]"
            button={
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            }
          >
            {(close) => (
              <div className="grid grid-cols-8 gap-0.5 max-h-[176px] overflow-y-auto">
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().insertContent(em).run(); close(); }}
                    className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[16px] hover:bg-[#F5F5F7] transition-colors duration-150"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </ToolbarPopover>
          <IBtn label="Equation (KaTeX)" action={insertMath}>
            <span className="text-[11px] font-semibold leading-none">√x</span>
          </IBtn>
        </div>

        {/* Mobile-only overflow toggle */}
        <button
          type="button"
          title={moreOpen ? 'Fewer tools' : 'More tools'}
          onMouseDown={(e) => { e.preventDefault(); setMoreOpen((v) => !v); }}
          className={`${ibtnClass(moreOpen)} sm:hidden ml-auto`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2.5} d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
        </button>

        </div>{/* end big box */}
      </div>

      {/* Action buttons — second row on mobile, inline on desktop */}
      <div className="flex items-center gap-0.5 flex-shrink-0 px-3 sm:px-0 border-t sm:border-t-0 border-[rgba(0,0,0,0.07)] min-h-[38px] sm:min-h-0 overflow-x-auto">
        {/* Spacer in right section */}
        <div className="w-1" />

        {/* Suggestion mode toggle */}
        <Tip label={suggestionMode ? 'Suggesting — click to switch back' : 'Switch to suggestion mode (Track Changes)'}>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onSuggestionToggle(); }}
            className={`flex items-center gap-1.5 px-2.5 h-[26px] rounded-full text-[11px] font-semibold border transition-all duration-200 flex-shrink-0 ${
              suggestionMode
                ? 'bg-[#FF9500]/10 text-[#B86800] border-[#FF9500]/30'
                : 'text-[#6E6E73] border-transparent hover:bg-[#EBEBEF] hover:text-[#1D1D1F]'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="hidden sm:inline">{suggestionMode ? 'Suggesting' : 'Editing'}</span>
          </button>
        </Tip>

        {suggestionMode && (
          <>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); onAcceptAll(); }}
              className="px-2.5 h-[26px] rounded-full text-[11px] font-semibold bg-[#34C759]/10 text-[#1A7F37] border border-[#34C759]/25 hover:bg-[#34C759]/20 transition-colors flex-shrink-0 ml-1">
              <span className="hidden sm:inline">✓ Accept all</span>
              <span className="sm:hidden">✓</span>
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); onRejectAll(); }}
              className="px-2.5 h-[26px] rounded-full text-[11px] font-semibold bg-[#FF3B30]/10 text-[#CC2B20] border border-[#FF3B30]/20 hover:bg-[#FF3B30]/20 transition-colors flex-shrink-0 ml-1">
              <span className="hidden sm:inline">✕ Reject all</span>
              <span className="sm:hidden">✕</span>
            </button>
          </>
        )}

        <Sep />

        {/* Comments — labelled pill with open-thread count */}
        <Tip label="Comments">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onCommentsToggle(); }}
            className="flex items-center gap-1.5 px-2.5 h-[26px] rounded-full text-[11px] font-semibold text-[#44454A] border border-[rgba(0,0,0,0.10)] bg-white hover:bg-[#EBEBEF] hover:text-[#1D1D1F] transition-colors duration-150 flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <span className="hidden sm:inline">Comments</span>
            {commentCount > 0 && (
              <span className="anim-pop min-w-[16px] h-4 px-[5px] rounded-full bg-[#007AFF] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {commentCount}
              </span>
            )}
          </button>
        </Tip>

        {/* Version history */}
        <IBtn label="Version history" action={onVersionsToggle}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </IBtn>

        {/* ✨ Ask AI */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onAiToggle(); }}
          className="flex items-center gap-1.5 px-3 h-[26px] rounded-full bg-gradient-to-r from-[#5856D6] to-[#AF52DE] hover:from-[#4C4AC2] hover:to-[#9B40CC] text-white text-[11px] font-semibold transition-all duration-150 shadow-[0_1px_6px_rgba(88,86,214,0.40)] hover:shadow-[0_2px_10px_rgba(88,86,214,0.50)] ml-1 flex-shrink-0"
        >
          <span className="text-[12px] leading-none">✨</span>
          Ask AI
        </button>
      </div>
    </div>
  );
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────
function AiPanel({ editor, onClose }: { editor: any; onClose: () => void }) {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Stream the AI response token-by-token via fetch (axios can't read a
  // streaming body in the browser). Retries once after refreshing the access
  // token on a 401, mirroring the axios interceptor.
  const streamFetch = async (endpoint: string, payload: Record<string, string>): Promise<Response> => {
    const base = process.env.NEXT_PUBLIC_API_URL;
    const doFetch = () =>
      fetch(`${base}/api/ai/${endpoint}?stream=1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(api.defaults.headers.common['Authorization']
            ? { Authorization: api.defaults.headers.common['Authorization'] as string }
            : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

    let res = await doFetch();
    if (res.status === 401) {
      try {
        const r = await api.post('/auth/refresh', {}, { timeout: 5000 });
        api.defaults.headers.common['Authorization'] = `Bearer ${r.data.accessToken}`;
        res = await doFetch();
      } catch { /* fall through — handled by caller */ }
    }
    return res;
  };

  const call = async (endpoint: string, payload: Record<string, string>, label: string) => {
    setLoading(true); setError(''); setResult(''); setActiveAction(label); setExpanded(null);
    try {
      const res = await streamFetch(endpoint, payload);
      if (!res.ok || !res.body) {
        let msg = 'AI request failed';
        try { msg = (await res.json()).error || msg; } catch { /* non-JSON error */ }
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(acc);
      }
      setResult(acc.trim());
    } catch (e: any) {
      setError(e.message || 'AI request failed');
    } finally {
      setLoading(false);
    }
  };

  const acceptResult = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from !== to) editor.chain().focus().insertContentAt({ from, to }, result).run();
    else editor.chain().focus().insertContent(result).run();
    setResult('');
  };

  const selectedText = editor?.state.doc.textBetween(
    editor.state.selection.from,
    editor.state.selection.to,
    ' '
  ) || '';

  const text = selectedText || editor?.getText() || '';
  const content = editor?.getText() || '';

  const TONES = ['Formal', 'Casual', 'Friendly', 'Professional', 'Direct', 'Persuasive'];
  const LANGUAGES = ['Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Arabic', 'Portuguese', 'Hindi', 'Italian', 'Korean'];

  const actions = [
    { label: 'Improve Writing',  sub: 'Clearer and more professional',  Icon: IconImproveWriting, fn: () => call('improve',    { text },    'Improve Writing') },
    { label: 'Fix Grammar',      sub: 'Correct spelling and grammar',    Icon: IconFixGrammar,     fn: () => call('grammar',    { text },    'Fix Grammar') },
    { label: 'Expand',           sub: 'Elaborate with more detail',      Icon: IconExpand,         fn: () => call('expand',     { text },    'Expand') },
    { label: 'Simplify',         sub: 'Plain language, easier to read',  Icon: IconSimplify,       fn: () => call('simplify',   { text },    'Simplify') },
    { label: 'Tone Shift',       sub: 'Change writing tone',             Icon: IconTone,           fn: () => setExpanded((v) => v === 'tone'      ? null : 'tone'),      expandKey: 'tone' },
    { label: 'Generate Outline', sub: 'Create structure from content',   Icon: IconOutline,        fn: () => call('outline',    { content }, 'Generate Outline') },
    { label: 'Brainstorm Ideas', sub: 'Related ideas and next steps',    Icon: IconBrainstorm,     fn: () => call('brainstorm', { content }, 'Brainstorm Ideas') },
    { label: 'Translate',        sub: 'Convert to another language',     Icon: IconTranslate,      fn: () => setExpanded((v) => v === 'translate' ? null : 'translate'), expandKey: 'translate' },
    { label: 'Generate Title',   sub: 'Suggest titles for content',      Icon: IconTitle,          fn: () => call('title',      { content }, 'Generate Title') },
    { label: 'Summarise',        sub: 'Concise 3-sentence summary',      Icon: IconSummarize,      fn: () => call('summarize',  { content }, 'Summarise') },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 h-[72vh] rounded-t-[20px] border-t shadow-apple-xl sm:shadow-none sm:h-auto sm:rounded-none sm:border-t-0 sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:w-80 md:relative md:inset-auto md:z-auto md:w-[300px] border-l border-[rgba(0,0,0,0.08)] bg-[#F5F5F7] flex flex-col overflow-y-auto anim-panel flex-shrink-0">
      <div className="border-b border-[rgba(0,0,0,0.08)] bg-white sticky top-0 z-10 rounded-t-[20px] sm:rounded-none">
        {/* Bottom-sheet grab handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-2">
          <div className="h-1 w-9 rounded-full bg-[#D1D1D6]" />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[7px] bg-gradient-to-br from-[#5856D6] to-[#AF52DE] flex items-center justify-center text-[12px] leading-none">
              ✨
            </div>
            <span className="font-semibold text-[14px] text-[#1D1D1F]">Ask AI</span>
          </div>
          <button type="button" aria-label="Close AI panel" onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-full text-[#8E8E93] hover:bg-[#E8E8ED]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {selectedText && (
          <div className="bg-[#5856D6]/10 border border-[#5856D6]/20 rounded-[10px] px-3 py-2 text-[11px] text-[#5856D6] font-medium">
            ✦ Using selected text
          </div>
        )}

        {actions.map((a) => {
          const isOwner = a.expandKey === 'tone'
            ? activeAction?.startsWith('Tone:')
            : a.expandKey === 'translate'
            ? activeAction?.startsWith('Translate:')
            : activeAction === a.label;

          return (
            <div key={a.label}>
              <button type="button" onClick={a.fn} disabled={loading}
                className={`w-full text-left px-3 py-3 rounded-[12px] border transition-all duration-150 disabled:opacity-50
                  ${isOwner && loading
                    ? 'border-[#5856D6] bg-[#5856D6]/5'
                    : a.expandKey && expanded === a.expandKey
                    ? 'border-[#5856D6]/40 bg-white'
                    : 'border-[rgba(0,0,0,0.08)] bg-white hover:border-[#5856D6]/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex-shrink-0 text-[#666]"><a.Icon /></span>
                    <div>
                      <div className="font-semibold text-[13px] text-[#1D1D1F]">{a.label}</div>
                      <div className="text-[11px] text-[#8E8E93] mt-0.5">{a.sub}</div>
                    </div>
                  </div>
                  {a.expandKey && (
                    <svg className={`w-3.5 h-3.5 text-[#8E8E93] flex-shrink-0 transition-transform ${expanded === a.expandKey ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Tone chips — inline below Tone Shift button */}
              {expanded === 'tone' && a.expandKey === 'tone' && (
                <div className="mt-1 p-2 bg-white border border-[#5856D6]/20 rounded-[10px] flex flex-wrap gap-1.5">
                  {TONES.map((tone) => (
                    <button key={tone} type="button" disabled={loading}
                      onClick={() => call('tone', { text, tone }, `Tone: ${tone}`)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F5F5F7] text-[#3A3A3C] hover:bg-[#5856D6] hover:text-white transition-all disabled:opacity-50">
                      {tone}
                    </button>
                  ))}
                </div>
              )}

              {/* Language chips — inline below Translate button */}
              {expanded === 'translate' && a.expandKey === 'translate' && (
                <div className="mt-1 p-2 bg-white border border-[#5856D6]/20 rounded-[10px] flex flex-wrap gap-1.5">
                  {LANGUAGES.map((lang) => (
                    <button key={lang} type="button" disabled={loading}
                      onClick={() => call('translate', { text, language: lang }, `Translate: ${lang}`)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F5F5F7] text-[#3A3A3C] hover:bg-[#5856D6] hover:text-white transition-all disabled:opacity-50">
                      {lang}
                    </button>
                  ))}
                </div>
              )}

              {/* Loading — inline below active button */}
              {loading && isOwner && (
                <div className="mt-1 px-3 py-2.5 rounded-[10px] bg-white border border-[rgba(0,0,0,0.08)] flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#5856D6] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <p className="text-[12px] text-[#6E6E73]">Processing…</p>
                </div>
              )}

              {/* Error — inline below active button */}
              {!loading && error && isOwner && (
                <div className="mt-1 bg-[#FFF2F1] border border-[#FF3B30]/20 text-[#FF3B30] rounded-[10px] px-3 py-2.5 text-[12px] font-medium">{error}</div>
              )}

              {/* Result — inline below active button */}
              {!loading && result && isOwner && (
                <div className="mt-1 anim-slide-up">
                  <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[12px] p-3 text-[13px] text-[#1D1D1F] leading-relaxed max-h-44 overflow-y-auto whitespace-pre-wrap">{result}</div>
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={acceptResult} className="btn-primary flex-1 justify-center py-2 text-[12px]">Accept</button>
                    <button type="button" onClick={() => setResult('')} className="btn-ghost flex-1 justify-center py-2 text-[12px]">Dismiss</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Version History Panel ─────────────────────────────────────────────────────
function VersionPanel({ docId, onClose, toast }: { docId: string; onClose: () => void; toast: any }) {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/versions/${docId}`);
      setVersions(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [docId]);

  useEffect(() => { load(); }, [load]);

  const saveVersion = async () => {
    setSaving(true);
    try {
      await api.post(`/versions/${docId}`);
      toast.success('Version saved');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save version');
    } finally { setSaving(false); }
  };

  const restore = async (versionId: string) => {
    if (!confirm('Restore this version? Current content will be overwritten.')) return;
    setRestoring(versionId);
    try {
      await api.post(`/versions/${versionId}/restore`);
      toast.success('Version restored');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to restore');
    } finally { setRestoring(null); }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 md:relative md:inset-auto md:z-auto md:w-[280px] border-l border-[rgba(0,0,0,0.08)] bg-[#F5F5F7] flex flex-col overflow-y-auto flex-shrink-0 anim-slide-up">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.08)] bg-white">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#6E6E73]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold text-[14px] text-[#1D1D1F]">Version History</span>
        </div>
        <button type="button" aria-label="Close version history" onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-full text-[#8E8E93] hover:bg-[#E8E8ED]">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-3">
        <button type="button" onClick={saveVersion} disabled={saving}
          className="btn-secondary w-full justify-center py-2 text-[13px] disabled:opacity-50">
          {saving ? 'Saving…' : '+ Save current version'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-[10px]" />
          ))
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-[#8E8E93] text-[13px]">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No saved versions yet
          </div>
        ) : versions.map((v) => (
          <div key={v._id} className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-3">
            <p className="text-[12px] font-semibold text-[#1D1D1F]">{v.label}</p>
            <p className="text-[11px] text-[#8E8E93] mt-0.5">by {v.savedBy?.displayName || 'Unknown'}</p>
            <button
              type="button"
              onClick={() => restore(v._id)}
              disabled={restoring === v._id}
              className="mt-2 text-[11px] font-semibold text-[#007AFF] hover:text-[#0055D4] disabled:opacity-50 transition-colors"
            >
              {restoring === v._id ? 'Restoring…' : 'Restore this version'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Share Modal ───────────────────────────────────────────────────────────────
function ShareModal({ docId, onClose, toast }: { docId: string; onClose: () => void; toast: any }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // People with access (collaborators invited by email)
  interface Person { userId: string; email: string | null; displayName: string | null; avatarUrl: string | null; permission: 'view' | 'edit'; }
  const [people, setPeople] = useState<Person[]>([]);
  const [ownerInfo, setOwnerInfo] = useState<{ userId: string; displayName: string | null; email: string | null } | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePerm, setInvitePerm] = useState<'view' | 'edit'>('view');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const fetchPeople = async () => {
    try {
      const res = await api.get(`/docs/${docId}/collaborators`);
      setPeople(res.data.collaborators || []);
      setOwnerInfo(res.data.owner || null);
    } catch { /* non-fatal — link sharing still works */ }
  };

  useEffect(() => {
    setInitLoading(true);
    api.get(`/docs/${docId}`)
      .then((res) => {
        const doc = res.data.document;
        setIsOwner(res.data.permission === 'owner');
        if (doc.shareLink) {
          setEnabled(true);
          setPermission(doc.shareLinkPermission || 'view');
          setShareUrl(`${window.location.origin}/doc/${docId}?share=${doc.shareLink}`);
        }
      })
      .catch(() => setError('Failed to load document settings.'))
      .finally(() => setInitLoading(false));
    fetchPeople();
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError('');
    try {
      const res = await api.post(`/docs/${docId}/collaborators`, { email: inviteEmail.trim(), permission: invitePerm });
      setPeople(res.data.collaborators || []);
      setInviteEmail('');
      toast.success('Invitation sent');
    } catch (e: any) {
      setInviteError(e.response?.data?.error || 'Could not add that person');
    } finally {
      setInviteLoading(false);
    }
  };

  const changePersonPermission = async (email: string | null, perm: 'view' | 'edit') => {
    if (!email) return;
    try {
      const res = await api.post(`/docs/${docId}/collaborators`, { email, permission: perm });
      setPeople(res.data.collaborators || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not update permission');
    }
  };

  const removePerson = async (userId: string) => {
    try {
      const res = await api.delete(`/docs/${docId}/collaborators/${userId}`);
      setPeople(res.data.collaborators || []);
      toast.success('Removed');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not remove person');
    }
  };

  const apply = async (newEnabled: boolean, newPermission: 'view' | 'edit') => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/docs/${docId}/share`,
        newEnabled ? { permission: newPermission } : { disable: true }
      );
      setEnabled(newEnabled);
      setPermission(newPermission);
      setShareUrl(res.data.shareUrl || null);
      toast.success(newEnabled ? 'Share link created' : 'Sharing disabled');
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Failed to update sharing';
      setError(msg);
    } finally { setLoading(false); }
  };

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied to clipboard');
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade-in">
      <div className="bg-white rounded-[20px] shadow-apple-xl max-w-[420px] w-full p-6 anim-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[17px] font-semibold text-[#1D1D1F]">Share Document</h2>
          <button type="button" aria-label="Close share dialog" onClick={onClose} className="w-7 h-7 rounded-full text-[#8E8E93] hover:bg-[#F5F5F7] flex items-center justify-center transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Inline error */}
        {error && (
          <div className="mb-4 bg-[#FFF2F1] border border-[#FF3B30]/20 text-[#FF3B30] rounded-[10px] px-3 py-2.5 text-[13px] font-medium anim-slide-up">
            {error}
          </div>
        )}

        {/* Toggle */}
        <div className="flex items-center justify-between p-4 bg-[#F5F5F7] rounded-[12px] mb-4">
          <div>
            <p className="text-[14px] font-semibold text-[#1D1D1F]">Share via link</p>
            <p className="text-[12px] text-[#6E6E73] mt-0.5">Anyone with the link can access</p>
          </div>
          <button
            type="button"
            aria-label={enabled ? 'Disable sharing' : 'Enable sharing'}
            onClick={() => apply(!enabled, permission)}
            disabled={loading || initLoading}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full overflow-hidden transition-colors duration-200
              ${enabled ? 'bg-[#34C759]' : 'bg-[#D1D1D6]'}
              ${(loading || initLoading) ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200
                ${enabled ? 'translate-x-[20px]' : 'translate-x-0'}`}
            />
          </button>
        </div>

        {/* Permission */}
        {enabled && (
          <div className="mb-4 anim-slide-up">
            <p className="text-[12px] font-semibold text-[#6E6E73] mb-2">Permission level</p>
            <div className="flex gap-2">
              {(['view', 'edit'] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => { setPermission(p); apply(true, p); }}
                  disabled={loading}
                  className={`flex-1 py-2 rounded-[8px] text-[13px] font-semibold border transition-all disabled:opacity-60 ${permission === p
                    ? 'bg-[#007AFF] text-white border-[#007AFF]'
                    : 'bg-white text-[#3A3A3C] border-[rgba(0,0,0,0.10)] hover:border-[#007AFF]/30'}`}
                >
                  {p === 'view' ? 'View only' : 'Can edit'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Link */}
        {enabled && shareUrl && (
          <div className="flex gap-2 anim-slide-up">
            <input
              readOnly
              aria-label="Share link"
              value={shareUrl}
              className="input-apple text-[12px] flex-1 bg-[#F5F5F7] cursor-default"
            />
            <button
              type="button"
              onClick={copyLink}
              className={`flex-shrink-0 px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all ${copied ? 'bg-[#34C759] text-white' : 'btn-primary'}`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        {!enabled && (
          <p className="text-[13px] text-[#8E8E93] text-center mt-2">
            Enable sharing to generate a link
          </p>
        )}

        {/* People with access */}
        <div className="mt-6 pt-5 border-t border-[rgba(0,0,0,0.08)]">
          <p className="text-[14px] font-semibold text-[#1D1D1F] mb-3">People with access</p>

          {isOwner && (
            <form onSubmit={invite} className="mb-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); }}
                  placeholder="Invite by email"
                  aria-label="Invite by email"
                  className="input-apple text-[13px] flex-1"
                />
                <select
                  value={invitePerm}
                  onChange={(e) => setInvitePerm(e.target.value as 'view' | 'edit')}
                  aria-label="Invite permission"
                  className="text-[13px] rounded-[8px] border border-[rgba(0,0,0,0.12)] px-2 bg-white text-[#3A3A3C]"
                >
                  <option value="view">Can view</option>
                  <option value="edit">Can edit</option>
                </select>
                <button type="submit" disabled={inviteLoading || !inviteEmail.trim()} className="btn-primary px-4 text-[13px] disabled:opacity-50">
                  {inviteLoading ? '…' : 'Invite'}
                </button>
              </div>
              {inviteError && <p className="text-[12px] text-[#FF3B30] mt-1.5 font-medium">{inviteError}</p>}
            </form>
          )}

          <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
            {/* Owner row */}
            {ownerInfo && (
              <div className="flex items-center gap-2.5 py-1.5">
                <div className="w-7 h-7 rounded-full bg-[#007AFF] text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                  {(ownerInfo.displayName || ownerInfo.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1D1D1F] truncate">{ownerInfo.displayName || ownerInfo.email}</p>
                  <p className="text-[11px] text-[#8E8E93] truncate">{ownerInfo.email}</p>
                </div>
                <span className="text-[12px] text-[#8E8E93] flex-shrink-0">Owner</span>
              </div>
            )}

            {/* Collaborators */}
            {people.map((p) => (
              <div key={p.userId} className="flex items-center gap-2.5 py-1.5">
                <div className="w-7 h-7 rounded-full bg-[#8E8E93] text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                  {(p.displayName || p.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1D1D1F] truncate">{p.displayName || p.email}</p>
                  <p className="text-[11px] text-[#8E8E93] truncate">{p.email}</p>
                </div>
                {isOwner ? (
                  <>
                    <select
                      value={p.permission}
                      onChange={(e) => changePersonPermission(p.email, e.target.value as 'view' | 'edit')}
                      aria-label={`Permission for ${p.email}`}
                      className="text-[12px] rounded-[6px] border border-[rgba(0,0,0,0.12)] px-1.5 py-1 bg-white text-[#3A3A3C] flex-shrink-0"
                    >
                      <option value="view">Can view</option>
                      <option value="edit">Can edit</option>
                    </select>
                    <button type="button" onClick={() => removePerson(p.userId)} aria-label={`Remove ${p.email}`} className="text-[#8E8E93] hover:text-[#FF3B30] flex-shrink-0 p-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </>
                ) : (
                  <span className="text-[12px] text-[#8E8E93] flex-shrink-0">{p.permission === 'edit' ? 'Can edit' : 'Can view'}</span>
                )}
              </div>
            ))}

            {people.length === 0 && !ownerInfo && (
              <p className="text-[12px] text-[#8E8E93] py-1">No one else has access yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Outline Sidebar ────────────────────────────────────────────────────────────
function OutlineSidebar({ editor }: { editor: any }) {
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number; pos: number }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return;

    const updateHeadings = () => {
      const newHeadings: { id: string; text: string; level: number; pos: number }[] = [];
      editor.state.doc.descendants((node: any, pos: number) => {
        if (node.type.name === 'heading') {
          newHeadings.push({
            id: `h-${pos}`,
            text: node.textContent,
            level: node.attrs.level,
            pos,
          });
        }
      });
      setHeadings(newHeadings);
    };

    editor.on('update', updateHeadings);
    updateHeadings(); // Initial run

    return () => {
      editor.off('update', updateHeadings);
    };
  }, [editor]);

  useEffect(() => {
    const container = document.getElementById('editor-scroll-container');
    if (!container || !editor) return;

    const handleScroll = () => {
      let currentActiveId = null;
      let minDistance = Infinity;

      headings.forEach((h) => {
        try {
          const domInfo = editor.view.domAtPos(h.pos);
          let element = domInfo.node;
          if (element.nodeType === Node.TEXT_NODE) element = element.parentElement;
          
          if (element instanceof HTMLElement) {
            const rect = element.getBoundingClientRect();
            // Find the heading closest to the top of the container
            if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
              if (rect.top < minDistance) {
                minDistance = rect.top;
                currentActiveId = h.id;
              }
            }
          }
        } catch (e) { /* ignore */ }
      });

      if (!currentActiveId) {
        // Fallback to the last heading above the viewport
        for (let i = headings.length - 1; i >= 0; i--) {
          try {
            const domInfo = editor.view.domAtPos(headings[i].pos);
            let element = domInfo.node;
            if (element.nodeType === Node.TEXT_NODE) element = element.parentElement;
            
            if (element instanceof HTMLElement) {
              const rect = element.getBoundingClientRect();
              if (rect.top < 0) {
                currentActiveId = headings[i].id;
                break;
              }
            }
          } catch (e) { /* ignore */ }
        }
      }

      if (currentActiveId) {
        setActiveId(currentActiveId);
      } else if (headings.length > 0) {
        setActiveId(headings[0].id);
      }
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => container.removeEventListener('scroll', handleScroll);
  }, [headings, editor]);

  const scrollToHeading = (pos: number) => {
    try {
      const domInfo = editor.view.domAtPos(pos);
      let element = domInfo.node;
      if (element.nodeType === Node.TEXT_NODE) element = element.parentElement;
      
      if (element instanceof HTMLElement) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (e) {
      console.error('Could not scroll to heading', e);
    }
  };

  if (headings.length === 0) return null;

  return (
    <div className="hidden md:flex w-[240px] border-r border-[rgba(0,0,0,0.08)] bg-[#FAFAFA] flex-col h-full flex-shrink-0">
      <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.08)]">
        <span className="font-semibold text-[13px] text-[#8E8E93] uppercase tracking-wider">Outline</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {headings.map((h) => (
          <button
            key={h.id}
            onClick={() => scrollToHeading(h.pos)}
            className={`${getOutlineIndentClass(h.level)} w-full text-left py-1.5 rounded-[6px] text-[13px] truncate transition-colors ${
              activeId === h.id
                ? 'bg-[#E8E8ED] text-[#1D1D1F] font-semibold'
                : 'text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]'
            }`}
            title={h.text}
          >
            {h.text}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────
// ─── Presence Bar ──────────────────────────────────────────────────────────────────
function PresenceBar({ onlineUsers, typingUsers }: { onlineUsers: any[]; typingUsers: Set<string> }) {
  if (onlineUsers.length === 0) return null;
  return (
    <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[rgba(0,0,0,0.04)] bg-[#FBFBFD] min-h-[44px] anim-fade-in">
      <span className="text-[10px] font-bold text-[#AEAEB2] uppercase tracking-[0.05em] flex-shrink-0">Live</span>
      <div className="flex items-center gap-2 flex-wrap">
        {onlineUsers.map((u) => {
          const isTyping = typingUsers.has(u.id);
          return (
            <div key={u.id}
              style={{ backgroundColor: userColor(u.id) }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-[11px] font-bold transition-all duration-500 shadow-apple-sm hover:scale-105 anim-pop">
              <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center text-[9px] font-black flex-shrink-0">
                {getUserLabel(u)?.[0]?.toUpperCase()}
              </span>
              <span className="max-w-[150px] truncate">{getUserLabel(u)}</span>
              {isTyping ? (
                <span className="flex items-center gap-[2px] ml-1" title="Typing">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:300ms]" />
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-[#34C759] border-2 border-white/30 flex-shrink-0" title="Online" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Editor({ docId }: { docId: string }) {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('Untitled');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [suggestionMode, setSuggestionMode] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState<SocketIOProvider | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [canEditDoc, setCanEditDoc] = useState(true);
  // Set when the server refuses (or revokes) access, so we show a friendly
  // screen instead of a blank editor. 'unshared' = arrived via a link that is no
  // longer shared; 'noaccess' = not permitted; 'notfound' = missing document.
  const [joinError, setJoinError] = useState<'unshared' | 'noaccess' | 'notfound' | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [pendingAnchorText, setPendingAnchorText] = useState('');
  const [pendingSelection, setPendingSelection] = useState<{ from: number; to: number } | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [editedAt, setEditedAt] = useState<Date | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  // Full-width vs. the focused 720px reading column (persisted per browser)
  const [fullWidth, setFullWidth] = useState(false);
  // Re-render every 30s so "Last edited … ago" stays fresh
  const [, setClockTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  if (!ydocRef.current) ydocRef.current = new Y.Doc();

  // Keep module-level TrackChanges flag in sync with React state
  useEffect(() => { setTrackChangesEnabled(suggestionMode); }, [suggestionMode]);

  useEffect(() => {
    const i = setInterval(() => setClockTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  // Favorite state is shared with the dashboard via localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('collabdocs_favorites') || '[]');
      setIsFavorite(Array.isArray(stored) && stored.includes(docId));
    } catch { /* ignore */ }
  }, [docId]);

  // Slash-menu entries that need editor-page UI (AI panel, image picker)
  useEffect(() => {
    const openAi = () => { setAiOpen(true); setVersionsOpen(false); setCommentsOpen(false); };
    const pickImage = () => fileInputRef.current?.click();
    window.addEventListener('collabdocs:open-ai', openAi);
    window.addEventListener('collabdocs:insert-image', pickImage);
    return () => {
      window.removeEventListener('collabdocs:open-ai', openAi);
      window.removeEventListener('collabdocs:insert-image', pickImage);
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!token || !user) {
      sessionStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
      router.replace('/login');
      return;
    }
    const socket = getSocket(token);

    socket.on('connect',    () => setIsOnline(true));
    socket.on('disconnect', () => setIsOnline(false));

    const p = new SocketIOProvider(ydocRef.current!, socket, docId);
    setProvider(p);

    // Persist the document locally so it loads instantly and stays editable
    // offline. Y.js merges local + server state automatically on reconnect.
    const idb = new IndexeddbPersistence(`collabdocs-${docId}`, ydocRef.current!);

    // Pass the share token (if the user arrived via a share link) so the server
    // can authorize link-based access without it granting access to everyone.
    const shareToken = new URLSearchParams(window.location.search).get('share');
    socket.emit('doc:join', { docId, shareToken });
    socket.on('doc:permission', ({ permission }: { permission: 'owner' | 'edit' | 'view' }) => {
      // A successful (re)authorization clears any prior denial (e.g. the owner
      // just re-enabled sharing or upgraded us) and reflects the new level live.
      setJoinError(null);
      setCanEditDoc(permission === 'owner' || permission === 'edit');
    });

    // Access was refused on join, or revoked mid-session (owner disabled the
    // link / removed us). Show a screen instead of a silently-broken editor.
    const showDenied = () =>
      setJoinError(shareToken ? 'unshared' : 'noaccess');
    socket.on('error', ({ message }: { message?: string }) => {
      if (message === 'Document not found') setJoinError('notfound');
      else if (message === 'Access denied') showDenied();
    });
    socket.on('doc:access-revoked', () => {
      setCanEditDoc(false);
      showDenied();
    });
    socket.on('doc:awareness', ({ users }: any) => setOnlineUsers(users));
    socket.on('doc:saved', () => {
      setSaving(false);
      setLastSaved(new Date());
    });

    // Typing awareness from other users
    socket.on('doc:typing', ({ userId }: any) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
      // Auto-clear after 2.5s of no update
      setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }, 2500);
    });

    api.get(`/docs/${docId}`)
      .then((res) => {
        setTitle(res.data.document.title);
        if (res.data.document.updatedAt) setEditedAt(new Date(res.data.document.updatedAt));
      })
      .catch(() => {});

    return () => {
      p.destroy();
      idb.destroy();
      setProvider(null);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('doc:permission');
      socket.off('error');
      socket.off('doc:access-revoked');
      socket.off('doc:awareness');
      socket.off('doc:saved');
      socket.off('doc:typing');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [docId, token, user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false, codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      SlashCommands.configure({
        suggestion: {
          items: ({ query }: { query: string }) => {
            return getSuggestionItems().filter((item: any) => item.title.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
          },
          render: renderItems,
        },
      } as any),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          items: ({ query }: { query: string }) => {
            // Filter online users or use a list of collaborators
            return onlineUsers.filter((u: any) => getUserLabel(u).toLowerCase().startsWith(query.toLowerCase())).slice(0, 5);
          },
          render: () => {
            let component: ReactRenderer;
            let popup: any;

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) return;

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
                if (!props.clientRect) return;
                popup[0].setProps({ getReferenceClientRect: props.clientRect });
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
          },
        },
      }),
      CommentMark,
      SuggestionMark,
      TrackChanges.configure({ enabled: suggestionMode }),
      Collaboration.configure({ document: ydocRef.current! }),
      ...(provider ? [CollaborationCursor.configure({
        provider,
        user: { name: user?.username || user?.displayName || 'Anonymous', color: userColor(user?.id || '') },
      })] : []),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FontFamily,
      FontSize,
      TextColor,
      Highlight.configure({ multicolor: true }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'editor-link' } }),
      ResizableImage,
      Mathematics.configure({ katexOptions: { throwOnError: false } }),
      Placeholder.configure({ placeholder: 'Start writing, press "/" for commands, or ✨ Ask AI…' }),
    ] as any,
    onUpdate: () => {
      setSaving(true);
    },
  }, [provider]);

  // Reflect the server-authorized permission: viewers get a read-only editor.
  useEffect(() => {
    editor?.setEditable(canEditDoc);
    // Drives the image cursor/hover hint in globals.css — viewers can't crop.
    editor?.view.dom.classList.toggle('is-readonly', !canEditDoc);
  }, [editor, canEditDoc]);

  const handleTitleBlur = useCallback(async () => {
    if (!canEditDoc) return; // viewers can't rename — server would 403 anyway
    await api.patch(`/docs/${docId}`, { title }).catch(() => {});
  }, [docId, title, canEditDoc]);

  // Initialize template content if present
  useEffect(() => {
    if (!editor || !ydocRef.current || !provider) return;

    const templateKey = `doc_${docId}_template`;
    let templateContent = sessionStorage.getItem(templateKey);

    if (templateContent) {
      const init = () => {
        if (editor.isEmpty) {
          // Check if it's plain text without HTML tags and format it
          if (!templateContent.trim().startsWith('<')) {
            templateContent = templateContent.split('\n').map(line => `<p>${line}</p>`).join('');
          }
          editor.commands.setContent(templateContent);
          sessionStorage.removeItem(templateKey);
        }
      };

      if (provider.synced) {
        init();
      } else {
        const interval = setInterval(() => {
          if (provider.synced) {
            clearInterval(interval);
            init();
          }
        }, 100);
        return () => clearInterval(interval);
      }
    }
  }, [editor, docId, provider]);

  // Emit typing event when user types
  const handleTyping = useCallback(() => {
    if (!token || !user) return;
    const socket = getSocket(token);
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('doc:typing', { docId, userId: user.id, username: user.username, displayName: user.displayName });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 2000);
  }, [docId, token, user]);

  // Close only one panel at a time
  const toggleAi       = () => { setAiOpen((v) => !v); setVersionsOpen(false); setCommentsOpen(false); };
  const toggleVersions = () => { setVersionsOpen((v) => !v); setAiOpen(false); setCommentsOpen(false); };
  const toggleComments = () => { setCommentsOpen((v) => !v); setAiOpen(false); setVersionsOpen(false); };

  const refreshCommentCount = useCallback(async () => {
    try {
      const { data } = await api.get(`/comments/${docId}`);
      setCommentCount(data.filter((c: any) => !c.parentId && !c.resolved).length);
    } catch { /* ignore */ }
  }, [docId]);

  // Re-count when the sidebar opens/closes (threads may get resolved there)
  useEffect(() => {
    if (authLoading || !token) return;
    refreshCommentCount();
  }, [authLoading, token, commentsOpen, refreshCommentCount]);

  // Restore the saved width preference (client-only to avoid SSR mismatch)
  useEffect(() => {
    setFullWidth(localStorage.getItem('collabdocs_full_width') === '1');
  }, []);

  const toggleFullWidth = () => {
    setFullWidth((v) => {
      const next = !v;
      try { localStorage.setItem('collabdocs_full_width', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const toggleFavorite = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('collabdocs_favorites') || '[]');
      const next = new Set<string>(Array.isArray(stored) ? stored : []);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      localStorage.setItem('collabdocs_favorites', JSON.stringify(Array.from(next)));
      setIsFavorite(next.has(docId));
      toast.success(next.has(docId) ? 'Added to favorites' : 'Removed from favorites');
    } catch { /* ignore */ }
  };

  // Insert a picked image as a base64 data URL (kept small so the Yjs doc stays lean)
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editor) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image is too large — 2 MB max'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      editor.chain().focus().setImage({ src: reader.result as string, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
  };

  const setLinkFromBubble = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL', prev || 'https://');
    if (url === null) return;
    if (!url) { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url, target: '_blank' }).run();
  };

  const addComment = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) { toast.info('Select some text first'); return; }
    const anchorText = editor.state.doc.textBetween(from, to, ' ');
    setPendingSelection({ from, to });
    setCommentOpen(true);
    setPendingAnchorText(anchorText);
    setCommentInput('');
  };

  const submitComment = async () => {
    if (!commentInput.trim() || !pendingAnchorText || !pendingSelection) return;
    try {
      const { data: comment } = await api.post('/comments', {
        documentId: docId,
        anchorText: pendingAnchorText,
        body: commentInput.trim(),
      });
      // Restore the saved selection before applying the mark (focus clears it)
      editor!.chain().focus().setTextSelection(pendingSelection).setComment(comment._id).run();
      setCommentsOpen(true);
      setCommentOpen(false);
      setCommentInput('');
      setPendingSelection(null);
      toast.success('Comment added');
      refreshCommentCount();
    } catch {
      toast.error('Failed to add comment');
    }
  };

  function acceptAllSuggestions() {
    if (!editor) return;
    const mark = editor.state.schema.marks.suggestion;
    const addRanges: { from: number; to: number }[] = [];
    const delRanges: { from: number; to: number }[] = [];
    editor.state.doc.descendants((node: any, pos: number) => {
      for (const m of node.marks) {
        if (m.type !== mark) continue;
        const range = { from: pos, to: pos + node.nodeSize };
        if (m.attrs.type === 'add') addRanges.push(range);
        else delRanges.push(range);
      }
    });
    let tr = editor.state.tr;
    for (const { from, to } of addRanges) tr.removeMark(from, to, mark);
    for (const { from, to } of delRanges.sort((a, b) => b.from - a.from)) tr.delete(from, to);
    editor.view.dispatch(tr);
    toast.success('All suggestions accepted');
  }

  function rejectAllSuggestions() {
    if (!editor) return;
    const mark = editor.state.schema.marks.suggestion;
    const addRanges: { from: number; to: number }[] = [];
    const delRanges: { from: number; to: number }[] = [];
    editor.state.doc.descendants((node: any, pos: number) => {
      for (const m of node.marks) {
        if (m.type !== mark) continue;
        const range = { from: pos, to: pos + node.nodeSize };
        if (m.attrs.type === 'add') addRanges.push(range);
        else delRanges.push(range);
      }
    });
    let tr = editor.state.tr;
    for (const { from, to } of delRanges) tr.removeMark(from, to, mark);
    for (const { from, to } of addRanges.sort((a, b) => b.from - a.from)) tr.delete(from, to);
    editor.view.dispatch(tr);
    toast.success('All suggestions rejected');
  }

  const lastEdit = lastSaved || editedAt;

  // Access refused / revoked — render a friendly screen instead of the editor.
  if (joinError) {
    const copy = {
      unshared: {
        icon: '🔗',
        title: 'This document is no longer shared',
        body: 'The owner has disabled link sharing. Ask them for access to keep viewing it.',
      },
      noaccess: {
        icon: '🔒',
        title: "You don't have access",
        body: 'You don’t have permission to view this document. Ask the owner to share it with you.',
      },
      notfound: {
        icon: '📄',
        title: 'Document not found',
        body: 'This document may have been deleted or the link is incorrect.',
      },
    }[joinError];
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-[380px] w-full text-center anim-scale-in">
          <div className="text-[40px] mb-3">{copy.icon}</div>
          <h1 className="text-[20px] font-semibold text-[#1D1D1F] mb-2">{copy.title}</h1>
          <p className="text-[14px] text-[#6E6E73] leading-relaxed mb-6">{copy.body}</p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-[#007AFF] hover:bg-[#0055D4] text-white text-[13px] font-semibold transition-colors"
          >
            Back to Docs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="apple-glass border-b border-[rgba(0,0,0,0.08)] sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-2">
          <button type="button" onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-[#007AFF] hover:text-[#0055D4] text-[13px] font-semibold transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Docs
          </button>
          <div className="w-px h-4 bg-[rgba(0,0,0,0.12)] flex-shrink-0" />

          {/* Title + live document meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <svg className="hidden sm:block w-4 h-4 text-[#AEAEB2] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                readOnly={!canEditDoc}
                className={`w-full font-semibold text-[#1D1D1F] bg-transparent border-none outline-none text-[16px] truncate tracking-tight placeholder:text-[#AEAEB2] ${!canEditDoc ? 'cursor-default' : ''}`}
                placeholder="Untitled"
              />
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#8E8E93] leading-none pl-[22px]">
              {!isOnline ? (
                <span className="flex items-center gap-1 text-[#B86800] font-semibold anim-pop">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500] animate-pulse" />
                  Offline — changes saved locally
                </span>
              ) : saving ? (
                <span className="anim-pop">Saving…</span>
              ) : (
                <>
                  {lastEdit && <span>Last edited {relativeTime(lastEdit)}</span>}
                  {lastSaved && (
                    <span className="flex items-center gap-0.5 text-[#34C759] font-semibold anim-pop">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Saved
                    </span>
                  )}
                </>
              )}
              {onlineUsers.length > 1 && (
                <>
                  <span>·</span>
                  <span>{onlineUsers.length} collaborators online</span>
                </>
              )}
            </div>
          </div>

          {/* Collaborator avatars */}
          {onlineUsers.length > 0 && (
            <div className="hidden sm:flex -space-x-1.5 flex-shrink-0">
              {onlineUsers.slice(0, 4).map((u) => (
                <div key={u.id} title={`${getUserLabel(u)} — online`}
                  style={{ backgroundColor: userColor(u.id) }}
                  className="w-6 h-6 rounded-full ring-[1.5px] ring-white flex items-center justify-center text-white text-[9px] font-bold shadow-sm cursor-default anim-pop">
                  {getUserLabel(u)?.[0]?.toUpperCase()}
                </div>
              ))}
              {onlineUsers.length > 4 && (
                <div className="w-6 h-6 rounded-full ring-[1.5px] ring-white bg-[#E8E8ED] flex items-center justify-center text-[#6E6E73] text-[9px] font-bold">
                  +{onlineUsers.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Full-width toggle */}
          <button
            type="button"
            title={fullWidth ? 'Focused width' : 'Full width'}
            onClick={toggleFullWidth}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-all duration-150 flex-shrink-0 ${
              fullWidth ? 'text-[#007AFF] bg-[#007AFF]/10' : 'text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
            }`}
          >
            {fullWidth ? (
              // Collapse to a centred column
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v16M15 4v16M9 9l-3 3 3 3M15 9l3 3-3 3" />
              </svg>
            ) : (
              // Expand to full width
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v16M20 4v16M8 9l-3 3 3 3M16 9l3 3-3 3" />
              </svg>
            )}
          </button>

          {/* Favorite */}
          <button
            type="button"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={toggleFavorite}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-all duration-150 flex-shrink-0 ${
              isFavorite ? 'text-[#FFB800]' : 'text-[#AEAEB2] hover:text-[#FFB800] hover:bg-[#F5F5F7]'
            }`}
          >
            <svg className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </button>

          {/* Share — owners/editors only; viewers can't reshare */}
          {canEditDoc && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 px-3 h-[26px] rounded-full bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white text-[11px] font-semibold transition-colors duration-150 flex-shrink-0"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              <span className="hidden sm:inline">Share</span>
            </button>
          )}
        </div>
        {/* Editing toolbar is hidden entirely in view-only mode (Google-Docs
            style); the read-only banner replaces it. */}
        {canEditDoc ? (
          <Toolbar
            editor={editor}
            onAiToggle={toggleAi}
            onVersionsToggle={toggleVersions}
            onCommentsToggle={toggleComments}
            onImageUpload={() => fileInputRef.current?.click()}
            commentCount={commentCount}
            suggestionMode={suggestionMode}
            onSuggestionToggle={() => setSuggestionMode(!suggestionMode)}
            onAcceptAll={acceptAllSuggestions}
            onRejectAll={rejectAllSuggestions}
          />
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 border-t border-[rgba(0,0,0,0.07)] bg-[#FFF8E6] text-[#8A6D00]">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-[13px] font-semibold">View only</span>
            <span className="hidden sm:inline text-[12px] text-[#B8860B]">
              · Editing is disabled by the document owner. You can read, select, and copy.
            </span>
          </div>
        )}
      </div>

      {/* Hidden file input backing the toolbar / slash-menu image upload */}
      <input ref={fileInputRef} type="file" accept="image/*" aria-label="Upload image" className="hidden" onChange={handleImageFile} />

      {/* Presence bar — outside the sticky header so nothing clips it */}
      <PresenceBar onlineUsers={onlineUsers} typingUsers={typingUsers} />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <OutlineSidebar editor={editor} />
        <div
          id="editor-scroll-container"
          className="flex-1 overflow-y-auto bg-white"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            const el = target.closest('[data-comment-id]') as HTMLElement | null;
            if (el) {
              setActiveCommentId(el.getAttribute('data-comment-id'));
              setCommentsOpen(true);
              setAiOpen(false);
              setVersionsOpen(false);
            }
          }}
        >
          <div className={`mx-auto px-4 sm:px-8 py-8 sm:py-14 anim-slide-up transition-[max-width] duration-200 ${fullWidth ? 'max-w-none' : 'max-w-[720px]'}`}>
            {editor && (
              <BubbleMenu
                editor={editor}
                tippyOptions={{ duration: 100, placement: 'top-start' }}
                shouldShow={({ state }) => {
                  // No editing affordances in view-only mode.
                  if (!canEditDoc) return false;
                  // Text formatting only — never over a selected image/atom node,
                  // which owns its own floating toolbar in the NodeView.
                  if ((state.selection as any).node) return false;
                  const { from, to } = state.selection;
                  return from !== to;
                }}
              >
                <div className="flex items-center gap-0.5 bg-[#1D1D1F] rounded-[10px] px-1.5 py-1 shadow-apple-xl anim-pop">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
                    className={`px-2 py-1 rounded-[7px] text-[13px] font-bold transition-colors duration-150 ${editor.isActive('bold') ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}
                  >B</button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
                    className={`px-2 py-1 rounded-[7px] text-[13px] font-semibold italic transition-colors duration-150 ${editor.isActive('italic') ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}
                  >I</button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
                    className={`px-2 py-1 rounded-[7px] text-[13px] font-semibold underline transition-colors duration-150 ${editor.isActive('underline') ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}
                  >U</button>
                  <button
                    type="button"
                    title="Highlight"
                    onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHighlight({ color: '#FEF08A' }).run(); }}
                    className={`px-2 py-1 rounded-[7px] transition-colors duration-150 ${editor.isActive('highlight') ? 'bg-white/20' : 'hover:bg-white/15'}`}
                  >
                    <span className="block w-4 h-4 rounded-[3px] bg-[#FEF08A] text-[#1D1D1F] text-[10px] font-bold leading-4 text-center">A</span>
                  </button>
                  <button
                    type="button"
                    title="Insert link"
                    onMouseDown={(e) => { e.preventDefault(); setLinkFromBubble(); }}
                    className={`px-2 py-1 rounded-[7px] transition-colors duration-150 ${editor.isActive('link') ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1" /></svg>
                  </button>
                  <div className="w-px h-4 bg-white/20 mx-0.5" />
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); toggleAi(); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-[7px] text-white text-[12px] font-semibold hover:bg-white/15 transition-colors duration-150"
                  >
                    <span className="text-[12px] leading-none">✨</span>
                    AI
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); addComment(); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-white text-[12px] font-semibold hover:bg-white/15 transition-colors duration-150"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Comment
                  </button>
                </div>
              </BubbleMenu>
            )}
            <EditorContent editor={editor} onKeyDown={handleTyping} />
          </div>
        </div>
        {aiOpen       && <AiPanel editor={editor} onClose={() => setAiOpen(false)} />}
        {versionsOpen && <VersionPanel docId={docId} onClose={() => setVersionsOpen(false)} toast={toast} />}
        {commentsOpen && <CommentSidebar docId={docId} onClose={() => setCommentsOpen(false)} highlightId={activeCommentId} />}
      </div>

      {shareOpen && <ShareModal docId={docId} onClose={() => setShareOpen(false)} toast={toast} />}

      {commentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px] anim-fade-in" onClick={() => setCommentOpen(false)}>
          <div className="w-[300px] bg-white border border-[rgba(0,0,0,0.10)] rounded-[16px] shadow-apple-xl p-4 anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] font-semibold text-[#8E8E93] mb-1">Commenting on:</p>
            <p className="text-[12px] text-[#3A3A3C] italic mb-3 bg-[#F5F5F7] rounded-[8px] px-2.5 py-1.5 truncate">"{pendingAnchorText}"</p>
            <textarea
              autoFocus
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Add a comment…"
              rows={3}
              className="w-full text-[13px] border border-[rgba(0,0,0,0.10)] rounded-[8px] px-3 py-2 resize-none outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/15 transition-all"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } if (e.key === 'Escape') setCommentOpen(false); }}
            />
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={submitComment} disabled={!commentInput.trim()} className="flex-1 h-9 rounded-[8px] bg-[#007AFF] text-white text-[13px] font-semibold hover:bg-[#0055D4] disabled:opacity-40 transition-colors">Comment</button>
              <button type="button" onClick={() => setCommentOpen(false)} className="flex-1 h-9 rounded-[8px] border border-[rgba(0,0,0,0.10)] text-[#3A3A3C] text-[13px] font-semibold hover:bg-[#F5F5F7] transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
