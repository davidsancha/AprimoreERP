'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/shared/components/Sidebar';
import { ThemeProvider } from '@/shared/contexts/ThemeContext';
import ThemeToggle from '@/shared/components/ThemeToggle';
import { useAuth } from '@/core/auth/AuthProvider';
import { Menu } from 'lucide-react';

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, profile, signOut } = useAuth();
  const cargo = profile?.cargo || 'Gestor';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Define o nome do ambiente com base na rota atual — Parceiro EGF
  // (acesso convidado) sempre vê o próprio rótulo, independente da rota,
  // já que ele só navega dentro do Relatório Fotográfico mesmo.
  let ambienteName = 'Ambiente de Operações';
  if (profile?.role === 'convidado') ambienteName = 'Ambiente do Parceiro EGF';
  else if (pathname.startsWith('/crm')) ambienteName = 'Ambiente de CRM & Pós-Venda';
  else if (pathname.startsWith('/engenharia')) ambienteName = 'Ambiente de Engenharia (PCM)';
  else if (pathname.startsWith('/financeiro')) ambienteName = 'Ambiente Financeiro';
  else if (pathname.startsWith('/suprimentos')) ambienteName = 'Ambiente de Suprimentos';
  else if (pathname.startsWith('/rh')) ambienteName = 'Ambiente de Recursos Humanos';
  else if (pathname.startsWith('/projetos')) ambienteName = 'Ambiente de Obras';

  return (
    <ThemeProvider>
      {/* Painel lateral flexível (Responsivo) */}
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Área de conteúdo principal rolável */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        
        {/* Header Superior */}
        <header className="h-16 border-b border-header-border bg-header backdrop-blur-md flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-sub hover:text-main p-1"
            >
              <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-ocre animate-ping"></span>
              <span className="text-xs font-semibold uppercase tracking-wider text-sub">{ambienteName}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            {/* Alternador de Tema (Light / Dark Mode) */}
            <ThemeToggle />

            <div className="h-8 w-px bg-card-border" />

            <div className="flex flex-col text-right">
              <span className="text-sm font-bold text-main">{user?.user_metadata?.full_name || user?.email || 'Usuário'}</span>
              <span className="text-[10px] text-brand-ocre font-semibold uppercase tracking-wide">
                {cargo}
              </span>
            </div>
            
            <button 
              onClick={() => signOut()}
              className="h-10 w-10 rounded-xl bg-brand-ocre/10 border border-brand-ocre/20 text-brand-ocre font-bold flex items-center justify-center shadow-lg shadow-brand-ocre/5 hover:bg-brand-ocre hover:text-brand-dark transition-all"
              title="Sair do Sistema"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        </header>

        {/* Páginas do ERP */}
        <main className="flex-1 p-4 md:p-8 bg-background">
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
