'use client';

import Link from 'next/link';
import { Users, Mail, ScrollText, ChevronRight } from 'lucide-react';

const ATALHOS = [
  {
    href: '/configuracoes/usuarios',
    icone: Users,
    titulo: 'Usuários',
    descricao: 'Gerenciar acessos, bloquear ou excluir cadastros.',
  },
  {
    href: '/configuracoes/convites',
    icone: Mail,
    titulo: 'Convites',
    descricao: 'Convites de acesso pendentes, aceitos e revogados.',
  },
  {
    href: '/configuracoes/log-atividades',
    icone: ScrollText,
    titulo: 'Log de Atividades',
    descricao: 'Registro de convites, bloqueios e exclusões.',
  },
];

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6 pb-16">
      <div className="border-b border-card-border pb-5">
        <h2 className="text-2xl font-extrabold tracking-tight text-main font-vomzom">Configurações</h2>
        <p className="text-sub text-sm mt-1">Gestão de usuários, convites e histórico de atividades do sistema.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ATALHOS.map((atalho) => {
          const Icone = atalho.icone;
          return (
            <Link
              key={atalho.href}
              href={atalho.href}
              className="group flex items-start gap-4 p-5 rounded-2xl bg-card border border-card-border hover:border-brand-ocre/50 hover:shadow-md transition-all"
            >
              <div className="h-11 w-11 shrink-0 rounded-xl bg-brand-blue/10 dark:bg-brand-ocre/10 flex items-center justify-center text-brand-blue dark:text-brand-ocre">
                <Icone size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-main flex items-center gap-1.5">
                  {atalho.titulo}
                  <ChevronRight size={14} className="text-desc group-hover:translate-x-0.5 transition-transform" />
                </h3>
                <p className="text-xs text-sub mt-1">{atalho.descricao}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
