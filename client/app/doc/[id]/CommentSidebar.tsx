'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';

interface CommentData {
  _id: string;
  body: string;
  anchorText: string;
  parentId: string | null;
  authorId: { displayName: string; avatarUrl: string | null };
  resolved: boolean;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-6 h-6 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
      {name[0]?.toUpperCase()}
    </div>
  );
}

function ReplyBox({ onSubmit, onCancel }: { onSubmit: (body: string) => Promise<void>; onCancel: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    await onSubmit(text.trim());
    setLoading(false);
    setText('');
  };

  return (
    <div className="mt-2 pl-8">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Reply…"
        rows={2}
        className="w-full text-[12px] border border-[rgba(0,0,0,0.10)] rounded-[8px] px-2.5 py-1.5 resize-none outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/15 transition-all"
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === 'Escape') onCancel(); }}
      />
      <div className="flex gap-1.5 mt-1.5">
        <button type="button" onClick={submit} disabled={!text.trim() || loading} className="px-3 py-1 rounded-[6px] bg-[#007AFF] text-white text-[11px] font-semibold disabled:opacity-40 hover:bg-[#0055D4] transition-colors">
          {loading ? 'Posting…' : 'Reply'}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1 rounded-[6px] border border-[rgba(0,0,0,0.10)] text-[#3A3A3C] text-[11px] font-semibold hover:bg-[#F5F5F7] transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

function CommentThread({ comment, replies, onResolve, onReply }: {
  comment: CommentData;
  replies: CommentData[];
  onResolve: (id: string) => void;
  onReply: (parentId: string, body: string) => Promise<void>;
}) {
  const [replyOpen, setReplyOpen] = useState(false);

  return (
    <div className={`rounded-[12px] border transition-all duration-300 ${comment.resolved ? 'bg-white/50 opacity-50 border-transparent' : 'bg-white border-[rgba(0,0,0,0.06)] shadow-apple-sm'}`}>
      {/* Top-level comment */}
      <div className="p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <Avatar name={comment.authorId.displayName} />
          <span className="text-[12px] font-semibold text-[#1D1D1F]">{comment.authorId.displayName}</span>
          <span className="text-[10px] text-[#AEAEB2] ml-auto">{timeAgo(comment.createdAt)}</span>
        </div>
        <div className="text-[11px] text-[#8E8E93] italic mb-1.5 px-2 border-l-2 border-[#007AFF]/30 truncate">"{comment.anchorText}"</div>
        <p className="text-[13px] text-[#3A3A3C] leading-relaxed">{comment.body}</p>
        {!comment.resolved && (
          <div className="flex items-center gap-3 mt-2.5">
            <button type="button" onClick={() => setReplyOpen((v) => !v)} className="text-[11px] font-semibold text-[#007AFF] hover:text-[#0055D4] transition-colors">
              Reply
            </button>
            <button type="button" onClick={() => onResolve(comment._id)} className="text-[11px] font-semibold text-[#34C759] hover:text-[#248A3D] flex items-center gap-0.5 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              Resolve
            </button>
          </div>
        )}
      </div>

      {/* Threaded replies */}
      {replies.length > 0 && (
        <div className="border-t border-[rgba(0,0,0,0.05)] px-3.5 py-2 space-y-2.5">
          {replies.map((r) => (
            <div key={r._id} className="flex gap-2">
              <Avatar name={r.authorId.displayName} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[11px] font-semibold text-[#1D1D1F]">{r.authorId.displayName}</span>
                  <span className="text-[10px] text-[#AEAEB2]">{timeAgo(r.createdAt)}</span>
                </div>
                <p className="text-[12px] text-[#3A3A3C] leading-relaxed">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {replyOpen && (
        <div className="border-t border-[rgba(0,0,0,0.05)] px-3.5 pb-3">
          <ReplyBox
            onSubmit={async (body) => { await onReply(comment._id, body); setReplyOpen(false); }}
            onCancel={() => setReplyOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

export const CommentSidebar = ({ docId, onClose, highlightId }: { docId: string; onClose: () => void; highlightId?: string | null }) => {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    try {
      const { data } = await api.get(`/comments/${docId}`);
      setComments(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [docId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // Scroll to and flash the highlighted comment after data loads
  useEffect(() => {
    if (!highlightId || loading) return;
    const el = document.getElementById(`comment-${highlightId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('comment-flash');
    const t = setTimeout(() => el.classList.remove('comment-flash'), 1600);
    return () => clearTimeout(t);
  }, [highlightId, loading]);

  const resolveComment = async (id: string) => {
    await api.patch(`/comments/${id}/resolve`).catch(() => {});
    fetchComments();
  };

  const addReply = async (parentId: string, body: string) => {
    const parent = comments.find((c) => c._id === parentId);
    if (!parent) return;
    await api.post('/comments', { documentId: docId, anchorText: parent.anchorText, body, parentId });
    fetchComments();
  };

  // Organise into threads: top-level + their replies
  const topLevel = comments.filter((c) => !c.parentId);
  const repliesFor = (id: string) => comments.filter((c) => c.parentId === id);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 md:relative md:inset-auto md:z-auto border-l border-[rgba(0,0,0,0.08)] bg-[#FBFBFD] flex flex-col overflow-y-auto anim-fade-in shadow-apple-sm flex-shrink-0">
      <div className="p-4 border-b border-[rgba(0,0,0,0.05)] flex items-center justify-between bg-white">
        <h2 className="text-[14px] font-bold text-[#1D1D1F]">
          Comments {topLevel.length > 0 && <span className="text-[#8E8E93] font-normal">({topLevel.length})</span>}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close comments" className="text-[#8E8E93] hover:text-[#1D1D1F] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-24 bg-[#E8E8ED] rounded-xl animate-pulse" />)
        ) : topLevel.length === 0 ? (
          <div className="text-center py-10">
            <svg className="w-8 h-8 mx-auto mb-2 text-[#C7C7CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-[13px] text-[#8E8E93]">No comments yet.<br />Select text to add one.</p>
          </div>
        ) : (
          topLevel.map((c) => (
            <div key={c._id} id={`comment-${c._id}`}>
              <CommentThread
                comment={c}
                replies={repliesFor(c._id)}
                onResolve={resolveComment}
                onReply={addReply}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
