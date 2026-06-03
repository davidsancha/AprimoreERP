'use client';

import React, { useState, useEffect } from 'react';
import { LucideIcon, AlertTriangle } from 'lucide-react';

interface ConfirmButtonProps {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  icon?: LucideIcon;
  confirmIcon?: LucideIcon;
  className?: string;
  confirmClassName?: string;
  title?: string;
  disabled?: boolean;
}

export default function ConfirmButton({
  onConfirm,
  label = '',
  confirmLabel = 'Confirmar?',
  icon: Icon,
  confirmIcon: ConfirmIcon = AlertTriangle,
  className = '',
  confirmClassName = 'bg-red-500 text-white border-red-600 hover:bg-red-600',
  title = '',
  disabled = false
}: ConfirmButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!isConfirming) return;

    // Retorna ao estado original se o usuário não confirmar em 3 segundos
    const timer = setTimeout(() => {
      setIsConfirming(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isConfirming]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Evita disparar cliques de elementos pais (como linhas de tabela ou links)

    if (isConfirming) {
      setIsConfirming(false);
      onConfirm();
    } else {
      setIsConfirming(true);
    }
  };

  if (isConfirming) {
    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        type="button"
        title="Clique novamente para confirmar a ação"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-black tracking-wide uppercase transition-all duration-150 animate-pulse cursor-pointer shadow-xs ${confirmClassName}`}
      >
        <ConfirmIcon size={12} className="shrink-0" />
        <span>{confirmLabel}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      type="button"
      title={title}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-150 cursor-pointer shadow-xs ${className}`}
    >
      {Icon && <Icon size={12} className="shrink-0" />}
      {label && <span>{label}</span>}
    </button>
  );
}
