'use client';

import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuth } from '@/core/auth/AuthProvider';
import ModalNovoUsuario from '@/modules/configuracoes/components/ModalNovoUsuario';
import Toast, { ToastType } from '@/shared/components/Toast';

export default function UsuariosPage() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      if (!supabase) return;
      // Obter perfis
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsuarios(data || []);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleUsuarioCriado = () => {
    setIsModalOpen(false);
    setToast({ message: 'Usuário criado com sucesso! Lembre-se de refazer seu login.', type: 'success' });
    fetchUsuarios();
  };

  // Verifica se o usuário logado tem permissão god/admin
  // Para fins de UI, vamos assumir que apenas 'god' ou 'admin' podem ver o botão de adicionar.
  // Obviamente, a RLS no Supabase também barra no backend.
  const isGod = usuarios.find(u => u.id === user?.id)?.role === 'god';

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-card-border pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-main flex items-center gap-2.5 font-vomzom">
            <Users size={28} className="text-brand-ocre" />
            Gestão de Usuários
          </h2>
          <p className="text-sub text-sm mt-1">
            Controle de acesso e níveis de permissão do sistema.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-ocre text-brand-dark text-xs font-bold hover:bg-brand-ocre/90 transition-all shadow-lg shadow-brand-ocre/10 cursor-pointer"
          >
            <UserPlus size={16} /> Novo Usuário
          </button>
        </div>
      </div>

      <ModalNovoUsuario 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onUsuarioCriado={handleUsuarioCriado} 
      />

      <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center py-20 text-brand-ocre">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background/50 text-xs uppercase tracking-wider text-sub border-b border-card-border">
                  <th className="p-4 font-bold">Usuário</th>
                  <th className="p-4 font-bold">E-mail</th>
                  <th className="p-4 font-bold">Nível de Acesso</th>
                  <th className="p-4 font-bold">Data de Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-sub">Nenhum usuário encontrado.</td>
                  </tr>
                ) : (
                  usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-brand-blue/10 dark:bg-brand-ocre/10 flex items-center justify-center text-brand-blue dark:text-brand-ocre font-bold border border-brand-blue/20 dark:border-brand-ocre/20">
                            {u.nome?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-main">{u.nome || 'Usuário Sem Nome'}</div>
                            {u.cargo && <div className="text-[10px] text-sub font-semibold">{u.cargo}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-sub">{u.email}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          u.role === 'god' 
                            ? 'bg-brand-ocre/10 text-brand-ocre border-brand-ocre/20'
                            : u.role === 'admin'
                            ? 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400'
                            : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
                        }`}>
                          {u.role === 'god' ? <ShieldAlert size={12} /> : <Shield size={12} />}
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-sub">
                        {new Date(u.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isGod && !loading && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-600 dark:text-yellow-500 text-sm flex items-center gap-3">
          <ShieldAlert size={20} />
          <p>Apenas usuários com perfil <strong>god</strong> ou <strong>admin</strong> podem modificar acessos. Sua visualização pode estar limitada.</p>
        </div>
      )}

    </div>
  );
}
