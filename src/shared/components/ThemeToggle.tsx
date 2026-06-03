'use client';

import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Garante que o componente só renderize no cliente após a montagem,
  // evitando erros de hidratação (hydration mismatch) que travam o clique.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-lg border border-card-border bg-card animate-pulse" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="p-2.5 rounded-lg border border-card-border bg-card hover:bg-brand-blue hover:text-white dark:hover:bg-brand-ocre dark:hover:text-brand-dark transition-all duration-150 cursor-pointer shadow-sm text-sub"
      aria-label="Alternar tema de cores"
      title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
    >
      {theme === 'dark' ? (
        <Sun size={15} className="text-brand-ocre" />
      ) : (
        <Moon size={15} className="text-brand-blue" />
      )}
    </button>
  );
}
