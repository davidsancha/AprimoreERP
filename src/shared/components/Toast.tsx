'use client';

import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgColors = {
    success: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30 text-emerald-800 dark:text-emerald-300',
    error: 'bg-red-50 dark:bg-red-955/30 border-red-500/30 text-red-800 dark:text-red-300',
    info: 'bg-sky-50 dark:bg-sky-955/30 border-sky-500/30 text-sky-800 dark:text-sky-300',
    warning: 'bg-amber-50 dark:bg-amber-955/30 border-amber-500/30 text-amber-800 dark:text-amber-300',
  };

  const icons = {
    success: <CheckCircle className="text-emerald-500 shrink-0" size={18} />,
    error: <AlertCircle className="text-red-500 shrink-0" size={18} />,
    info: <Info className="text-sky-500 shrink-0" size={18} />,
    warning: <AlertCircle className="text-amber-500 shrink-0" size={18} />,
  };

  return (
    <div className="fixed bottom-5 right-5 z-55 max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-xs ${bgColors[type]}`}>
        {icons[type]}
        <div className="flex-1 text-xs font-semibold leading-relaxed">
          {message}
        </div>
        <button 
          onClick={onClose}
          className="text-desc hover:text-main transition-colors shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
