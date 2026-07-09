'use client';
import { useState, useRef, useEffect, FormEvent, KeyboardEvent, ClipboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '../../lib/api';

type Step = 'email' | 'otp' | 'reset' | 'done';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds — matches the server-side resend throttle

// Basic RFC-5322-ish check: non-empty local part, single @, a dotted domain.
// Kept deliberately lenient — the server is the source of truth, this just
// gates the button and drives the inline hint.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (value: string) => EMAIL_RE.test(value.trim());

// Password rules — kept in sync with the server's validatePassword config.
const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

// ─── Flow steps (drives the tracker on the brand panel) ───────────────────────
const FLOW_STEPS = [
  { key: 'email', label: 'Verify email', hint: 'Confirm the account' },
  { key: 'otp', label: 'Enter code', hint: 'Check your inbox' },
  { key: 'reset', label: 'New password', hint: 'Secure the account' },
] as const;

const stepIndexOf = (step: Step) => (step === 'done' ? FLOW_STEPS.length : FLOW_STEPS.findIndex((s) => s.key === step));

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

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

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 anim-slide-up" role="alert">
      <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <span className="text-[13px] font-medium text-red-600">{message}</span>
    </div>
  );
}

const inputClass =
  'h-[48px] w-full rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-all duration-150 focus:border-[#2563EB] focus:bg-white focus:ring-4 focus:ring-[#2563EB]/[0.10]';
// Solid brand-blue CTA — flat, with a simple darken on hover.
const primaryBtn =
  'group flex h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-[#1D4ED8] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed';

