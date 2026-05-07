'use client';
import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';

type Step = 1 | 2 | 3 | 4;

// ─── EyeIcon ───────────────────────────────────────────────────────────────

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

// ─── StrengthBar ───────────────────────────────────────────────────────────

function StrengthBar({ password }: { password: string }) {
  const score = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 8 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const barColor = ['', 'bg-red-500', 'bg-amber-400', 'bg-emerald-500', 'bg-emerald-500'];
  const txtColor = ['', 'text-red-500', 'text-amber-500', 'text-emerald-600', 'text-emerald-600'];
  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? barColor[score] : 'bg-[#E5E7EB]'}`} />
        ))}
      </div>
      <p className={`text-[11px] font-medium ${txtColor[score]}`}>{labels[score]}</p>
    </div>
  );
}

// ─── StepIndicator ─────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {([1, 2, 3, 4] as const).map(s => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 ${
            s < step ? 'bg-[#0F172A] text-white' :
            s === step ? 'bg-[#0F172A] text-white ring-4 ring-[#0F172A]/10' :
            'bg-[#F1F5F9] text-[#94A3B8]'
          }`}>
            {s < step ? (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : s}
          </div>
          {s < 4 && (
            <div className={`h-0.5 w-8 rounded-full transition-all duration-500 ${s < step ? 'bg-[#0F172A]' : 'bg-[#E2E8F0]'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Left panel: Step 1 preview ────────────────────────────────────────────

const USE_CASE_ICONS = [
  <svg key="pen" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>,
  <svg key="users" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>,
  <svg key="code" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>,
];

function UseCasePreview() {
  const [lit, setLit] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLit(v => (v + 1) % 3), 1800);
    return () => clearInterval(id);
  }, []);
  const items = [
    { label: 'Personal writing', desc: 'Notes, journals & essays', color: '#3B82F6' },
    { label: 'Team collaboration', desc: 'Shared docs & real-time editing', color: '#8B5CF6' },
    { label: 'Coding / docs', desc: 'READMEs, wikis & specs', color: '#10B981' },
  ];
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 transition-all duration-700 ${
            lit === i ? 'border-white/20 bg-white/[0.08]' : 'border-white/5 bg-white/[0.02]'
          }`}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-700"
            style={{ backgroundColor: lit === i ? item.color + '30' : 'rgba(255,255,255,0.04)', color: lit === i ? item.color : '#4B5563' }}
          >
            {USE_CASE_ICONS[i]}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[13px] font-semibold transition-colors duration-300 ${lit === i ? 'text-white' : 'text-[#6B7280]'}`}>
              {item.label}
            </p>
            <p className={`text-[11px] mt-0.5 transition-colors duration-300 ${lit === i ? 'text-[#9CA3AF]' : 'text-[#374151]'}`}>
              {item.desc}
            </p>
          </div>
          <div
            className="w-2 h-2 rounded-full flex-shrink-0 transition-all duration-700"
            style={{ backgroundColor: lit === i ? item.color : 'transparent', opacity: lit === i ? 1 : 0 }}
          />
        </div>
      ))}
      <p className="text-[11px] text-[#374151] pt-2 px-1">Whatever you choose, you can change it later.</p>
    </div>
  );
}

// ─── Left panel: Step 2 preview (live editing) ─────────────────────────────

const LIVE_USERS = [
  { name: 'Sumit', color: '#3B82F6', initials: 'S' },
  { name: 'Aman', color: '#8B5CF6', initials: 'A' },
];
const CW = [
  [{ top: 46, left: 32 }, { top: 90, left: 118 }],
  [{ top: 78, left: 88 }, { top: 50, left: 48 }],
  [{ top: 62, left: 140 }, { top: 105, left: 64 }],
  [{ top: 95, left: 56 }, { top: 68, left: 130 }],
];
const TYPED_TEXT = 'simultaneously—without conflicts, with zero lag.';

function LivePreview() {
  const [typed, setTyped] = useState(0);
  const [blink, setBlink] = useState(true);
  const [wi, setWi] = useState(0);

  useEffect(() => {
    let i = 0;
    const tick = () => {
      i++;
      if (i > TYPED_TEXT.length + 12) { i = 0; setTyped(0); }
      else setTyped(Math.min(i, TYPED_TEXT.length));
    };
    const id = setInterval(tick, 65);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setBlink(v => !v), 500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setWi(v => (v + 1) % CW.length), 2400);
    return () => clearInterval(id);
  }, []);

  const wp = CW[wi];
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
        <div className="flex gap-1.5">
          {['#FF5F57', '#FEBC2E', '#28C840'].map(c => (
            <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#10B981]/20">
          <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-[10px] font-semibold text-[#10B981] tracking-wide">LIVE</span>
        </div>
        <div className="flex -space-x-1.5">
          {LIVE_USERS.map(u => (
            <div key={u.name} className="w-5 h-5 rounded-full border border-[#111827] flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: u.color }}>
              {u.initials}
            </div>
          ))}
        </div>
      </div>
      <div className="relative px-5 py-4 min-h-[140px]">
        <p className="text-[11px] font-bold text-white/80 mb-1.5">Project Roadmap</p>
        <p className="text-[10px] text-[#9CA3AF] leading-relaxed">
          Multiple people can edit this document{' '}
          <span className="text-white">
            {TYPED_TEXT.slice(0, typed)}
            {typed < TYPED_TEXT.length && (
              <span style={{ opacity: blink ? 1 : 0 }} className="inline-block w-0.5 h-3 bg-white align-middle ml-px" />
            )}
          </span>
        </p>
        {LIVE_USERS.map((u, i) => (
          <div
            key={u.name}
            className="absolute flex items-start gap-1 pointer-events-none transition-all duration-[1100ms] ease-in-out"
            style={{ top: wp[i].top, left: wp[i].left }}
          >
            <svg width="10" height="12" viewBox="0 0 10 12" fill={u.color}>
              <path d="M0 0 L10 4 L5.5 5.5 L4 10 Z" />
            </svg>
            <span className="text-[9px] font-semibold text-white px-1.5 py-0.5 rounded whitespace-nowrap" style={{ backgroundColor: u.color }}>
              {u.name}
            </span>
          </div>
        ))}
      </div>
      <div className="px-5 py-2 border-t border-white/10 flex items-center gap-2">
        <div className="flex gap-0.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1 h-1 rounded-full bg-[#9CA3AF] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
        <span className="text-[10px] text-[#6B7280]">Aman is typing…</span>
      </div>
    </div>
  );
}

// ─── Left panel: Step 3 preview ────────────────────────────────────────────

const DOC_ICONS = [
  <svg key="doc" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>,
  <svg key="book" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>,
  <svg key="chart" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>,
];

function WorkspacePreview({ name }: { name: string }) {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    setVisible(0);
    const timers = [400, 900, 1400].map((d, i) => setTimeout(() => setVisible(i + 1), d));
    return () => timers.forEach(clearTimeout);
  }, [name]);
  const docs = ['Getting Started', 'Team Handbook', 'Roadmap 2026'];
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10">
        <div className="w-7 h-7 rounded-lg bg-[#3B82F6]/20 flex items-center justify-center text-[#3B82F6]">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        <span className="text-[13px] font-semibold text-white truncate flex-1">{name || 'Your Workspace'}</span>
        <span className="text-[10px] text-[#10B981] font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] inline-block animate-pulse" />
          Created
        </span>
      </div>
      <div className="p-3 space-y-1.5">
        {docs.map((title, i) => (
          <div
            key={title}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/5 bg-white/[0.02] transition-all duration-500 ${
              i < visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <span className="text-[#6B7280]">{DOC_ICONS[i]}</span>
            <span className="text-[11px] text-[#D1D5DB]">{title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Left panel: Step 4 preview ────────────────────────────────────────────

function InvitePreview() {
  const [joined, setJoined] = useState(0);
  useEffect(() => {
    const timers = [800, 2000].map((d, i) => setTimeout(() => setJoined(i + 1), d));
    return () => timers.forEach(clearTimeout);
  }, []);
  const teammates = [
    { initials: 'SK', name: 'Sakshi K.', color: '#EC4899', role: 'Editor' },
    { initials: 'RP', name: 'Raj P.', color: '#F59E0B', role: 'Viewer' },
  ];
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03]">
      <div className="px-4 py-3 border-b border-white/10">
        <p className="text-[12px] font-semibold text-white">Team members</p>
      </div>
      <div className="p-3 space-y-1.5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20">
          <div className="w-7 h-7 rounded-full bg-[#3B82F6] flex items-center justify-center text-[11px] font-bold text-white">S</div>
          <div className="flex-1">
            <p className="text-[12px] font-semibold text-white">You</p>
            <p className="text-[10px] text-[#6B7280]">Owner</p>
          </div>
          <span className="text-[10px] font-medium text-[#3B82F6]">Owner</span>
        </div>
        {teammates.map((tm, i) => (
          <div
            key={tm.name}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl border border-white/5 bg-white/[0.02] transition-all duration-700 ${
              i < joined ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'
            }`}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: tm.color }}>
              {tm.initials}
            </div>
            <div className="flex-1">
              <p className="text-[12px] text-[#D1D5DB]">{tm.name}</p>
              <p className="text-[10px] text-[#6B7280]">{tm.role}</p>
            </div>
            {i < joined && (
              <span className="text-[10px] text-[#10B981] flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Invited
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Left panel orchestrator ────────────────────────────────────────────────

function OnboardingPreview({ step, workspaceName }: { step: Step; workspaceName: string }) {
  const meta: Record<Step, { title: string; subtitle: string }> = {
    1: { title: 'See it in action', subtitle: 'Real-time editing, zero lag.' },
    2: { title: 'Find your fit', subtitle: 'CollabDocs adapts to how you work.' },
    3: { title: 'Your workspace', subtitle: 'A place for everything you create.' },
    4: { title: 'Build your team', subtitle: 'Collaboration starts with one invite.' },
  };
  const { title, subtitle } = meta[step];
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.2em] text-[#4B5563] uppercase mb-3">Step {step} of 4</p>
      <h2 className="text-[30px] font-bold text-white tracking-[-0.02em] leading-tight mb-1">{title}</h2>
      <p className="text-[14px] text-[#6B7280] mb-8">{subtitle}</p>
      {step === 1 && <LivePreview />}
      {step === 2 && <UseCasePreview />}
      {step === 3 && <WorkspacePreview name={workspaceName} />}
      {step === 4 && <InvitePreview />}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();

  const finishSignup = () => {
    const redirect = sessionStorage.getItem('postLoginRedirect');
    sessionStorage.removeItem('postLoginRedirect');
    router.replace(redirect || '/dashboard');
  };

  const [step, setStep] = useState<Step>(1);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteEmails, setInviteEmails] = useState(['', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step === 3 && displayName && !workspaceName) {
      const firstName = displayName.trim().split(' ')[0];
      setWorkspaceName(`${firstName}'s Workspace`);
    }
  }, [step]);

  async function handleAccountSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup(email, password, displayName, username);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const ctaClass = 'h-[50px] w-full rounded-xl bg-[#0F172A] text-[15px] font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-all hover:bg-[#1E293B] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(15,23,42,0.25)] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none';
  const inputClass = 'h-[48px] w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:bg-white focus:border-[#94A3B8] focus:ring-4 focus:ring-[#0F172A]/[0.06] transition-all';

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[44%] flex-col bg-[#111827] px-10 pt-12 pb-10">
        <img src="/collabdocs-logo-full.png?v=2" alt="CollabDocs" className="h-14 w-auto object-contain rounded-xl self-start" />
        <div className="flex-1 flex flex-col justify-center py-8">
          <OnboardingPreview step={step} workspaceName={workspaceName} />
        </div>
        <p className="text-[12px] text-[#374151]">© 2026 CollabDocs</p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 items-center justify-center bg-white px-5 sm:px-6 py-8 sm:py-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden flex justify-center">
            <img src="/collabdocs-logo-full.png?v=2" alt="CollabDocs" className="h-14 w-auto object-contain rounded-xl" />
          </div>

          {/* ── Step 1: Account creation ── */}
          {step === 1 && (
            <div>
              <StepIndicator step={step} />

              <h1 className="text-[38px] font-extrabold text-[#0F172A] tracking-[-0.04em] leading-[1.05]">
                Create your<br />account
              </h1>
              <p className="mt-2 text-[15px] text-[#64748B]">Free forever. No credit card required.</p>
              <Link
                href="/demo"
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#0F172A]/10 bg-[#0F172A] text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#1E293B]"
              >
                See demo
              </Link>

              {error && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span className="text-[13px] font-medium text-red-600">{error}</span>
                </div>
              )}

              <a
                href={`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`}
                className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#E2E8F0] bg-white text-[14px] font-medium text-[#374151] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:bg-[#F8FAFC] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
              >
                <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </a>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#E2E8F0]" />
                <span className="text-[12px] text-[#94A3B8]">or</span>
                <div className="h-px flex-1 bg-[#E2E8F0]" />
              </div>

              <form onSubmit={handleAccountSubmit} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Full name</label>
                  <input
                    autoFocus
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Your full name"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="@sumit_kumar"
                    className={inputClass}
                  />
                  <p className="mt-1.5 text-[12px] text-[#94A3B8]">This username will be shown on your live editor cursor.</p>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Min. 8 characters"
                      className={`${inputClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-3 flex items-center text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                    >
                      <EyeIcon open={showPw} />
                    </button>
                  </div>
                  <StrengthBar password={password} />
                </div>

                <button
                  type="submit"
                  disabled={loading || !displayName || !email || password.length < 8}
                  className={`mt-2 ${ctaClass}`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Creating account…
                    </span>
                  ) : 'Continue'}
                </button>
              </form>

              {/* Trust signals */}
              <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-[11px] text-[#9CA3AF]">256-bit SSL</span>
                </div>
                <div className="w-px h-3 bg-[#E2E8F0]" />
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[#6B7280]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span className="text-[11px] text-[#9CA3AF]">Open source</span>
                </div>
                <div className="w-px h-3 bg-[#E2E8F0]" />
                <div className="flex items-center gap-1.5">
                  <div className="flex -space-x-1.5">
                    {['#3B82F6', '#8B5CF6', '#EC4899', '#10B981'].map((c, i) => (
                      <div key={i} className="w-5 h-5 rounded-full border-2 border-white" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <span className="text-[11px] text-[#9CA3AF]">10k+ teams</span>
                </div>
              </div>

              <p className="mt-5 text-center text-[13px] text-[#94A3B8]">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-[#0F172A] hover:underline">Sign in</Link>
              </p>
            </div>
          )}

          {/* ── Step 2: Use case ── */}
          {step === 2 && (
            <div>
              <StepIndicator step={step} />
              <h1 className="text-[38px] font-extrabold text-[#0F172A] tracking-[-0.04em] leading-[1.05]">
                How will you use<br />CollabDocs?
              </h1>
              <p className="mt-2 text-[15px] text-[#64748B]">We'll personalize your experience.</p>

              <div className="mt-8 space-y-3">
                {([
                  {
                    id: 'personal',
                    label: 'Personal writing',
                    desc: 'Notes, journals & essays',
                    icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    ),
                  },
                  {
                    id: 'team',
                    label: 'Team collaboration',
                    desc: 'Shared docs & real-time editing',
                    icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ),
                  },
                  {
                    id: 'coding',
                    label: 'Coding / docs',
                    desc: 'READMEs, wikis & specifications',
                    icon: (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    ),
                  },
                ] as const).map(uc => (
                  <button
                    key={uc.id}
                    type="button"
                    onClick={() => setStep(3)}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-[#E2E8F0] text-left transition-all hover:border-[#0F172A] hover:bg-[#F8FAFC] group active:scale-[0.99]"
                  >
                    <span className="text-[#64748B] group-hover:text-[#0F172A] transition-colors">{uc.icon}</span>
                    <div className="flex-1">
                      <p className="text-[15px] font-semibold text-[#0F172A]">{uc.label}</p>
                      <p className="text-[13px] text-[#64748B] mt-0.5">{uc.desc}</p>
                    </div>
                    <svg className="w-5 h-5 text-[#CBD5E1] group-hover:text-[#0F172A] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => finishSignup()}
                className="mt-5 w-full text-center text-[13px] text-[#94A3B8] hover:text-[#64748B] transition-colors"
              >
                Skip for now →
              </button>
            </div>
          )}

          {/* ── Step 3: Workspace name ── */}
          {step === 3 && (
            <div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors mb-6"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <StepIndicator step={step} />
              <h1 className="text-[38px] font-extrabold text-[#0F172A] tracking-[-0.04em] leading-[1.05]">
                Name your<br />workspace
              </h1>
              <p className="mt-2 text-[15px] text-[#64748B]">This is where you and your team create together.</p>

              <div className="mt-8 space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Workspace name</label>
                  <input
                    autoFocus
                    type="text"
                    value={workspaceName}
                    onChange={e => setWorkspaceName(e.target.value)}
                    placeholder="My Workspace"
                    className={inputClass}
                    onKeyDown={e => e.key === 'Enter' && workspaceName.trim() && setStep(4)}
                  />
                  <p className="mt-1.5 text-[12px] text-[#94A3B8]">You can always rename it later.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(4)}
                  disabled={!workspaceName.trim()}
                  className={ctaClass}
                >
                  Create your workspace →
                </button>

                <button
                  type="button"
                  onClick={() => finishSignup()}
                  className="w-full text-center text-[13px] text-[#94A3B8] hover:text-[#64748B] transition-colors"
                >
                  Skip for now →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Invite teammates ── */}
          {step === 4 && (
            <div>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors mb-6"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <StepIndicator step={step} />

              <h1 className="text-[38px] font-extrabold text-[#0F172A] tracking-[-0.04em] leading-[1.05]">
                Invite your<br />teammates
              </h1>
              <p className="mt-2 text-[15px] text-[#64748B]">Start collaborating right away. Add more later.</p>

              <div className="mt-8 space-y-3">
                {inviteEmails.map((em, i) => (
                  <input
                    key={i}
                    autoFocus={i === 0}
                    type="email"
                    value={em}
                    onChange={e => {
                      const next = [...inviteEmails];
                      next[i] = e.target.value;
                      setInviteEmails(next);
                    }}
                    placeholder={`teammate${i + 1}@example.com`}
                    className={inputClass}
                  />
                ))}

                <button
                  type="button"
                  onClick={() => setInviteEmails(v => [...v, ''])}
                  className="flex items-center gap-2 text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add another
                </button>

                <div className="pt-2 space-y-3">
                  <button
                    type="button"
                    onClick={() => finishSignup()}
                    className={ctaClass}
                  >
                    Send invites &amp; go to dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => finishSignup()}
                    className="h-[44px] w-full rounded-xl border border-[#E2E8F0] text-[14px] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-all"
                  >
                    Skip for now →
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-[11px] text-[#9CA3AF]">
            By continuing you agree to our{' '}
            <Link href="/terms" className="underline hover:text-[#6B7280] transition-colors">Terms</Link>
            {' '}and{' '}
            <Link href="/terms#privacy" className="underline hover:text-[#6B7280] transition-colors">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
