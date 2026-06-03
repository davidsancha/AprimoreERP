'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  HardHat, 
  Coins, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Package, 
  Wrench, 
  Key, 
  Truck, 
  FileText, 
  Users, 
  Eye, 
  EyeOff, 
  ArrowDownUp, 
  Settings, 
  X,
  Utensils,
  MoreHorizontal
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

import { fetchProjetos, fetchOrcamentosByProjeto, fetchCustosRealizadosByProjeto, salvarCustoRealizado } from '@/modules/operacional/services/apiProjetos';
import { fetchRecebimentos, calcularPrevisaoCaixa } from '@/modules/financeiro/services/apiFinanceiro';
import { isSupabaseConfigured } from '@/shared/lib/supabaseClient';
import { Projeto, CategoriaCusto, CATEGORIAS_CUSTO_LABELS } from '@/modules/operacional/types';
import { Recebimento } from '@/modules/financeiro/types';
import { supabase } from '@/shared/lib/supabaseClient';
import ValorPremium from '@/shared/components/ValorPremium';
import ConfirmButton from '@/shared/components/ConfirmButton';
import Toast, { ToastType } from '@/shared/components/Toast';

interface ProjetoComFinanceiro extends Projeto {
  custoPrevisto: number;
  custoRealizado: number;
  saudeStatus: 'excelente' | 'alerta' | 'estourado';
  saudePercentual: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [projetos, setProjetos] = useState<ProjetoComFinanceiro[]>([]);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  
  // KPIs
  const [projetosAndamento, setProjetosAndamento] = useState(0);
  const [recebimentosAtrasados, setRecebimentosAtrasados] = useState(0);
  const [atrasadosValor, setAtrasadosValor] = useState(0);
  const [caixa15Dias, setCaixa15Dias] = useState(0);
  const [caixa30Dias, setCaixa30Dias] = useState(0);

  // Dados para o Gráfico
  const [graficoDados, setGraficoDados] = useState<any[]>([]);

  // Configuração do Dashboard (Reordenação e Visibilidade por Cargo/Preferência)
  const [showConfig, setShowConfig] = useState(false);
  const [visibilidadeWidgets, setVisibilidadeWidgets] = useState({
    saudeObras: true,
    fluxoCaixa: true,
    recebimentosAtrasados: true
  });
  const [ordemWidgets, setOrdemWidgets] = useState<string[]>([
    'saudeObras',
    'fluxoCaixa',
    'recebimentosAtrasados'
  ]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Lançamento Rápido de Custos (Modal inline com campo único de valor)
  const [quickCusto, setQuickCusto] = useState<{
    projetoId: string;
    projetoNome: string;
    categoria: CategoriaCusto;
    categoriaLabel: string;
  } | null>(null);
  const [quickValor, setQuickValor] = useState<string>('');
  const [salvandoQuick, setSalvandoQuick] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };

