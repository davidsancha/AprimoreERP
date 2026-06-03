'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Landmark, 
  Coins, 
  TrendingUp, 
  HardHat, 
  AlertTriangle, 
  CheckCircle, 
  Percent, 
  ArrowLeft, 
  Loader2, 
  ArrowUpRight, 
  BarChart3, 
  PieChart as PieIcon, 
  Layers,
  MapPin,
  Calendar,
  Layers2,
  DollarSign
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  LineChart, 
  Line 
} from 'recharts';

import { fetchProjetos } from '@/modules/operacional/services/apiProjetos';
import { fetchRecebimentos } from '@/modules/financeiro/services/apiFinanceiro';
import { supabase } from '@/shared/lib/supabaseClient';
import { Projeto, CategoriaCusto, CATEGORIAS_CUSTO_LABELS } from '@/modules/operacional/types';
import { Recebimento } from '@/modules/financeiro/types';
import ValorPremium from '@/shared/components/ValorPremium';

const COLORS_CATEGORIES = {
  insumos: '#cca353',      // Ocre
  mao_de_obra: '#1e3a8a',  // Azul Escuro
  empreiteiros: '#2563eb',  // Azul Claro
  ferramentas: '#f59e0b',  // Amber
  locacoes: '#ef4444',     // Vermelho
  logistica: '#10b981',    // Emerald
  administrativo: '#8b5cf6', // Roxo
  alimentacao: '#ec4899',  // Rosa
  outros: '#6b7280',       // Cinza
};

async function fetchTodosCustosRealizados() {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('custos_realizados')
    .select('*');
  if (error) {
    console.error('Erro ao buscar custos:', error);
    return [];
  }
  return data || [];
}

