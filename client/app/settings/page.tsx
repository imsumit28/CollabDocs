'use client';
import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface Profile {
  email: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  hasPassword: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading, refreshUser, applyAccessToken } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);

  // Profile form
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    api.get('/auth/me')
      .then((res) => {
        const p: Profile = res.data;
        setProfile(p);
        setDisplayName(p.displayName || '');
        setUsername(p.username || '');
        setAvatarUrl(p.avatarUrl || '');
      })
      .catch(() => toast.error('Could not load your profile'));
  }, [loading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    try {
      await api.patch('/auth/me', { displayName, username, avatarUrl });
      await refreshUser();
      toast.success('Profile updated');
    } catch (err: any) {
      setProfileError(err.response?.data?.error || 'Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await api.post('/auth/change-password', { currentPassword, newPassword });
      if (res.data.accessToken) applyAccessToken(res.data.accessToken);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast.success('Password updated');
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Could not change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const inputClass =
    'h-[44px] w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-all focus:border-[#3B82F6] focus:bg-white focus:ring-4 focus:ring-[#3B82F6]/[0.08]';
  const labelClass = 'block text-[13px] font-semibold text-[#0F172A] mb-1.5';

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-[#8E8E93]">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] py-10 px-5">
      <div className="max-w-[640px] mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.03em]">Account settings</h1>
          <Link href="/dashboard" className="text-[14px] font-semibold text-[#3B82F6] hover:text-[#2563EB]">← Back</Link>
        </div>

        {/* Profile */}
        <section className="bg-white rounded-[16px] shadow-sm border border-[rgba(0,0,0,0.06)] p-6 mb-6">
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-4">Profile</h2>
          {profileError && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-[13px] font-medium text-red-600">{profileError}</div>}
          <div className="flex items-center gap-4 mb-5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover border border-[rgba(0,0,0,0.08)]" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#007AFF] text-white flex items-center justify-center text-[24px] font-bold">
                {(displayName || profile.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="text-[13px] text-[#6E6E73]">{profile.email}</div>
          </div>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className={labelClass}>Display name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} placeholder="Your name" />
            </div>
            <div>
              <label className={labelClass}>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} placeholder="username" />
            </div>
            <div>
              <label className={labelClass}>Avatar URL</label>
              <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className={inputClass} placeholder="https://… (optional)" />
            </div>
            <button type="submit" disabled={savingProfile} className="h-[44px] px-6 rounded-xl bg-[#0F172A] text-[14px] font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60">
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>

        {/* Password */}
        <section className="bg-white rounded-[16px] shadow-sm border border-[rgba(0,0,0,0.06)] p-6">
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-4">Password</h2>
          {profile.hasPassword ? (
            <>
              {passwordError && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-[13px] font-medium text-red-600">{passwordError}</div>}
              <form onSubmit={changePassword} className="space-y-4">
                <div>
                  <label className={labelClass}>Current password</label>
                  <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>New password</label>
                  <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Confirm new password</label>
                  <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} required />
                </div>
                <button type="submit" disabled={savingPassword} className="h-[44px] px-6 rounded-xl bg-[#0F172A] text-[14px] font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60">
                  {savingPassword ? 'Updating…' : 'Update password'}
                </button>
                <p className="text-[12px] text-[#8E8E93]">Changing your password signs you out of other devices.</p>
              </form>
            </>
          ) : (
            <p className="text-[14px] text-[#6E6E73]">Your account uses Google sign-in, so there&apos;s no password to manage here.</p>
          )}
        </section>
      </div>
    </div>
  );
}
