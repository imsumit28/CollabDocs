'use client';

import { Check, ListChecks, Sparkles, Wand2 } from 'lucide-react';

const ACTIONS = [
  { label: 'Improve Writing', icon: Wand2 },
  { label: 'Summarize', icon: Sparkles },
  { label: 'Fix Grammar', icon: Check },
  { label: 'Convert to Bullet Points', icon: ListChecks },
];

export default function FakeToolbar({ visible, clicked, className = '' }: { visible: boolean; clicked: boolean; className?: string }) {
  return (
    <div
      className={`absolute left-1/2 top-[236px] z-50 w-[min(560px,calc(100%-32px))] -translate-x-1/2 rounded-lg border border-white/15 bg-[#0f172a]/95 p-2 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl transition-all duration-500 ${className} ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIONS.map((action, index) => {
          const Icon = action.icon;
          const active = clicked && index === 0;
          return (
            <button
              key={action.label}
              type="button"
              className={`relative flex h-10 items-center justify-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-all ${
                active
                  ? 'border-cyan-300 bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)]'
                  : 'border-white/10 bg-white/[0.06] text-slate-100'
              }`}
            >
              <Icon size={14} />
              <span className="truncate">{action.label}</span>
              {active && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-white" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
