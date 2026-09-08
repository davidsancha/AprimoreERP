'use client';

import React, { useState } from 'react';
import { X, UserPlus, AlertTriangle } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';

interface ModalNovoUsuarioProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * `sessaoTrocada` diz se o cadastro trocou a sessão atual pela do usuário
   * novo — só acontece quando o projeto do Supabase NÃO exige confirmação de
   * e-mail. Em produção a confirmação está ligada (descoberto testando ao
   * vivo: `signUp` aqui nunca devolve `session`), então isso normalmente vem
   * `false` — o admin continua logado, mas a pessoa nova só consegue entrar
   * depois de confirmar o e-mail.
   */
  onUsuarioCriado: (sessaoTrocada: boolean) => void;
}

export default function ModalNovoUsuario({ isOpen, onClose, onUsuarioCriado }: ModalNovoUsuarioProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState<'god' | 'admin' | 'engenheiro' | 'financeiro'>('engenheiro');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  /**
   * `metaRole` sobrescreve o valor do `<select>` — usado pelo botão "Criar
   * como Parceiro EGF", que sempre manda 'convidado' pra trigger
   * `handle_new_user()` (ver migration 00014), independente do que estiver
   * selecionado em Nível de Acesso (que não se aplica a convidado: vira
   * sempre acesso restrito, só aos próprios relatórios + Cowork).
   */
  const criarUsuario = async (metaRole: string) => {
    setLoading(true);
    setError(null);

    try {
      if (!supabase) throw new Error('Supabase client não inicializado.');

      // Se o projeto exigir confirmação de e-mail (é o caso em produção),
      // `signUp` NÃO devolve sessão — a conta fica pendente até a pessoa
      // clicar no link do e-mail, e a sessão atual (do admin) não muda. Só
      // quando não exige confirmação (`data.session` vem preenchido) que o
      // cadastro loga automaticamente na conta nova, trocando quem está
      // logado neste navegador.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            full_name: nome,
            role: metaRole // Isso deve ser validado na trigger, mas o ideal é gerenciar a role por admin
          }
        }
      });

      if (signUpError) throw signUpError;

      // Sucesso
      onUsuarioCriado(!!data.session);
    } catch (err: any) {
      console.error('Erro ao cadastrar usuário:', err);
      setError(err.message || 'Erro desconhecido ao tentar cadastrar usuário.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    criarUsuario(role);
  };

  const handleCriarParceiroEgf = () => {
    if (!nome || !email || !senha) {
      setError('Preencha nome, e-mail e senha antes de criar como Parceiro EGF.');
      return;
    }
    criarUsuario('convidado');
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
              <h2 className="text-xl font-bold text-main font-vomzom">Novo Usuário</h2>
              <p className="text-xs text-sub">Adicione um novo colaborador ao sistema</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-sub hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-card-border">
          
          <div className="mb-6 p-4 bg-brand-ocre/10 border border-brand-ocre/20 rounded-xl flex items-start gap-3">
            <AlertTriangle size={18} className="text-brand-ocre shrink-0 mt-0.5" />
            <p className="text-xs text-brand-ocre leading-relaxed">
              <strong>Atenção:</strong> Como estamos utilizando o cadastro via interface cliente (sem chave de administrador servidor), ao cadastrar um novo usuário (por qualquer um dos botões abaixo), se a confirmação de e-mail estiver desligada no projeto <strong>você será desconectado da sua conta atual</strong> e logado na nova. Se estiver ligada (caso mais comum em produção), a pessoa só consegue entrar depois de confirmar o e-mail recebido — e você continua logado normalmente.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-xl">
              {error}
            </div>
          )}

          <form id="form-novo-usuario" onSubmit={handleSubmit} className="space-y-5">
            
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-sub">Nome Completo</label>
              <input 
                type="text" 
                required
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-main focus:ring-2 focus:ring-brand-ocre focus:outline-none"
                placeholder="Ex: João Silva"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-sub">E-mail</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-main focus:ring-2 focus:ring-brand-ocre focus:outline-none"
                placeholder="joao@aprimore.com.br"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-sub">Senha Provisória</label>
              <input 
                type="password" 
                required
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-main focus:ring-2 focus:ring-brand-ocre focus:outline-none"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-sub">Nível de Acesso (Role)</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as any)}
                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-main focus:ring-2 focus:ring-brand-ocre focus:outline-none"
              >
                <option value="engenheiro">Engenheiro (Obras e Custos Básicos)</option>
                <option value="financeiro">Financeiro (Recebimentos e Fluxo de Caixa)</option>
                <option value="admin">Administrador (Gerência Geral)</option>
                <option value="god">God Mode (Acesso Total)</option>
              </select>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-card-border bg-slate-50/50 dark:bg-white/[0.02] flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-sub hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          {/* Ignora o seletor de Role acima — Parceiro EGF é sempre acesso
              convidado (restrito aos próprios relatórios + Cowork), nunca um
              dos níveis internos. Mesmo cadastro que o formulário público de
              login já oferece (checkbox "Sou Parceiro EGF"), só que disparado
              pelo admin em vez do próprio convidado. */}
          <button
            type="button"
            onClick={handleCriarParceiroEgf}
            disabled={loading}
            title="Cria a conta com acesso restrito de convidado — só aos próprios relatórios e aos compartilhados via Cowork"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border border-brand-ocre/40 text-brand-ocre hover:bg-brand-ocre/10 transition-all disabled:opacity-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/egflogo.jpg" alt="" className="h-5 w-5 rounded-full object-cover" />
            {loading ? 'Criando...' : 'Criar como Parceiro EGF'}
          </button>
          <button
            type="submit"
            form="form-novo-usuario"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl font-bold text-sm bg-brand-ocre text-brand-dark hover:bg-brand-ocre/90 transition-all shadow-lg shadow-brand-ocre/20 disabled:opacity-50"
          >
            {loading ? 'Cadastrando...' : 'Cadastrar Usuário'}
          </button>
        </div>
      </div>
    </div>
  );
}
