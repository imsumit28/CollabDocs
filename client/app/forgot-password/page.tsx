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
    <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 anim-slide-up" role="alert">
      <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <span className="text-[13px] font-medium text-red-600">{message}</span>
    </div>
  );
}

const inputClass =
  'h-[46px] w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-all duration-150 focus:border-[#2563EB] focus:bg-white focus:ring-4 focus:ring-[#2563EB]/[0.10]';
const primaryBtn =
  'flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#0F172A] text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-all duration-150 hover:bg-[#1E293B] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed';

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
    <div className="flex justify-between gap-2" role="group" aria-label="Verification code">
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
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
          className={`h-[54px] w-full rounded-xl border bg-[#F8FAFC] text-center text-[22px] font-bold text-[#0F172A] outline-none transition-all duration-150 focus:bg-white focus:ring-4 focus:ring-[#2563EB]/[0.10] disabled:opacity-50 ${
            invalid ? 'border-red-300 focus:border-red-400' : 'border-[#E2E8F0] focus:border-[#2563EB]'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Brand panel — dark, matches /login; the step tracker mirrors the flow ────
function BrandPanel({ step }: { step: Step }) {
  const active = stepIndexOf(step);

  return (
    <div className="hidden lg:flex lg:w-[44%] flex-col bg-[#111827] px-10 pt-12 pb-10 relative overflow-hidden">
      {/* Ambient brand glow */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#2563EB]/25 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[#5856D6]/20 blur-[120px]" />

      {/* Logo */}
      <div className="relative flex items-center gap-3">
        <Image src="/collabdocs-logo-full.png?v=3" alt="CollabDocs" width={662} height={216} priority className="h-14 w-auto object-contain rounded-xl" />
      </div>

      {/* Centred content */}
      <div className="relative flex-1 flex flex-col justify-center py-8">
        {/* Lock badge */}
        <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#2563EB] shadow-[0_12px_32px_rgba(37,99,235,0.45)]">
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <rect x="4" y="10" width="16" height="11" rx="2.5" />
            <path strokeLinecap="round" d="M8 10V7a4 4 0 118 0v3" />
            <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
          </svg>
        </div>

        <h2 className="text-[30px] font-extrabold text-white tracking-[-0.03em] leading-[1.1]">
          Reset your password<br />securely.
        </h2>
        <p className="mt-3 text-[14px] text-[#9CA3AF] leading-relaxed max-w-[300px]">
          A quick, verified recovery — a code to your inbox, then a fresh password. Only takes a minute.
        </p>

        {/* Step tracker — reflects the live step */}
        <ol className="mt-10 space-y-1">
          {FLOW_STEPS.map((s, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <li key={s.key} className="flex items-center gap-4">
                <div className="relative flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border text-[13px] font-bold transition-all duration-300 ${
                      done
                        ? 'border-[#2563EB] bg-[#2563EB] text-white'
                        : current
                        ? 'border-[#3B82F6] bg-[#3B82F6]/15 text-[#93C5FD] ring-4 ring-[#3B82F6]/10'
                        : 'border-white/10 bg-white/5 text-[#4B5563]'
                    }`}
                  >
                    {done ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < FLOW_STEPS.length - 1 && (
                    <span className={`mt-1 h-6 w-px ${done ? 'bg-[#2563EB]' : 'bg-white/10'}`} />
                  )}
                </div>
                <div className="pb-4">
                  <div className={`text-[14px] font-semibold transition-colors ${current || done ? 'text-white' : 'text-[#6B7280]'}`}>
                    {s.label}
                  </div>
                  <div className="text-[12px] text-[#4B5563]">{s.hint}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="relative text-[12px] text-[#374151]">© 2026 CollabDocs</p>
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

  return (
    <div className="flex min-h-screen">
      {/* ── Left brand panel ── */}
      <BrandPanel step={step} />

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-center justify-center bg-white px-5 sm:px-8 py-10 sm:py-12">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="mb-10 lg:hidden flex justify-center">
            <Image src="/collabdocs-logo-full.png?v=3" alt="CollabDocs" width={662} height={216} priority className="h-12 w-auto object-contain" />
          </div>

          {/* Compact step indicator (all breakpoints, hidden on success) */}
          {step !== 'done' && (
            <div className="mb-8 flex items-center gap-2" aria-hidden="true">
              {FLOW_STEPS.map((s, i) => {
                const active = stepIndexOf(step);
                return (
                  <div
                    key={s.key}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                      i < active ? 'bg-[#2563EB]' : i === active ? 'bg-[#3B82F6]' : 'bg-[#E2E8F0]'
                    }`}
                  />
                );
              })}
            </div>
          )}

          {/* ── STEP: enter email ── */}
          {step === 'email' && (
            <div className="anim-fade-in">
              <div className="mb-8">
                <h1 className="text-[32px] font-extrabold text-[#0F172A] tracking-[-0.03em] leading-[1.1]">Forgot password?</h1>
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
                    aria-invalid={email.length > 0 && !emailValid ? 'true' : 'false'}
                    className={`${inputClass} ${
                      email.length > 0 && !emailValid ? 'border-red-300 focus:border-red-400 focus:ring-red-500/[0.08]' : ''
                    }`}
                  />
                  {email.length > 0 && !emailValid && (
                    <p className="mt-1.5 text-[12.5px] font-medium text-red-500">Enter a valid email address</p>
                  )}
                </div>
                <button type="submit" disabled={loading || !emailValid} className={primaryBtn}>
                  {loading ? <><Spinner /> Sending…</> : 'Send OTP'}
                </button>
              </form>

              <p className="mt-6 text-center text-[14px] text-[#64748B]">
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
                  {loading ? <><Spinner /> Verifying…</> : 'Verify OTP'}
                </button>
              </form>

              <div className="mt-6 text-center text-[14px] text-[#64748B]">
                {cooldown > 0 ? (
                  <span>Resend code in <span className="font-semibold text-[#0F172A] tabular-nums">{cooldown}s</span></span>
                ) : (
                  <button type="button" onClick={handleResend} disabled={loading} className="font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors disabled:opacity-50">
                    Resend OTP
                  </button>
                )}
              </div>
              <p className="mt-3 text-center">
                <button type="button" onClick={backToEmail} className="text-[14px] font-medium text-[#64748B] hover:text-[#0F172A] transition-colors">
                  ← Change email
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
                            <li key={rule.label} className={`flex items-center gap-2 text-[12.5px] ${ok ? 'text-green-600' : 'text-[#94A3B8]'}`}>
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
                  {loading ? <><Spinner /> Updating…</> : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {/* ── STEP: success ── */}
          {step === 'done' && (
            <div className="text-center anim-fade-in">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 anim-pop">
                <svg className="h-9 w-9 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-[28px] font-extrabold text-[#0F172A] tracking-[-0.03em]">Password updated</h1>
              <p className="mt-3 text-[15px] text-[#64748B] leading-relaxed">
                Your password has been updated successfully. You can now sign in with your new password.
              </p>
              <button type="button" onClick={() => router.replace('/login?reset=1')} className={`${primaryBtn} mt-8`}>
                Go to Sign In
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
      `}</style>
    </div>
  );
}
