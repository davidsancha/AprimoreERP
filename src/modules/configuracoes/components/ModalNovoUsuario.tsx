'use client';

import React, { useState } from 'react';
import { X, UserPlus, AlertTriangle } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';

interface ModalNovoUsuarioProps {
  isOpen: boolean;
  onClose: () => void;
  onUsuarioCriado: () => void;
}

export default function ModalNovoUsuario({ isOpen, onClose, onUsuarioCriado }: ModalNovoUsuarioProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState<'god' | 'admin' | 'engenheiro' | 'financeiro'>('engenheiro');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!supabase) throw new Error('Supabase client não inicializado.');

      // O cadastro pelo client-side via signUp automaticamente loga o novo usuário 
      // e desloga o atual. Avisaremos o usuário sobre isso ou usaríamos Edge Functions / Admin API.
      // Por enquanto, como não temos a Service Role Key, seguimos com a API normal.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            full_name: nome,
            role: role // Isso deve ser validado na trigger, mas o ideal é gerenciar a role por admin
          }
        }
      });

      if (signUpError) throw signUpError;

      // Sucesso
      onUsuarioCriado();
    } catch (err: any) {
      console.error('Erro ao cadastrar usuário:', err);
      setError(err.message || 'Erro desconhecido ao tentar cadastrar usuário.');
    } finally {
      setLoading(false);
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
              <strong>Atenção:</strong> Como estamos utilizando o cadastro via interface cliente (sem chave de administrador servidor), ao cadastrar um novo usuário <strong>você será desconectado da sua conta atual</strong> e logado na nova conta.
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

        <div className="p-6 border-t border-card-border bg-slate-50/50 dark:bg-white/[0.02] flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-sub hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancelar
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
