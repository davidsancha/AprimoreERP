'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Mesma prioridade usada pelo script síncrono em layout.tsx (que já deixa
 *  a classe certa no <html> antes da primeira pintura, sem flash) — aqui só
 *  sincroniza o estado do React com o que aquele script já aplicou. */
function temaInicial(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const salvo = localStorage.getItem('aprimore-theme') as Theme | null;
  if (salvo) return salvo;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(temaInicial);

  useEffect(() => {
    // O script síncrono em layout.tsx já aplicou a classe certa no <html>
    // antes da hidratação (localStorage salvo > tema do aparelho) — aqui só
    // garante que fique aplicada (idempotente) caso algo tenha mudado entre
    // o script rodar e o React montar.
    applyTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = window.document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('aprimore-theme', nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider');
  }
  return context;
}
