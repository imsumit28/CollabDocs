'use client';

import { MessageSquare } from 'lucide-react';

export default function FakeComment({ visible, className = '' }: { visible: boolean; className?: string }) {
  return (
    <div
      className={`absolute right-5 top-[315px] z-40 w-[260px] rounded-lg border border-amber-200/40 bg-[#fff8e6]/95 p-3 text-[#271b00] shadow-2xl shadow-amber-950/20 backdrop-blur-xl transition-all duration-500 sm:right-8 ${className} ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-5 opacity-0'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-amber-950">
          <MessageSquare size={15} />
        </div>
        <div>
          <p className="text-[12px] font-bold">Aman commented</p>
          <p className="text-[10px] text-amber-950/60">just now</p>
        </div>
      </div>
      <p className="text-[13px] leading-snug">Can we improve this section before export?</p>
    </div>
  );
}
