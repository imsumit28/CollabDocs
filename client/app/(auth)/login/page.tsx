'use client';
import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';

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

const USERS = [
  { name: 'Sumit', color: '#3B82F6', initials: 'S' },
  { name: 'Aman', color: '#8B5CF6', initials: 'A' },
];

// Absolute pixel positions within the document content area
const CURSOR_WAYPOINTS = [
  [{ top: 46, left: 32 }, { top: 90, left: 118 }],
  [{ top: 78, left: 88 }, { top: 50, left: 48 }],
  [{ top: 62, left: 140 }, { top: 105, left: 64 }],
  [{ top: 95, left: 56 }, { top: 68, left: 130 }],
];

const TYPED_TEXT = 'simultaneously—without conflicts, with zero lag.';

function LivePreview() {
  const [typed, setTyped] = useState(0);
  const [blink, setBlink] = useState(true);
  const [waypointIdx, setWaypointIdx] = useState(0);
  const [typingUser, setTypingUser] = useState(0);

  // Typing animation: forward only, loops with a pause at end
  useEffect(() => {
    let i = 0;
    let pausing = false;
    const tick = () => {
      if (pausing) return;
      i++;
      if (i > TYPED_TEXT.length + 12) {
        i = 0;
        setTyped(0);
      } else {
        setTyped(Math.min(i, TYPED_TEXT.length));
      }
    };
    const id = setInterval(tick, 65);
    return () => clearInterval(id);
  }, []);

  // Cursor blink
  useEffect(() => {
    const id = setInterval(() => setBlink((v) => !v), 500);
    return () => clearInterval(id);
  }, []);

  // Move cursors to next waypoint
  useEffect(() => {
    const id = setInterval(() => {
      setWaypointIdx((v) => (v + 1) % CURSOR_WAYPOINTS.length);
      setTypingUser((v) => (v + 1) % USERS.length);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  const positions = CURSOR_WAYPOINTS[waypointIdx];

  return (
    <div className="w-full max-w-[340px] mx-auto select-none">
      {/* LIVE badge */}
      <div className="flex items-center gap-2 mb-5">
        <div className="inline-flex items-center gap-1.5 bg-[#022c22] border border-[#34D399]/30 rounded-full px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
          <span className="text-[11px] font-semibold text-[#34D399] tracking-widest uppercase">Live</span>
        </div>
        <span className="text-[12px] text-[#4B5563]">3 people editing right now</span>
      </div>

      {/* Document window chrome */}
      <div className="rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_24px_48px_rgba(0,0,0,0.5)]">
        {/* Title bar */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#1F2937] border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 mx-3 bg-[#111827] rounded-md px-2 py-0.5 text-center text-[10px] text-[#6B7280]">
            Q1 Strategy 2026.doc
          </div>
          {/* User avatars */}
          <div className="flex -space-x-1.5">
            {USERS.map((u) => (
              <div key={u.name} style={{ backgroundColor: u.color }}
                className="w-5 h-5 rounded-full border-2 border-[#1F2937] flex items-center justify-center text-white text-[8px] font-bold">
                {u.initials}
              </div>
            ))}
            <div className="w-5 h-5 rounded-full border-2 border-[#1F2937] bg-[#374151] flex items-center justify-center text-[#9CA3AF] text-[8px] font-bold">
              M
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-4 py-1.5 bg-[#F9FAFB] border-b border-[#E5E7EB]">
          {['B', 'I', 'U'].map((t, i) => (
            <button type="button" key={t} className={`w-5 h-5 rounded text-[11px] text-[#6B7280] hover:bg-[#E5E7EB] flex items-center justify-center ${i === 0 ? 'font-black' : i === 1 ? 'italic font-medium' : 'underline font-medium'}`}>{t}</button>
          ))}
          <div className="w-px h-3.5 bg-[#E5E7EB] mx-1" />
          <div className="flex gap-0.5 items-center">
            {[3, 5, 4].map((w, i) => (
              <div key={i} style={{ width: `${w * 4}px` }} className="h-1 rounded-full bg-[#D1D5DB]" />
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
            <span className="text-[9px] text-[#6B7280] font-medium">Synced</span>
          </div>
        </div>

        {/* Document content */}
        <div className="relative bg-white px-5 py-4 min-h-[190px] overflow-hidden">
          {/* Document title */}
          <div className="text-[14px] font-bold text-[#111827] mb-0.5">Q1 2026 Strategy</div>
          <div className="text-[9px] text-[#9CA3AF] mb-4">Edited just now · Sumit, Aman, Mike</div>

          {/* Static lines */}
          <div className="text-[11px] text-[#374151] leading-[1.75] space-y-0.5">
            <div>We're launching CollabDocs 1.0 with a new</div>
            <div>real-time engine. Teams can edit the same</div>
            <div>
              <span>paragraph </span>
              <span className="bg-[#DBEAFE] rounded-sm px-0.5 relative">
                {TYPED_TEXT.slice(0, typed)}
                <span className={`inline-block w-[1.5px] h-3 bg-[#3B82F6] ml-px align-middle transition-opacity duration-75 ${blink ? 'opacity-100' : 'opacity-0'}`} />
              </span>
            </div>
            <div className="pt-3 border-t border-[#F3F4F6] mt-2">
              <div className="text-[9px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5">Milestones</div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#6B7280]">
                <span className="text-[#10B981] font-bold">✓</span>
                <span className="line-through">Real-time engine v2</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#374151] mt-1">
                <span className="text-[#F59E0B] font-bold">→</span>
                <span>Webpage launch</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF] mt-1">
                <span className="font-bold">○</span>
                <span>10k active teams</span>
              </div>
            </div>
          </div>

          {/* Animated cursors */}
          {USERS.map((u, i) => (
            <div
              key={u.name}
              className="absolute pointer-events-none transition-all duration-[1100ms] ease-in-out"
              style={{ top: positions[i].top, left: positions[i].left }}
            >
              <div className="w-[1.5px] h-[18px] rounded-full" style={{ backgroundColor: u.color }} />
              <div
                className="absolute -top-[22px] left-1 text-white text-[9px] font-semibold px-1.5 py-[2px] rounded-full whitespace-nowrap"
                style={{ backgroundColor: u.color }}
              >
                {u.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typing indicator */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-[#1F2937] rounded-full px-3 py-1.5">
          <div className="flex gap-[3px] items-end h-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-[#3B82F6] animate-bounce"
                style={{ height: '6px', animationDelay: `${i * 140}ms`, animationDuration: '0.8s' }}
              />
            ))}
          </div>
          <span className="text-[11px] text-[#6B7280]">
            <span style={{ color: USERS[typingUser].color }}>{USERS[typingUser].name}</span> is typing…
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[#374151]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
          <span>0ms lag</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[44%] flex-col bg-[#111827] px-10 pt-12 pb-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src="/collabdocs-logo-full.png?v=2" alt="CollabDocs" className="h-14 w-auto object-contain rounded-xl" />
        </div>

        {/* Live preview centred vertically */}
        <div className="flex-1 flex flex-col justify-center py-8">
          <LivePreview />
        </div>

        <p className="text-[12px] text-[#374151]">© 2026 CollabDocs</p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 items-center justify-center bg-white px-5 sm:px-8 py-10 sm:py-12">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="mb-10 lg:hidden flex justify-center">
            <img src="/collabdocs-logo-full.png?v=2" alt="CollabDocs" className="h-12 w-auto object-contain" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-[42px] font-extrabold text-[#0F172A] tracking-[-0.04em] leading-[1.05]">
              Welcome back
            </h1>
            <p className="mt-2.5 text-[15px] text-[#64748B] leading-relaxed">
              Sign in to continue to CollabDocs
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span className="text-[13px] font-medium text-red-600">{error}</span>
            </div>
          )}

          {/* Google */}
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#E2E8F0] bg-white text-[14px] font-semibold text-[#0F172A] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-[#CBD5E1] transition-all duration-200"
          >
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </a>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-[#F1F5F9]" />
            <span className="text-[12px] text-[#94A3B8] font-medium">or</span>
            <div className="h-px flex-1 bg-[#F1F5F9]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[13px] font-semibold text-[#0F172A] mb-1.5 tracking-[-0.01em]">
                Email
              </label>
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

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] font-semibold text-[#0F172A] tracking-[-0.01em]">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[13px] font-medium text-[#64748B] hover:text-[#0F172A] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-[46px] w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 pr-11 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-all duration-150 focus:border-[#3B82F6] focus:bg-white focus:ring-4 focus:ring-[#3B82F6]/[0.08]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-[#94A3B8] hover:text-[#64748B] transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="mt-2 h-[46px] w-full rounded-xl bg-[#0F172A] text-[15px] font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:bg-[#1E293B] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </span>
              ) : 'Continue'}
            </button>
          </form>

          <p className="mt-8 text-center text-[13px] text-[#94A3B8]">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold text-[#0F172A] hover:underline transition-colors">
              Sign up free
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
