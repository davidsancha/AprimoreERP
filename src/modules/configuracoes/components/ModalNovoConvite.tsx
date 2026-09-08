'use client';

import React, { useState } from 'react';
import { X, UserPlus, Check, Copy } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { formatarTelefone } from '@/shared/lib/validacao';

interface ModalNovoConviteProps {
  isOpen: boolean;
  onClose: () => void;
  onConviteCriado: () => void;
}

/**
 * Substitui o antigo cadastro instantâneo (`admin_criar_usuario`) por um
 * convite: o admin não define senha nenhuma — só gera um link e manda pra
 * pessoa, que completa o próprio cadastro em `/convite/[token]`.
 */
export default function ModalNovoConvite({ isOpen, onClose, onConviteCriado }: ModalNovoConviteProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [parceiroEgf, setParceiroEgf] = useState(false);
  const [role, setRole] = useState<'admin' | 'engenheiro' | 'financeiro' | 'god'>('engenheiro');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  if (!isOpen) return null;

  const fechar = () => {
    setNome('');
    setEmail('');
    setTelefone('');
    setParceiroEgf(false);
    setRole('engenheiro');
    setError(null);
    setLinkGerado(null);
    setCopiado(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!supabase) throw new Error('Supabase client não inicializado.');

      const { data, error: rpcError } = await supabase.rpc('criar_convite_usuario', {
        p_email: email,
        p_nome: nome,
        p_telefone: telefone || null,
        p_role: parceiroEgf ? 'convidado' : role,
      });

      if (rpcError) throw rpcError;

      setLinkGerado(`${window.location.origin}/convite/${data.token}`);
      onConviteCriado();
    } catch (err: any) {
      console.error('Erro ao criar convite:', err);
      setError(err.message || 'Erro desconhecido ao tentar criar o convite.');
    } finally {
      setLoading(false);
    }
  };

  const copiarLink = async () => {
    if (!linkGerado) return;
    try {
      await navigator.clipboard.writeText(linkGerado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponível (ex.: contexto não seguro) — o link já está selecionável no campo
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-card border border-card-border w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-card-border bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-ocre/10 text-brand-ocre flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main font-vomzom">{linkGerado ? 'Convite pronto' : 'Novo Convite'}</h2>
              <p className="text-xs text-sub">
                {linkGerado ? 'Mande esse link pra pessoa completar o cadastro dela' : 'Convide um colaborador ou parceiro pro sistema'}
              </p>
            </div>
          </div>
          <button onClick={fechar} className="p-2 rounded-xl text-sub hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-card-border">
          {linkGerado ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                <Check size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-600 dark:text-emerald-400 leading-relaxed">
                  Convite criado! O link vale por 14 dias — a pessoa define a própria senha ao completar o cadastro.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-sub">Link do convite</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={linkGerado}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-main focus:ring-2 focus:ring-brand-ocre focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={copiarLink}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-3 rounded-xl font-bold text-xs bg-brand-ocre text-brand-dark hover:bg-brand-ocre/90 transition-all"
                  >
                    <Copy size={14} /> {copiado ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {error && <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-xl">{error}</div>}

              <form id="form-novo-convite" onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-sub">Nome completo</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-main focus:ring-2 focus:ring-brand-ocre focus:outline-none"
                    placeholder="Ex: João Silva (a pessoa pode completar depois)"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-sub">E-mail</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-main focus:ring-2 focus:ring-brand-ocre focus:outline-none"
                    placeholder="joao@exemplo.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-sub">
                    Telefone <span className="normal-case font-normal text-[11px]">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                    className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-main focus:ring-2 focus:ring-brand-ocre focus:outline-none"
                    placeholder="XX XXXXX-XXXX"
                  />
                </div>

                {/* Parceiro EGF logo no início do formulário — decide o convite
                    inteiro (esconde o seletor de Nível de Acesso abaixo), não é
                    mais um botão separado lá no final. */}
                <label className="flex items-start gap-3 text-xs font-semibold text-sub cursor-pointer select-none bg-brand-ocre/5 border border-brand-ocre/20 rounded-xl px-4 py-3">
                  <input
                    type="checkbox"
                    checked={parceiroEgf}
                    onChange={(e) => setParceiroEgf(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-brand-ocre focus:ring-brand-ocre border-card-border cursor-pointer accent-brand-ocre shrink-0"
                  />
                  <span className="flex items-start gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/egflogo.jpg" alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                    <span>
                      É um <strong className="text-main">Parceiro EGF</strong> — entra com acesso aos próprios relatórios
                      fotográficos (e aos que forem compartilhados com ele via Cowork).
                    </span>
                  </span>
                </label>

                {!parceiroEgf && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-sub">Nível de Acesso</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-main focus:ring-2 focus:ring-brand-ocre focus:outline-none"
                    >
                      <option value="engenheiro">Engenheiro (Obras e Custos Básicos)</option>
                      <option value="financeiro">Financeiro (Recebimentos e Fluxo de Caixa)</option>
                      <option value="admin">Administrador (Gerência Geral)</option>
                      <option value="god">God Mode (Acesso Total)</option>
                    </select>
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        <div className="p-6 border-t border-card-border bg-slate-50/50 dark:bg-white/[0.02] flex flex-wrap items-center justify-end gap-3">
          {linkGerado ? (
            <button
              type="button"
              onClick={fechar}
              className="px-6 py-2.5 rounded-xl font-bold text-sm bg-brand-ocre text-brand-dark hover:bg-brand-ocre/90 transition-all shadow-lg shadow-brand-ocre/20"
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={fechar}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-sub hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="form-novo-convite"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-brand-ocre text-brand-dark hover:bg-brand-ocre/90 transition-all shadow-lg shadow-brand-ocre/20 disabled:opacity-50"
              >
                {loading ? 'Gerando...' : 'Gerar convite'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
