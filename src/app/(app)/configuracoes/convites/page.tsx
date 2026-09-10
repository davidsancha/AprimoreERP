'use client';

import React, { useEffect, useState } from 'react';
import { Mail, Copy, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import ConfirmButton from '@/shared/components/ConfirmButton';
import Toast, { ToastType } from '@/shared/components/Toast';

interface ConviteUsuario {
  id: string;
  token: string;
  email: string;
  nome: string;
  telefone: string | null;
  role: string;
  status: 'pendente' | 'aceito' | 'revogado';
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

const STATUS_LABEL: Record<string, { texto: string; classe: string }> = {
  pendente: { texto: 'Pendente', classe: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  aceito: { texto: 'Aceito', classe: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  revogado: { texto: 'Revogado', classe: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
};

export default function ConvitesPage() {
  const [convites, setConvites] = useState<ConviteUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      if (!supabase) return;
      const { data, error } = await supabase.from('convites_usuario').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setConvites(data || []);
    } catch (err) {
      console.error('Erro ao buscar convites:', err);
      setToast({ message: 'Não foi possível carregar os convites. Tente novamente.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const copiarLink = async (token: string) => {
    const link = `${window.location.origin}/convite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setToast({ message: 'Link copiado!', type: 'success' });
    } catch {
      setToast({ message: link, type: 'info' });
    }
  };

  const revogar = async (id: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.rpc('revogar_convite', { p_convite_id: id });
      if (error) throw error;
      setToast({ message: 'Convite revogado.', type: 'success' });
      carregar();
    } catch (err: any) {
      setToast({ message: err.message || 'Erro ao revogar convite.', type: 'error' });
    }
  };

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="border-b border-card-border pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-main flex items-center gap-2.5 font-vomzom">
          <Mail size={28} className="text-brand-ocre" />
          Convites
        </h2>
        <p className="text-sub text-sm mt-1">Convites de acesso enviados — pendentes, aceitos e revogados.</p>
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
                  <th className="p-4 font-bold">Nome</th>
                  <th className="p-4 font-bold">E-mail</th>
                  <th className="p-4 font-bold">Nível</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold">Criado em</th>
                  <th className="p-4 font-bold">Ações</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group divide-y divide-card-border">
                {convites.length === 0 ? (
                  <tr className="block md:table-row">
                    <td colSpan={6} className="p-8 text-center text-sub block md:table-cell">Nenhum convite ainda.</td>
                  </tr>
                ) : (
                  convites.map((c) => (
                    <tr key={c.id} className="flex flex-col md:table-row hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors py-3 md:py-0 border-b border-card-border/60 md:border-0">
                      <td className="px-4 py-1.5 md:p-4 font-bold text-main md:table-cell">{c.nome}</td>
                      <td className="px-4 py-1.5 md:p-4 text-sm text-sub flex justify-between items-center md:table-cell">
                        <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">E-mail</span>
                        {c.email}
                      </td>
                      <td className="px-4 py-1.5 md:p-4 text-sm text-sub flex justify-between items-center md:table-cell">
                        <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Nível</span>
                        {c.role === 'convidado' ? 'Parceiro EGF' : c.role}
                      </td>
                      <td className="px-4 py-1.5 md:p-4 flex justify-between items-center md:table-cell">
                        <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Status</span>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${STATUS_LABEL[c.status].classe}`}>
                          {STATUS_LABEL[c.status].texto}
                        </span>
                      </td>
                      <td className="px-4 py-1.5 md:p-4 text-sm text-sub flex justify-between items-center md:table-cell">
                        <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Criado em</span>
                        {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-2 md:p-4 flex justify-between items-center md:table-cell">
                        {c.status === 'pendente' ? (
                          <>
                            <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Ações</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => copiarLink(c.token)}
                                title="Copiar link do convite"
                                className="p-2 rounded-lg border border-card-border bg-background hover:bg-brand-ocre/10 text-desc hover:text-brand-ocre transition-colors"
                              >
                                <Copy size={13} />
                              </button>
                              <ConfirmButton
                                onConfirm={() => revogar(c.id)}
                                confirmLabel="Confirmar?"
                                icon={ShieldAlert}
                                className="p-2 rounded-lg border border-card-border bg-background hover:bg-red-500/10 text-desc hover:text-red-500 transition-colors"
                                confirmClassName="bg-red-500 text-white border-red-600 hover:bg-red-600 p-2"
                                title="Revogar convite"
                              />
                            </div>
                          </>
                        ) : <span className="hidden md:inline text-[10px] text-sub italic">—</span>}
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
