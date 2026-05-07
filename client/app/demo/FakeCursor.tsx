'use client';

interface FakeCursorProps {
  color: string;
  name: string;
  visible: boolean;
  position: { top: number; left: number };
  label?: string;
  className?: string;
}

export default function FakeCursor({ color, name, visible, position, label, className = '' }: FakeCursorProps) {
  return (
    <div
      className={`absolute z-30 pointer-events-none transition-all duration-[1400ms] ease-out ${className} ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      style={{ top: position.top, left: position.left }}
    >
      <div className="h-7 w-0.5 rounded-full shadow-[0_0_18px_rgba(255,255,255,0.18)]" style={{ backgroundColor: color }} />
      <div
        className="absolute left-1 top-[-26px] whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-white shadow-lg"
        style={{ backgroundColor: color }}
      >
        {label || `${name} editing...`}
      </div>
    </div>
  );
}
