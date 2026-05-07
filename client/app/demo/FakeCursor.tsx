'use client';

interface FakeCursorProps {
  color: string;
  name: string;
  visible: boolean;
  position: { top: number; left: number };
  label?: string;
  className?: string;
  mode?: 'pointer' | 'caret';
}

export default function FakeCursor({ color, name, visible, position, label, className = '', mode = 'pointer' }: FakeCursorProps) {
  return (
    <div
      className={`absolute z-30 pointer-events-none transition-all duration-[1400ms] ease-out ${className} ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      style={{ top: position.top, left: position.left }}
    >
      {mode === 'pointer' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill={color} stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-md">
          <path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/>
        </svg>
      ) : (
        <div className="h-7 w-0.5 rounded-full shadow-[0_0_18px_rgba(255,255,255,0.18)]" style={{ backgroundColor: color }} />
      )}
      
      <div
        className={`absolute whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-white shadow-lg ${
          mode === 'pointer' ? 'left-3 top-3' : 'left-1 top-[-26px]'
        }`}
        style={{ backgroundColor: color }}
      >
        {label || (mode === 'pointer' ? name : `${name} editing...`)}
      </div>
    </div>
  );
}