async function fetchTodosOrcamentos() {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('orcamentos_custos')
    .select('*');
  if (error) {
    console.error('Erro ao buscar orçamentos:', error);
    return [];
  }
  return data || [];
}

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'consolidado' | 'obra'>('consolidado');
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [todosCustos, setTodosCustos] = useState<any[]>([]);
  const [todosOrcamentos, setTodosOrcamentos] = useState<any[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string>('');

  useEffect(() => {
    async function loadRelatoriosData() {
      setLoading(true);
      try {
        const projs = await fetchProjetos();
        const recs = await fetchRecebimentos();
        const costs = await fetchTodosCustosRealizados();
        const orcs = await fetchTodosOrcamentos();

        setProjetos(projs);
        setRecebimentos(recs);
        setTodosCustos(costs);
        setTodosOrcamentos(orcs);

        if (projs.length > 0) {
          setSelectedObraId(projs[0].id!);
        }
      } catch (err) {
        console.error('Erro ao carregar dados de relatórios:', err);
      } finally {
        setLoading(false);
      }
    }
    loadRelatoriosData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-3 text-desc">
        <Loader2 className="animate-spin text-brand-ocre" size={40} />
        <span className="text-sm font-semibold tracking-wider uppercase">CARREGANDO INTELIGÊNCIA FINANCEIRA...</span>
      </div>
    );
  }

  // --- MÉTODOS AUXILIARES E PROCESSAMENTO Consolidado ---

  // Receitas Totais
  const faturamentoTotalContratado = projetos.reduce((acc, p) => acc + Number(p.valor_total_contrato), 0);
  const receitaRecebida = recebimentos.filter(r => r.status === 'pago').reduce((acc, r) => acc + Number(r.valor), 0);
  const receitaPendente = recebimentos.filter(r => r.status !== 'pago').reduce((acc, r) => acc + Number(r.valor), 0);
  
  // Inadimplência (Vencida e não paga)
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const inadimplenciaTotal = recebimentos
    .filter(r => r.status !== 'pago' && new Date(r.data_prevista) < hoje)
    .reduce((acc, r) => acc + Number(r.valor), 0);

  // Despesas Totais
  const despesaRealizada = todosCustos.reduce((acc, c) => acc + Number(c.valor), 0);
  const orcamentoTotalPrevisto = todosOrcamentos.reduce((acc, o) => acc + Number(o.valor_previsto), 0);

  // Lucro Consolidado
  const lucroEfetivoRealizado = receitaRecebida - despesaRealizada;
  const margemEfetivaRealizada = receitaRecebida > 0 ? (lucroEfetivoRealizado / receitaRecebida) * 100 : 0;

  // Distribuição de custos global por categoria para o Gráfico de Pizza
  const custosPorCategoriaGlobalMap: Record<string, number> = {};
  Object.keys(CATEGORIAS_CUSTO_LABELS).forEach(cat => {
    custosPorCategoriaGlobalMap[cat] = 0;
  });

  todosCustos.forEach(c => {
    if (c.categoria in custosPorCategoriaGlobalMap) {
      custosPorCategoriaGlobalMap[c.categoria] += Number(c.valor);
    } else {
      custosPorCategoriaGlobalMap.outros = (custosPorCategoriaGlobalMap.outros || 0) + Number(c.valor);
    }
  });

  const dadosPizzaGlobal = Object.entries(custosPorCategoriaGlobalMap)
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => ({
      name: CATEGORIAS_CUSTO_LABELS[key as CategoriaCusto] || key,
      value: value,
      key: key
    }));

  // Faturamento vs Custos por Projeto para o Gráfico de Barras
  const dadosBarrasProjetos = projetos.map(p => {
    const totalContrato = Number(p.valor_total_contrato);
    const receitaObra = recebimentos.filter(r => r.projeto_id === p.id && r.status === 'pago').reduce((acc, r) => acc + Number(r.valor), 0);
    const custosObra = todosCustos.filter(c => c.projeto_id === p.id).reduce((acc, c) => acc + Number(c.valor), 0);
    
    return {
      name: p.nome.length > 15 ? `${p.nome.substring(0, 15)}...` : p.nome,
      contrato: totalContrato,
      recebido: receitaObra,
      custos: custosObra
    };
  });

  // --- PROCESSAMENTO DE OBRA SELECIONADA ---
  const selectedObra = projetos.find(p => p.id === selectedObraId);
  const orcamentosObra = todosOrcamentos.filter(o => o.projeto_id === selectedObraId);
  const custosObra = todosCustos.filter(c => c.projeto_id === selectedObraId);
  const recebimentosObra = recebimentos.filter(r => r.projeto_id === selectedObraId);

  const selectedObraValorContrato = selectedObra ? Number(selectedObra.valor_total_contrato) : 0;
  const selectedObraRecebida = recebimentosObra.filter(r => r.status === 'pago').reduce((acc, r) => acc + Number(r.valor), 0);
  const selectedObraPendente = recebimentosObra.filter(r => r.status !== 'pago').reduce((acc, r) => acc + Number(r.valor), 0);
  const selectedObraCustoRealizado = custosObra.reduce((acc, c) => acc + Number(c.valor), 0);
  const selectedObraOrcamentoPrevisto = orcamentosObra.reduce((acc, o) => acc + Number(o.valor_previsto), 0);
  
  const selectedObraLucroReal = selectedObraRecebida - selectedObraCustoRealizado;
  const selectedObraMargemReal = selectedObraRecebida > 0 ? (selectedObraLucroReal / selectedObraRecebida) * 100 : 0;

  // Comparativo previsto vs realizado por categoria para a obra selecionada
  const comparativoObraCategorias = Object.entries(CATEGORIAS_CUSTO_LABELS).map(([cat, label]) => {
    const previsto = orcamentosObra.filter(o => o.categoria === cat).reduce((acc, o) => acc + Number(o.valor_previsto), 0);
    const realizado = custosObra.filter(c => c.categoria === cat).reduce((acc, c) => acc + Number(c.valor), 0);
    
    return {
      category: label,
      previsto,
      realizado,
      color: COLORS_CATEGORIES[cat as CategoriaCusto] || '#6b7280'
    };
  }).filter(item => item.previsto > 0 || item.realizado > 0);

  return (
    <div className="space-y-8 pb-16">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-card-border pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-main flex items-center gap-2.5 font-vomzom">
            <BarChart3 className="text-brand-ocre" /> Relatórios Estratégicos
          </h2>
          <p className="text-sub text-sm mt-1">
            Análise consolidada de fluxo de caixa, rentabilidade de obras e auditoria financeira.
          </p>
        </div>
        <div>
          <Link 
            href="/" 
            className="flex items-center gap-1.5 text-xs text-sub hover:text-brand-blue dark:hover:text-brand-ocre transition-colors border border-card-border bg-card px-4 py-2.5 rounded-xl font-bold shadow-2xs"
          >
            <ArrowLeft size={14} /> Voltar ao Dashboard
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-card-border pb-px">
        <button
          onClick={() => setActiveTab('consolidado')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'consolidado'
              ? 'border-brand-blue text-brand-blue dark:border-brand-ocre dark:text-brand-ocre'
              : 'border-transparent text-sub hover:text-main'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <PieIcon size={14} /> Consolidado Global
          </div>
        </button>
        <button
          onClick={() => setActiveTab('obra')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'obra'
              ? 'border-brand-blue text-brand-blue dark:border-brand-ocre dark:text-brand-ocre'
              : 'border-transparent text-sub hover:text-main'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Layers size={14} /> Análise Individual por Obra
          </div>
        </button>
      </div>

      {/* RENDERIZAÇÃO DA TAB CONSOLIDADA */}
      {activeTab === 'consolidado' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* Cards de Métricas Consolidadas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: Faturamento Recebido */}
            <div className="bg-card border border-card-border rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider">Faturado Recebido</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-450">
                  <Landmark size={15} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-main flex items-baseline gap-1">
                  <ValorPremium valor={receitaRecebida} size="lg" colorClass="text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-[10px] text-desc">Total quitado no fluxo de caixa</p>
              </div>
              <div className="pt-2 border-t border-card-border/60 flex justify-between text-[10px]">
                <span className="text-desc">Previsto Contratos:</span>
                <span className="font-bold text-main">R$ {faturamentoTotalContratado.toLocaleString('pt-BR')}</span>
              </div>
            </div>

            {/* Card 2: Custos Totais Realizados */}
            <div className="bg-card border border-card-border rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider">Custos Realizados</span>
                <div className="p-2 rounded-lg bg-red-500/10 text-red-500 dark:text-red-400">
                  <Coins size={15} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-main flex items-baseline gap-1">
                  <ValorPremium valor={despesaRealizada} size="lg" colorClass="text-red-500 dark:text-red-450" />
                </div>
                <p className="text-[10px] text-desc">Total pago em insumos e serviços</p>
              </div>
              <div className="pt-2 border-t border-card-border/60 flex justify-between text-[10px]">
                <span className="text-desc">Orçado Planejado:</span>
                <span className="font-bold text-main">R$ {orcamentoTotalPrevisto.toLocaleString('pt-BR')}</span>
              </div>
            </div>

            {/* Card 3: Lucro Líquido Real */}
            <div className="bg-card border border-card-border rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider">Lucro Real Efetivo</span>
                <div className="p-2 rounded-lg bg-brand-blue/10 dark:bg-brand-ocre/10 text-brand-blue dark:text-brand-ocre">
                  <TrendingUp size={15} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-main flex items-baseline gap-1">
                  <ValorPremium valor={lucroEfetivoRealizado} size="lg" colorClass={lucroEfetivoRealizado >= 0 ? 'text-brand-blue dark:text-brand-ocre' : 'text-red-500'} />
                </div>
                <p className="text-[10px] text-desc">Recebido menos Custo Realizado</p>
              </div>
              <div className="pt-2 border-t border-card-border/60 flex justify-between text-[10px]">
                <span className="text-desc">Margem Média Geral:</span>
                <span className={`font-bold ${margemEfetivaRealizada >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {margemEfetivaRealizada.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Card 4: Inadimplência Acumulada */}
            <div className="bg-card border border-card-border rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider">Inadimplência Ativa</span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                  <AlertTriangle size={15} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-main flex items-baseline gap-1">
                  <ValorPremium valor={inadimplenciaTotal} size="lg" colorClass="text-amber-500" />
                </div>
                <p className="text-[10px] text-desc">Parcelas vencidas e não pagas</p>
              </div>
              <div className="pt-2 border-t border-card-border/60 flex justify-between text-[10px]">
                <span className="text-desc">Futuro Programado:</span>
                <span className="font-bold text-main">R$ {receitaPendente.toLocaleString('pt-BR')}</span>
              </div>
            </div>

          </div>

          {/* Gráficos Consolidado */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Gráfico 1: Despesas por Categoria (Pizza) */}
            <div className="lg:col-span-5 bg-card border border-card-border rounded-2xl p-6 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-main font-vomzom">Distribuição de Despesas</h3>
                <p className="text-xs text-sub">Composição de todos os custos reais lançados por categoria.</p>
              </div>
              
              {dadosPizzaGlobal.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-desc">
                  Nenhum custo lançado para gerar distribuição.
                </div>
              ) : (
                <div className="h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dadosPizzaGlobal}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {dadosPizzaGlobal.map((entry: any, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS_CATEGORIES[entry.key as CategoriaCusto] || '#6b7280'} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '11px' }}
                        formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Total Gasto']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-desc font-semibold uppercase">Total Despesas</span>
                    <span className="text-sm font-black text-main">R$ {despesaRealizada.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              )}

              {/* Legendas Customizadas */}
              <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-card-border/60 pt-4 mt-2">
                {dadosPizzaGlobal.map((item: any) => (
                  <div key={item.name} className="flex items-center gap-1.5 text-sub">
                    <span 
                      className="h-2 w-2 rounded-full shrink-0" 
                      style={{ backgroundColor: COLORS_CATEGORIES[item.key as CategoriaCusto] || '#6b7280' }} 
                    />
                    <span className="truncate">{item.name}: <strong>R$ {item.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</strong></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico 2: Rentabilidade e Custos por Obra (Barras) */}
            <div className="lg:col-span-7 bg-card border border-card-border rounded-2xl p-6 space-y-4 shadow-sm">
              <div>
                <h3 className="text-base font-bold text-main font-vomzom">Faturamento vs Custos por Obra</h3>
                <p className="text-xs text-sub">Desempenho financeiro geral agrupado por canteiro de obras.</p>
              </div>

              {dadosBarrasProjetos.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-xs text-desc">
                  Sem obras registradas no sistema.
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosBarrasProjetos} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" strokeOpacity={0.5} vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                      <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                        labelStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                        itemStyle={{ fontSize: '11px' }}
                        formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="contrato" name="Valor Contrato" fill="#cca353" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="recebido" name="Total Recebido" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="custos" name="Custo Realizado" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>

          {/* Tabela Geral de Obras com Saúde */}
          <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-card-border">
              <h3 className="text-base font-bold text-main font-vomzom">Auditoria de Projetos</h3>
              <p className="text-xs text-sub">Status geral de faturamento, custos e saldo de contratos de cada obra.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-card-border bg-slate-50 dark:bg-zinc-900/50 text-[10px] font-bold text-desc uppercase tracking-wider">
                    <th className="py-4 px-6">OS</th>
                    <th className="py-4 px-4">Nome da Obra</th>
                    <th className="py-4 px-4">Tipologia</th>
                    <th className="py-4 px-4 text-right">Contrato</th>
                    <th className="py-4 px-4 text-right">Faturado Recebido</th>
                    <th className="py-4 px-4 text-right">Custos Totais</th>
                    <th className="py-4 px-4 text-right">Lucro Efetivo</th>
                    <th className="py-4 px-6 text-center">Status Obra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border text-xs font-semibold text-main">
                  {projetos.map(p => {
                    const receita = recebimentos.filter(r => r.projeto_id === p.id && r.status === 'pago').reduce((acc, r) => acc + Number(r.valor), 0);
                    const custo = todosCustos.filter(c => c.projeto_id === p.id).reduce((acc, c) => acc + Number(c.valor), 0);
                    const lucro = receita - custo;
                    
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/40 dark:hover:bg-zinc-900/20">
                        <td className="py-4 px-6 font-bold text-brand-ocre">{p.os}</td>
                        <td className="py-4 px-4 font-bold font-vomzom">{p.nome}</td>
                        <td className="py-4 px-4">
                          <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-sub px-2 py-0.5 rounded border border-card-border/50 font-bold uppercase">
                            {p.tipologia || 'Residencial'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right"><ValorPremium valor={Number(p.valor_total_contrato)} size="xs" /></td>
                        <td className="py-4 px-4 text-right text-emerald-600 dark:text-emerald-400">R$ {receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="py-4 px-4 text-right text-red-500">R$ {custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="py-4 px-4 text-right">
                          <span className={lucro >= 0 ? 'text-brand-blue dark:text-brand-ocre' : 'text-red-500'}>
                            R$ {lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                            p.status === 'em_andamento'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : p.status === 'concluido'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : p.status === 'planejado'
                              ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                              : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                          }`}>
                            {p.status === 'em_andamento' ? 'Em Andamento' : p.status === 'concluido' ? 'Concluída' : p.status === 'planejado' ? 'Planejada' : 'Suspensa'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* RENDERIZAÇÃO DA TAB POR OBRA */}
      {activeTab === 'obra' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* Seletor de Obra */}
          <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Layers2 className="text-brand-ocre" size={18} />
              <div>
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider block">Filtrar Canteiro de Obras</span>
                <span className="text-xs text-sub">Escolha a obra para auditar a integridade de custos e recebimentos.</span>
              </div>
            </div>
            <select
              value={selectedObraId}
              onChange={(e) => setSelectedObraId(e.target.value)}
              className="w-full sm:w-80 bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-main font-semibold focus:outline-none focus:border-brand-ocre"
            >
              {projetos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.os})
                </option>
              ))}
            </select>
          </div>

          {selectedObra ? (
            <div className="space-y-8">
              
              {/* Painel Cabeçalho Detalhado da Obra */}
              <div className="bg-card border border-card-border rounded-2xl p-6 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-brand-ocre bg-brand-ocre/10 px-2 py-0.5 rounded border border-brand-ocre/20 uppercase tracking-wide">
                      {selectedObra.os}
                    </span>
                    <span className="text-[10px] font-bold text-brand-blue dark:text-brand-ocre bg-brand-blue/10 dark:bg-brand-ocre/10 px-2 py-0.5 rounded border border-brand-blue/20 dark:border-brand-ocre/20 uppercase tracking-wide">
                      {selectedObra.tipologia || 'Residencial'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-main font-vomzom leading-snug">{selectedObra.nome}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-sub">
                    <MapPin size={13} className="text-brand-ocre shrink-0" />
                    <span>{selectedObra.logradouro}, {selectedObra.numero} - {selectedObra.cidade}/{selectedObra.uf}</span>
                  </div>
                </div>

                <div className="space-y-3 border-t md:border-t-0 md:border-l md:border-r border-card-border/70 py-2 md:py-0 md:px-6 text-xs text-sub">
                  <div className="flex justify-between items-center">
                    <span>Início Previsto:</span>
                    <strong className="text-main flex items-center gap-1"><Calendar size={12} /> {new Date(selectedObra.data_prevista_inicio).toLocaleDateString('pt-BR')}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Fim Previsto:</span>
                    <strong className="text-main flex items-center gap-1"><Calendar size={12} /> {new Date(selectedObra.data_prevista_termino).toLocaleDateString('pt-BR')}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Status Obra:</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      selectedObra.status === 'em_andamento'
                        ? 'bg-amber-500/10 text-amber-500'
                        : selectedObra.status === 'concluido'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-slate-500/10 text-slate-500'
                    }`}>
                      {selectedObra.status === 'em_andamento' ? 'Em Andamento' : selectedObra.status === 'concluido' ? 'Concluída' : 'Suspensa'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col justify-center space-y-2">
                  <div className="flex justify-between items-baseline text-xs text-sub">
                    <span>Contrato Fechado:</span>
                    <strong className="text-main"><ValorPremium valor={selectedObraValorContrato} size="sm" /></strong>
                  </div>
                  <div className="flex justify-between items-baseline text-xs text-sub">
                    <span>Margem Obra Real:</span>
                    <span className={`font-bold ${selectedObraMargemReal >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {selectedObraMargemReal.toFixed(1)}% (R$ {selectedObraLucroReal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })})
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-150 dark:bg-zinc-800 rounded-full overflow-hidden border border-card-border">
                    <div 
                      style={{ width: `${Math.min(100, selectedObraOrcamentoPrevisto > 0 ? (selectedObraCustoRealizado / selectedObraOrcamentoPrevisto) * 100 : 0)}%` }} 
                      className={`h-full rounded-full ${
                        selectedObraCustoRealizado > selectedObraOrcamentoPrevisto ? 'bg-red-500' : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Grid Gráficos de Obra */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Comparativo de Orçado vs Realizado (Barras) */}
                <div className="lg:col-span-7 bg-card border border-card-border rounded-2xl p-6 space-y-4 shadow-sm">
                  <div>
                    <h3 className="text-base font-bold text-main font-vomzom">Orçado Planejado vs Custos Reais</h3>
                    <p className="text-xs text-sub">Visão comparativa por categoria de custos desta obra.</p>
                  </div>

                  {comparativoObraCategorias.length === 0 ? (
                    <div className="h-72 flex items-center justify-center text-xs text-desc">
                      Nenhum custo ou meta cadastrada nesta obra.
                    </div>
                  ) : (
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparativoObraCategorias} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" strokeOpacity={0.5} vertical={false} />
                          <XAxis dataKey="category" stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                          <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                            labelStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                            formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`}
                          />
                          <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="previsto" name="Planejado (Meta)" fill="var(--text-secondary)" opacity={0.65} radius={[3, 3, 0, 0]} />
                          <Bar dataKey="realizado" name="Custo Efetivo Real" fill="#cca353" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Resumo de Metas e Faturamento (Pizza) */}
                <div className="lg:col-span-5 bg-card border border-card-border rounded-2xl p-6 space-y-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-main font-vomzom">Resumo Financeiro da Obra</h3>
                    <p className="text-xs text-sub">Composição consolidada do faturamento e margem física.</p>
                  </div>

                  <div className="space-y-4 text-xs text-sub my-auto">
                    <div className="flex justify-between items-center py-2 border-b border-card-border/50">
                      <span>Valor do Contrato:</span>
                      <strong className="text-main font-bold">R$ {selectedObraValorContrato.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-card-border/50">
                      <span>Total Orçado (Planejado):</span>
                      <strong className="text-main font-bold">R$ {selectedObraOrcamentoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-card-border/50">
                      <span>Custo Realizado (Despesa):</span>
                      <strong className="text-red-500 font-bold">R$ {selectedObraCustoRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-card-border/50">
                      <span>Faturado Recebido:</span>
                      <strong className="text-emerald-600 dark:text-emerald-450 font-bold">R$ {selectedObraRecebida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-card-border/50">
                      <span>Saldo Pendente de Receber:</span>
                      <strong className="text-main font-bold">R$ {selectedObraPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex justify-between items-center py-2 text-sm">
                      <span className="font-semibold text-main">Margem Obra Realizada:</span>
                      <strong className={`font-black ${selectedObraMargemReal >= 0 ? 'text-brand-blue dark:text-brand-ocre' : 'text-red-500'}`}>
                        {selectedObraMargemReal.toFixed(1)}%
                      </strong>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-card-border/60 text-center">
                    <span className="text-[10px] text-desc font-bold uppercase tracking-wider">
                      {selectedObraCustoRealizado > selectedObraOrcamentoPrevisto ? '⚠️ CUSTO SUPEROU O ORÇAMENTO' : '✅ OBRA DENTRO DO ORÇADO'}
                    </span>
                  </div>
                </div>

              </div>

              {/* Tabela do Cronograma de Recebimentos da Obra (Auditoria de Parcelas) */}
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-card-border">
                  <h3 className="text-base font-bold text-main font-vomzom">Cronograma de Recebimento de Parcelas</h3>
                  <p className="text-xs text-sub">Histórico e faturas programadas, quitações parciais e auditoria.</p>
                </div>
                <div className="overflow-x-auto">
                  {recebimentosObra.length === 0 ? (
                    <div className="text-center py-8 text-xs text-desc">
                      Sem parcelas no cronograma para esta obra.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-card-border bg-slate-50 dark:bg-zinc-900/50 text-[10px] font-bold text-desc uppercase tracking-wider">
                          <th className="py-4 px-6 w-20">Parcela</th>
                          <th className="py-4 px-4 w-32">Percentual (%)</th>
                          <th className="py-4 px-4 w-40 text-right">Valor Programado</th>
                          <th className="py-4 px-4 w-44">Previsão Vencimento</th>
                          <th className="py-4 px-4 w-36">Status</th>
                          <th className="py-4 px-6">Data de Pagamento (Caixa)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-card-border text-xs font-semibold text-main">
                        {recebimentosObra.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50/40 dark:hover:bg-zinc-900/20">
                            <td className="py-4 px-6 font-bold">#{r.parcela_numero}</td>
                            <td className="py-4 px-4 text-sub">{Number(r.percentual).toFixed(2)}%</td>
                            <td className="py-4 px-4 text-right font-bold">R$ {Number(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td className="py-4 px-4 text-sub">{new Date(r.data_prevista).toLocaleDateString('pt-BR')}</td>
                            <td className="py-4 px-4">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                                r.status === 'pago'
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                  : new Date(r.data_prevista) < hoje
                                  ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                  : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                              }`}>
                                {r.status === 'pago' ? 'Pago' : new Date(r.data_prevista) < hoje ? 'Atrasado' : 'Pendente'}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-sub">
                              {r.data_pagamento ? (
                                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle size={12} /> {new Date(r.data_pagamento).toLocaleDateString('pt-BR')}
                                </span>
                              ) : (
                                <span className="text-desc italic">Aguardando entrada</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Detalhes Físicos de Lançamentos de Custos (Despesas) */}
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-card-border">
                  <h3 className="text-base font-bold text-main font-vomzom">Histórico de Custos Realizados (Auditoria de Despesas)</h3>
                  <p className="text-xs text-sub">Extrato cronológico e detalhado de despesas registradas nesta obra.</p>
                </div>
                <div className="overflow-x-auto">
                  {custosObra.length === 0 ? (
                    <div className="text-center py-8 text-xs text-desc">
                      Nenhum custo registrado para esta obra.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-card-border bg-slate-50 dark:bg-zinc-900/50 text-[10px] font-bold text-desc uppercase tracking-wider">
                          <th className="py-4 px-6">Data de Lançamento</th>
                          <th className="py-4 px-4">Categoria</th>
                          <th className="py-4 px-4">Descrição</th>
                          <th className="py-4 px-6 text-right">Valor Lançado (R$)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-card-border text-xs font-semibold text-main">
                        {custosObra.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50/40 dark:hover:bg-zinc-900/20">
                            <td className="py-4 px-6 text-sub">{new Date(c.data_custo).toLocaleDateString('pt-BR')}</td>
                            <td className="py-4 px-4">
                              <span 
                                className="text-[9px] font-bold px-2 py-0.5 rounded border uppercase"
                                style={{ 
                                  backgroundColor: `${COLORS_CATEGORIES[c.categoria as CategoriaCusto] || '#6b7280'}10`,
                                  borderColor: `${COLORS_CATEGORIES[c.categoria as CategoriaCusto] || '#6b7280'}30`,
                                  color: COLORS_CATEGORIES[c.categoria as CategoriaCusto] || '#6b7280'
                                }}
                              >
                                {CATEGORIAS_CUSTO_LABELS[c.categoria as CategoriaCusto] || c.categoria}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-sub font-normal">{c.descricao}</td>
                            <td className="py-4 px-6 text-right font-bold text-red-500">R$ {Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-20 bg-card border border-dashed border-card-border rounded-2xl">
              <HardHat size={40} className="mx-auto text-desc opacity-50 mb-3" />
              <p className="text-sm font-semibold text-main">Nenhuma obra cadastrada para avaliação.</p>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
