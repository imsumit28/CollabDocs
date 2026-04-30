import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

const MENTION_COLORS = [
  'bg-[#007AFF]',
  'bg-[#FF3B30]',
  'bg-[#FF9500]',
  'bg-[#34C759]',
  'bg-[#AF52DE]',
  'bg-[#FF2D55]',
  'bg-[#5AC8FA]',
  'bg-[#FFCC00]',
];

function getMentionColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return MENTION_COLORS[Math.abs(hash) % MENTION_COLORS.length];
}

export const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) props.command({ id: item.id, label: item.displayName });
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-white rounded-[12px] shadow-apple-lg border border-[rgba(0,0,0,0.08)] py-1.5 min-w-[180px] overflow-hidden anim-scale-in">
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
          <button
            key={index}
            className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-[13px] font-medium transition-colors ${
              index === selectedIndex ? 'bg-[#007AFF] text-white' : 'bg-transparent text-[#1D1D1F] hover:bg-[#F5F5F7]'
            }`}
            onClick={() => selectItem(index)}
          >
            <div 
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                index === selectedIndex
                  ? 'bg-white/20 text-white'
                  : `${getMentionColorClass(item.id ?? item.displayName ?? String(index))} text-white`
              }`}
            >
              {item.displayName?.[0]?.toUpperCase()}
            </div>
            <span className="truncate">{item.displayName}</span>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-[13px] text-[#8E8E93]">No users found</div>
      )}
    </div>
  );
});

MentionList.displayName = 'MentionList';
