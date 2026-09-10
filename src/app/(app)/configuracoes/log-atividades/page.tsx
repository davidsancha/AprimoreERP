'use client';

import React, { useEffect, useState } from 'react';
import { ScrollText, Loader2 } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import Toast, { ToastType } from '@/shared/components/Toast';

interface LogAtividade {
  id: string;
  criado_em: string;
  ator_nome: string | null;
  acao: string;
  alvo_tipo: string | null;
  alvo_nome: string | null;
  detalhes: Record<string, any> | null;
}

const ACAO_LABEL: Record<string, string> = {
  convite_criado: 'Convite criado',
  convite_aceito: 'Convite aceito',
  convite_revogado: 'Convite revogado',
  usuario_bloqueado: 'Usuário bloqueado',
  usuario_desbloqueado: 'Usuário desbloqueado',
  usuario_excluido: 'Usuário excluído',
};

export default function LogAtividadesPage() {
  const [logs, setLogs] = useState<LogAtividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase
          .from('log_atividades')
          .select('*')
          .order('criado_em', { ascending: false })
          .limit(200);
        if (error) throw error;
        setLogs(data || []);
      } catch (err) {
        console.error('Erro ao buscar log de atividades:', err);
        setToast({ message: 'Não foi possível carregar o log de atividades. Tente novamente.', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="border-b border-card-border pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-main flex items-center gap-2.5 font-vomzom">
          <ScrollText size={28} className="text-brand-ocre" />
          Log de Atividades
        </h2>
        <p className="text-sub text-sm mt-1">Registro de convites, acessos bloqueados e exclusões.</p>
      </div>

      <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center py-20 text-brand-ocre">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="hidden md:table-header-group">
                <tr className="bg-background/50 text-xs uppercase tracking-wider text-sub border-b border-card-border">
                  <th className="p-4 font-bold">Data/Hora</th>
                  <th className="p-4 font-bold">Quem fez</th>
                  <th className="p-4 font-bold">Ação</th>
                  <th className="p-4 font-bold">Alvo</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group divide-y divide-card-border">
                {logs.length === 0 ? (
                  <tr className="block md:table-row">
                    <td colSpan={4} className="p-8 text-center text-sub block md:table-cell">Nenhuma atividade registrada ainda.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="flex flex-col md:table-row hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors py-3 md:py-0 border-b border-card-border/60 md:border-0">
                      <td className="px-4 py-1.5 md:p-4 text-xs text-sub whitespace-nowrap md:table-cell">
                        {new Date(log.criado_em).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-1.5 md:p-4 text-sm font-semibold text-main flex justify-between items-center md:table-cell">
                        <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Quem fez</span>
                        {log.ator_nome || '—'}
                      </td>
                      <td className="px-4 py-1.5 md:p-4 flex justify-between items-center md:table-cell">
                        <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Ação</span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-brand-blue/10 text-brand-blue border-brand-blue/20 dark:bg-brand-ocre/10 dark:text-brand-ocre dark:border-brand-ocre/20">
                          {ACAO_LABEL[log.acao] || log.acao}
                        </span>
                      </td>
                      <td className="px-4 py-1.5 md:p-4 text-sm text-sub flex justify-between items-center md:table-cell">
                        <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Alvo</span>
                        {log.alvo_nome || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
