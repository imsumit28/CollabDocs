'use client';

import { CheckCircle2, Info } from 'lucide-react';
import type { DemoToast } from './useDemoTimeline';

export default function FakeNotification({ toasts }: { toasts: DemoToast[] }) {
  return (
    <div className="pointer-events-none absolute right-4 top-20 z-[70] flex w-[280px] flex-col gap-2 sm:right-7">
      {toasts.slice(-3).map((toast) => {
        const Icon = toast.tone === 'success' ? CheckCircle2 : Info;
        return (
          <div
            key={toast.id}
            className="flex translate-x-0 items-center gap-3 rounded-lg border border-white/15 bg-white/95 px-3 py-2.5 text-slate-950 shadow-2xl shadow-slate-950/25 backdrop-blur-xl animate-slide-up"
          >
            <div className={toast.tone === 'success' ? 'text-emerald-500' : 'text-cyan-500'}>
              <Icon size={18} />
            </div>
            <p className="text-[13px] font-semibold">{toast.message}</p>
          </div>
        );
      })}
    </div>
  );
}