  const carregarDadosDashboard = async () => {
    setLoading(true);
    try {
      const listaProjetos = await fetchProjetos();
      const listaRecebimentos = await fetchRecebimentos();

      setRecebimentos(listaRecebimentos);

      // 1. Calcular Projetos em Andamento
      const andamento = listaProjetos.filter(p => p.status === 'em_andamento').length;
      setProjetosAndamento(andamento);

      // 2. Calcular Previsão de Caixa (15 e 30 dias)
      const previsao = calcularPrevisaoCaixa(listaRecebimentos);
      setCaixa15Dias(previsao.periodo15Dias);
      setCaixa30Dias(previsao.periodo30Dias);

      // 3. Calcular Recebimentos em Atraso (status !== 'pago' e data_prevista < hoje)
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const atrasados = listaRecebimentos.filter(r => {
        const dataPrev = new Date(r.data_prevista);
        return r.status !== 'pago' && dataPrev < hoje;
      });
      
      setRecebimentosAtrasados(atrasados.length);
      const somaAtrasados = atrasados.reduce((acc, curr) => acc + Number(curr.valor), 0);
      setAtrasadosValor(somaAtrasados);

      // 4. Calcular Saúde Financeira de cada projeto (Custos Realizados vs Orçamento Previsto)
      const projetosComFinanceiro: ProjetoComFinanceiro[] = await Promise.all(
        listaProjetos.map(async (p) => {
          const orcamentosObra = await fetchOrcamentosByProjeto(p.id!);
          const custosObra = await fetchCustosRealizadosByProjeto(p.id!);

          const custoPrevisto = orcamentosObra.reduce((acc, curr) => acc + Number(curr.valor_previsto), 0);
          const custoRealizado = custosObra.reduce((acc, curr) => acc + Number(curr.valor), 0);

          let saudePercentual = 0;
          if (custoPrevisto > 0) {
            saudePercentual = (custoRealizado / custoPrevisto) * 100;
          } else if (custoRealizado > 0) {
            saudePercentual = 100; // Se não tem orçamento mas tem custo
          }

          let saudeStatus: 'excelente' | 'alerta' | 'estourado' = 'excelente';
          if (saudePercentual > 100) {
            saudeStatus = 'estourado';
          } else if (saudePercentual > 85) {
            saudeStatus = 'alerta';
          }

          return {
            ...p,
            custoPrevisto,
            custoRealizado,
            saudePercentual,
            saudeStatus
          };
        })
      );

      setProjetos(projetosComFinanceiro);

      // 5. Estruturar dados do Gráfico de Fluxo de Caixa Previsto
      const dadosMensais: Record<string, number> = {};
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      
      const dataGraficoInicial = [];
      const dataAtual = new Date();
      for (let i = 0; i < 6; i++) {
        const d = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + i, 1);
        const mesAno = `${meses[d.getMonth()]}/${d.getFullYear().toString().substr(-2)}`;
        dadosMensais[mesAno] = 0;
      }

      listaRecebimentos.forEach(r => {
        if (r.status !== 'pago') {
          const d = new Date(r.data_prevista);
          const mesAno = `${meses[d.getMonth()]}/${d.getFullYear().toString().substr(-2)}`;
          if (dadosMensais[mesAno] !== undefined) {
            dadosMensais[mesAno] += Number(r.valor);
          }
        }
      });

      const formattedGraficoDados = Object.entries(dadosMensais).map(([name, val]) => ({
        name,
        faturamento: val
      }));

      setGraficoDados(formattedGraficoDados);

    } catch (err) {
      console.error('Erro ao carregar dados do painel:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDadosDashboard();
  }, []);

  const darBaixaRecebimento = async (recebimentoId: string) => {
    try {
      if (!supabase) return;

      const { error } = await supabase
        .from('cronograma_recebimentos')
        .update({
          status: 'pago',
          data_pagamento: new Date().toISOString().split('T')[0]
        })
        .eq('id', recebimentoId);

      if (error) throw error;

      showToast('Recebimento baixado com sucesso!', 'success');
      carregarDadosDashboard();
    } catch (err) {
      console.error('Erro ao baixar parcela:', err);
      showToast('Erro ao processar baixa financeira.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-3 text-desc">
        <Loader2 className="animate-spin text-brand-ocre" size={40} />
        <span className="text-sm font-semibold tracking-wider uppercase">CARREGANDO ERP CONTROL PANEL...</span>
      </div>
    );
  }

  // Obter a lista de parcelas que estão atrasadas para o alerta em vermelho
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const parcelasAtrasadas = recebimentos.filter(r => {
    const dataPrev = new Date(r.data_prevista);
    return r.status !== 'pago' && dataPrev < hoje;
  });

  // Dados para Sparklines de Tendência
  const dataSparkObras = [
    { value: Math.max(0, projetosAndamento - 1) },
    { value: projetosAndamento },
    { value: Math.max(0, projetosAndamento - 1) },
    { value: projetosAndamento + 1 },
    { value: projetosAndamento }
  ];
  const dataSparkAtrasados = [
    { value: recebimentosAtrasados + 2 },
    { value: recebimentosAtrasados + 1 },
    { value: recebimentosAtrasados + 3 },
    { value: recebimentosAtrasados - 1 },
    { value: recebimentosAtrasados }
  ];
  const dataSparkCaixa15 = [
    { value: caixa15Dias * 0.85 },
    { value: caixa15Dias * 0.95 },
    { value: caixa15Dias * 0.9 },
    { value: caixa15Dias * 1.05 },
    { value: caixa15Dias }
  ];
  const dataSparkCaixa30 = [
    { value: caixa30Dias * 0.8 },
    { value: caixa30Dias * 0.9 },
    { value: caixa30Dias * 0.85 },
    { value: caixa30Dias * 1.05 },
    { value: caixa30Dias }
  ];

  // Ações de reordenar widgets
  const moverWidget = (index: number, direcao: 'up' | 'down') => {
    const novaOrdem = [...ordemWidgets];
    const targetIdx = direcao === 'up' ? index - 1 : index + 1;
    if (targetIdx >= 0 && targetIdx < novaOrdem.length) {
      const temp = novaOrdem[index];
      novaOrdem[index] = novaOrdem[targetIdx];
      novaOrdem[targetIdx] = temp;
      setOrdemWidgets(novaOrdem);
    }
  };

  // Manipuladores de Drag and Drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!showConfig) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (!showConfig) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    if (!showConfig) return;
    e.preventDefault();
    if (draggedIndex === null) return;
    
    const novaOrdem = [...ordemWidgets];
    const dragItem = novaOrdem[draggedIndex];
    
    // Remove o item do índice antigo
    novaOrdem.splice(draggedIndex, 1);
    // Insere o item na nova posição
    novaOrdem.splice(index, 0, dragItem);
    
    setOrdemWidgets(novaOrdem);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSalvarQuickCusto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCusto) return;

