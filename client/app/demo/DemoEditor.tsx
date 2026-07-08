'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, Download, FileText, Loader2, PanelRight, Share2, Sparkles } from 'lucide-react';
import FakeComment from './FakeComment';
import FakeCursor from './FakeCursor';
import FakeNotification from './FakeNotification';
import FakeToolbar from './FakeToolbar';
import { useDemoTimeline } from './useDemoTimeline';

const CURSOR_PATHS = [
  { top: 228, left: 180 },
  { top: 305, left: 292 },
  { top: 365, left: 226 },
  { top: 250, left: 200 },
];
const DEMO_TITLE = 'Project Roadmap 2026';
const DEMO_IMPROVED = `Q1 Goals:
- Reduce collaboration latency across every workspace
- Ship AI summaries for meetings, notes, and roadmap updates
- Polish exports for PDF, DOCX, and Markdown`;

function PresenceAvatar({ initials, color, delay = 0 }: { initials: string; color: string; delay?: number }) {
  return (
    <div className="relative">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0b1120] text-[11px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
      <span
        className="absolute inset-0 rounded-full border border-white/30 animate-ping"
        style={{ animationDelay: `${delay}ms`, animationDuration: '2200ms' }}
      />
    </div>
  );
}

export default function DemoEditor() {
  const timeline = useDemoTimeline();
  const cursorPosition = CURSOR_PATHS[timeline.cursorStep];

  return (
    <main className="min-h-screen overflow-hidden bg-[#050914] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(20,184,166,0.22),transparent_26%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.20),transparent_30%),linear-gradient(135deg,#050914_0%,#101827_48%,#08111f_100%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link href="/signup" className="flex items-center gap-3">
            <Image src="/collabdocs-logo-full.png?v=2" alt="CollabDocs" width={150} height={44} className="h-11 w-auto rounded-lg object-contain" priority />
          </Link>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-[12px] font-semibold text-slate-200 backdrop-blur-xl sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            3 collaborators online
          </div>
        </header>

        <section className="grid flex-1 items-center gap-6 py-5 lg:grid-cols-[0.82fr_1.18fr] lg:py-8">
          <div className="order-2 max-w-xl lg:order-1">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.22em] text-cyan-200">
              <Sparkles size={14} />
              Frontend only demo
            </p>
            <h1 className="text-[42px] font-extrabold leading-[0.98] tracking-[-0.04em] text-white sm:text-[58px] lg:text-[68px]">
              Live collaboration, staged like a product film.
            </h1>
            <p className="mt-5 max-w-lg text-[16px] leading-7 text-slate-300">
              A timed editor sequence with typing, presence, comments, AI actions, notifications, and export polish. No sockets, no API calls, just a sharp illusion.
            </p>
            <div className="mt-7 flex items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-5 text-[14px] font-bold text-slate-950 transition hover:bg-cyan-100"
              >
                Start signup
              </Link>
              <div className="h-11 min-w-[150px] overflow-hidden rounded-lg border border-white/10 bg-white/[0.06]">
                <div className="h-full bg-cyan-300/20 transition-all duration-700" style={{ width: `${timeline.progress}%` }} />
                <div className="-mt-11 flex h-11 items-center justify-center text-[12px] font-semibold text-cyan-100">
                  Scene progress
                </div>
              </div>
            </div>
          </div>

          <div className="relative order-1 mx-auto w-full max-w-3xl lg:order-2">
            <FakeNotification toasts={timeline.toasts} />
            <div
              className={`absolute right-8 top-14 z-50 flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/15 px-3 py-2 text-[13px] font-semibold text-emerald-100 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl transition-all duration-500 ${
                timeline.collaboratorJoined ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
              }`}
            >
              <PresenceAvatar initials="A" color="#10b981" />
              Aman joined workspace
            </div>

            <div className="relative overflow-hidden rounded-lg border border-white/12 bg-white/[0.08] shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.07] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                  <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[12px] font-semibold text-slate-300">
                  <FileText size={14} />
                  Roadmap workspace
                </div>
                <div className="flex -space-x-2">
                  <PresenceAvatar initials="SK" color="#3b82f6" />
                  <div className={`transition-opacity duration-500 ${timeline.collaboratorJoined ? 'opacity-100' : 'opacity-0'}`}>
                    <PresenceAvatar initials="A" color="#10b981" delay={260} />
                  </div>
                  <div className={`transition-opacity duration-500 ${timeline.secondCursor ? 'opacity-100' : 'opacity-0'}`}>
                    <PresenceAvatar initials="P" color="#ec4899" delay={520} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-white/10 bg-[#101827]/80 px-4 py-2.5">
                <div className="flex items-center gap-2 text-slate-300">
                  {['B', 'I', 'U'].map((item, index) => (
                    <button
                      key={item}
                      type="button"
                      className={`flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[13px] ${
                        index === 0 ? 'font-black' : index === 1 ? 'italic' : 'underline'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                  <button type="button" className="flex h-8 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[12px] font-semibold">
                    Normal <ChevronDown size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-slate-300">
                    <PanelRight size={15} />
                  </button>
                  <button type="button" className="flex h-8 items-center gap-2 rounded-md bg-cyan-300 px-3 text-[12px] font-bold text-slate-950">
                    <Share2 size={14} />
                    Share
                  </button>
                </div>
              </div>

              <div className="relative min-h-[560px] bg-[#f8fafc] px-5 py-6 text-slate-950 sm:px-8">
                <div className="mx-auto min-h-[500px] max-w-[620px] rounded-lg bg-white px-8 py-8 shadow-[0_16px_55px_rgba(15,23,42,0.14)]">
                  <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="text-[12px] font-semibold text-slate-400">Edited just now</div>
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      synced
                    </div>
                  </div>

                  <h2 className="min-h-[45px] text-[34px] font-extrabold leading-tight tracking-[-0.03em] text-slate-950">
                    <span>{timeline.typedTitle}</span>
                    {timeline.typedTitle.length < DEMO_TITLE.length && <span className="ml-1 inline-block h-8 w-0.5 translate-y-1 bg-cyan-500 animate-pulse" />}
                  </h2>

                  <div className="relative mt-8 font-mono text-[15px] leading-8 text-slate-700">
                    <div className={`absolute left-0 top-[30px] h-[34px] w-[360px] rounded bg-cyan-200/55 transition-all duration-300 ${timeline.selectionVisible ? 'opacity-100' : 'opacity-0'}`} />
                    <div className={`absolute left-0 top-[95px] h-[30px] w-[330px] rounded bg-amber-200/70 ring-2 ring-amber-300/70 transition-opacity duration-300 ${timeline.commentVisible ? 'opacity-100' : 'opacity-0'}`} />
                    <pre className={`demo-type-draft relative min-h-[128px] whitespace-pre-wrap font-mono ${timeline.improved ? 'opacity-0' : ''}`}>
                      {timeline.typedBody}
                    </pre>
                    {timeline.improved && (
                      <pre className="absolute left-0 top-0 whitespace-pre-wrap font-mono opacity-100 transition-opacity duration-500">
                        {DEMO_IMPROVED}
                      </pre>
                    )}
                  </div>

                  {timeline.improved && (
                    <div className="mt-7 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-[13px] font-semibold text-cyan-900 animate-scale-in">
                      Suggestion accepted: tighter wording, clearer scope, export-specific detail.
                    </div>
                  )}
                </div>

                <FakeCursor color="#3b82f6" name="Sumit" visible position={{ top: 214, left: 138 }} label="You" mode="caret" />
                <FakeCursor color="#ec4899" name="Priya" visible={timeline.secondCursor} position={cursorPosition} mode="pointer" />
                <FakeComment visible={timeline.commentVisible} />
                <FakeToolbar visible={timeline.toolbarVisible} clicked={timeline.toolbarClicked} />

                <div className="absolute bottom-7 right-7 z-40">
                  <div className="relative">
                    <button
                      type="button"
                      className={`flex h-10 items-center gap-2 rounded-lg border px-4 text-[13px] font-bold shadow-lg transition-all ${
                        timeline.exportOpen ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <Download size={15} />
                      Export
                      <ChevronDown size={14} />
                    </button>
                    <div
                      className={`absolute bottom-12 right-0 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-[13px] font-semibold text-slate-700 shadow-2xl transition-all duration-300 ${
                        timeline.exportOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                      }`}
                    >
                      {['PDF', 'DOCX', 'Markdown'].map((item) => (
                        <div key={item} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                          <FileText size={14} />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {(timeline.exporting || timeline.exportDone) && (
                  <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/35 backdrop-blur-sm animate-fade-in">
                    <div className="rounded-lg border border-white/20 bg-white px-7 py-6 text-center text-slate-950 shadow-2xl">
                      {timeline.exporting ? (
                        <>
                          <Loader2 className="mx-auto mb-3 animate-spin text-cyan-500" size={30} />
                          <p className="text-[15px] font-bold">Exporting document...</p>
                        </>
                      ) : (
                        <>
                          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">OK</div>
                          <p className="text-[15px] font-bold">PDF export complete</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
