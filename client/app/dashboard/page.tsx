'use client';
import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import Image from 'next/image';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface Doc {
  _id: string;
  title: string;
  ownerId: string;
  updatedAt: string;
  createdAt: string;
  collaborators: { userId: string; permission: string }[];
  shareLink?: string | null;
  shareLinkPermission?: 'view' | 'edit' | null;
  deletedAt?: string | null;
  folderId?: string | null;
  content?: string;
  lastEditedBy?: string;
  lastEditedAt?: string;
  isLive?: boolean;
}

interface Folder {
  _id: string;
  name: string;
  docCount: number;
}

interface Activity {
  id: string;
  type: 'edit' | 'join' | 'mention' | 'share' | 'create';
  user: string;
  documentTitle: string;
  documentId: string;
  timestamp: string;
  description: string;
  avatar: string;
}

const fetcher = (url: string) => api.get(url).then((r) => r.data);

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 65%, 55%)`;
}

// ─── Favorites ────────────────────────────────────────────────────────────────
function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const s = localStorage.getItem('collabdocs_favorites');
      return s ? new Set(JSON.parse(s)) : new Set();
    } catch { return new Set(); }
  });
  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('collabdocs_favorites', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);
  return { favorites, toggle };
}

// ─── Pinned ───────────────────────────────────────────────────────────────────
function usePinned() {
  const [pinned, setPinned] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const s = localStorage.getItem('collabdocs_pinned');
      return s ? new Set(JSON.parse(s)) : new Set();
    } catch { return new Set(); }
  });
  const toggle = useCallback((id: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('collabdocs_pinned', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);
  return { pinned, toggle };
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────
function RenameModal({ doc, onClose, onSave }: { doc: Doc; onClose: () => void; onSave: (title: string) => void }) {
  const [title, setTitle] = useState(doc.title || 'Untitled');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.select(); }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) onSave(title.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade-in">
      <div className="bg-white rounded-[20px] shadow-apple-xl max-w-sm w-full p-6 anim-scale-in">
        <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-4">Rename Document</h2>
        <form onSubmit={submit}>
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-apple mb-4"
            placeholder="Document title"
          />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center py-2.5">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center py-2.5">Rename</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Folder name Modal (create / rename) ──────────────────────────────────────
function FolderNameModal({ title, initial = '', confirmLabel, onClose, onSave }: {
  title: string; initial?: string; confirmLabel: string; onClose: () => void; onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.select(); }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSave(name.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade-in">
      <div className="bg-white rounded-[20px] shadow-apple-xl max-w-sm w-full p-6 anim-scale-in">
        <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-4">{title}</h2>
        <form onSubmit={submit}>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-apple mb-4"
            placeholder="Folder name"
          />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center py-2.5">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center py-2.5">{confirmLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Move-to-folder Modal ──────────────────────────────────────────────────────
function MoveToFolderModal({ doc, folders, onClose, onMove }: {
  doc: Doc; folders: Folder[]; onClose: () => void; onMove: (doc: Doc, folderId: string | null) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade-in">
      <div className="bg-white rounded-[20px] shadow-apple-xl max-w-sm w-full p-6 anim-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-semibold text-[#1D1D1F]">Move "{doc.title || 'Untitled'}"</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="w-7 h-7 rounded-full text-[#8E8E93] hover:bg-[#F5F5F7] flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          <button
            type="button"
            onClick={() => onMove(doc, null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${
              !doc.folderId ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            No folder (root)
          </button>
          {folders.length === 0 && (
            <p className="text-[13px] text-[#8E8E93] px-3 py-2">No folders yet — create one from the sidebar.</p>
          )}
          {folders.map((f) => (
            <button
              key={f._id}
              type="button"
              onClick={() => onMove(doc, f._id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${
                doc.folderId === f._id ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              <span className="flex-1 truncate">{f.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────
interface Person { userId: string; email: string | null; displayName: string | null; avatarUrl: string | null; permission: 'view' | 'edit'; }

function ShareModal({ doc, onClose, toast, currentUserId }: { doc: Doc; onClose: () => void; toast: any; currentUserId?: string }) {
  const [shareUrl, setShareUrl] = useState<string | null>(
    doc.shareLink ? `${window.location.origin}/doc/${doc._id}?share=${doc.shareLink}` : null
  );
  const [permission, setPermission] = useState<'view' | 'edit'>(doc.shareLinkPermission || 'view');
  const [enabled, setEnabled] = useState(!!doc.shareLink);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // People with access (collaborators invited by email) — mirrors the editor's
  // Share modal so owners can manage access without opening the document.
  const isOwner = doc.ownerId?.toString() === currentUserId?.toString();
  interface Pending { email: string; permission: 'view' | 'edit'; }
  const [people, setPeople] = useState<Person[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Pending[]>([]);
  const [ownerInfo, setOwnerInfo] = useState<{ userId: string; displayName: string | null; email: string | null } | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePerm, setInvitePerm] = useState<'view' | 'edit'>('view');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    api.get(`/docs/${doc._id}/collaborators`)
      .then((res) => {
        setPeople(res.data.collaborators || []);
        setPendingInvites(res.data.pendingInvites || []);
        setOwnerInfo(res.data.owner || null);
      })
      .catch(() => { /* non-fatal — link sharing still works */ });
  }, [doc._id]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true); setInviteError('');
    try {
      const res = await api.post(`/docs/${doc._id}/collaborators`, { email: inviteEmail.trim(), permission: invitePerm });
      setPeople(res.data.collaborators || []);
      setPendingInvites(res.data.pendingInvites || []);
      const stillPending = (res.data.pendingInvites || []).some(
        (p: Pending) => p.email === inviteEmail.trim().toLowerCase()
      );
      setInviteEmail('');
      toast.success(stillPending ? 'Invitation emailed — they can join with this address' : 'Invitation sent');
    } catch (err: any) {
      setInviteError(err.response?.data?.error || 'Could not add that person');
    } finally { setInviteLoading(false); }
  };

  const changePersonPermission = async (email: string | null, perm: 'view' | 'edit') => {
    if (!email) return;
    try {
      const res = await api.post(`/docs/${doc._id}/collaborators`, { email, permission: perm });
      setPeople(res.data.collaborators || []);
      setPendingInvites(res.data.pendingInvites || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not update permission');
    }
  };

  const removePerson = async (userId: string) => {
    try {
      const res = await api.delete(`/docs/${doc._id}/collaborators/${userId}`);
      setPeople(res.data.collaborators || []);
      setPendingInvites(res.data.pendingInvites || []);
      toast.success('Removed');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not remove person');
    }
  };

  const removePendingInvite = async (email: string) => {
    try {
      const res = await api.delete(`/docs/${doc._id}/invites`, { data: { email } });
      setPendingInvites(res.data.pendingInvites || []);
      toast.success('Invitation revoked');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not revoke invitation');
    }
  };

  const apply = async (newEnabled: boolean, newPerm: 'view' | 'edit') => {
    setLoading(true); setError('');
    try {
      const res = await api.post(`/docs/${doc._id}/share`,
        newEnabled ? { permission: newPerm } : { disable: true }
      );
      setEnabled(newEnabled);
      setPermission(newPerm);
      setShareUrl(res.data.shareUrl || null);
      toast.success(newEnabled ? 'Share link created' : 'Sharing disabled');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to update sharing');
    } finally { setLoading(false); }
  };

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied');
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade-in">
      <div className="bg-white rounded-[20px] shadow-apple-xl max-w-[420px] w-full p-6 anim-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[17px] font-semibold text-[#1D1D1F]">Share "{doc.title || 'Untitled'}"</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="w-7 h-7 rounded-full text-[#8E8E93] hover:bg-[#F5F5F7] flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {error && <div className="mb-4 bg-[#FFF2F1] border border-[#FF3B30]/20 text-[#FF3B30] rounded-[10px] px-3 py-2.5 text-[13px] font-medium">{error}</div>}
        <div className="flex items-center justify-between p-4 bg-[#F5F5F7] rounded-[12px] mb-4">
          <div>
            <p className="text-[14px] font-semibold text-[#1D1D1F]">Share via link</p>
            <p className="text-[12px] text-[#6E6E73] mt-0.5">Anyone with the link can access</p>
          </div>
          <button type="button" aria-label={enabled ? 'Disable sharing' : 'Enable sharing'}
            onClick={() => apply(!enabled, permission)} disabled={loading}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full overflow-hidden transition-colors duration-200
              ${enabled ? 'bg-[#34C759]' : 'bg-[#D1D1D6]'} ${loading ? 'opacity-60' : ''}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${enabled ? 'translate-x-[18px]' : 'translate-x-0'}`} />
          </button>
        </div>
        {enabled && (
          <div className="mb-4 anim-slide-up">
            <p className="text-[12px] font-semibold text-[#6E6E73] mb-2">Permission</p>
            <div className="flex gap-2">
              {(['view', 'edit'] as const).map((p) => (
                <button type="button" key={p} onClick={() => { setPermission(p); apply(true, p); }} disabled={loading}
                  className={`flex-1 py-2 rounded-[8px] text-[13px] font-semibold border transition-all ${permission === p ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#3A3A3C] border-[rgba(0,0,0,0.10)] hover:border-[#2563EB]/30'}`}>
                  {p === 'view' ? 'View only' : 'Can edit'}
                </button>
              ))}
            </div>
          </div>
        )}
        {enabled && shareUrl && (
          <div className="flex gap-2 anim-slide-up">
            <input readOnly aria-label="Share link" value={shareUrl} className="input-apple text-[12px] flex-1 bg-[#F5F5F7] cursor-default" />
            <button type="button" onClick={copyLink}
              className={`flex-shrink-0 px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all ${copied ? 'bg-[#34C759] text-white' : 'btn-primary'}`}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
        {!enabled && <p className="text-[13px] text-[#8E8E93] text-center mt-2">Enable sharing to generate a link</p>}

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

            {/* Pending invites — addresses without an account yet */}
            {pendingInvites.map((p) => (
              <div key={`pending-${p.email}`} className="flex items-center gap-2.5 py-1.5">
                <div className="w-7 h-7 rounded-full bg-[#E5E7EB] text-[#8E8E93] flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1D1D1F] truncate">{p.email}</p>
                  <p className="text-[11px] text-[#B8860B] truncate">Pending — invitation emailed</p>
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
                    <button type="button" onClick={() => removePendingInvite(p.email)} aria-label={`Revoke invitation for ${p.email}`} className="text-[#8E8E93] hover:text-[#FF3B30] flex-shrink-0 p-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </>
                ) : (
                  <span className="text-[12px] text-[#8E8E93] flex-shrink-0">Pending</span>
                )}
              </div>
            ))}

            {people.length === 0 && pendingInvites.length === 0 && !ownerInfo && (
              <p className="text-[12px] text-[#8E8E93] py-1">No one else has access yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Doc Info Modal ───────────────────────────────────────────────────────────
function DocInfoModal({ doc, isOwner, onClose }: { doc: Doc; isOwner: boolean; onClose: () => void }) {
  const created = new Date(doc.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const updated = new Date(doc.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start justify-between py-3 border-b border-[rgba(0,0,0,0.06)] last:border-0">
      <span className="text-[13px] text-[#6E6E73]">{label}</span>
      <span className="text-[13px] font-medium text-[#1D1D1F] text-right max-w-[60%]">{value}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade-in">
      <div className="bg-white rounded-[20px] shadow-apple-xl max-w-sm w-full p-6 anim-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[17px] font-semibold text-[#1D1D1F]">Document Info</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="w-7 h-7 rounded-full text-[#8E8E93] hover:bg-[#F5F5F7] flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <Row label="Title"        value={doc.title || 'Untitled'} />
        <Row label="Created"      value={created} />
        <Row label="Last modified" value={updated} />
        <Row label="Owner"        value={isOwner ? 'You' : 'Shared with you'} />
        <Row label="Collaborators" value={`${doc.collaborators?.length || 0} people`} />
        <Row label="Sharing"      value={doc.shareLink ? `Link sharing on (${doc.shareLinkPermission})` : 'Not shared'} />
      </div>
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
function ContextMenu({
  anchor,
  isOwner, isFavorite,
  onRename, onFavorite, onShare, onCopyLink,
  onDuplicate, onVersionHistory, onExport, onInfo, onDelete, onMove,
  onClose,
}: {
  anchor: DOMRect;
  isOwner: boolean; isFavorite: boolean;
  onRename: () => void; onFavorite: () => void; onShare: () => void; onCopyLink: () => void;
  onDuplicate: () => void; onVersionHistory: () => void; onExport: (fmt: 'pdf' | 'docx') => void;
  onInfo: () => void; onDelete: () => void; onMove?: () => void; onClose: () => void;
}) {
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  // Start below the button; useLayoutEffect will flip up if it overflows
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: anchor.bottom + 4,
    right: window.innerWidth - anchor.right,
    zIndex: 9999,
    visibility: 'hidden',
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideMobile = mobileMenuRef.current?.contains(target);
      const insideDesktop = desktopMenuRef.current?.contains(target);
      if (!insideMobile && !insideDesktop) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useLayoutEffect(() => {
    if (!desktopMenuRef.current) return;
    const rect = desktopMenuRef.current.getBoundingClientRect();
    const top = anchor.bottom + 4 + rect.height > window.innerHeight - 8
      ? Math.max(8, anchor.top - rect.height - 4)
      : anchor.bottom + 4;
    setStyle({
      position: 'fixed',
      top,
      right: window.innerWidth - anchor.right,
      zIndex: 9999,
      visibility: 'visible',
    });
  }, [anchor]);

  const Item = ({ icon, label, onClick, danger, disabled }: {
    icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-[14px] font-medium transition-colors text-left rounded-md
        ${danger ? 'text-[#FF3B30] hover:bg-[#FFF2F1] active:bg-[#FFE8E6]' : 'text-[#1D1D1F] hover:bg-[#F5F5F7] active:bg-[#EBEBEF]'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">{icon}</span>
      {label}
    </button>
  );

  const Divider = () => <div className="h-px bg-[rgba(0,0,0,0.07)] my-1" />;

  const menuContent = (
    <>
      {/* Group 1 */}
      <Item icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
        label="Rename" onClick={() => { onRename(); onClose(); }} />
      <Item icon={<svg fill={isFavorite ? '#FFCC00' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-[#FFCC00]"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
        label={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'} onClick={() => { onFavorite(); onClose(); }} />

      <Divider />

      {/* Group 2 */}
      <Item icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
        label="Copy Link" onClick={() => { onCopyLink(); onClose(); }} />

      <Divider />

      {/* Group 3 */}
      <Item icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>}
        label="Duplicate" onClick={() => { onDuplicate(); onClose(); }} />
      {onMove && isOwner && (
        <Item icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>}
          label="Move to folder" onClick={() => { onMove(); onClose(); }} />
      )}
      <Item icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        label="Version History" onClick={() => { onVersionHistory(); onClose(); }} />

      <Divider />

      {/* Group 4 */}
      <div>
        <button type="button"
          onClick={() => setExportOpen((v) => !v)}
          className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-[14px] font-medium transition-colors text-left rounded-md text-[#1D1D1F] hover:bg-[#F5F5F7] active:bg-[#EBEBEF]`}
        >
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </span>
          Export {exportOpen && '▼'}
        </button>
        {exportOpen && (
          <div className="ml-3 border-l-2 border-[#2563EB]/20 pl-2 mb-1">
            <button type="button" onClick={() => { onExport('pdf'); onClose(); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[#1D1D1F] hover:bg-[#F5F5F7] active:bg-[#E8E8ED] rounded-lg transition-colors">
              <span className="text-[10px] font-bold bg-[#FF3B30] text-white px-1 rounded">PDF</span> Export as PDF
            </button>
            <button type="button" onClick={() => { onExport('docx'); onClose(); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[#1D1D1F] hover:bg-[#F5F5F7] active:bg-[#E8E8ED] rounded-lg transition-colors">
              <span className="text-[10px] font-bold bg-[#2563EB] text-white px-1 rounded">DOC</span> Export as DOCX
            </button>
          </div>
        )}
      </div>
      <Item icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        label="Document Info" onClick={() => { onInfo(); onClose(); }} />
    </>
  );

  return (
    <>
      {/* Mobile: full-screen bottom sheet */}
      <div className="md:hidden fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div
          ref={mobileMenuRef}
          className="absolute bottom-3 left-3 right-3 bg-white rounded-[24px] pb-6 pt-2 shadow-apple-xl anim-slide-up max-h-[70vh] overflow-y-auto"
        >
          {/* Handle bar */}
          <div className="w-10 h-1 bg-[rgba(0,0,0,0.15)] rounded-full mx-auto mb-3" />
          <div className="px-2">
            {menuContent}
          </div>
        </div>
      </div>

      {/* Desktop: portal dropdown with smart flip */}
      {createPortal(
        <div
          ref={desktopMenuRef}
          style={style}
          className="hidden md:block w-52 bg-white rounded-[14px] shadow-apple-lg border border-[rgba(0,0,0,0.08)] py-1.5 anim-scale-in origin-top-right"
        >
          {menuContent}
        </div>,
        document.body
      )}
    </>
  );
}

// ─── SidebarItem ────────────────────────────────────────────────────────────────
function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
        active ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]'
      }`}
    >
      <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
      {label}
    </button>
  );
}

// ─── Mobile Bottom Nav ───────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    key: 'all' as const,
    label: 'Docs',
    icon: (active: boolean) => (
      <svg className={`w-6 h-6 ${active ? 'text-[#2563EB]' : 'text-[#8E8E93]'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    key: 'shared' as const,
    label: 'Shared',
    icon: (active: boolean) => (
      <svg className={`w-6 h-6 ${active ? 'text-[#2563EB]' : 'text-[#8E8E93]'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    key: 'starred' as const,
    label: 'Starred',
    icon: (active: boolean) => (
      <svg className={`w-6 h-6 ${active ? 'text-[#2563EB]' : 'text-[#8E8E93]'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    key: 'trash' as const,
    label: 'Trash',
    icon: (active: boolean) => (
      <svg className={`w-6 h-6 ${active ? 'text-[#2563EB]' : 'text-[#8E8E93]'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  },
];

function MobileBottomNav({ filterMode, setFilterMode }: { filterMode: string; setFilterMode: (m: any) => void }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-xl border-t border-[rgba(0,0,0,0.08)] flex items-stretch h-16 safe-area-inset-bottom">
      {NAV_ITEMS.map((item) => {
        const active = filterMode === item.key;
        return (
          <button
            key={item.key}
            onClick={() => setFilterMode(item.key)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90"
          >
            {item.icon(active)}
            <span className={`text-[10px] font-semibold tracking-tight ${active ? 'text-[#2563EB]' : 'text-[#8E8E93]'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Time Helper ────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function HighlightedTitle({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) {
    return <span>{text}</span>;
  }
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-[#FFCC00]/40 text-[#1D1D1F] rounded-[2px] px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// ─── DocCard ──────────────────────────────────────────────────────────────────
function DocCard({
  doc, userId, isFavorite, isPinned, searchQuery = '',
  onDelete, onFavoriteToggle, onPinToggle, onRename, onDuplicate, onShareOpen, onInfoOpen,
  onRestore, onPermanentDelete, onMoveToFolder,
}: {
  doc: Doc; userId: string; isFavorite: boolean; isPinned: boolean; searchQuery?: string;
  onDelete: (id: string) => void;
  onFavoriteToggle: (id: string) => void;
  onPinToggle: (id: string) => void;
  onRename: (doc: Doc) => void;
  onDuplicate: (doc: Doc) => void;
  onShareOpen: (doc: Doc) => void;
  onInfoOpen: (doc: Doc) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  onMoveToFolder?: (doc: Doc) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const isOwner = doc.ownerId?.toString() === userId?.toString();
  const timeStr = timeAgo(doc.updatedAt);
  const isDeleted = !!doc.deletedAt;

  // Trash retention — keep in sync with TRASH_TTL_DAYS on the server.
  const TRASH_TTL_DAYS = 7;
  const purgeDate = isDeleted ? new Date(new Date(doc.deletedAt!).getTime() + TRASH_TTL_DAYS * 24 * 60 * 60 * 1000) : null;
  const daysUntilPurge = isDeleted ? Math.max(1, 7 - Math.floor((Date.now() - new Date(doc.deletedAt!).getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const purgeDateStr = purgeDate ? purgeDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const purgeTooltip = isDeleted ? `Will be permanently deleted on ${purgeDateStr}` : '';

  const status = isDeleted ? 'Trash' : (!isOwner ? 'Shared' : (doc.shareLink ? 'Shared' : 'Private'));
  const statusColor = isDeleted
    ? 'bg-[#FF3B30]/10 text-[#FF3B30] ring-1 ring-inset ring-[#FF3B30]/25'
    : !isOwner
      ? 'bg-[#2563EB]/10 text-[#2563EB] ring-1 ring-inset ring-[#2563EB]/25'
      : doc.shareLink
        ? 'bg-[#34C759]/10 text-[#34C759] ring-1 ring-inset ring-[#34C759]/25'
        : 'bg-[#8E8E93]/10 text-[#8E8E93] ring-1 ring-inset ring-[#8E8E93]/25';

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/doc/${doc._id}`);
    toast.success('Link copied to clipboard');
  };

  const exportDoc = async (fmt: 'pdf' | 'docx') => {
    try {
      toast.info(`Preparing ${fmt.toUpperCase()} export…`);
      const mimeType = fmt === 'pdf' ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const res = await api.get(`/export/${doc._id}/${fmt}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title || 'document'}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast.success('Export complete');
    } catch {
      toast.error('Export failed');
    }
  };

  // Helper to generate a color from string
  const hashColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 70%, 55%)`;
  };

  return (
    <div className="apple-card group relative overflow-visible flex flex-col h-full hover:shadow-apple-lg transition-all duration-300 bg-white" title={isDeleted ? purgeTooltip : undefined}>
      <div onClick={() => router.push(`/doc/${doc._id}`)} className="cursor-pointer">
        {/* Thumbnail */}
        <div className="h-28 bg-gradient-to-br from-[#F5F5F7] to-[#E8E8ED] flex items-center justify-center relative overflow-hidden rounded-t-[16px]">
          <div className="absolute inset-0 flex flex-col justify-center px-6 py-4 gap-2 opacity-40">
            <div className="h-2 bg-[#AEAEB2] rounded-full w-3/4" />
            <div className="h-1.5 bg-[#AEAEB2] rounded-full w-full" />
            <div className="h-1.5 bg-[#AEAEB2] rounded-full w-5/6" />
            <div className="h-1.5 bg-[#AEAEB2] rounded-full w-2/3" />
          </div>
          {/* AI Writing Badge */}
          {doc.content?.includes('AI') && (
            <AIWritingBadge doc={doc} />
          )}
          
          {/* Pin badge */}
          {isPinned && (
            <div className="absolute top-2 right-2 w-5 h-5 bg-[#FF9500] rounded-full flex items-center justify-center shadow-sm z-10" title="Pinned">
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
          )}
          {isFavorite && (
            <div className="absolute top-2 left-2 w-5 h-5 text-[#FFCC00]">
              <svg fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
            </div>
          )}
          
          {/* Quick Actions Overlay on Hover */}
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 backdrop-blur-[1px]">
            {isDeleted ? (
              <>
                <button onClick={(e) => { e.stopPropagation(); onRestore?.(doc._id); }} className="p-2 bg-white/90 text-[#34C759] hover:bg-white rounded-full shadow-sm hover:scale-110 transition-all" title="Restore">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onPermanentDelete?.(doc._id); }} className="p-2 bg-white/90 text-[#FF3B30] hover:bg-white rounded-full shadow-sm hover:scale-110 transition-all" title="Delete Permanently">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </>
            ) : (
              <>
                <button onClick={(e) => { e.stopPropagation(); router.push(`/doc/${doc._id}`); }} className="p-2 bg-white/90 text-[#1D1D1F] hover:bg-white rounded-full shadow-sm hover:scale-110 transition-all" title="Open">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onPinToggle(doc._id); }} className={`p-2 bg-white/90 hover:bg-white rounded-full shadow-sm hover:scale-110 transition-all ${isPinned ? 'text-[#FF9500]' : 'text-[#8E8E93]'}`} title={isPinned ? 'Unpin' : 'Pin to top'}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onShareOpen(doc); }} className={`p-2 bg-white/90 hover:bg-white rounded-full shadow-sm hover:scale-110 transition-all ${!isOwner ? 'opacity-50 cursor-not-allowed text-[#8E8E93]' : 'text-[#2563EB]'}`} title="Share" disabled={!isOwner}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(doc._id); }} className={`p-2 bg-white/90 hover:bg-white rounded-full shadow-sm hover:scale-110 transition-all ${!isOwner ? 'opacity-50 cursor-not-allowed text-[#8E8E93]' : 'text-[#FF3B30]'}`} title="Delete" disabled={!isOwner}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

        {/* Enhanced Info with content preview */}
        <div className="p-3 flex flex-col gap-2">
          {/* Title + 3-dot */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-[#1D1D1F] text-sm truncate flex-1 leading-snug cursor-pointer" onClick={() => router.push(`/doc/${doc._id}`)}>
              <HighlightedTitle text={doc.title || 'Untitled'} highlight={searchQuery} />
            </h3>
            <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                ref={btnRef}
                type="button"
                aria-label="Document options"
                onClick={() => {
                  if (!menuOpen && btnRef.current) setMenuAnchor(btnRef.current.getBoundingClientRect());
                  setMenuOpen((v) => !v);
                }}
                className="p-1 -mr-1 rounded-md text-[#8E8E93] hover:bg-[#F5F5F7] transition-all duration-150"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
              {menuOpen && menuAnchor && (
                <ContextMenu
                  anchor={menuAnchor}
                  isOwner={isOwner}
                  isFavorite={isFavorite}
                  onRename={() => onRename(doc)}
                  onFavorite={() => onFavoriteToggle(doc._id)}
                  onShare={() => onShareOpen(doc)}
                  onCopyLink={copyLink}
                  onDuplicate={() => onDuplicate(doc)}
                  onVersionHistory={() => router.push(`/doc/${doc._id}`)}
                  onExport={exportDoc}
                  onInfo={() => onInfoOpen(doc)}
                  onDelete={() => onDelete(doc._id)}
                  onMove={onMoveToFolder ? () => onMoveToFolder(doc) : undefined}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </div>
          </div>

          {/* Content Preview */}
          {doc.content && (
            <div className="bg-gradient-to-br from-[#F5F5F7] to-[#E8E8ED] rounded-lg p-4 mt-2 border border-[rgba(0,0,0,0.08)] shadow-sm">
              <p className="text-[13px] text-[#1D1D1F] line-clamp-3 leading-relaxed font-medium">
                {doc.content.length > 180 ? doc.content.substring(0, 180) + '...' : doc.content}
              </p>
            </div>
          )}

          {/* Status + time + collaborator avatars */}
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md flex-shrink-0 ${statusColor}`}>
              {doc.isLive ? 'Editing' : status}
            </span>
            <span className="text-[11px] text-[#8E8E93] truncate flex-1">
              {isDeleted ? (
                <span className="text-[#FF3B30] font-medium cursor-help" title={purgeTooltip}>
                  Deletes in {daysUntilPurge} {daysUntilPurge === 1 ? 'day' : 'days'}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  {doc.isLive && !isDeleted && (
                    <>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#34C759]" />
                      </span>
                      <span className="text-[#34C759] font-medium">live</span>
                    </>
                  )}
                  {doc.lastEditedBy && !isDeleted && (
                    <span className="text-[#2563EB]">by {doc.lastEditedBy}</span>
                  )}
                  {timeStr}
                </span>
              )}
            </span>
            {doc.collaborators && doc.collaborators.length > 0 && (
              <div className="flex -space-x-1.5 flex-shrink-0">
                {doc.collaborators.slice(0, 3).map((c) => (
                  <div key={c.userId} className="w-4 h-4 rounded-full border border-white flex items-center justify-center text-white text-[7px] font-bold relative" style={{ backgroundColor: hashColor(c.userId) }}>
                    {c.userId.slice(-1).toUpperCase()}
                    {Math.random() > 0.6 && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-[#34C759] rounded-full border border-white" />
                    )}
                  </div>
                ))}
                {doc.collaborators.length > 3 && (
                  <div className="w-4 h-4 rounded-full border border-white bg-[#E8E8ED] flex items-center justify-center text-[#6E6E73] text-[8px] font-bold">
                    +{doc.collaborators.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}

// ─── Smart New Document Modal ────────────────────────────────────────────────────────
function NewDocumentModal({ onClose, onCreate }: { onClose: () => void; onCreate: (title: string, template?: string, content?: string) => void }) {
  const [selectedTab, setSelectedTab] = useState<'blank' | 'template' | 'import'>('blank');
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [docTitle, setDocTitle] = useState('Untitled Document');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    console.log('handleCreate called, isCreating:', isCreating, 'selectedTab:', selectedTab);
    if (isCreating) return;
    setIsCreating(true);

    try {
      console.log('Creating with title:', docTitle || 'Untitled');
      if (selectedTab === 'blank') {
        await onCreate(docTitle || 'Untitled');
      } else if (selectedTab === 'template' && selectedTemplate) {
        await onCreate(selectedTemplate.title || selectedTemplate.id, selectedTemplate.id, selectedTemplate.content);
      } else if (selectedTab === 'import' && importFile) {
        // Handle file import
        const extension = importFile.name.split('.').pop()?.toLowerCase();
        let content = '';

        if (extension === 'pdf') {
          try {
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
            const arrayBuffer = await importFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            // Smarter PDF text extraction preserving basic formatting
            let baseFontSize = 0;
            const fontSizes: Record<number, number> = {};
            
            // First pass to find base font size
            for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              for (const item of textContent.items as any[]) {
                if (item.str && item.str.trim()) {
                  const size = Math.round(item.transform[3]);
                  fontSizes[size] = (fontSizes[size] || 0) + item.str.length;
                }
              }
            }
            baseFontSize = parseInt(Object.keys(fontSizes).reduce((a, b) => fontSizes[parseInt(a)] > fontSizes[parseInt(b)] ? a : b, "12"));

            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              
              let lastY = -1;
              let currentLine = '';
              let currentFontSize = baseFontSize;
              
              for (const item of textContent.items as any[]) {
                if (!item.str) continue;
                
                const y = Math.round(item.transform[5]);
                const fontSize = Math.round(item.transform[3]);
                const fontName = item.fontName || '';
                const isBold = fontName.toLowerCase().includes('bold');
                
                let text = item.str;
                
                // If it's a new line (Y changed by more than a tiny amount)
                if (lastY !== -1 && Math.abs(lastY - y) > 2) {
                  // If it was a heading
                  if (currentFontSize > baseFontSize + 2) {
                    content += `<h2>${currentLine.trim()}</h2>`;
                  } else {
                    content += `<p>${currentLine.trim()}</p>`;
                  }
                  currentLine = '';
                }
                
                if (isBold) {
                  currentLine += `<strong>${text}</strong>`;
                } else {
                  currentLine += text;
                }
                
                lastY = y;
                currentFontSize = fontSize;
                
                // Add space if there is EOL but we didn't break line
                if (item.hasEOL && currentLine) {
                  currentLine += ' ';
                }
              }
              
              if (currentLine.trim()) {
                if (currentFontSize > baseFontSize + 2) {
                  content += `<h2>${currentLine.trim()}</h2>`;
                } else {
                  content += `<p>${currentLine.trim()}</p>`;
                }
              }
            }
          } catch (e) {
            console.error('Error parsing PDF:', e);
            content = await importFile.text(); // Fallback
          }
        } else if (extension === 'docx') {
          try {
            const mammoth = (await import('mammoth')).default || await import('mammoth');
            const arrayBuffer = await importFile.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            content = result.value;
          } catch (e) {
            console.error('Error parsing DOCX:', e);
            content = await importFile.text(); // Fallback
          }
        } else {
          content = await importFile.text();
        }

        await onCreate(importFile.name.replace(/\.[^/.]+$/, ''), undefined, content);
      }
      console.log('Document creation completed');
      onClose();
    } catch (err) {
      console.error('Error in handleCreate:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const SMART_TEMPLATES = [
    {
      id: 'meeting-notes',
      title: 'Meeting Notes',
      description: 'Structured meeting documentation',
      icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" strokeWidth="0"/><path d="M9 3v2M15 3v2M5 8h14" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M6 10h12v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-9z" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M9 13h6M9 16h6M9 19h3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>,
      color: 'from-blue-500 to-blue-600',
      preview: '## Meeting Details\n**Date:** \n**Attendees:** \n\n## Agenda\n- \n\n## Action Items\n- [ ] ',
      content: '# **Meeting Notes**\n\n## **Date:** \n\n## **Attendees:** \n\n## **Agenda**\n1. \n2. \n3. \n\n## **Discussion Points**\n- \n- \n\n## **Decisions Made**\n1. \n2. \n\n## **Action Items**\n- [ ] \n- [ ] \n- [ ] \n\n## **Next Steps**\n'
    },
    {
      id: 'project-brief',
      title: 'Project Brief',
      description: 'Comprehensive project planning',
      icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2-13H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>,
      color: 'from-purple-500 to-purple-600',
      preview: '# Project Brief\n\n## Overview\n\n## Objectives\n\n## Timeline\n\n## Resources',
      content: '# **Project Brief**\n\n## **Overview**\n\n## **Objectives**\n1. \n2. \n3. \n\n## **Scope**\n- **Includes:**\n  - \n  - \n- **Excludes:**\n  - \n  - \n\n## **Timeline**\n- **Phase 1:** \n- **Phase 2:** \n- **Phase 3:** \n\n## **Resources**\n- **Team Members:** \n- **Budget:** \n- **Tools & Technology:** \n\n## **Success Criteria**\n1. \n2. \n3. \n'
    },
    {
      id: 'ai-assistant',
      title: 'AI Assistant',
      description: 'AI-powered writing assistant',
      icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>,
      color: 'from-green-500 to-green-600',
      preview: '# AI Writing Assistant\n\n## Topic:\n\n## Key Points:\n\n## AI Suggestions:\n*Generating intelligent content...*',
      content: '# **AI Writing Assistant**\n\n## **Topic:** \n\n## **Key Points**\n1. \n2. \n3. \n\n## **Draft Content**\n\n## **AI Suggestions**\n- \n- \n- \n\n## **Refinements**\n1. \n2. \n3. \n\n## **Final Notes**\n'
    },
    {
      id: 'code-documentation',
      title: 'Code Documentation',
      description: 'Developer-focused documentation',
      icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9.4 16.6L4.8 12l4.6-4.6M14.6 16.6l4.6-4.6-4.6-4.6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      color: 'from-orange-500 to-orange-600',
      preview: '# API Documentation\n\n## Overview\n\n```javascript\n// Code examples\n```\n\n## Parameters',
      content: '# **API Documentation**\n\n## **Overview**\n\n## **Authentication**\n```javascript\n// Add authentication code here\n```\n\n## **Endpoints**\n1. **GET** - Description\n2. **POST** - Description\n3. **PUT** - Description\n\n## **Parameters**\n- \n- \n\n## **Response Examples**\n```json\n// Add response examples here\n```\n\n## **Error Handling**\n- \n- \n\n## **Code Examples**\n'
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade-in">
      <div className="bg-white rounded-[24px] shadow-apple-xl max-w-4xl w-full max-h-[85vh] overflow-hidden anim-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[rgba(0,0,0,0.06)]">
          <div>
            <h2 className="text-xl font-bold text-[#1D1D1F]">Create New Document</h2>
            <p className="text-sm text-[#6E6E73] mt-1">Choose how you want to start</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-[#8E8E93]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[rgba(0,0,0,0.06)]">
          {[
            { id: 'blank', label: 'Blank', icon: '' },
            { id: 'template', label: 'Templates', icon: '' },
            { id: 'import', label: 'Import', icon: '' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-medium text-sm transition-all ${
                selectedTab === tab.id
                  ? 'text-[#2563EB] border-b-2 border-[#2563EB] bg-[#2563EB]/5'
                  : 'text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {selectedTab === 'blank' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1D1D1F] mb-2">Document Title</label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="input-apple w-full"
                  placeholder="Enter document title..."
                />
              </div>
              <div className="p-4 bg-[#F5F5F7] rounded-xl">
                <p className="text-sm text-[#6E6E73]">Start with a clean slate and build your document from scratch.</p>
              </div>
            </div>
          )}

          {selectedTab === 'template' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SMART_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      selectedTemplate?.id === template.id
                        ? 'border-[#2563EB] bg-[#2563EB]/5'
                        : 'border-[rgba(0,0,0,0.08] hover:border-[#2563EB]/30 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center text-white text-xl shadow-sm`}>
                        {template.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-[#1D1D1F]">{template.title}</h3>
                        <p className="text-sm text-[#6E6E73] mt-1">{template.description}</p>
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-[#F5F5F7] rounded-lg text-xs text-[#8E8E93] font-mono line-clamp-3">
                      {template.preview}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedTab === 'import' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-[#2563EB]/30 rounded-xl p-8 text-center hover:border-[#2563EB]/60 transition-colors">
                <div className="w-16 h-16 bg-[#2563EB]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[#1D1D1F] mb-2">Drop files here or click to browse</h3>
                <p className="text-sm text-[#6E6E73] mb-4">Support for .docx, .pdf, .txt, .md files</p>
                <input
                  type="file"
                  accept=".docx,.pdf,.txt,.md"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-xl hover:bg-[#1D4ED8] transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Choose Files
                </label>
                {importFile && (
                  <div className="mt-4 p-3 bg-[#34C759]/10 rounded-lg">
                    <p className="text-sm text-[#34C759] font-medium">✓ {importFile.name}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-[rgba(0,0,0,0.06)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || (selectedTab === 'template' && !selectedTemplate) || (selectedTab === 'import' && !importFile)}
            className="btn-primary gap-2"
          >
            {isCreating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Document
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────────
function ActivityFeed({ activities }: { activities: Activity[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayActivities = isExpanded ? activities : activities.slice(0, 4);

  return (
    <div className="mb-6 bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm">
      <div className="p-4 border-b border-[rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#2563EB] to-[#34C759] rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-[#1D1D1F] text-sm">Activity Feed</h3>
              <p className="text-[11px] text-[#8E8E93]">Real-time updates from your workspace</p>
            </div>
          </div>
          {activities.length > 4 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[#2563EB] text-[12px] font-medium hover:text-[#1D4ED8] transition-colors"
            >
              {isExpanded ? 'Show less' : `View all (${activities.length})`}
            </button>
          )}
        </div>
      </div>
      <div className="p-2">
        {displayActivities.map((activity, index) => (
          <div key={activity.id} className="flex items-start gap-3 p-3 hover:bg-[#F5F5F7] rounded-xl transition-colors group cursor-pointer">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563EB] to-[#34C759] flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
                {activity.avatar}
              </div>
              {activity.type === 'edit' && (
                <div className="w-2 h-2 bg-[#34C759] rounded-full -mt-1 ml-3 animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[#1D1D1F] font-medium leading-snug">
                <span className="font-semibold">{activity.user}</span>
                <span className="text-[#8E8E93] font-normal"> {activity.description}</span>
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-[#2563EB] font-medium hover:underline cursor-pointer">
                  {activity.documentTitle}
                </span>
                <span className="text-[10px] text-[#8E8E93]">•</span>
                <span className="text-[10px] text-[#8E8E93]">{timeAgo(activity.timestamp)}</span>
              </div>
            </div>
            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1.5 hover:bg-[#E8E8ED] rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5 text-[#8E8E93]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Real-time Activity Counter ────────────────────────────────────────────────────────
function RealTimeActivityCounter({ activeUsers }: { activeUsers: number }) {
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (activeUsers === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-6 p-3 bg-gradient-to-r from-[#34C759]/10 to-[#2563EB]/10 rounded-xl border border-[#34C759]/20">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34C759]" />
        </span>
        <span className={`text-sm font-semibold text-[#1D1D1F] ${isAnimating ? 'animate-pulse' : ''}`}>
          {activeUsers} {activeUsers === 1 ? 'person' : 'people'} editing now
        </span>
      </div>
      <div className="flex -space-x-1.5">
        {Array.from({ length: Math.min(3, activeUsers) }).map((_, i) => (
          <div 
            key={i} 
            className="w-6 h-6 rounded-full border-2 border-white bg-gradient-to-br from-[#2563EB] to-[#34C759] flex items-center justify-center text-white text-[9px] font-bold shadow-sm"
            style={{ animationDelay: `${i * 200}ms` }}
          >
            {String.fromCharCode(65 + i)}
          </div>
        ))}
        {activeUsers > 3 && (
          <div className="w-6 h-6 rounded-full border-2 border-white bg-[#8E8E93] flex items-center justify-center text-white text-[9px] font-bold shadow-sm">
            +{activeUsers - 3}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Recent Activity Strip ──────────────────────────────────────────────────────────
// Shows docs edited in the last 24h that have collaborators
function RecentActivityStrip({ docs, userId, onOpen }: { docs: Doc[]; userId: string; onOpen: (id: string) => void }) {
  const recent = docs
    .filter((d) => {
      const age = Date.now() - new Date(d.updatedAt).getTime();
      return d.collaborators && d.collaborators.length > 0 && age < 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  if (recent.length === 0) return null;

  return (
    <div className="mb-8 p-4 rounded-2xl bg-[#2563EB]/5 border border-[#2563EB]/10">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34C759]" />
        </span>
        <span className="text-[12px] font-bold text-[#10B981] uppercase tracking-wider">AI Templates</span>
        <span className="text-[11px] text-[#8E8E93] ml-auto">Smart & structured</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {recent.map((doc) => (
          <button
            key={doc._id}
            onClick={() => onOpen(doc._id)}
            className="flex-shrink-0 flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-[rgba(0,0,0,0.07)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 min-w-[180px] max-w-[220px] text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-[#1D1D1F] truncate">{doc.title || 'Untitled'}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="flex -space-x-1">
                  {doc.collaborators.slice(0, 3).map((c) => (
                    <div key={c.userId} className="w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center text-white text-[7px] font-bold" style={{ backgroundColor: hashColor(c.userId) }}>
                      {c.userId.slice(-1).toUpperCase()}
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-[#8E8E93]">{doc.collaborators.length} collab{doc.collaborators.length > 1 ? 's' : ''}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── AI Writing Assistant Badge ────────────────────────────────────────────────────────
function AIWritingBadge({ doc }: { doc: Doc }) {
  const hasAIContent = doc.content?.includes('AI') || doc.title?.includes('AI');
  
  if (!hasAIContent) return null;
  
  return (
    <div className="absolute top-2 left-2 w-6 h-6 bg-gradient-to-br from-[#10B981] to-[#059669] rounded-full flex items-center justify-center shadow-sm z-10" title="AI-Enhanced">
      <span className="text-white text-[10px] font-bold">AI</span>
    </div>
  );
}

// ─── Smart Templates Row ─────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    title: 'Meeting Notes',
    desc: 'Agenda, decisions, action items',
    id: 'meeting-notes',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    content: '# **Meeting Notes**\n\n## **Date:** \n\n## **Attendees:** \n\n## **Agenda**\n1. \n2. \n3. \n\n## **Discussion Points**\n- \n- \n\n## **Decisions Made**\n1. \n2. \n\n## **Action Items**\n- [ ] \n- [ ] \n- [ ] \n\n## **Next Steps**\n',
  },
  {
    title: 'Project Brief',
    desc: 'Goals, scope, timeline',
    id: 'project-brief',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    content: '# **Project Brief**\n\n## **Overview**\n\n## **Objectives**\n1. \n2. \n3. \n\n## **Scope**\n- **Includes:**\n  - \n  - \n- **Excludes:**\n  - \n  - \n\n## **Timeline**\n- **Phase 1:** \n- **Phase 2:** \n- **Phase 3:** \n\n## **Resources**\n- **Team Members:** \n- **Budget:** \n- **Tools & Technology:** \n\n## **Success Criteria**\n1. \n2. \n3. \n',
  },
  {
    title: 'Weekly Report',
    desc: 'Progress, blockers, next steps',
    id: 'weekly-report',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    content: '# **Weekly Report**\n\n**Week of:** \n\n## **Accomplishments**\n1. \n2. \n3. \n\n## **Progress Metrics**\n- **Target:** \n- **Actual:** \n- **Variance:** \n\n## **Blockers & Challenges**\n- [ ] \n- [ ] \n\n## **Upcoming This Week**\n1. \n2. \n3. \n\n## **Key Notes**\n\n## **Status**\n- [ ] On Track\n- [ ] At Risk\n- [ ] Off Track\n',
  },
  {
    title: 'Blog Post',
    desc: 'Draft and outline your article',
    id: 'blog-post',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    content: '# **Blog Post Title**\n\n**Author:** \n**Date:** \n\n## **Introduction**\n\n## **Main Topics**\n\n### **1. Section Title**\n\n### **2. Section Title**\n\n### **3. Section Title**\n\n## **Key Takeaways**\n- \n- \n- \n\n## **Call to Action**\n\n## **Additional Resources**\n- [Link]() \n- [Link]() \n',
  },
  {
    title: 'To-do List',
    desc: 'Tasks, priorities, deadlines',
    id: 'todo-list',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    content: '# **To-Do List**\n\n## **High Priority**\n- [ ] \n- [ ] \n- [ ] \n\n## **Medium Priority**\n- [ ] \n- [ ] \n- [ ] \n\n## **Low Priority**\n- [ ] \n- [ ] \n\n## **Completed**\n- [x] \n- [x] \n\n**Last Updated:** \n',
  },
];

function TemplateRow({ onCreate }: { onCreate: (title: string, template?: string, content?: string) => void }) {
  return (
    <div className="mt-10 pt-8 border-t border-[rgba(0,0,0,0.06)]">
      <p className="text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-4">Start from a template</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {TEMPLATES.map((t) => (
          <button
            key={t.title}
            type="button"
            onClick={() => onCreate(t.title, t.id, t.content)}
            className="text-left p-4 bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] hover:border-[#2563EB]/30 hover:shadow-sm transition-all group"
          >
            <span className="text-[#2563EB]">{t.icon}</span>
            <p className="mt-2.5 text-[13px] font-semibold text-[#1D1D1F] group-hover:text-[#2563EB] transition-colors">{t.title}</p>
            <p className="text-[11px] text-[#8E8E93] mt-0.5 leading-snug">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Notification Bell ──────────────────────────────────────────────────────────
interface Notif {
  _id: string;
  type: 'mention' | 'comment' | 'share';
  actorName: string;
  documentId: string;
  documentTitle: string;
  snippet: string;
  read: boolean;
  createdAt: string;
}

function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, mutate } = useSWR<{ notifications: Notif[]; unread: number }>(
    '/notifications', fetcher, { refreshInterval: 30000, revalidateOnFocus: true }
  );
  const notifications = data?.notifications ?? [];
  const unread = data?.unread ?? 0;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openNotif = async (n: Notif) => {
    setOpen(false);
    if (!n.read) { await api.patch(`/notifications/${n._id}/read`).catch(() => {}); mutate(); }
    router.push(`/doc/${n.documentId}`);
  };

  const markAll = async () => {
    await api.post('/notifications/read-all').catch(() => {});
    mutate();
  };

  const verb = (t: Notif['type']) => t === 'mention' ? 'mentioned you in' : t === 'share' ? 'shared' : 'commented on';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-[#6E6E73] hover:bg-[#F4F4F5] transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#FF3B30] text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-w-[90vw] bg-white rounded-[14px] shadow-apple-lg border border-[rgba(0,0,0,0.08)] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
            <span className="text-[14px] font-semibold text-[#1D1D1F]">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-[12px] font-medium text-[#2563EB] hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-[13px] text-[#8E8E93] text-center py-8">You're all caught up.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => openNotif(n)}
                  className={`w-full text-left px-4 py-3 border-b border-[rgba(0,0,0,0.04)] hover:bg-[#F5F5F7] transition-colors ${n.read ? '' : 'bg-[#2563EB]/[0.04]'}`}
                >
                  <p className="text-[13px] text-[#1D1D1F] leading-snug">
                    <span className="font-semibold">{n.actorName || 'Someone'}</span>{' '}
                    {verb(n.type)}{' '}
                    <span className="font-medium">{n.documentTitle || 'Untitled'}</span>
                  </p>
                  {n.snippet && <p className="text-[12px] text-[#8E8E93] mt-0.5 line-clamp-2">{n.snippet}</p>}
                  <p className="text-[11px] text-[#AEAEB2] mt-1">{timeAgo(n.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuPortalRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'shared' | 'starred' | 'trash'>('all');
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<Doc | null>(null);
  const [shareDoc, setShareDoc] = useState<Doc | null>(null);
  const [infoDoc, setInfoDoc] = useState<Doc | null>(null);
  const [newDocModal, setNewDocModal] = useState(false);
  const [sortBy, setSortBy] = useState<'lastEdited' | 'created' | 'title'>('lastEdited');
  const [filterBy, setFilterBy] = useState<'all' | 'shared' | 'private'>('all');
  // How many (unpinned) documents to render at once. Pinned docs always show;
  // the rest load in pages so a large library doesn't render hundreds of cards.
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Folders (owner-only organization). activeFolderId narrows the main view to
  // one folder; null means "all folders / no folder filter".
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [moveDoc, setMoveDoc] = useState<Doc | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameFolder, setRenameFolder] = useState<Folder | null>(null);
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const { pinned, toggle: togglePin } = usePinned();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Mock activity data
  const mockActivities: Activity[] = [
    {
      id: '1',
      type: 'edit',
      user: 'Rahul',
      documentTitle: 'Project Brief',
      documentId: 'doc1',
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      description: 'edited Project Brief',
      avatar: 'R'
    },
    {
      id: '2',
      type: 'join',
      user: 'Ankit',
      documentTitle: 'Meeting Notes',
      documentId: 'doc2',
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
      description: 'joined document',
      avatar: 'A'
    },
    {
      id: '3',
      type: 'mention',
      user: 'You',
      documentTitle: 'Q4 Planning',
      documentId: 'doc3',
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
      description: 'were mentioned in',
      avatar: 'Y'
    },
  ];

  // Mock document data with enhanced features
  const mockDocs: Doc[] = [
    {
      _id: '1',
      title: 'AI Writing Assistant',
      ownerId: user?.id || '1',
      updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
      collaborators: [
        { userId: 'user2', permission: 'edit' },
        { userId: 'user3', permission: 'view' }
      ],
      content: '# AI Writing Assistant\n\n## Topic: Blog Post on Technology\n\n## Key Points:\n- Artificial Intelligence is transforming content creation\n- AI tools help with grammar, style, and structure\n- Human creativity remains essential\n\n## AI Suggestions:\n*Generating intelligent content...*\n\nThe future of writing is here with AI-powered assistants that help you create better content faster.',
      lastEditedBy: 'Rahul',
      lastEditedAt: new Date(Date.now() - 5 * 60000).toISOString(),
      isLive: true
    },
    {
      _id: '2',
      title: 'Meeting Notes - Product Review',
      ownerId: user?.id || '1',
      updatedAt: new Date(Date.now() - 30 * 60000).toISOString(),
      createdAt: new Date(Date.now() - 24 * 60 * 60000).toISOString(),
      collaborators: [
        { userId: 'user4', permission: 'edit' }
      ],
      content: '## Meeting Details\n**Date:** April 29, 2026\n**Attendees:** Product Team, Engineering\n\n## Agenda\n- Q2 Product Roadmap Review\n- User Feedback Analysis\n- Technical Debt Discussion\n\n## Action Items\n- [ ] Implement AI writing suggestions\n- [ ] Update user onboarding flow\n- [ ] Schedule user research sessions',
      lastEditedBy: 'Ankit',
      lastEditedAt: new Date(Date.now() - 30 * 60000).toISOString(),
      isLive: false
    },
    {
      _id: '3',
      title: 'Code Documentation - API v2',
      ownerId: 'user2',
      updatedAt: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60000).toISOString(),
      collaborators: [
        { userId: user?.id || '1', permission: 'edit' },
        { userId: 'user5', permission: 'view' }
      ],
      content: '# API Documentation v2\n\n## Overview\nThe CollabDocs API provides programmatic access to document management and AI-powered writing features.\n\n## Authentication\n```javascript\nconst apiKey = process.env.COLLABDOCS_API_KEY;\nconst client = new CollabDocsClient(apiKey);\n```\n\n## AI Writing Endpoints\n- `POST /ai/suggest` - Get AI writing suggestions\n- `POST /ai/expand` - Expand on existing content\n- `POST /ai/summarize` - Generate summaries',
      lastEditedBy: 'Sumit',
      lastEditedAt: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
      isLive: true
    },
    {
      _id: '4',
      title: 'Project Brief - AI Platform',
      ownerId: user?.id || '1',
      updatedAt: new Date(Date.now() - 45 * 60000).toISOString(),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(),
      collaborators: [],
      content: '# Project Brief\n\n## Overview\nBuilding an AI-powered writing platform that transforms how teams create and collaborate on documents.\n\n## Objectives\n- Implement AI writing suggestions\n- Real-time collaboration features\n- Smart templates and automation\n\n## Timeline\n- Phase 1: Core AI features (2 weeks)\n- Phase 2: Collaboration tools (3 weeks)\n- Phase 3: Advanced AI capabilities (4 weeks)\n\n## Resources\n- AI/ML Team: 3 engineers\n- Frontend Team: 2 developers\n- Product Manager: 1',
      lastEditedBy: 'You',
      lastEditedAt: new Date(Date.now() - 45 * 60000).toISOString(),
      isLive: false
    },
    {
      _id: '5',
      title: 'Q4 Planning - AI Features',
      ownerId: 'user3',
      updatedAt: new Date(Date.now() - 15 * 60000).toISOString(),
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60000).toISOString(),
      collaborators: [
        { userId: user?.id || '1', permission: 'view' },
        { userId: 'user6', permission: 'edit' }
      ],
      content: '# Q4 Planning - AI Features\n\n## Priority Features\n1. **AI Writing Assistant**\n   - Real-time suggestions\n   - Content expansion\n   - Grammar and style improvements\n\n2. **Smart Templates**\n   - Industry-specific templates\n   - AI-powered content generation\n   - Dynamic formatting\n\n3. **Collaboration AI**\n   - Meeting summaries\n   - Action item extraction\n   - Participant insights',
      lastEditedBy: 'Priya',
      lastEditedAt: new Date(Date.now() - 15 * 60000).toISOString(),
      isLive: false
    }
  ];

  const isTrashMode = filterMode === 'trash';
  const fetchUrl = isTrashMode ? '/docs/trash' : '/docs';
  const { data: docs, mutate } = useSWR<Doc[]>(user ? fetchUrl : null, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });

  // Use real documents from API, empty array if none loaded yet
  const displayDocs = Array.isArray(docs) ? docs : [];

  // Folders for the sidebar (owner's organization).
  const { data: folders, mutate: mutateFolders } = useSWR<Folder[]>(user ? '/folders' : null, fetcher);
  const folderList = Array.isArray(folders) ? folders : [];
  const activeFolder = folderList.find((f) => f._id === activeFolderId) || null;

  // Server-side search (title + content). Active only when there's a query and
  // we're not viewing trash. Falls back to the full list otherwise.
  const trimmedSearch = debouncedSearch.trim();
  const searching = !!trimmedSearch && !isTrashMode;
  const { data: searchResults } = useSWR<Doc[]>(
    searching && user ? `/docs/search?q=${encodeURIComponent(trimmedSearch)}` : null,
    fetcher,
  );
  const baseDocs = searching ? (searchResults ?? []) : displayDocs;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedTrigger = profileMenuRef.current?.contains(target);
      const clickedPortal = profileMenuPortalRef.current?.contains(target);
      if (!clickedTrigger && !clickedPortal) {
        setProfileMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const usernameHandle = user?.username
    ? `@${user.username}`
    : user?.displayName
    ? `@${user.displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`
    : '@user';




  const createDoc = useCallback(async (title = 'Untitled', template?: string, content?: string) => {
    try {
      console.log('Creating document with title:', title);
      const res = await api.post('/docs', { title, template, content });
      console.log('Document created:', res.data);
      // Store template content in sessionStorage for the editor to load
      if (content) {
        sessionStorage.setItem(`doc_${res.data._id}_template`, content);
      }
      router.push(`/doc/${res.data._id}`);
    } catch (error) {
      console.error('Create document error:', error);
      const message = (error as any)?.response?.data?.error || 'Failed to create document';
      toast.error(message);
    }
  }, [router, toast]);

  const deleteDoc = useCallback(async (id: string) => {
    try {
      if (filterMode === 'trash') {
        await api.delete(`/docs/${id}/permanent`);
        toast.success('Document permanently deleted');
      } else {
        await api.delete(`/docs/${id}`);
        toast.success('Moved to trash');
      }
      mutate();
      setDeleteModal(null);
    } catch { toast.error('Action failed'); }
  }, [mutate, toast, filterMode]);

  const restoreDoc = useCallback(async (id: string) => {
    try {
      await api.patch(`/docs/${id}/restore`);
      mutate();
      toast.success('Document restored');
    } catch { toast.error('Failed to restore document'); }
  }, [mutate, toast]);

  const renameDocFn = useCallback(async (doc: Doc, title: string) => {
    try {
      await api.patch(`/docs/${doc._id}`, { title });
      mutate();
      setRenameDoc(null);
      toast.success('Document renamed');
    } catch { toast.error('Failed to rename document'); }
  }, [mutate, toast]);

  const duplicateDoc = useCallback(async (doc: Doc) => {
    try {
      const res = await api.post('/docs', { title: `${doc.title || 'Untitled'} (Copy)` });
      mutate();
      toast.success('Document duplicated');
      router.push(`/doc/${res.data._id}`);
    } catch { toast.error('Failed to duplicate document'); }
  }, [mutate, router, toast]);

  // Switching to a top-level tab exits any active folder view.
  const selectFilterMode = useCallback((m: 'all' | 'shared' | 'starred' | 'trash') => {
    setFilterMode(m);
    setActiveFolderId(null);
  }, []);

  // ─── Folder actions ──────────────────────────────────────────────────────────
  const createFolder = useCallback(async (name: string) => {
    try {
      await api.post('/folders', { name });
      mutateFolders();
      setNewFolderOpen(false);
      toast.success('Folder created');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Failed to create folder'); }
  }, [mutateFolders, toast]);

  const renameFolderFn = useCallback(async (folder: Folder, name: string) => {
    try {
      await api.patch(`/folders/${folder._id}`, { name });
      mutateFolders();
      setRenameFolder(null);
      toast.success('Folder renamed');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Failed to rename folder'); }
  }, [mutateFolders, toast]);

  const deleteFolder = useCallback(async (folder: Folder) => {
    try {
      await api.delete(`/folders/${folder._id}`);
      if (activeFolderId === folder._id) setActiveFolderId(null);
      mutateFolders();
      mutate();
      toast.success('Folder deleted — its documents moved to root');
    } catch { toast.error('Failed to delete folder'); }
  }, [activeFolderId, mutateFolders, mutate, toast]);

  const moveToFolder = useCallback(async (doc: Doc, folderId: string | null) => {
    try {
      await api.patch(`/docs/${doc._id}`, { folderId });
      mutate();
      mutateFolders();
      setMoveDoc(null);
      toast.success(folderId ? 'Moved to folder' : 'Removed from folder');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Failed to move document'); }
  }, [mutate, mutateFolders, toast]);

  // Enhanced filtering and sorting
  const filtered = (baseDocs ?? [])
    // Folder scope (owner-only organization). When a folder is selected, show
    // only that folder's documents; otherwise show everything.
    .filter((d) => !activeFolderId || d.folderId === activeFolderId)
    // When searching, the server already matched title + content, so don't
    // re-apply a client-side title-only filter (it would drop content matches).
    .filter((d) => searching || (d.title || 'Untitled').toLowerCase().includes(debouncedSearch.toLowerCase()))
    .filter((d) => {
      const isOwner = d.ownerId?.toString() === user?.id;
      if (filterMode === 'shared') return !isOwner;
      if (filterMode === 'starred') return favorites.has(d._id);
      if (filterMode === 'trash') return isOwner;
      
      // Additional filter by shared/private
      if (filterBy === 'shared') return !isOwner || (d.collaborators && d.collaborators.length > 0);
      if (filterBy === 'private') return isOwner && (!d.collaborators || d.collaborators.length === 0);
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'lastEdited') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      } else if (sortBy === 'created') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === 'title') {
        return (a.title || 'Untitled').localeCompare(b.title || 'Untitled');
      }
      return 0;
    });

  const pinnedDocs = filterMode === 'trash' ? [] : filtered.filter((d) => pinned.has(d._id));
  const unpinnedDocsAll = filterMode === 'trash'
    ? filtered
    : filtered.filter((d) => !pinned.has(d._id)).sort((a, b) => {
        const af = favorites.has(a._id) ? 0 : 1;
        const bf = favorites.has(b._id) ? 0 : 1;
        return af - bf;
      });
  // Only render up to visibleCount of the unpinned docs; "Load more" reveals more.
  const unpinnedDocs = unpinnedDocsAll.slice(0, visibleCount);
  const hasMoreDocs = unpinnedDocsAll.length > unpinnedDocs.length;
  const allFiltered = [...pinnedDocs, ...unpinnedDocsAll];

  // Whenever the active view changes, collapse back to the first page so we
  // don't carry a huge visibleCount across tabs/searches.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filterMode, debouncedSearch, sortBy, filterBy, activeFolderId]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <svg className="w-8 h-8 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  let pageTitle = 'My Documents';
  if (filterMode === 'shared') pageTitle = 'Shared with me';
  if (filterMode === 'starred') pageTitle = 'Starred';
  if (filterMode === 'trash') pageTitle = 'Trash';
  if (activeFolder) pageTitle = activeFolder.name;

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Navbar */}
      <header className="apple-glass sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-16">
          <div className="flex items-center flex-shrink-0">
            <img
              src="/collabdocs-logo-full.png?v=2"
              alt="CollabDocs"
              width={220}
              height={64}
              className="h-9 sm:h-12 w-auto object-contain"
            />
          </div>
          <div className="flex-1 hidden sm:block max-w-xl mx-4 lg:mx-8">
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…" className="input-apple !pl-10 py-2 text-sm h-10" />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {user && <NotificationBell />}

            {user?.displayName && (
              <div ref={profileMenuRef} className="block relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-lg px-1.5 sm:px-2 py-1.5 hover:bg-[#F4F4F5] transition-colors"
                >
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt={user.displayName} className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[11px] font-bold">
                      {user.displayName[0].toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:inline text-sm text-[#6E6E73] font-medium">{user.displayName}</span>
                </button>

                {profileMenuOpen && typeof document !== 'undefined' && createPortal(
                  <>
                    <div
                      className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <div ref={profileMenuPortalRef} className="fixed left-0 right-0 bottom-0 w-full bg-white border border-[rgba(0,0,0,0.08)] shadow-lg rounded-t-2xl p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] z-50">
                      <div className="w-10 h-1 bg-[#D1D5DB] rounded-full mx-auto my-2" />
                      <div className="px-3 py-2 border-b border-[rgba(0,0,0,0.06)]">
                        <p className="text-[11px] text-[#8E8E93]">Username</p>
                        <p className="text-sm font-semibold text-[#1D1D1F] truncate">{usernameHandle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setProfileMenuOpen(false); router.push('/settings'); }}
                        className="w-full text-left px-3 py-2 text-sm text-[#1D1D1F] hover:bg-[#F4F4F5] rounded-lg transition-colors"
                      >
                        Account Settings
                      </button>
                      <button
                        type="button"
                        onClick={() => { setProfileMenuOpen(false); logout(); }}
                        className="w-full text-left px-3 py-2 text-sm text-[#D92D20] hover:bg-[#FFF1F0] rounded-lg transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </>,
                  document.body
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Body with Sidebar */}
      <div className="flex max-w-[1600px] mx-auto w-full">
        {/* Enhanced Sidebar */}
        <aside className="w-80 flex-shrink-0 p-5 hidden md:block min-h-[calc(100vh-64px)] overflow-y-auto">
          {/* Navigation */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">Navigation</h3>
            <div className="space-y-1">
              <SidebarItem
                active={filterMode === 'all' && !activeFolderId}
                onClick={() => selectFilterMode('all')}
                label="My Documents"
                icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
              />
              <SidebarItem
                active={filterMode === 'shared' && !activeFolderId}
                onClick={() => selectFilterMode('shared')}
                label="Shared with me"
                icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
              />
              <SidebarItem
                active={filterMode === 'starred' && !activeFolderId}
                onClick={() => selectFilterMode('starred')}
                label="Starred"
                icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
              />
              <SidebarItem
                active={filterMode === 'trash' && !activeFolderId}
                onClick={() => selectFilterMode('trash')}
                label="Trash"
                icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
              />
            </div>
          </div>

          {/* Folders */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">Folders</h3>
              <button
                type="button"
                onClick={() => setNewFolderOpen(true)}
                className="text-[#2563EB] hover:text-[#1D4ED8] transition-colors p-0.5 rounded"
                title="New folder"
                aria-label="New folder"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
            <div className="space-y-1">
              {folderList.length === 0 && (
                <p className="text-[13px] text-[#8E8E93] px-3 py-1">No folders yet</p>
              )}
              {folderList.map((folder) => (
                <div
                  key={folder._id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    activeFolderId === folder._id ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]'
                  }`}
                  onClick={() => { setFilterMode('all'); setActiveFolderId(folder._id); }}
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  <span className="flex-1 truncate">{folder.name}</span>
                  <span className="text-[11px] text-[#AEAEB2]">{folder.docCount}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setRenameFolder(folder); }}
                    className="opacity-0 group-hover:opacity-100 text-[#8E8E93] hover:text-[#2563EB] transition-all p-0.5"
                    title="Rename folder" aria-label="Rename folder"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteFolder(folder); }}
                    className="opacity-0 group-hover:opacity-100 text-[#8E8E93] hover:text-[#FF3B30] transition-all p-0.5"
                    title="Delete folder" aria-label="Delete folder"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Feed in Sidebar */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">Recent Activity</h3>
            <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.08)] shadow-sm">
              <div className="p-3 border-b border-[rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-[#2563EB] to-[#34C759] rounded-lg flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-[#1D1D1F]">Activity</span>
                  </div>
                  <button className="text-[#2563EB] text-xs font-medium hover:text-[#1D4ED8] transition-colors">
                    View all
                  </button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {mockActivities.slice(0, 5).map((activity, index) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 hover:bg-[#F5F5F7] transition-colors cursor-pointer border-b border-[rgba(0,0,0,0.04)] last:border-0">
                    <div className="flex-shrink-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white shadow-sm relative ${
                        activity.type === 'edit' ? 'bg-gradient-to-br from-[#3B82F6] to-[#1E40AF]' :
                        activity.type === 'join' ? 'bg-gradient-to-br from-[#10B981] to-[#059669]' :
                        activity.type === 'mention' ? 'bg-gradient-to-br from-[#F59E0B] to-[#D97706]' :
                        activity.type === 'share' ? 'bg-gradient-to-br from-[#8B5CF6] to-[#4F46E5]' :
                        'bg-gradient-to-br from-[#6366F1] to-[#4B5563]'
                      }`}>
                        {activity.type === 'edit' && (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        )}
                        {activity.type === 'join' && (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 00-3 3L12 15l-4 1 1 1 6-6.5z" />
                          </svg>
                        )}
                        {activity.type === 'mention' && (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        )}
                        {activity.type === 'share' && (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <circle cx="11" cy="13" r="3" />
                            <line x1="11" y1="16" x2="11" y2="16" />
                          </svg>
                        )}
                        {activity.type === 'create' && (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 00-3 3L12 15l-4 1 1 1 6-6.5z" />
                          </svg>
                        )}
                        {activity.type === 'edit' && (
                          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#10B981] rounded-full border-2 border-white animate-pulse" />
                        )}
                      </div>
                      {activity.type === 'edit' && (
                        <div className="w-1.5 h-1.5 bg-[#34C759] rounded-full -mt-0.5 ml-2 animate-pulse" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[#1D1D1F] font-medium leading-snug">
                        <span className="font-semibold">{activity.user}</span>
                        <span className="text-[#8E8E93] font-normal"> {activity.description}</span>
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-[#2563EB] font-medium hover:underline cursor-pointer">
                          {activity.documentTitle}
                        </span>
                        <span className="text-[9px] text-[#8E8E93]">•</span>
                        <span className="text-[9px] text-[#8E8E93]">{timeAgo(activity.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Real-time Status */}
          <div>
            <h3 className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">Active Now</h3>
            <div className="bg-gradient-to-r from-[#10B981]/15 via-[#059669]/15 to-[#047857]/15 rounded-xl p-4 border border-[#10B981]/25 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
                  </span>
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#10B981] rounded-full flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold animate-pulse">{Math.floor(Math.random() * 5) + 1}</span>
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1D1D1F]">people editing</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">Real-time collaboration</p>
                </div>
              </div>
              <div className="flex -space-x-2">
                {Array.from({ length: Math.min(3, Math.floor(Math.random() * 5) + 1) }).map((_, i) => (
                  <div 
                    key={i} 
                    className="w-7 h-7 rounded-full border-2 border-white bg-gradient-to-br from-[#3B82F6] to-[#1E40AF] flex items-center justify-center text-white text-[10px] font-bold shadow-md relative"
                  >
                    {String.fromCharCode(65 + i)}
                    {Math.random() > 0.5 && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-[#10B981] rounded-full border border-white animate-pulse" />
                    )}
                  </div>
                ))}
                {Math.floor(Math.random() * 5) + 1 > 3 && (
                  <div className="w-7 h-7 rounded-full border-2 border-white bg-[#6B7280] flex items-center justify-center text-white text-[10px] font-bold shadow-md">
                    +{Math.floor(Math.random() * 5) + 1 - 3}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 px-4 md:px-8 py-8 anim-fade-in min-w-0 pb-24 md:pb-8">
          {/* Mobile search bar */}
          <div className="sm:hidden mb-5">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…" className="input-apple !pl-9 py-2 text-sm w-full" />
            </div>
          </div>

          {/* Recent Activity Strip - only on 'all' tab */}
          {filterMode === 'all' && displayDocs && displayDocs.length > 0 && (
            <RecentActivityStrip docs={displayDocs} userId={user!.id} onOpen={(id) => router.push(`/doc/${id}`)} />
          )}

          {/* Sorting and Filtering Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[#1D1D1F] tracking-tight">{pageTitle}</h1>
              {displayDocs && <p className="text-sm text-[#6E6E73] mt-0.5">{allFiltered.length} {allFiltered.length === 1 ? 'document' : 'documents'}</p>}
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 bg-white border border-[rgba(0,0,0,0.08)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 min-w-0"
              >
                <option value="lastEdited">Last edited</option>
                <option value="created">Date created</option>
                <option value="title">Title</option>
              </select>

              {/* Filter Dropdown */}
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as any)}
                className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 bg-white border border-[rgba(0,0,0,0.08)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 min-w-0"
              >
                <option value="all">All documents</option>
                <option value="shared">Shared</option>
                <option value="private">Private</option>
              </select>

              <button type="button" onClick={() => setNewDocModal(true)} className="btn-primary gap-1.5 text-xs sm:text-sm whitespace-nowrap flex-shrink-0">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                New<span className="hidden sm:inline"> Document</span>
              </button>
            </div>
          </div>

        {!displayDocs ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-52 rounded-[16px]" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 anim-fade-in text-center relative z-0">
            {/* Background glowing effects for the illustration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-100/50 rounded-full blur-3xl -z-10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-48 h-48 bg-emerald-100/40 rounded-full blur-2xl -z-10" />
            
            {/* Floating illustration */}
            <div className="relative mb-8 group">
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-emerald-400 rounded-[28px] opacity-20 blur-lg group-hover:opacity-30 transition duration-1000" />
              <div className="w-24 h-24 rounded-[24px] bg-white shadow-apple-lg flex items-center justify-center relative transform transition-transform hover:scale-105 duration-300 animate-[bounce_3s_infinite_ease-in-out]">
                <svg className="w-12 h-12 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {/* Decorative floating elements */}
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-[#2563EB] rounded-full flex items-center justify-center text-white shadow-lg animate-[pulse_2s_infinite]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </div>
            </div>

            <h3 className="text-[#1D1D1F] font-bold text-2xl mb-2 tracking-tight">
              {debouncedSearch ? 'No results found' : 'Start your AI-powered document'}
            </h3>
            <p className="text-[#6E6E73] text-[15px] mb-8 max-w-[300px]">
              {debouncedSearch ? `Nothing matches "${debouncedSearch}"` : 'Create intelligent documents with AI assistance and real-time collaboration.'}
            </p>
            {!debouncedSearch && (
              <button 
                type="button" 
                onClick={() => createDoc()}
                className="btn-primary px-7 py-3 text-[15px] font-semibold shadow-apple-md hover:shadow-apple-lg hover:-translate-y-0.5 transition-all duration-200 gap-2 flex items-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                New Document
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pinned Section */}
            {pinnedDocs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-[#FF9500]" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  <span className="text-[12px] font-bold text-[#FF9500] uppercase tracking-wider">Pinned</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {pinnedDocs.map((doc, i) => (
                    <div key={doc._id} className="anim-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <DocCard
                        doc={doc}
                        userId={user!.id}
                        isFavorite={favorites.has(doc._id)}
                        isPinned={true}
                        searchQuery={debouncedSearch}
                        onDelete={(id) => setDeleteModal(id)}
                        onFavoriteToggle={(id) => { toggleFavorite(id); toast.success(favorites.has(id) ? 'Removed from favorites' : 'Added to favorites'); }}
                        onPinToggle={(id) => { togglePin(id); toast.success('Unpinned'); }}
                        onRename={(d) => setRenameDoc(d)}
                        onDuplicate={duplicateDoc}
                        onShareOpen={(d) => setShareDoc(d)}
                        onInfoOpen={(d) => setInfoDoc(d)}
                        onRestore={restoreDoc}
                        onPermanentDelete={(id) => setDeleteModal(id)}
                        onMoveToFolder={(d) => setMoveDoc(d)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All / Rest */}
            {unpinnedDocs.length > 0 && (
              <div>
                {pinnedDocs.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider">All Documents</span>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {unpinnedDocs.map((doc, i) => (
                    <div key={doc._id} className="anim-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <DocCard
                        doc={doc}
                        userId={user!.id}
                        isFavorite={favorites.has(doc._id)}
                        isPinned={false}
                        searchQuery={debouncedSearch}
                        onDelete={(id) => setDeleteModal(id)}
                        onFavoriteToggle={(id) => { toggleFavorite(id); toast.success(favorites.has(id) ? 'Removed from favorites' : 'Added to favorites'); }}
                        onPinToggle={(id) => { togglePin(id); toast.success(pinned.has(id) ? 'Unpinned' : 'Pinned to top!'); }}
                        onRename={(d) => setRenameDoc(d)}
                        onDuplicate={duplicateDoc}
                        onShareOpen={(d) => setShareDoc(d)}
                        onInfoOpen={(d) => setInfoDoc(d)}
                        onRestore={restoreDoc}
                        onPermanentDelete={(id) => setDeleteModal(id)}
                        onMoveToFolder={(d) => setMoveDoc(d)}
                      />
                    </div>
                  ))}
                </div>
                {hasMoreDocs && (
                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="btn-ghost px-5 py-2.5 text-sm font-medium"
                    >
                      Load more ({unpinnedDocsAll.length - unpinnedDocs.length} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {filterMode === 'all' && displayDocs && (
          <TemplateRow onCreate={createDoc} />
        )}
      </main>
    </div>

      {/* New Document Modal */}
      {newDocModal && (
        <NewDocumentModal
          onClose={() => setNewDocModal(false)}
          onCreate={createDoc}
        />
      )}

      {/* Mobile bottom navigation */}
      <MobileBottomNav filterMode={activeFolderId ? '' : filterMode} setFilterMode={selectFilterMode} />

      {/* Delete modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade-in">
          <div className="bg-white rounded-[20px] shadow-apple-xl max-w-sm w-full p-6 anim-scale-in">
            <div className="w-12 h-12 rounded-[14px] bg-[#FFF2F1] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#FF3B30]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-[17px] font-semibold text-[#1D1D1F] text-center mb-1">
              {filterMode === 'trash' ? 'Permanently Delete?' : 'Delete Document?'}
            </h2>
            <p className="text-sm text-[#6E6E73] text-center mb-6">
              {filterMode === 'trash' ? 'This document will be gone forever.' : 'This document will be moved to Trash.'}
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteModal(null)} className="btn-ghost flex-1 justify-center py-2.5">Cancel</button>
              <button type="button" onClick={() => deleteDoc(deleteModal)} className="btn-danger flex-1 justify-center py-2.5">
                {filterMode === 'trash' ? 'Permanently Delete' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameDoc && (
        <RenameModal doc={renameDoc} onClose={() => setRenameDoc(null)} onSave={(title) => renameDocFn(renameDoc, title)} />
      )}

      {/* Share modal */}
      {shareDoc && (
        <ShareModal doc={shareDoc} onClose={() => setShareDoc(null)} toast={toast} currentUserId={user?.id} />
      )}

      {/* Doc info modal */}
      {infoDoc && (
        <DocInfoModal doc={infoDoc} isOwner={infoDoc.ownerId?.toString() === user?.id?.toString()} onClose={() => setInfoDoc(null)} />
      )}

      {/* New folder modal */}
      {newFolderOpen && (
        <FolderNameModal title="New Folder" confirmLabel="Create" onClose={() => setNewFolderOpen(false)} onSave={createFolder} />
      )}

      {/* Rename folder modal */}
      {renameFolder && (
        <FolderNameModal
          title="Rename Folder"
          initial={renameFolder.name}
          confirmLabel="Rename"
          onClose={() => setRenameFolder(null)}
          onSave={(name) => renameFolderFn(renameFolder, name)}
        />
      )}

      {/* Move to folder modal */}
      {moveDoc && (
        <MoveToFolderModal doc={moveDoc} folders={folderList} onClose={() => setMoveDoc(null)} onMove={moveToFolder} />
      )}
    </div>
  );
}