    const valorNum = parseFloat(quickValor);
    if (isNaN(valorNum) || valorNum <= 0) {
      showToast('Por favor, digite um valor maior que zero.', 'warning');
      return;
    }

    setSalvandoQuick(true);
    try {
      await salvarCustoRealizado({
        projeto_id: quickCusto.projetoId,
        categoria: quickCusto.categoria,
        descricao: `Lançamento Rápido - ${quickCusto.categoriaLabel}`,
        valor: valorNum,
        data_custo: new Date().toISOString().split('T')[0]
      });

      showToast(`Custo de ${quickCusto.categoriaLabel} registrado com sucesso para a obra ${quickCusto.projetoNome}!`, 'success');
      setQuickCusto(null);
      setQuickValor('');
      carregarDadosDashboard();
    } catch (err) {
      console.error('Erro ao salvar custo rápido:', err);
      showToast('Ocorreu um erro ao registrar o custo.', 'error');
    } finally {
      setSalvandoQuick(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* Mensagem informativa caso o Supabase não esteja configurado */}
      {!isSupabaseConfigured && (
        <div className="bg-brand-ocre/10 border border-brand-ocre/20 text-brand-ocre p-4 rounded-xl flex items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>
              <strong>Banco Local Ativo:</strong> As variáveis de ambiente do Supabase não foram preenchidas no `.env.local`. 
              O sistema está operando em modo offline de demonstração (LocalStorage).
            </span>
          </div>
          <span className="bg-brand-ocre/20 px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-widest text-brand-ocre">DEMO MODE</span>
        </div>
      )}

      {/* Cabeçalho do Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-card-border pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-main flex items-center gap-2.5 font-vomzom">
            Painel de Controle <span className="text-brand-ocre text-xs font-semibold border border-brand-ocre/20 bg-brand-ocre/5 px-2.5 py-0.5 rounded-lg uppercase tracking-wider">FINANCEIRO / OPERACIONAL</span>
          </h2>
          <p className="text-sub text-sm mt-1">
            Indicadores consolidados, fluxo de caixa previsto e integridade financeira das obras.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-card-border bg-card text-sub text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-sm"
            title="Configurar Painel"
          >
            <Settings size={14} className="text-brand-ocre" /> Configurar
          </button>
          <Link
            href="/custos"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-card-border bg-card text-sub text-xs font-bold hover:bg-brand-blue hover:text-white dark:hover:bg-brand-ocre dark:hover:text-brand-dark transition-all cursor-pointer shadow-sm"
          >
            <Coins size={14} className="text-brand-ocre" /> Lançar Despesa
          </Link>
          <Link
            href="/projetos/novo"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-ocre text-brand-dark text-xs font-bold hover:bg-brand-ocre/90 transition-all shadow-lg shadow-brand-ocre/10 cursor-pointer"
          >
            <HardHat size={14} /> Nova Obra (OS)
          </Link>
        </div>
      </div>

      {/* Painel Colapsável de Configurações de Widgets (Personalização por Cargo) */}
      {showConfig && (
        <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center border-b border-card-border pb-3">
            <h3 className="text-sm font-bold text-main flex items-center gap-2">
              <Settings size={16} className="text-brand-ocre" /> Configurações de Layout do Painel
            </h3>
            <button onClick={() => setShowConfig(false)} className="p-1 rounded-lg hover:bg-slate-150 dark:hover:bg-zinc-800 text-sub">
              <X size={14} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-sub">
            {/* Checkboxes de Visibilidade */}
            <div className="space-y-3">
              <span className="font-bold text-main uppercase tracking-wider block text-[10px]">Visibilidade dos Blocos</span>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibilidadeWidgets.saudeObras}
                    onChange={(e) => setVisibilidadeWidgets({ ...visibilidadeWidgets, saudeObras: e.target.checked })}
                    className="accent-brand-ocre h-4 w-4"
                  />
                  <span>Saúde Financeira das Obras</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibilidadeWidgets.fluxoCaixa}
                    onChange={(e) => setVisibilidadeWidgets({ ...visibilidadeWidgets, fluxoCaixa: e.target.checked })}
                    className="accent-brand-ocre h-4 w-4"
                  />
                  <span>Faturamento Futuro (Gráfico)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibilidadeWidgets.recebimentosAtrasados}
                    onChange={(e) => setVisibilidadeWidgets({ ...visibilidadeWidgets, recebimentosAtrasados: e.target.checked })}
                    className="accent-brand-ocre h-4 w-4"
                  />
                  <span>Fila de Recebimentos em Atraso</span>
                </label>
              </div>
            </div>

