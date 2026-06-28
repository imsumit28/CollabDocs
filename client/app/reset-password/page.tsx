'use client';
import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
    </svg>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  // undefined = not yet read from URL; null/'' = absent
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Read the token from the URL on mount (avoids needing a Suspense boundary)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    setToken(t);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => router.replace('/login?reset=1'), 1800);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'h-[46px] w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 pr-11 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-all duration-150 focus:border-[#3B82F6] focus:bg-white focus:ring-4 focus:ring-[#3B82F6]/[0.08]';

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-5 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex justify-center">
          <img src="/collabdocs-logo-full.png?v=2" alt="CollabDocs" className="h-12 w-auto object-contain" />
        </div>

        {done ? (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <svg className="h-7 w-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.03em]">Password reset</h1>
            <p className="mt-3 text-[15px] text-[#64748B]">Redirecting you to sign in…</p>
          </div>
        ) : token === undefined ? (
          // Still reading the token from the URL — render nothing to avoid a flash
          <div className="h-10" />
        ) : !token ? (
          <div className="text-center">
            <h1 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.03em]">Invalid link</h1>
            <p className="mt-3 text-[15px] text-[#64748B]">
              This password reset link is missing or malformed. Please request a new one.
            </p>
            <Link href="/forgot-password" className="mt-8 inline-block text-[14px] font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors">
              Request a new link
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-[32px] font-extrabold text-[#0F172A] tracking-[-0.03em] leading-[1.1]">
                Set a new password
              </h1>
              <p className="mt-2.5 text-[15px] text-[#64748B] leading-relaxed">
                Choose a strong password you don&apos;t use elsewhere.
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <span className="text-[13px] font-medium text-red-600">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#0F172A] mb-1.5 tracking-[-0.01em]">New password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className={inputClass}
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] transition-colors">
                    <EyeIcon open={showPw} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#0F172A] mb-1.5 tracking-[-0.01em]">Confirm password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-[46px] w-full rounded-xl bg-[#0F172A] text-[15px] font-semibold text-white transition-all duration-150 hover:bg-[#1E293B] disabled:opacity-60"
              >
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </form>

            <p className="mt-6 text-center text-[14px] text-[#64748B]">
              <Link href="/login" className="font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
