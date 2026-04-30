'use client';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextType {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const ICONS: Record<ToastVariant, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

const COLORS: Record<ToastVariant, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: '#F0FDF4', border: '#34C759/30', icon: '#34C759', text: '#1D1D1F' },
  error:   { bg: '#FFF2F1', border: '#FF3B30/30', icon: '#FF3B30', text: '#1D1D1F' },
  info:    { bg: '#F0F6FF', border: '#007AFF/30', icon: '#007AFF', text: '#1D1D1F' },
  warning: { bg: '#FFFBF0', border: '#FF9500/30', icon: '#FF9500', text: '#1D1D1F' },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const c = COLORS[toast.variant];
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-[14px] shadow-apple-md border anim-slide-up"
      style={{ background: c.bg, minWidth: 260, maxWidth: 380 }}
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
        style={{ background: c.icon }}
      >
        {ICONS[toast.variant]}
      </span>
      <p className="text-[13px] font-medium text-[#1D1D1F] flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-[#AEAEB2] hover:text-[#6E6E73] transition-colors flex-shrink-0 ml-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { id, message, variant }]);
    setTimeout(() => remove(id), 3500);
  }, [remove]);

  const success = useCallback((m: string) => toast(m, 'success'), [toast]);
  const error   = useCallback((m: string) => toast(m, 'error'),   [toast]);
  const info    = useCallback((m: string) => toast(m, 'info'),    [toast]);
  const warning = useCallback((m: string) => toast(m, 'warning'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