            {/* Ordenação de Widgets */}
            <div className="space-y-3">
              <span className="font-bold text-main uppercase tracking-wider block text-[10px]">Ordem de Exibição</span>
              <div className="space-y-2">
                {ordemWidgets.map((widgetKey, idx) => {
                  const label = widgetKey === 'saudeObras' 
                    ? 'Saúde Financeira das Obras' 
                    : widgetKey === 'fluxoCaixa' 
                    ? 'Faturamento Futuro' 
                    : 'Fila de Recebimentos em Atraso';
                  
                  return (
                    <div key={widgetKey} className="flex items-center justify-between bg-background border border-card-border p-2 rounded-lg">
                      <span className="font-semibold text-main">{label}</span>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={idx === 0}
                          onClick={() => moverWidget(idx, 'up')}
                          className="p-1 rounded bg-card hover:bg-slate-200 dark:hover:bg-zinc-800 disabled:opacity-40"
                        >
                          ▲
                        </button>
                        <button
                          disabled={idx === ordemWidgets.length - 1}
                          onClick={() => moverWidget(idx, 'down')}
                          className="p-1 rounded bg-card hover:bg-slate-200 dark:hover:bg-zinc-800 disabled:opacity-40"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        /* LOADING SKELETONS PULSANTES */
        <div className="space-y-8">
          {/* Grid de 4 KPIs Fictícios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card border border-card-border rounded-2xl p-5 space-y-4 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-28 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                  <div className="h-8 w-8 bg-slate-200 dark:bg-zinc-800 rounded-lg"></div>
                </div>
                <div className="space-y-2 pt-2">
                  <div className="h-8 w-16 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                  <div className="h-3 w-32 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                </div>
                <div className="h-8 w-full bg-slate-200 dark:bg-zinc-800/50 rounded mt-2"></div>
              </div>
            ))}
          </div>

          {/* Grid de Obras e Fluxo de Caixa Fictícios */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-card border border-card-border rounded-2xl p-6 space-y-6 animate-pulse">
              <div className="flex justify-between items-center border-b border-card-border pb-4">
                <div className="h-5 w-48 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                <div className="h-4 w-24 bg-slate-200 dark:bg-zinc-800 rounded"></div>
              </div>
              <div className="space-y-5">
                {[1, 2].map((i) => (
                  <div key={i} className="p-5 bg-background/30 border border-card-border rounded-xl space-y-4">
                    <div className="flex justify-between">
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                        <div className="h-3 w-40 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                      </div>
                      <div className="h-6 w-24 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-full bg-slate-200 dark:bg-zinc-800 rounded"></div>
                      <div className="h-2 w-full bg-slate-200 dark:bg-zinc-800 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6 animate-pulse">
              <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
                <div className="h-5 w-36 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                <div className="h-44 bg-slate-200 dark:bg-zinc-800/30 rounded-xl"></div>
              </div>
              <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
                <div className="h-5 w-40 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                <div className="h-32 bg-slate-200 dark:bg-zinc-800/30 rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CONTEÚDO REAL DO DASHBOARD */
        <>
          {/* Bloco 1: KPIs Principais com Sparklines e Microtendências */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* KPI 1: Obras em Andamento */}
            <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col justify-between hover-card shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sub uppercase tracking-wider">Obras em Andamento</span>
                <div className="h-8 w-8 rounded-lg bg-brand-blue/10 dark:bg-brand-ocre/10 text-brand-blue dark:text-brand-ocre flex items-center justify-center">
                  <HardHat size={16} />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-3xl font-extrabold text-main">{projetosAndamento}</h3>
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-450 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    +1 obra ativa vs mês ant.
                  </span>
                </div>
                <p className="text-[10px] text-desc">Monitoramento de canteiros ativos</p>
                
                {/* Sparkline */}
                <div className="h-8 w-full mt-2 opacity-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dataSparkObras} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                      <Area type="monotone" dataKey="value" stroke="var(--brand-blue)" fill="var(--brand-blue)" fillOpacity={0.05} strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* KPI 2: Alertas de Recebimentos em Atraso */}
            <div className={`border rounded-2xl p-5 flex flex-col justify-between transition-all shadow-sm ${
              recebimentosAtrasados > 0 
                ? 'bg-red-500/5 border-red-500/20' 
                : 'bg-card border-card-border hover-card'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${recebimentosAtrasados > 0 ? 'text-red-500 dark:text-red-400' : 'text-sub'}`}>
                  Recebimentos Atrasados
                </span>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  recebimentosAtrasados > 0 ? 'bg-red-500/10 text-red-500 dark:text-red-400' : 'bg-brand-blue/10 dark:bg-brand-ocre/10 text-brand-blue dark:text-brand-ocre'
                }`}>
                  <AlertCircle size={16} />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <h3 className={`text-3xl font-extrabold ${recebimentosAtrasados > 0 ? 'text-red-500 dark:text-red-400' : 'text-main'}`}>
                    {recebimentosAtrasados}
                  </h3>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    recebimentosAtrasados > 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-600'
                  }`}>
                    {recebimentosAtrasados > 0 ? '-2 parcelas vs mês ant.' : 'Em dia'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-sub flex items-center gap-1">
                  {recebimentosAtrasados > 0 ? (
                    <>Total: <ValorPremium valor={atrasadosValor} size="xs" colorClass="text-red-500 dark:text-red-400" /></>
                  ) : (
                    'Faturamento em dia'
                  )}
                </div>

                {/* Sparkline */}
                <div className="h-8 w-full mt-2 opacity-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dataSparkAtrasados} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={recebimentosAtrasados > 0 ? '#ef4444' : 'var(--brand-blue)'} 
                        fill={recebimentosAtrasados > 0 ? '#ef4444' : 'var(--brand-blue)'} 
                        fillOpacity={0.05} 
                        strokeWidth={1.5} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* KPI 3: Previsão de Caixa (15 Dias) */}
            <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col justify-between hover-card shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sub uppercase tracking-wider">Projeção Caixa (15 Dias)</span>
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Calendar size={16} />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <ValorPremium valor={caixa15Dias} size="xl" colorClass="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-450 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    +12.4% vs mês ant.
                  </span>
                </div>
                <p className="text-[10px] text-desc">Recebimentos previstos em 15d</p>

                {/* Sparkline */}
                <div className="h-8 w-full mt-2 opacity-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dataSparkCaixa15} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                      <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.05} strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* KPI 4: Previsão de Caixa (30 Dias) */}
            <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col justify-between hover-card shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sub uppercase tracking-wider">Projeção Caixa (30 Dias)</span>
                <div className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <ValorPremium valor={caixa30Dias} size="xl" colorClass="text-sky-600 dark:text-sky-400" />
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-450 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    +8.2% vs mês ant.
                  </span>
                </div>
                <p className="text-[10px] text-desc">Recebimentos acumulados em 30d</p>

                {/* Sparkline */}
                <div className="h-8 w-full mt-2 opacity-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dataSparkCaixa30} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                      <Area type="monotone" dataKey="value" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.05} strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>

          {/* Renderização Dinâmica e Reordenável dos Widgets */}
          <div className="space-y-8">
            {ordemWidgets.map((widgetKey, idx) => {
              const isVisible = visibilidadeWidgets[widgetKey as keyof typeof visibilidadeWidgets];
              if (!isVisible) return null;

              let widgetContent = null;

              if (widgetKey === 'saudeObras') {
                widgetContent = (
                  <div className="bg-card border border-card-border rounded-2xl p-6 space-y-6 shadow-sm">
                    <div className="flex items-center justify-between border-b border-card-border pb-4">
                      <div>
                        <h3 className="text-lg font-bold text-main flex items-center gap-2 font-vomzom">
                          Saúde Financeira das Obras
                        </h3>
                        <p className="text-xs text-sub mt-1">
                          Comparativo de Custos Efetivos Lançados contra o Orçamento Planejado.
                        </p>
                      </div>
                      <span className="text-xs text-desc font-semibold">{projetos.length} obras cadastradas</span>
                    </div>

                    {projetos.length === 0 ? (
                      <div className="text-center py-16 border border-dashed border-card-border rounded-2xl">
                        <p className="text-sm text-desc mb-4">Nenhuma obra cadastrada para avaliação financeira.</p>
                        <Link 
                          href="/projetos/novo"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-ocre text-brand-dark text-xs font-bold hover:bg-brand-ocre/90 transition-all shadow-lg"
                        >
                          Cadastrar Obra e Orçamento
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {projetos.map((proj) => {
                          const estouro = proj.custoRealizado > proj.custoPrevisto;
                          const temCustos = proj.custoRealizado > 0;
                          
                          return (
                            <div 
                              key={proj.id} 
                              className="p-5 rounded-xl bg-background/30 border border-card-border hover-card hover:border-brand-ocre/20 transition-all shadow-xs space-y-4"
                            >
                              
                              {/* Linha 1: Dados do Projeto e Ícones Rápidos */}
                              <div className="flex items-start justify-between flex-wrap gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold text-brand-ocre bg-brand-ocre/10 px-2.5 py-0.5 rounded-md uppercase tracking-wider border border-brand-ocre/20">
                                      {proj.os}
                                    </span>
                                    <Link 
                                      href={`/custos?projetoId=${proj.id}`}
                                      className="text-[10px] font-bold text-brand-blue hover:text-brand-blue/85 dark:text-brand-ocre dark:hover:text-brand-ocre/85 hover:underline flex items-center gap-1 transition-colors"
                                    >
                                      + Lançar Custo
                                    </Link>
                                    <span className="text-[10px] text-desc">•</span>
                                    <Link 
                                      href={`/projetos/editar?id=${proj.id}`}
                                      className="text-[10px] font-bold text-brand-blue hover:text-brand-blue/85 dark:text-brand-ocre dark:hover:text-brand-ocre/85 hover:underline flex items-center gap-1 transition-colors"
                                    >
                                      Editar Obra
                                    </Link>
                                  </div>
                                  <Link
                                    href={`/projetos/editar?id=${proj.id}`}
                                    className="text-base font-bold text-main hover:text-brand-blue dark:hover:text-brand-ocre hover:underline block transition-colors font-vomzom"
                                    title="Clique para editar esta obra"
                                  >
                                    {proj.nome}
                                  </Link>
                                  <p className="text-xs text-sub">{proj.logradouro}, {proj.numero} - {proj.cidade}/{proj.uf}</p>
                                </div>

                                {/* Ícones de Lançamento Rápido */}
                                <div className="space-y-1.5">
                                  <span className="text-[9px] text-desc font-bold uppercase tracking-wider block text-right md:text-left">Lançamento Rápido</span>
                                  <div className="flex flex-wrap items-center gap-1 bg-background/50 border border-card-border p-1 rounded-lg">
                                    {Object.entries(CATEGORIAS_CUSTO_LABELS).map(([cat, label]) => {
                                      const CATEGORIAS_ICONS: Record<string, React.ComponentType<any>> = {
                                        insumos: Package,
                                        mao_de_obra: HardHat,
                                        empreiteiros: Users,
                                        ferramentas: Wrench,
                                        locacoes: Key,
                                        logistica: Truck,
                                        administrativo: FileText,
                                        alimentacao: Utensils,
                                        outros: MoreHorizontal
                                      };
                                      const Icon = CATEGORIAS_ICONS[cat] || Coins;
                                      return (
                                        <button
                                          key={cat}
                                          type="button"
                                          onClick={() => {
                                            if (cat === 'mao_de_obra' || cat === 'empreiteiros') {
                                              window.location.href = `/rh/pagamentos-parceiros?projeto_id=${proj.id}`;
                                            } else {
                                              setQuickCusto({
                                                projetoId: proj.id!,
                                                projetoNome: proj.nome,
                                                categoria: cat as CategoriaCusto,
                                                categoriaLabel: label
                                              });
                                            }
                                          }}
                                          title={`Lançamento Rápido: ${label}`}
                                          className="p-1.5 rounded hover:bg-brand-blue/10 dark:hover:bg-brand-ocre/10 text-desc hover:text-brand-blue dark:hover:text-brand-ocre transition-all cursor-pointer"
                                        >
                                          <Icon size={12} className="shrink-0" />
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                
                                <div className="text-right">
                                  <span className="text-[10px] text-desc font-bold uppercase tracking-wider block">Valor do Contrato</span>
                                  <ValorPremium valor={Number(proj.valor_total_contrato)} size="sm" colorClass="text-brand-blue dark:text-brand-ocre" />
                                </div>
                              </div>

                              {/* Linha 2: Saúde do Custo (Barra de Progresso ou Empty-State) */}
                              {!temCustos ? (
                                /* EMPTY-STATE PREMIUM PARA OBRA SEM CUSTO (Ex: Belle Vue) */
                                <div className="border border-dashed border-card-border bg-background/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                                  <div className="space-y-0.5">
                                    <span className="text-xs font-bold text-main flex items-center gap-1.5 justify-center sm:justify-start">
                                      <CheckCircle size={14} className="text-emerald-500" /> Saúde Controlada
                                    </span>
                                    <p className="text-[11px] text-desc">Nenhum custo efetivo lançado nesta obra.</p>
                                  </div>
                                  <Link
                                    href={`/custos?projetoId=${proj.id}&categoria=insumos`}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-ocre/10 hover:bg-brand-ocre/20 text-brand-ocre text-[10px] font-black uppercase tracking-wider transition-colors border border-brand-ocre/25"
                                  >
                                    + Lançar primeiro custo
                                  </Link>
                                </div>
                              ) : (
                                /* PROCESSO REAL */
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-xs items-center">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sub">Custos Realizados:</span>
                                      <strong className={estouro ? 'text-red-500 dark:text-red-400' : 'text-main'}>
                                        <ValorPremium valor={proj.custoRealizado} size="xs" />
                                      </strong>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-desc">Teto Planejado:</span>
                                      <strong className="text-sub">
                                        <ValorPremium valor={proj.custoPrevisto} size="xs" />
                                      </strong>
                                    </div>
                                  </div>

                                  {/* Barra de Progresso Real/Previsto */}
                                  <div className="h-2.5 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden flex border border-card-border">
                                    <div 
                                      style={{ width: `${Math.min(100, proj.saudePercentual)}%` }} 
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        proj.saudeStatus === 'estourado'
                                          ? 'bg-red-500'
                                          : proj.saudeStatus === 'alerta'
                                          ? 'bg-brand-ocre'
                                          : 'bg-emerald-500'
                                      }`}
                                    />
                                  </div>

                                  {/* Rótulo de Alerta de Saúde */}
                                  <div className="flex justify-between items-center text-[9px] font-bold">
                                    <span className="text-desc uppercase">CONSUMO DO ORÇAMENTO: {proj.saudePercentual.toFixed(0)}%</span>
                                    {proj.saudeStatus === 'estourado' && (
                                      <span className="text-red-500 dark:text-red-400 flex items-center gap-1">
                                        <AlertCircle size={10} /> ORÇAMENTO ESTOURADO
                                      </span>
                                    )}
                                    {proj.saudeStatus === 'alerta' && (
                                      <span className="text-brand-ocre flex items-center gap-1">
                                        <AlertTriangle size={10} /> ATENÇÃO: LIMITE DE PREVISÃO
                                      </span>
                                    )}
                                    {proj.saudeStatus === 'excelente' && (
                                      <span className="text-emerald-600 dark:text-emerald-450 flex items-center gap-1">
                                        <CheckCircle size={10} /> CUSTO CONTROLADO
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              if (widgetKey === 'fluxoCaixa') {
                widgetContent = (
                  <div className="bg-card border border-card-border rounded-2xl p-6 space-y-4 shadow-sm">
                    <div>
                      <h3 className="text-lg font-bold text-main flex items-center gap-2 font-vomzom">
                        Faturamento Futuro
                      </h3>
                      <p className="text-xs text-sub">
                        Recebimentos previstos consolidando os próximos 6 meses de vencimento.
                      </p>
                    </div>
                    
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={graficoDados} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" strokeOpacity={0.5} vertical={false} />
                          <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                          <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                            labelStyle={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 'bold' }}
                            itemStyle={{ color: 'var(--brand-ocre)', fontSize: '11px', fontWeight: 'bold' }}
                            formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'A Receber']}
                          />
                          <Bar dataKey="faturamento" fill="var(--brand-ocre)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              }

              if (widgetKey === 'recebimentosAtrasados') {
                widgetContent = (
                  <div className="bg-card border border-card-border rounded-2xl p-6 space-y-4 shadow-sm">
                    <div>
                      <h3 className="text-lg font-bold text-main flex items-center gap-2 font-vomzom">
                        Fila de Recebimentos em Atraso
                      </h3>
                      <p className="text-xs text-sub">
                        Parcelas vencidas com cobrança ativa e fluxo de baixa de dois cliques.
                      </p>
                    </div>

                    {parcelasAtrasadas.length === 0 ? (
                      <div className="text-center py-8 bg-background/50 rounded-xl border border-card-border">
                        <span className="text-xs text-desc font-semibold flex items-center justify-center gap-1.5">
                          <CheckCircle size={14} className="text-emerald-500" /> Tudo em dia! Sem inadimplência ativa.
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-1">
                        {parcelasAtrasadas.map((r) => {
                          const obraAssociada = projetos.find(p => p.id === r.projeto_id);
                          const diasAtraso = Math.floor((hoje.getTime() - new Date(r.data_prevista).getTime()) / (1000 * 3600 * 24));
                          
                          return (
                            <div 
                              key={r.id} 
                              className="p-4 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between text-xs gap-3 group transition-all"
                            >
                              <div className="space-y-1">
                                <div className="font-extrabold text-main leading-snug">
                                  {obraAssociada ? obraAssociada.nome : 'Obra Desconhecida'}
                                </div>
                                <div className="text-[10px] text-desc flex items-center gap-2">
                                  <span>Parc #{r.parcela_numero}</span>
                                  <span>•</span>
                                  <span className="text-red-500 dark:text-red-400 font-bold">Vencida há {diasAtraso} dias</span>
                                </div>
                                <div className="pt-1 flex items-baseline">
                                  <ValorPremium valor={Number(r.valor)} size="sm" colorClass="text-red-500 dark:text-red-400" />
                                </div>
                              </div>
                              
                              {/* Botão de Confirmação Inline */}
                              <ConfirmButton
                                onConfirm={() => darBaixaRecebimento(r.id!)}
                                label="Baixar"
                                confirmLabel="Confirmar?"
                                className="px-3 py-1.5 rounded-lg border border-card-border bg-background hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-sub font-bold text-[10px] transition-all cursor-pointer shadow-2xs shrink-0"
                                confirmClassName="bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                                title="Marcar Parcela como Recebida"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              if (!widgetContent) return null;

              return (
                <div
                  key={widgetKey}
                  draggable={showConfig}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`relative transition-all duration-300 ${
                    showConfig 
                      ? 'border-2 border-dashed border-brand-ocre/45 bg-slate-50/20 dark:bg-zinc-900/10 p-2.5 rounded-3xl cursor-move shadow-md hover:border-brand-ocre hover:bg-slate-50/40 dark:hover:bg-zinc-900/30' 
                      : ''
                  } ${draggedIndex === idx ? 'opacity-40 scale-[0.98]' : ''}`}
                >
                  {showConfig && (
                    <div className="flex items-center justify-between mb-3 px-4 py-2 bg-brand-ocre/5 border border-brand-ocre/10 rounded-xl select-none">
                      <span className="text-[10px] font-bold text-brand-ocre uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowDownUp size={11} /> Clique e arraste este bloco para reordenar
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setVisibilidadeWidgets(prev => ({ 
                            ...prev, 
                            [widgetKey]: false 
                          }));
                        }}
                        className="p-1 rounded-md bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all cursor-pointer shadow-sm border border-red-500/20 flex items-center justify-center"
                        title="Ocultar Widget"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  {widgetContent}
                </div>
              );
            })}
          </div>
        </>
      )}
      {/* Modal de Lançamento Rápido de Custos */}
      {quickCusto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-main font-vomzom flex items-center gap-2">
                <Coins size={20} className="text-brand-ocre" /> Lançar Custo Rápido
              </h3>
              <p className="text-[11px] text-desc uppercase tracking-wider font-semibold">
                {quickCusto.projetoNome} &bull; {quickCusto.categoriaLabel}
              </p>
            </div>

            <form onSubmit={handleSalvarQuickCusto} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-sub">
                  Valor do Custo (R$) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-desc text-xs font-bold pointer-events-none">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    placeholder="0.00"
                    value={quickValor}
                    onChange={(e) => setQuickValor(e.target.value)}
                    className="w-full bg-background border border-card-border rounded-xl pl-8 pr-4 py-2.5 text-main text-sm focus:outline-none focus:border-brand-ocre"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuickCusto(null);
                    setQuickValor('');
                  }}
                  className="px-4 py-2 rounded-xl border border-card-border hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-bold text-sub cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoQuick}
                  className="px-5 py-2 rounded-xl bg-brand-ocre text-brand-dark hover:bg-brand-ocre/90 text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {salvandoQuick ? (
                    <>
                      <Loader2 className="animate-spin" size={14} /> Salvando...
                    </>
                  ) : (
                    'Confirmar Custo'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

    </div>
  );
}
