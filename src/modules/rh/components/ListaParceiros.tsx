'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/shared/lib/supabaseClient';
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  MapPin, 
  Phone, 
  Mail, 
  HardHat, 
  Loader2,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  DollarSign
} from 'lucide-react';
import ValorPremium from '@/shared/components/ValorPremium';
import ConfirmButton from '@/shared/components/ConfirmButton';
import Toast, { ToastType } from '@/shared/components/Toast';

interface Parceiro {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  cidade: string;
  uf: string;
  tipo_parceiro: string;
  valor_diaria: number;
  total_pago?: number;
}

export default function ListaParceiros() {
  const [loading, setLoading] = useState(true);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [busca, setBusca] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };

  const carregarParceiros = async () => {
    setLoading(true);
    try {
      // Busca parceiros com os pagamentos atrelados para calcular total ganho
      const { data: parceirosData, error } = await supabase
        .from('rh_parceiros')
        .select(`
          *,
          rh_pagamentos_parceiros(valor_total)
        `)
        .order('nome');

      if (error) throw error;

      const parceirosProcessados = (parceirosData || []).map((p: any) => {
        const totalPago = p.rh_pagamentos_parceiros?.reduce((acc: number, curr: any) => acc + (Number(curr.valor_total) || 0), 0) || 0;
        return { ...p, total_pago: totalPago };
      });

      setParceiros(parceirosProcessados);
    } catch (err) {
      console.error('Erro ao buscar lista de parceiros:', err);
      showToast('Erro ao carregar parceiros.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarParceiros();
  }, []);

  const handleExcluir = async (id: string) => {
    try {
      const { error } = await supabase.from('rh_parceiros').delete().eq('id', id);
      if (error) throw error;
      showToast('Parceiro excluído com sucesso.', 'success');
      carregarParceiros();
    } catch (err: any) {
      console.error('Erro ao deletar parceiro:', err);
      if (err.code === '23503') {
        showToast('Não é possível excluir. O parceiro possui pagamentos vinculados.', 'error');
      } else {
        showToast('Houve um erro ao processar a exclusão.', 'error');
      }
    }
  };

  const parceirosFiltrados = parceiros.filter(p => {
    const term = busca.toLowerCase();
    return p.nome.toLowerCase().includes(term) || 
           p.documento.includes(term) ||
           (p.cidade && p.cidade.toLowerCase().includes(term)) ||
           p.tipo_parceiro.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-8 pb-12">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-card-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-main flex items-center gap-2 font-vomzom">
            Quadro de Parceiros <span className="text-brand-blue dark:text-brand-ocre text-[10px] font-semibold border border-brand-ocre/20 bg-brand-blue/5 dark:bg-brand-ocre/5 px-2 py-0.5 rounded-lg uppercase tracking-wider">RH & MÃO DE OBRA</span>
          </h2>
          <p className="text-sub text-xs mt-0.5">
            Gestão de empreiteiros, diaristas e profissionais de mão de obra.
          </p>
        </div>
        <div>
          <Link
            href="/rh/parceiros/novo"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-ocre text-brand-dark text-xs font-bold hover:bg-brand-ocre/90 transition-all shadow-lg shadow-brand-ocre/10 cursor-pointer"
          >
            <Plus size={15} /> Cadastrar Parceiro
          </Link>
        </div>
      </div>

      {/* Painel de Busca e Filtros */}
      <div className="bg-card border border-card-border rounded-2xl p-4 flex flex-col sm:flex-row gap-3.5 items-center justify-between shadow-xs">
        
        {/* Input de busca */}
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-desc">
            <Search size={14} />
          </div>
          <input
            type="text"
            placeholder="Buscar por nome, documento, função ou cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-background border border-card-border rounded-lg pl-8 pr-3.5 py-1.5 text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-ocre focus:ring-1 focus:ring-brand-ocre transition-all"
          />
        </div>

        {/* Alternador de Visualização */}
        <div className="flex items-center gap-1 bg-background border border-card-border p-1 rounded-lg shrink-0 w-full sm:w-auto justify-center sm:justify-start">
          <span className="text-[10px] text-desc font-semibold px-2.5 hidden sm:inline">Exibição:</span>
          <button
            onClick={() => setViewMode('grid')}
            title="Exibir em Cards (Grade)"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-brand-blue text-white dark:bg-brand-ocre dark:text-brand-dark shadow-xs'
                : 'text-sub hover:bg-slate-100 dark:hover:bg-white/[0.02]'
            }`}
          >
            <LayoutGrid size={12} />
            <span>Cards</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="Exibir em Tabela (Lista)"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-brand-blue text-white dark:bg-brand-ocre dark:text-brand-dark shadow-xs'
                : 'text-sub hover:bg-slate-100 dark:hover:bg-white/[0.02]'
            }`}
          >
            <List size={12} />
            <span>Lista</span>
          </button>
        </div>

      </div>

      {/* Listagem */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-3 text-desc">
          <Loader2 className="animate-spin text-brand-ocre" size={36} />
          <span className="text-xs font-bold tracking-wider uppercase">CARREGANDO PARCEIROS...</span>
        </div>
      ) : parceirosFiltrados.length === 0 ? (
        <div className="text-center py-20 bg-card border border-card-border border-dashed rounded-2xl">
          <Users size={40} className="mx-auto text-desc opacity-50 mb-3" />
          <p className="text-sm font-semibold text-main">Nenhum parceiro localizado.</p>
          <p className="text-xs text-desc mt-1">Tente ajustar a pesquisa ou crie um novo parceiro.</p>
          {busca ? (
            <button
              onClick={() => setBusca('')}
              className="mt-4 px-4 py-2 rounded-xl border border-card-border bg-card text-xs font-bold text-sub hover:bg-slate-100 dark:hover:bg-white/[0.02] transition-all cursor-pointer"
            >
              Limpar Pesquisa
            </button>
          ) : (
            <Link
              href="/rh/parceiros/novo"
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-brand-ocre text-brand-dark text-xs font-bold hover:bg-brand-ocre/90 transition-all shadow-lg"
            >
              Cadastrar Parceiro
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* VISUALIZAÇÃO EM GRADE (CARDS) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {parceirosFiltrados.map((p) => (
            <div 
              key={p.id}
              className="bg-card border border-card-border rounded-2xl p-4.5 hover-card shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-card-border pb-2.5 mb-3">
                  <span className="text-xs font-bold text-brand-blue dark:text-brand-ocre bg-brand-blue/10 dark:bg-brand-ocre/10 px-2 py-1 rounded-md border border-brand-blue/20 dark:border-brand-ocre/20 uppercase tracking-wide flex items-center gap-1.5">
                    <HardHat size={12} /> {p.tipo_parceiro}
                  </span>
                  <div className="flex items-center gap-2">
                    <ConfirmButton
                      onConfirm={() => handleExcluir(p.id)}
                      confirmLabel="Confirmar?"
                      icon={Trash2}
                      className="p-1.5 rounded-md border border-card-border bg-background hover:bg-red-500/10 text-desc hover:text-red-500 transition-colors shadow-xs cursor-pointer"
                      confirmClassName="bg-red-500 text-white border-red-600 hover:bg-red-600 p-1.5"
                      title="Excluir Parceiro"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  <h3 className="text-base font-bold text-main block font-vomzom">
                    {p.nome}
                  </h3>
                  
                  <div className="flex flex-col gap-1.5 text-xs text-desc">
                    <span className="flex items-center gap-1.5">
                      <Phone size={12} className="text-sub shrink-0" />
                      {p.telefone || 'Sem telefone'}
                    </span>
                    <span className="flex items-start gap-1.5">
                      <MapPin size={12} className="text-sub shrink-0 mt-0.5" />
                      {p.cidade ? `${p.cidade}/${p.uf}` : 'Sem cidade cadastrada'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-card-border pt-3 mt-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-desc font-medium block">Diária Padrão</span>
                    <span className="text-main font-semibold flex items-center gap-1">
                      <DollarSign size={12} className="text-brand-blue dark:text-brand-ocre" />
                      <ValorPremium valor={p.valor_diaria} size="xs" />
                    </span>
                  </div>
                  <div className="space-y-0.5 border-l border-card-border pl-3">
                    <span className="text-desc font-medium block">Total Recebido</span>
                    <span className="text-main font-semibold flex items-center gap-1">
                      <ValorPremium valor={p.total_pago || 0} size="xs" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* VISUALIZAÇÃO EM LISTA (TABELA) */
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 dark:bg-zinc-900/50 text-xs font-bold text-desc uppercase tracking-wider">
                  <th className="py-3 px-5">Nome</th>
                  <th className="py-3 px-4">Função</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Cidade/UF</th>
                  <th className="py-3 px-4 text-right">Valor Diária</th>
                  <th className="py-3 px-4 text-right">Total Recebido</th>
                  <th className="py-3 px-5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {parceirosFiltrados.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-855/20 transition-colors text-xs font-semibold text-main">
                    <td className="py-3 px-5 font-bold font-vomzom">{p.nome}</td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold text-brand-blue dark:text-brand-ocre bg-brand-blue/10 dark:bg-brand-ocre/10 px-2 py-0.5 rounded border border-brand-blue/20 dark:border-brand-ocre/20 uppercase tracking-wide">
                        {p.tipo_parceiro}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-desc">{p.telefone}</td>
                    <td className="py-3 px-4 text-desc">{p.cidade ? `${p.cidade}/${p.uf}` : '-'}</td>
                    <td className="py-3 px-4 text-right"><ValorPremium valor={p.valor_diaria} size="xs" /></td>
                    <td className="py-3 px-4 text-right text-emerald-600"><ValorPremium valor={p.total_pago || 0} size="xs" /></td>
                    <td className="py-3 px-5 text-center">
                      <ConfirmButton
                        onConfirm={() => handleExcluir(p.id)}
                        confirmLabel="Excluir?"
                        icon={Trash2}
                        className="p-1.5 inline-block rounded-md border border-card-border bg-background hover:bg-red-500/10 text-desc hover:text-red-500 transition-colors shadow-xs"
                        confirmClassName="bg-red-500 text-white border-red-600 hover:bg-red-600 p-1.5"
                        title="Excluir Parceiro"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