// ─── 6-digit segmented OTP input ──────────────────────────────────────────────
function OtpInput({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setDigit = (index: number, digit: string) => {
    const chars = value.split('');
    chars[index] = digit;
    onChange(chars.join('').slice(0, OTP_LENGTH));
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    setDigit(index, digit);
    if (index < OTP_LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[index]) {
        setDigit(index, '');
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        setDigit(index - 1, '');
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!digits) return;
    onChange(digits);
    refs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  };

  return (
    <div className="flex justify-between gap-2 sm:gap-2.5" role="group" aria-label="Verification code">
      {Array.from({ length: OTP_LENGTH }).map((_, i) => {
        const filled = !!value[i];
        return (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            disabled={disabled}
            aria-label={`Digit ${i + 1}`}
            value={value[i] ?? ''}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={`h-[56px] w-full rounded-2xl border bg-[#F8FAFC] text-center text-[22px] font-bold text-[#0F172A] outline-none transition-all duration-150 focus:bg-white focus:ring-4 focus:ring-[#2563EB]/[0.12] disabled:opacity-50 ${
              invalid
                ? 'border-red-300 focus:border-red-400'
                : filled
                ? 'border-[#2563EB] bg-white shadow-[0_2px_8px_-2px_rgba(37,99,235,0.25)]'
                : 'border-[#E2E8F0] focus:border-[#2563EB]'
            }`}
          />
        );
      })}
    </div>
  );
}

// ─── Brand panel — a flat, concrete preview of the recovery email ─────────────
function BrandPanel({ email }: { email: string }) {
  const recipient = email.trim() || 'you@example.com';
  // Illustrative digits — the real code is entered on the right.
  const sampleCode = ['4', '8', '1', '5', '2', '9'];

  return (
    <div className="relative hidden lg:flex lg:w-[46%] flex-col bg-[#111827] px-12 pt-12 pb-10">
      {/* Logo */}
      <div className="flex items-center">
        <Image src="/collabdocs-logo-full.png?v=3" alt="CollabDocs" width={662} height={216} priority className="h-14 w-auto object-contain" />
      </div>

      {/* Centre */}
      <div className="flex-1 flex flex-col justify-center py-10">
        <div className="max-w-[400px]">
          <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#60A5FA]">Password recovery</span>
          <h2 className="mt-4 text-[30px] font-bold leading-[1.18] tracking-[-0.02em] text-white">
            A verification code is on the way to your inbox.
          </h2>
          <p className="mt-3.5 text-[14px] leading-relaxed text-[#94A3B8]">
            Enter it on the right to prove it&apos;s you, then choose a new password. The code stays valid for 10 minutes.
          </p>

          {/* Recovery-email preview — flat white card, no gradients */}
          <div className="anim-scale-in mt-9 overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
            {/* Sender row */}
            <div className="flex items-center gap-3 border-b border-[#EEF1F5] px-5 py-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-[13px] font-bold text-white">C</div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[#0F172A]">CollabDocs</div>
                <div className="truncate text-[11px] text-[#94A3B8]">to {recipient}</div>
              </div>
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#2563EB]" aria-hidden="true" />
            </div>

            {/* Body */}
            <div className="px-5 pb-5 pt-4">
              <div className="text-[14px] font-semibold text-[#0F172A]">Your verification code</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[#64748B]">Use this code to reset your password.</p>
              <div className="mt-4 flex gap-2">
                {sampleCode.map((d, i) => (
                  <div
                    key={i}
                    style={{ animation: 'slideUp 0.4s var(--ease-apple) both', animationDelay: `${300 + i * 70}ms` }}
                    className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[#F1F5F9] text-[20px] font-bold text-[#0F172A]"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" d="M12 8v4l2.5 2.5" />
                </svg>
                Expires in 10 minutes
              </div>
            </div>
          </div>

          {/* Trust row */}
          <div className="mt-8 flex items-center gap-6 text-[12px] text-[#64748B]">
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path strokeLinecap="round" d="M8 11V8a4 4 0 018 0v3" />
              </svg>
              Encrypted end-to-end
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              One-time use
            </span>
          </div>
        </div>
      </div>

      <p className="text-[12px] text-[#475569]">© 2026 CollabDocs</p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Resend countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const emailValid = isValidEmail(email);
  const passwordValid = PASSWORD_RULES.every((r) => r.test(password));
  const satisfiedRules = PASSWORD_RULES.filter((r) => r.test(password)).length;

  // ── Step 1: request the OTP ──────────────────────────────────────────────
  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // The server always returns the same generic response — it never reveals
      // whether the email is registered or is a Google-only account (those users
      // are notified over email instead). So we advance to the OTP step for every
      // input, leaking nothing about which addresses exist.
      await api.post('/auth/forgot-password', { email });
      setStep('otp');
      setOtp('');
      setCooldown(RESEND_COOLDOWN);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Resend OTP ───────────────────────────────────────────────────────────
  async function handleResend() {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/resend-otp', { email });
      setOtp('');
      setCooldown(RESEND_COOLDOWN);
    } catch (err: any) {
      const retry = err.response?.data?.retryAfterSec;
      if (retry) setCooldown(retry);
      setError(err.response?.data?.error || 'Could not resend the code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: verify the OTP ───────────────────────────────────────────────
  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (otp.length !== OTP_LENGTH) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/verify-otp', { email, otp });
      setResetToken(res.data.resetToken);
      setStep('reset');
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.code === 'OTP_EXPIRED' || data?.code === 'OTP_LOCKED') {
        setError(data.error || 'Your code has expired. Please request a new one.');
        setOtp('');
        setCooldown(0); // allow an immediate resend
      } else {
        setError(data?.error || 'Invalid code. Please try again.');
        setOtp('');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: set the new password ─────────────────────────────────────────
  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!passwordValid) {
      setError('Please choose a password that meets all the requirements.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token: resetToken, password });
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not reset your password. Please start over.');
    } finally {
      setLoading(false);
    }
  }

  function backToEmail() {
    setStep('email');
    setOtp('');
    setError('');
    setCooldown(0);
  }

  const stepMeta = FLOW_STEPS[stepIndexOf(step)];

  return (
    <div className="flex min-h-screen bg-white">
      {/* ── Left brand panel ── */}
      <BrandPanel email={email} />

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-center justify-center px-5 sm:px-8 py-10 sm:py-12">
        <div className="w-full max-w-[390px]">

          {/* Mobile logo */}
          <div className="mb-10 lg:hidden flex justify-center">
            <Image src="/collabdocs-logo-full.png?v=3" alt="CollabDocs" width={662} height={216} priority className="h-12 w-auto object-contain" />
          </div>

          {/* Step indicator with label (all breakpoints, hidden on success) */}
          {step !== 'done' && (
            <div className="mb-8">
              <div className="mb-2 flex items-center justify-between text-[12px] font-semibold tracking-[-0.01em]">
                <span className="text-[#2563EB]">Step {stepIndexOf(step) + 1} of {FLOW_STEPS.length}</span>
                <span className="text-[#94A3B8]">{stepMeta?.label}</span>
              </div>
              <div className="flex items-center gap-2" aria-hidden="true">
                {FLOW_STEPS.map((s, i) => {
                  const active = stepIndexOf(step);
                  return (
                    <div key={s.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEF2F7]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          i < active ? 'w-full bg-[#2563EB]' : i === active ? 'w-1/2 bg-[#3B82F6]' : 'w-0'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP: enter email ── */}
          {step === 'email' && (
            <div className="anim-fade-in">
              <div className="mb-8">
                <h1 className="text-[32px] font-extrabold text-[#0F172A] tracking-[-0.035em] leading-[1.08]">Forgot password?</h1>
                <p className="mt-2.5 text-[15px] text-[#64748B] leading-relaxed">
                  Enter your email and we&apos;ll send you a verification code to reset it.
                </p>
              </div>

              {error && <ErrorBanner message={error} />}

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-[13px] font-semibold text-[#0F172A] mb-1.5 tracking-[-0.01em]">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={email.length > 0 && !emailValid ? true : undefined}
                    className={`${inputClass} ${
                      email.length > 0 && !emailValid ? 'border-red-300 focus:border-red-400 focus:ring-red-500/[0.08]' : ''
                    }`}
                  />
                  {email.length > 0 && !emailValid && (
                    <p className="mt-1.5 text-[12.5px] font-medium text-red-500">Enter a valid email address</p>
                  )}
                </div>
                <button type="submit" disabled={loading || !emailValid} className={primaryBtn}>
                  {loading ? <><Spinner /> Sending…</> : <>Send code<span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span></>}
                </button>
              </form>

              <p className="mt-7 text-center text-[14px] text-[#64748B]">
                Remembered it?{' '}
                <Link href="/login" className="font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors">Sign in</Link>
              </p>
            </div>
          )}

          {/* ── STEP: enter OTP ── */}
          {step === 'otp' && (
            <div className="anim-fade-in">
              <div className="mb-7">
                <h1 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.03em] leading-[1.1]">Enter the code</h1>
                <p className="mt-2.5 text-[15px] text-[#64748B] leading-relaxed">
                  We sent a {OTP_LENGTH}-digit code to <span className="font-semibold text-[#0F172A]">{email}</span>. It expires in 10 minutes.
                </p>
              </div>

              {error && <ErrorBanner message={error} />}

              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <OtpInput value={otp} onChange={setOtp} disabled={loading} invalid={!!error} />
                <button type="submit" disabled={loading || otp.length !== OTP_LENGTH} className={primaryBtn}>
                  {loading ? <><Spinner /> Verifying…</> : 'Verify code'}
                </button>
              </form>

              <div className="mt-6 text-center text-[14px] text-[#64748B]">
                {cooldown > 0 ? (
                  <span>Resend code in <span className="font-semibold text-[#0F172A] tabular-nums">{cooldown}s</span></span>
                ) : (
                  <button type="button" onClick={handleResend} disabled={loading} className="font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors disabled:opacity-50">
                    Resend code
                  </button>
                )}
              </div>
              <p className="mt-3 text-center">
                <button type="button" onClick={backToEmail} className="inline-flex items-center gap-1 text-[14px] font-medium text-[#64748B] hover:text-[#0F172A] transition-colors">
                  <span aria-hidden="true">←</span> Change email
                </button>
              </p>
            </div>
          )}

          {/* ── STEP: reset password ── */}
          {step === 'reset' && (
            <div className="anim-fade-in">
              <div className="mb-7">
                <h1 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.03em] leading-[1.1]">Set a new password</h1>
                <p className="mt-2.5 text-[15px] text-[#64748B] leading-relaxed">Choose a strong password you don&apos;t use elsewhere.</p>
              </div>

              {error && <ErrorBanner message={error} />}

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-[13px] font-semibold text-[#0F172A] mb-1.5 tracking-[-0.01em]">New password</label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className={`${inputClass} pr-11`}
                    />
                    <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] transition-colors">
                      <EyeIcon open={showPw} />
                    </button>
                  </div>

                  {/* Strength meter */}
                  {password.length > 0 && (
                    <div className="mt-3">
                      <div className="flex gap-1" aria-hidden="true">
                        {PASSWORD_RULES.map((_, i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                            i < satisfiedRules ? (satisfiedRules <= 2 ? 'bg-red-400' : satisfiedRules <= 4 ? 'bg-amber-400' : 'bg-green-500') : 'bg-[#E2E8F0]'
                          }`} />
                        ))}
                      </div>
                      <ul className="mt-3 grid grid-cols-1 gap-1.5">
                        {PASSWORD_RULES.map((rule) => {
                          const ok = rule.test(password);
                          return (
                            <li key={rule.label} className={`flex items-center gap-2 text-[12.5px] transition-colors ${ok ? 'text-green-600' : 'text-[#94A3B8]'}`}>
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                {ok ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    : <circle cx="12" cy="12" r="9" strokeWidth={1.5} />}
                              </svg>
                              {rule.label}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-[13px] font-semibold text-[#0F172A] mb-1.5 tracking-[-0.01em]">Confirm password</label>
                  <input
                    id="confirm-password"
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className={inputClass}
                  />
                  {confirm.length > 0 && confirm !== password && (
                    <p className="mt-1.5 text-[12.5px] font-medium text-red-500">Passwords do not match</p>
                  )}
                </div>

                <button type="submit" disabled={loading || !passwordValid || password !== confirm} className={primaryBtn}>
                  {loading ? <><Spinner /> Updating…</> : 'Update password'}
                </button>
              </form>
            </div>
          )}

          {/* ── STEP: success ── */}
          {step === 'done' && (
            <div className="text-center anim-fade-in">
              <div className="relative mx-auto mb-6 flex h-[72px] w-[72px] items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-green-500/15 anim-ring" />
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#10B981] anim-pop">
                  <svg className="h-9 w-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>
              <h1 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.03em]">Password updated</h1>
              <p className="mt-3 text-[15px] text-[#64748B] leading-relaxed">
                Your password has been updated successfully. You can now sign in with your new password.
              </p>
              <button type="button" onClick={() => router.replace('/login?reset=1')} className={`${primaryBtn} mt-8`}>
                Go to sign in
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); }
        }
        .anim-pop { animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

        @keyframes ring {
          0% { transform: scale(0.8); opacity: 0.7; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .anim-ring { animation: ring 1.4s ease-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .anim-pop, .anim-ring { animation: none; }
        }
      `}</style>
    </div>
  );
}
