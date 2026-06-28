'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-5 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex justify-center">
          <img src="/collabdocs-logo-full.png?v=2" alt="CollabDocs" className="h-12 w-auto object-contain" />
        </div>

        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <svg className="h-7 w-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.03em]">Check your email</h1>
            <p className="mt-3 text-[15px] text-[#64748B] leading-relaxed">
              If an account exists for <span className="font-semibold text-[#0F172A]">{email}</span>, we&apos;ve sent a link to reset your password. The link expires in 1 hour.
            </p>
            <Link href="/login" className="mt-8 inline-block text-[14px] font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-[32px] font-extrabold text-[#0F172A] tracking-[-0.03em] leading-[1.1]">
                Forgot password?
              </h1>
              <p className="mt-2.5 text-[15px] text-[#64748B] leading-relaxed">
                Enter your email and we&apos;ll send you a link to reset it.
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
                <label className="block text-[13px] font-semibold text-[#0F172A] mb-1.5 tracking-[-0.01em]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-[46px] w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-all duration-150 focus:border-[#3B82F6] focus:bg-white focus:ring-4 focus:ring-[#3B82F6]/[0.08]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-[46px] w-full rounded-xl bg-[#0F172A] text-[15px] font-semibold text-white transition-all duration-150 hover:bg-[#1E293B] disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <p className="mt-6 text-center text-[14px] text-[#64748B]">
              Remembered it?{' '}
              <Link href="/login" className="font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
