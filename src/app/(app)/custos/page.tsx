'use client';

import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  Search,
  Filter,
  Plus,
  ArrowLeft,
  Loader2,
  Eye,
  Layers
} from 'lucide-react';
import Link from 'next/link';
import { fetchProjetos, fetchTodosCustosRealizados } from '@/modules/operacional/services/apiProjetos';
import { Projeto, CategoriaCusto, CATEGORIAS_CUSTO_LABELS, CustoRealizado } from '@/modules/operacional/types';
import CustoLancarModal from '@/modules/operacional/components/CustoLancarModal';
import DespesaDetalhesModal from '@/modules/operacional/components/DespesaDetalhesModal';
import ValorPremium from '@/shared/components/ValorPremium';

export default function CustosPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [custos, setCustos] = useState<CustoRealizado[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isLancarModalOpen, setIsLancarModalOpen] = useState(false);
  const [selectedDespesa, setSelectedDespesa] = useState<CustoRealizado | null>(null);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroProjeto, setFiltroProjeto] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');

  const loadData = async () => {
    setLoading(true);
    try {
      const [projs, custs] = await Promise.all([
        fetchProjetos(),
        fetchTodosCustosRealizados()
      ]);
      setProjetos(projs);
      setCustos(custs);
    } catch (err) {
      console.error('Erro ao carregar central de despesas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Aplicar filtros
  const custosFiltrados = custos.filter(c => {
    const matchProjeto = filtroProjeto === 'todos' || c.projeto_id === filtroProjeto;
    const matchCategoria = filtroCategoria === 'todas' || c.categoria === filtroCategoria;
    const descLower = c.descricao.toLowerCase();
    const buscaLower = busca.toLowerCase();
    const projetoNome = projetos.find(p => p.id === c.projeto_id)?.nome.toLowerCase() || '';
    
    const matchBusca = busca === '' || descLower.includes(buscaLower) || projetoNome.includes(buscaLower);

    return matchProjeto && matchCategoria && matchBusca;
  });

  const totalFiltrado = custosFiltrados.reduce((acc, curr) => acc + Number(curr.valor), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-in fade-in duration-200">
      
      {/* Voltar e Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-card-border pb-4">
        <div>
          <Link 
            href="/" 
            className="inline-flex items-center gap-1.5 text-xs font-bold text-sub hover:text-brand-ocre transition-colors bg-card border border-card-border px-3 py-1.5 rounded-lg mb-3 shadow-2xs"
          >
            <ArrowLeft size={14} /> Voltar ao Dashboard
          </Link>
          <h2 className="text-2xl font-bold font-vomzom text-main flex items-center gap-2">
            <Coins className="text-brand-ocre" /> Central de Despesas
          </h2>
          <p className="text-sub text-sm mt-1">
            Gestão unificada de todos os custos e despesas registrados no sistema.
          </p>
        </div>
        
        <button
          onClick={() => setIsLancarModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-ocre text-brand-dark font-bold text-sm hover:bg-brand-ocre/90 transition-all shadow-md shadow-brand-ocre/20 shrink-0"
        >
          <Plus size={16} /> Nova Despesa
        </button>
      </div>

      {/* Painel de Filtros */}
      <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-main mb-2">
          <Filter size={16} className="text-brand-ocre" /> Filtros Avançados
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Busca Texto */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-sub" />
            </div>
            <input
              type="text"
              placeholder="Buscar por descrição ou obra..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-background border border-card-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-main placeholder-slate-500 focus:outline-none focus:border-brand-ocre"
            />
          </div>

          {/* Filtro Obra */}
          <select
            value={filtroProjeto}
            onChange={(e) => setFiltroProjeto(e.target.value)}
            className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-main focus:outline-none focus:border-brand-ocre"
          >
            <option value="todos">Todas as Obras</option>
            {projetos.map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>

          {/* Filtro Categoria */}
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-main focus:outline-none focus:border-brand-ocre"
          >
            <option value="todas">Todas as Categorias</option>
            {(Object.keys(CATEGORIAS_CUSTO_LABELS) as CategoriaCusto[]).map(cat => (
              <option key={cat} value={cat}>{CATEGORIAS_CUSTO_LABELS[cat]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Resumo dos Filtros */}
      <div className="flex items-center justify-between px-2">
        <p className="text-xs text-sub">
          Mostrando <strong className="text-main">{custosFiltrados.length}</strong> despesas
        </p>
        <div className="text-sm">
          Total: <strong className="text-brand-ocre"><ValorPremium valor={totalFiltrado} size="sm" /></strong>
        </div>
      </div>

      {/* Tabela de Despesas */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-desc">
            <Loader2 className="animate-spin text-brand-ocre" size={32} />
            <span className="text-sm font-medium">Carregando despesas...</span>
          </div>
        ) : custosFiltrados.length === 0 ? (
          <div className="py-16 text-center">
            <Layers size={40} className="mx-auto text-desc opacity-40 mb-3" />
            <p className="text-sm text-main font-semibold">Nenhuma despesa encontrada.</p>
            <p className="text-xs text-sub mt-1">Tente ajustar os filtros ou cadastre uma nova despesa.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-card-border/60 text-[10px] font-bold text-desc uppercase tracking-wider bg-slate-50/50 dark:bg-zinc-900/50">
                  <th className="py-4 px-5 w-28 whitespace-nowrap">Data</th>
                  <th className="py-4 px-5 w-40">Obra</th>
                  <th className="py-4 px-5 w-40">Categoria</th>
                  <th className="py-4 px-5">Descrição</th>
                  <th className="py-4 px-5 text-right w-36">Valor</th>
                  <th className="py-4 px-5 text-center w-20">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border text-xs text-main">
                {custosFiltrados.map((custo) => {
                  const projeto = projetos.find(p => p.id === custo.projeto_id);
                  return (
                    <tr key={custo.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="py-3.5 px-5 text-sub whitespace-nowrap">
                        {new Date(custo.data_custo).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-5">
                        {projeto ? (
                          <span className="font-bold text-[11px] truncate block max-w-[150px] text-main" title={projeto.nome}>
                            {projeto.nome}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-sub">
                          {CATEGORIAS_CUSTO_LABELS[custo.categoria as CategoriaCusto] || custo.categoria}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="truncate block max-w-[200px] sm:max-w-[300px]" title={custo.descricao}>
                          {custo.descricao}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-black text-brand-ocre whitespace-nowrap">
                        R$ {Number(custo.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <button
                          onClick={() => setSelectedDespesa(custo)}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg border border-card-border bg-background hover:bg-brand-blue hover:text-white dark:hover:bg-brand-ocre dark:hover:text-brand-dark text-sub transition-colors shadow-xs"
                          title="Ver Detalhes"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CustoLancarModal 
        isOpen={isLancarModalOpen}
        onClose={() => setIsLancarModalOpen(false)}
        onSuccess={loadData}
      />

      <DespesaDetalhesModal
        isOpen={!!selectedDespesa}
        onClose={() => setSelectedDespesa(null)}
        custo={selectedDespesa as CustoRealizado}
      />

    </div>
  );
}
