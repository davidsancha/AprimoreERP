'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  HardHat, 
  Plus, 
  Search, 
  Edit, 
  Coins, 
  Trash2, 
  MapPin, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle, 
  Loader2,
  Filter,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  Package,
  Wrench,
  Key,
  Truck,
  FileText,
  Users,
  Utensils,
  MoreHorizontal,
  Calculator,
  TrendingUp,
  Camera
} from 'lucide-react';
import { fetchProjetos, fetchOrcamentosByProjeto, fetchCustosRealizadosByProjeto, deletarProjeto, salvarCustoRealizado } from '@/modules/operacional/services/apiProjetos';
import { fetchRecebimentosByProjeto } from '@/modules/financeiro/services/apiFinanceiro';
import { isSupabaseConfigured } from '@/shared/lib/supabaseClient';
import { Projeto, CategoriaCusto, CATEGORIAS_CUSTO_LABELS } from '@/modules/operacional/types';
import ValorPremium from '@/shared/components/ValorPremium';
import ConfirmButton from '@/shared/components/ConfirmButton';
import Toast, { ToastType } from '@/shared/components/Toast';
import DespesaDetalhesModal from '@/modules/operacional/components/DespesaDetalhesModal';
import { CustoRealizado } from '@/modules/operacional/types';


interface ProjetoComFinanceiro extends Projeto {
  custoPrevisto: number;
  custoRealizado: number;
  saudeStatus: 'excelente' | 'alerta' | 'estourado';
  saudePercentual: number;
  orcamentosObra?: any[];
  custosObra?: any[];
  valorRecebido: number;
  pctRecebido: number;
}

export default function ProjetosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projetos, setProjetos] = useState<ProjetoComFinanceiro[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('em_andamento');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [expandedProjetoId, setExpandedProjetoId] = useState<string | null>(null);

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

  // Modal de Detalhes da Despesa
  const [selectedCusto, setSelectedCusto] = useState<CustoRealizado | null>(null);
  const [isCustoModalOpen, setIsCustoModalOpen] = useState(false);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };

  const carregarProjetos = async () => {
    setLoading(true);
    try {
      const listaProjetos = await fetchProjetos();
      
      const projetosComFinanceiro: ProjetoComFinanceiro[] = await Promise.all(
        listaProjetos.map(async (p) => {
          const orcamentosObra = await fetchOrcamentosByProjeto(p.id!);
          const custosObra = await fetchCustosRealizadosByProjeto(p.id!);
          const recebimentosObra = await fetchRecebimentosByProjeto(p.id!);

          const custoPrevisto = orcamentosObra.reduce((acc, curr) => acc + Number(curr.valor_previsto), 0);
          const custoRealizado = custosObra.reduce((acc, curr) => acc + Number(curr.valor), 0);

          const valorRecebido = recebimentosObra
            .filter((r: any) => r.status === 'pago')
            .reduce((acc: number, curr: any) => acc + Number(curr.valor), 0);

          const valorContrato = Number(p.valor_total_contrato);
          const pctRecebido = valorContrato > 0 ? (valorRecebido / valorContrato) * 100 : 0;

          let saudePercentual = 0;
          if (custoPrevisto > 0) {
            saudePercentual = (custoRealizado / custoPrevisto) * 100;
          } else if (custoRealizado > 0) {
            saudePercentual = 100;
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
            saudeStatus,
            orcamentosObra,
            custosObra,
            valorRecebido,
            pctRecebido
          };
        })
      );

      setProjetos(projetosComFinanceiro);
    } catch (err) {
      console.error('Erro ao buscar lista de projetos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarProjetos();
  }, []);

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

      showToast(`Custo de ${quickCusto.categoriaLabel} registrado com sucesso para o projeto ${quickCusto.projetoNome}!`, 'success');
      setQuickCusto(null);
      setQuickValor('');
      carregarProjetos();
    } catch (err) {
      console.error('Erro ao salvar custo rápido:', err);
      showToast('Ocorreu um erro ao registrar o custo.', 'error');
    } finally {
      setSalvandoQuick(false);
    }
  };

  const handleExcluir = async (id: string) => {
    try {
      await deletarProjeto(id);
      showToast('Projeto excluído com sucesso.', 'success');
      carregarProjetos();
    } catch (err) {
      console.error('Erro ao deletar projeto:', err);
      showToast('Houve um erro ao processar a exclusão do projeto.', 'error');
    }
  };

  // Filtrar projetos com base na busca textual e seletor de status
  const projetosFiltrados = projetos.filter(p => {
    const atendeBusca = p.nome.toLowerCase().includes(busca.toLowerCase()) || 
                        p.os.toLowerCase().includes(busca.toLowerCase()) ||
                        p.cidade.toLowerCase().includes(busca.toLowerCase());
                        
    const atendeStatus = filtroStatus === 'todos' || p.status === filtroStatus;
    
    return atendeBusca && atendeStatus;
  });

  return (
    <div className="space-y-8 pb-12">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-card-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-main flex items-center gap-2 font-vomzom">
            Gestão de Projetos <span className="text-brand-blue dark:text-brand-ocre text-[10px] font-semibold border border-brand-ocre/20 bg-brand-blue/5 dark:bg-brand-ocre/5 px-2 py-0.5 rounded-lg uppercase tracking-wider">VISUALIZADOR COMPLETO</span>
          </h2>
          <p className="text-sub text-xs mt-0.5">
            Pesquisa avançada, análise física/financeira e controle total do ciclo de vida dos projetos.
          </p>
        </div>
        <div>
          <Link
            href="/projetos/novo"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-ocre text-brand-dark text-xs font-bold hover:bg-brand-ocre/90 transition-all shadow-lg shadow-brand-ocre/10 cursor-pointer"
          >
            <Plus size={15} /> Cadastrar Novo Projeto (OS)
          </Link>
        </div>
      </div>

      {/* Painel de Busca e Filtros */}
      <div className="bg-card border border-card-border rounded-2xl p-4 flex flex-col xl:flex-row gap-3.5 items-center justify-between shadow-xs">
        
        {/* Input de busca */}
        <div className="relative w-full xl:w-80">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-desc">
            <Search size={14} />
          </div>
          <input
            type="text"
            placeholder="Buscar por nome, OS ou cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-background border border-card-border rounded-lg pl-8 pr-3.5 py-1.5 text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-ocre focus:ring-1 focus:ring-brand-ocre transition-all"
          />
        </div>

        {/* Abas de Status */}
        <div className="flex flex-wrap items-center gap-1.5 w-full xl:w-auto">
          <span className="text-[10px] text-desc font-bold flex items-center gap-1 mr-1.5 uppercase tracking-wider">
            <Filter size={11} /> Filtrar status:
          </span>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'planejado', label: 'Planejados' },
            { id: 'em_andamento', label: 'Em Andamento' },
            { id: 'concluido', label: 'Concluídos' },
            { id: 'suspenso', label: 'Suspensos' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFiltroStatus(tab.id)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                filtroStatus === tab.id
                  ? 'bg-brand-blue text-white dark:bg-brand-ocre dark:text-brand-dark shadow-xs'
                  : 'bg-background hover:bg-slate-100 dark:hover:bg-white/[0.02] border border-card-border text-sub'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Alternador de Visualização (Grade vs Lista) */}
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

      {/* Listagem de Projetos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-3 text-desc">
          <Loader2 className="animate-spin text-brand-ocre" size={36} />
          <span className="text-xs font-bold tracking-wider uppercase">CARREGANDO LISTAGEM DE PROJETOS...</span>
        </div>
      ) : projetosFiltrados.length === 0 ? (
        <div className="text-center py-20 bg-card border border-card-border border-dashed rounded-2xl">
          <HardHat size={40} className="mx-auto text-desc opacity-50 mb-3" />
          <p className="text-sm font-semibold text-main">Nenhum projeto localizado.</p>
          <p className="text-xs text-sub mt-1">Tente ajustar seus filtros de busca ou cadastre um novo projeto para começar.</p>
          {busca || filtroStatus !== 'todos' ? (
            <button
              onClick={() => { setBusca(''); setFiltroStatus('todos'); }}
              className="mt-4 px-4 py-2 rounded-xl border border-card-border bg-card text-xs font-bold text-sub hover:bg-slate-100 dark:hover:bg-white/[0.02] transition-all cursor-pointer"
            >
              Limpar Filtros
            </button>
          ) : (
            <Link
              href="/projetos/novo"
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-brand-ocre text-brand-dark text-xs font-bold hover:bg-brand-ocre/90 transition-all shadow-lg"
            >
              Cadastrar Projeto
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* VISUALIZAÇÃO EM GRADE (CARDS) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projetosFiltrados.map((proj) => {
            const estouro = proj.custoRealizado > proj.custoPrevisto;
            
            return (
              <div 
                key={proj.id}
                className="bg-card border border-card-border rounded-2xl p-4.5 hover-card shadow-xs flex flex-col justify-between"
              >
                <div>
                  {/* Linha Superior: OS, Badge Status e Ações */}
                  <div className="flex items-center justify-between border-b border-card-border pb-2.5 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-brand-ocre bg-brand-ocre/10 px-1.5 py-0.5 rounded border border-brand-ocre/20 uppercase tracking-wide">
                        {proj.os}
                      </span>
                      {proj.tipologia && (
                        <span className="text-xs font-bold text-brand-blue dark:text-brand-ocre bg-brand-blue/10 dark:bg-brand-ocre/10 px-1.5 py-0.5 rounded border border-brand-blue/20 dark:border-brand-ocre/20 uppercase tracking-wide">
                          {proj.tipologia}
                        </span>
                      )}
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                        proj.status === 'em_andamento'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : proj.status === 'concluido'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : proj.status === 'planejado'
                          ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                          : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                      }`}>
                        {proj.status === 'em_andamento' ? 'Em Andamento' : proj.status === 'concluido' ? 'Concluída' : proj.status === 'planejado' ? 'Planejada' : 'Suspensa'}
                      </span>
                    </div>

                    {/* Botões de Ações Rápidas */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/engenharia/relatorio-fotografico?projetoId=${proj.id}`}
                        className="p-2 rounded-lg border border-card-border bg-background hover:bg-brand-blue hover:text-white dark:hover:bg-brand-ocre dark:hover:text-brand-dark text-desc transition-colors shadow-xs cursor-pointer"
                        title="Relatório Fotográfico da Obra"
                      >
                        <Camera size={13} />
                      </Link>
                      <Link
                        href={`/projetos/editar?id=${proj.id}`}
                        className="p-2 rounded-lg border border-card-border bg-background hover:bg-brand-blue hover:text-white dark:hover:bg-brand-ocre dark:hover:text-brand-dark text-desc transition-colors shadow-xs cursor-pointer"
                        title="Editar Projeto"
                      >
                        <Edit size={13} />
                      </Link>
                      <Link
                        href={`/custos?projetoId=${proj.id}`}
                        className="p-2 rounded-lg border border-card-border bg-background hover:bg-brand-blue hover:text-white dark:hover:bg-brand-ocre dark:hover:text-brand-dark text-desc transition-colors shadow-xs cursor-pointer"
                        title="Lançar Custo"
                      >
                        <Coins size={13} />
                      </Link>
                      <ConfirmButton
                        onConfirm={() => handleExcluir(proj.id!)}
                        confirmLabel="Confirmar?"
                        icon={Trash2}
                        className="p-2 rounded-lg border border-card-border bg-background hover:bg-red-500/10 text-desc hover:text-red-500 transition-colors shadow-xs cursor-pointer"
                        confirmClassName="bg-red-500 text-white border-red-600 hover:bg-red-600 p-2"
                        title="Excluir Projeto"
                      />
                    </div>
                  </div>

                  {/* Nome do Projeto e Endereço */}
                  <div className="space-y-1.5">
                    <Link
                      href={`/projetos/editar?id=${proj.id}`}
                      className="text-base font-bold text-main hover:text-brand-ocre dark:hover:text-brand-ocre transition-colors hover:underline block font-vomzom"
                    >
                      {proj.nome}
                    </Link>
                    
                    <div className="flex items-start gap-1 text-xs text-desc leading-relaxed">
                      <MapPin size={12} className="text-brand-ocre shrink-0 mt-0.5" />
                      <span>
                        {proj.logradouro}, {proj.numero} {proj.complemento && `(${proj.complemento})`} - {proj.bairro}, {proj.cidade}/{proj.uf}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes de Cronograma */}
                  <div className="grid grid-cols-2 gap-3 border-t border-b border-card-border py-2.5 my-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-desc font-medium block">Previsão de Início</span>
                      <span className="text-main font-semibold flex items-center gap-1">
                        <Calendar size={12} className="text-brand-blue dark:text-brand-ocre" />
                        {new Date(proj.data_prevista_inicio).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-desc font-medium block">Previsão de Término</span>
                      <span className="text-main font-semibold flex items-center gap-1">
                        <Calendar size={12} className="text-brand-blue dark:text-brand-ocre" />
                        {new Date(proj.data_prevista_termino).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes Financeiros */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-desc font-medium">Contrato Total</span>
                      <ValorPremium valor={Number(proj.valor_total_contrato)} size="sm" />
                    </div>

                    {/* Indicador de Metas */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-desc flex items-center gap-0.5">Realizado: <strong className={estouro ? 'text-red-500' : 'text-main'}><ValorPremium valor={proj.custoRealizado} size="sm" /></strong></span>
                        <span className="text-desc flex items-center gap-0.5">Planejado: <strong><ValorPremium valor={proj.custoPrevisto} size="sm" /></strong></span>
                      </div>
                      
                      {/* Barra de Progresso Financeira */}
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden flex border border-card-border">
                        <div 
                          style={{ width: `${Math.min(100, proj.saudePercentual)}%` }} 
                          className="h-full rounded-full transition-all duration-350 bg-emerald-600"/>
                      </div>

                      {/* Saúde Financeira Label */}
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-desc uppercase">Recebido: R$ {proj.valorRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({proj.pctRecebido.toFixed(0)}%)</span>
                        {proj.saudeStatus === 'estourado' ? (
                          <span className="text-red-500 flex items-center gap-0.5">
                            <AlertCircle size={10} /> ORÇAMENTO ESTOURADO
                          </span>
                        ) : proj.saudeStatus === 'alerta' ? (
                          <span className="text-brand-ocre flex items-center gap-0.5">
                            <AlertTriangle size={10} /> LIMITE DE PREVISÃO
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-450 flex items-center gap-0.5">
                            <CheckCircle size={10} /> CUSTO CONTROLADO
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Atalhos Rápidos de Lançamentos */}
                  <div className="border-t border-card-border pt-3 mt-3 space-y-1.5">
                    <span className="text-xs text-desc font-bold uppercase tracking-wider block">Lançamento Rápido por Categoria</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Entradas */}
                      <button
                        type="button"
                        onClick={() => router.push(`/recebimentos?projeto_id=${proj.id}`)}
                        title="Lançar Recebimento (Entrada)"
                        className="p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40 text-emerald-600 transition-all flex items-center justify-center shadow-2xs cursor-pointer"
                      >
                        <TrendingUp size={14} className="shrink-0" />
                      </button>
                      <div className="w-[1px] h-6 bg-card-border/50 mx-1"></div>
                      
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
                                router.push(`/rh/pagamentos-parceiros?projeto_id=${proj.id}`);
                              } else {
                                router.push(`/custos?projetoId=${proj.id}&categoria=${cat}`);
                              }
                            }}
                            title={`Lançamento Rápido: ${label}`}
                            className="p-2 rounded-lg border border-card-border bg-background hover:bg-brand-blue/5 hover:border-brand-blue/30 dark:hover:bg-brand-ocre/5 dark:hover:border-brand-ocre/30 text-desc hover:text-brand-blue dark:hover:text-brand-ocre transition-all flex items-center justify-center shadow-2xs cursor-pointer"
                          >
                            <Icon size={14} className="shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Últimas Despesas (Adicionado para mobile/grid) */}
                  <div className="border-t border-card-border pt-3 mt-3">
                    <span className="text-xs text-desc font-bold uppercase tracking-wider block mb-2">Últimas Despesas</span>
                    <div className="bg-slate-500/5 dark:bg-white/[0.01] border border-card-border/60 rounded-xl overflow-hidden">
                      {(() => {
                        const custosRecentes = [...(proj.custosObra || [])]
                          .sort((a, b) => new Date(b.data_custo).getTime() - new Date(a.data_custo).getTime())
                          .slice(0, 3);

                        if (custosRecentes.length === 0) {
                          return (
                            <div className="p-3 text-center text-[11px] text-desc font-semibold">
                              Nenhuma despesa lançada.
                            </div>
                          );
                        }

                        return (
                          <div className="divide-y divide-card-border/50 text-[11px]">
                            {custosRecentes.map((c, i) => (
                              <div 
                                key={i} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCusto(c as CustoRealizado);
                                  setIsCustoModalOpen(true);
                                }}
                                className="flex justify-between items-center p-2 hover:bg-slate-500/10 transition-colors cursor-pointer"
                              >
                                <div className="space-y-0.5 text-left min-w-0">
                                  <span className="font-bold text-main block truncate">
                                    {CATEGORIAS_CUSTO_LABELS[c.categoria as CategoriaCusto] || c.categoria}
                                  </span>
                                  <span className="text-[10px] text-desc block font-medium">
                                    {new Date(c.data_custo).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                                <span className="font-bold text-red-500 shrink-0 ml-2">
                                  - R$ {Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISUALIZAÇÃO EM LISTA (TABELA COM EXPANSÃO) */
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse block md:table">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-card-border bg-slate-50 dark:bg-zinc-900/50 text-xs font-bold text-desc uppercase tracking-wider">
                  <th className="py-3 px-5 w-32">OS</th>
                  <th className="py-3 px-4 min-w-[400px]">Projeto</th>
                  <th className="py-3 px-4 w-24">Tipologia</th>
                  <th className="py-3 px-4 w-48">Cidade/UF</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right w-32">Contrato</th>
                  <th className="py-3 px-4 text-right w-32">Recebido</th>
                  <th className="py-3 px-5 text-center w-32">Ações</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group divide-y divide-card-border">
                {projetosFiltrados.map((proj) => {
                  const isExpanded = expandedProjetoId === proj.id;
                  const estouro = proj.custoRealizado > proj.custoPrevisto;
                  
                  return (
                    <React.Fragment key={proj.id}>
                      {/* Linha Principal */}
                      <tr 
                        onClick={() => setExpandedProjetoId(isExpanded ? null : proj.id!)}
                        className={`hover:bg-slate-50/50 dark:hover:bg-zinc-855/20 cursor-pointer transition-colors text-xs font-semibold text-main flex flex-col md:table-row relative pb-3 md:pb-0 ${
                          isExpanded ? 'bg-slate-50/30 dark:bg-zinc-900/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 md:py-3 md:px-5 font-bold text-brand-ocre text-xs flex justify-between items-center md:table-cell">
                          <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">OS</span>
                          <span>{proj.os}</span>
                        </td>
                        <td className="py-2.5 px-3 md:py-3 md:px-4 text-xs flex justify-between items-center md:table-cell">
                          <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Projeto</span>
                          <div className="flex items-center gap-1.5 justify-end md:justify-start">
                            <div className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-zinc-700">
                              {isExpanded ? <ChevronUp size={12} className="text-desc" /> : <ChevronDown size={12} className="text-desc" />}
                            </div>
                            <span className="font-bold hover:text-brand-ocre transition-colors font-vomzom text-right md:text-left">{proj.nome}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 md:py-3 md:px-4 text-xs flex justify-between items-center md:table-cell">
                          <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Tipologia</span>
                          <span>{proj.tipologia || 'Residencial'}</span>
                        </td>
                        <td className="py-2.5 px-3 md:py-3 md:px-4 w-full md:w-48 text-xs flex justify-between items-center md:table-cell">
                          <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Cidade/UF</span>
                          <span className="text-right md:text-left">{proj.cidade}/{proj.uf}</span>
                        </td>
                        <td className="py-2.5 px-3 md:py-3 md:px-4 text-xs flex justify-between items-center md:table-cell whitespace-nowrap">
                          <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Status</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap ${
                            proj.status === 'em_andamento'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : proj.status === 'concluido'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : proj.status === 'planejado'
                              ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                              : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                          }`}>
                            {proj.status === 'em_andamento' ? 'Em Andamento' : proj.status === 'concluido' ? 'Concluído' : proj.status === 'planejado' ? 'Planejado' : 'Suspenso'}
                        </span>
                        </td>
                        <td className="py-2.5 px-3 md:py-3 md:px-4 text-xs flex justify-between items-center md:table-cell md:text-right">
                          <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Contrato</span>
                          <ValorPremium valor={proj.valor_total_contrato} size="xs" />
                        </td>
                        <td className="py-2.5 px-3 md:py-3 md:px-4 text-xs flex justify-between items-center md:table-cell md:text-right">
                          <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Recebido</span>
                          <ValorPremium valor={proj.valorRecebido} size="xs" />
                        </td>
                        <td className="py-4 px-3 md:px-6 flex justify-between md:justify-center items-center md:table-cell" onClick={(e) => e.stopPropagation()}>
                          <span className="md:hidden font-black text-[10px] text-desc uppercase tracking-wider">Ações Rápidas</span>
                          <div className="flex items-center justify-end md:justify-center gap-1.5">
                            <Link
                              href={`/engenharia/relatorio-fotografico?projetoId=${proj.id}`}
                              className="p-1.5 rounded-lg border border-card-border bg-background hover:bg-brand-blue hover:text-white dark:hover:bg-brand-ocre dark:hover:text-brand-dark text-desc transition-colors shadow-xs"
                              title="Relatório Fotográfico da Obra"
                            >
                              <Camera size={12} />
                            </Link>
                            <Link
                              href={`/projetos/editar?id=${proj.id}`}
                              className="p-1.5 rounded-lg border border-card-border bg-background hover:bg-brand-blue hover:text-white dark:hover:bg-brand-ocre dark:hover:text-brand-dark text-desc transition-colors shadow-xs"
                              title="Editar Projeto"
                            >
                              <Edit size={12} />
                            </Link>
                            <Link
                              href={`/custos?projetoId=${proj.id}`}
                              className="p-1.5 rounded-lg border border-card-border bg-background hover:bg-brand-blue hover:text-white dark:hover:bg-brand-ocre dark:hover:text-brand-dark text-desc transition-colors shadow-xs"
                              title="Lançar Custo"
                            >
                              <Coins size={12} />
                            </Link>
                            <ConfirmButton
                              onConfirm={() => handleExcluir(proj.id!)}
                              confirmLabel="Confirmar?"
                              icon={Trash2}
                              className="p-1.5 rounded-lg border border-card-border bg-background hover:bg-red-500/10 text-desc hover:text-red-500 transition-colors shadow-xs"
                              confirmClassName="bg-red-500 text-white border-red-600 hover:bg-red-600 p-1.5"
                              title="Excluir Projeto"
                            />
                          </div>
                        </td>
                      </tr>
                      
                      {/* Linha Expandida - Detalhes Inline */}
                      {isExpanded && (() => {
                        const valorContrato = Number(proj.valor_total_contrato);
                        const custoPrevisto = Number(proj.custoPrevisto);
                        const custoRealizado = Number(proj.custoRealizado);

                        // 1. Margem Prevista
                        const lucroPrevisto = valorContrato - custoPrevisto;
                        const margemPrevistaPct = valorContrato > 0 ? (lucroPrevisto / valorContrato) * 100 : 0;

                        // 2. Margem do Momento
                        const lucroMomento = valorContrato - custoRealizado;
                        const margemMomentoPct = valorContrato > 0 ? (lucroMomento / valorContrato) * 100 : 0;

                        // 3. Margem Provisionada
                        let custoProjetadoTotal = 0;
                        const categoriasList = ['insumos', 'mao_de_obra', 'empreiteiros', 'ferramentas', 'locacoes', 'logistica', 'administrativo', 'alimentacao', 'outros'];
                        
                        categoriasList.forEach(cat => {
                          const prevCat = (proj.orcamentosObra || []).filter((o: any) => o.categoria === cat).reduce((acc: number, curr: any) => acc + Number(curr.valor_previsto), 0);
                          const realCat = (proj.custosObra || []).filter((c: any) => c.categoria === cat).reduce((acc: number, curr: any) => acc + Number(curr.valor), 0);
                          
                          const provisaoAVisar = prevCat > realCat ? (prevCat - realCat) : 0;
                          custoProjetadoTotal += (realCat + provisaoAVisar);
                        });

                        if (custoProjetadoTotal === 0 && custoRealizado > 0) {
                          custoProjetadoTotal = custoRealizado;
                        }

                        const lucroProvisionado = valorContrato - custoProjetadoTotal;
                        const margemProvisionadaPct = valorContrato > 0 ? (lucroProvisionado / valorContrato) * 100 : 0;


                        return (
                          <tr className="bg-slate-50/20 dark:bg-zinc-900/10 block md:table-row border-t-4 md:border-t-0 border-card-border/50">
                            <td colSpan={8} className="py-3 px-2 md:py-4 md:px-5 border-b border-card-border block md:table-cell">
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-5 bg-card border border-card-border rounded-xl p-3 md:p-5 shadow-sm text-left items-start">
                                
                                {/* ══════════ COLUNA 1: DADOS DA OBRA E ENDEREÇO ══════════ */}
                                <div className="space-y-4">
                                  <h4 className="text-xs font-black text-brand-ocre uppercase tracking-wider font-vomzom flex items-center gap-1.5 pb-2 border-b border-card-border/50">
                                    <HardHat size={14} className="text-brand-blue" /> Dados do Projeto
                                  </h4>
                                  <div className="bg-slate-500/5 dark:bg-white/[0.01] border border-card-border/60 rounded-xl p-3 space-y-2.5 text-xs text-main">
                                    <div className="space-y-1 pb-2 border-b border-card-border/50">
                                      <span className="text-[10px] text-desc font-bold uppercase tracking-wider block">Nome do Projeto</span>
                                      <span className="text-xs font-black text-main">{proj.nome}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-card-border/50">
                                      <div>
                                        <span className="text-[10px] text-desc font-bold uppercase tracking-wider block">OS</span>
                                        <span className="text-xs font-bold text-brand-ocre">{proj.os}</span>
                                      </div>
                                      <div>
                                        <span className="text-[10px] text-desc font-bold uppercase tracking-wider block">Tipologia</span>
                                        <span className="text-xs font-bold text-main">{proj.tipologia || 'Residencial'}</span>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-card-border/50">
                                      <div>
                                        <span className="text-[10px] text-desc font-bold uppercase tracking-wider block">Status</span>
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider inline-block mt-0.5 ${
                                          proj.status === 'em_andamento' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                          : proj.status === 'concluido' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                          : proj.status === 'planejado' ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                                          : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'}`}>
                                          {proj.status === 'em_andamento' ? 'Em Andamento' : proj.status === 'concluido' ? 'Concluída' : proj.status === 'planejado' ? 'Planejada' : 'Suspensa'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-[10px] text-desc font-bold uppercase tracking-wider block">Contrato</span>
                                        <span className="text-xs font-black text-main mt-0.5 block"><ValorPremium valor={Number(proj.valor_total_contrato)} size="xs" /></span>
                                      </div>
                                    </div>
                                    
                                    <div className="pb-2 border-b border-card-border/50">
                                      <span className="text-[10px] text-desc font-bold uppercase tracking-wider block">Endereço Completo</span>
                                      <div className="flex items-start gap-1 font-semibold mt-0.5 text-xs text-main">
                                        <MapPin size={12} className="text-brand-blue shrink-0 mt-0.5" />
                                        <span>{proj.logradouro}, {proj.numero} {proj.complemento && `(${proj.complemento})`} - {proj.bairro}, {proj.cidade}/{proj.uf}</span>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <span className="text-[10px] text-desc font-bold uppercase tracking-wider block">Previsão Início</span>
                                        <span className="text-xs font-bold text-main flex items-center gap-1 mt-0.5">
                                          <Calendar size={11} className="text-brand-blue" />
                                          {new Date(proj.data_prevista_inicio).toLocaleDateString('pt-BR')}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-[10px] text-desc font-bold uppercase tracking-wider block">Previsão Término</span>
                                        <span className="text-xs font-bold text-main flex items-center gap-1 mt-0.5">
                                          <Calendar size={11} className="text-brand-blue" />
                                          {new Date(proj.data_prevista_termino).toLocaleDateString('pt-BR')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* ══════════ COLUNA 2: CRONOGRAMA DE FATURAMENTO E METAS ══════════ */}
                                <div className="space-y-4">
                                  <h4 className="text-xs font-black text-brand-ocre uppercase tracking-wider font-vomzom flex items-center gap-1.5 pb-2 border-b border-card-border/50">
                                    <DollarSign size={14} className="text-brand-blue" /> Faturamento e Metas
                                  </h4>

                                  {/* Resumo Financeiro */}
                                  <div className="bg-slate-500/5 dark:bg-white/[0.01] border border-card-border/60 rounded-xl p-3 space-y-2 text-xs">
                                    <div className="flex items-center justify-between pb-2 border-b border-card-border/50">
                                      <span className="text-desc font-bold uppercase tracking-wider text-[10px]">Valor Contratado</span>
                                      <span className="font-black text-main">R$ {valorContrato.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex items-center justify-between pb-2 border-b border-card-border/50">
                                      <span className="text-desc font-bold uppercase tracking-wider text-[10px]">Recebido</span>
                                      <span className="font-black text-emerald-600">R$ {proj.valorRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex items-center justify-between pb-2 border-b border-card-border/50">
                                      <span className="text-desc font-bold uppercase tracking-wider text-[10px]">A Receber</span>
                                      <span className="font-black text-amber-600">R$ {(valorContrato - proj.valorRecebido).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    {/* Barra de progresso recebido */}
                                    <div className="pt-1">
                                      <div className="flex items-center justify-between text-[10px] mb-1">
                                        <span className="text-desc font-bold uppercase tracking-wider">Progresso do Faturamento</span>
                                        <span className="font-black text-main">{proj.pctRecebido.toFixed(1)}%</span>
                                      </div>
                                      <div className="h-2 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden border border-card-border">
                                        <div style={{ width: `${Math.min(100, proj.pctRecebido)}%` }} className="h-full bg-emerald-500 rounded-full transition-all duration-350" />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Desempenho Financeiro / Margens */}
                                  <div className="space-y-2">
                                    <span className="text-[10px] text-desc font-black uppercase tracking-wider block">Margens</span>
                                    <div className="p-2 bg-slate-500/5 dark:bg-white/[0.01] border border-card-border/60 rounded-lg flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-desc uppercase tracking-wider">Prevista</span>
                                      <div className="text-right">
                                        <span className="text-[11px] font-black text-brand-blue dark:text-brand-ocre">{margemPrevistaPct.toFixed(1)}%</span>
                                        <span className="text-[10px] text-sub font-bold ml-1.5">R$ {lucroPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                    </div>
                                    <div className="p-2 bg-slate-500/5 dark:bg-white/[0.01] border border-card-border/60 rounded-lg flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-desc uppercase tracking-wider">Real</span>
                                      <div className="text-right">
                                        <span className={`text-[11px] font-black ${lucroMomento >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{margemMomentoPct.toFixed(1)}%</span>
                                        <span className="text-[10px] text-sub font-bold ml-1.5">R$ {lucroMomento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                    </div>
                                    <div className="p-2 bg-slate-500/5 dark:bg-white/[0.01] border border-card-border/60 rounded-lg flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-desc uppercase tracking-wider">Provisionada</span>
                                      <div className="text-right">
                                        <span className={`text-[11px] font-black ${lucroProvisionado >= 0 ? 'text-purple-500' : 'text-red-500'}`}>{margemProvisionadaPct.toFixed(1)}%</span>
                                        <span className="text-[10px] text-sub font-bold ml-1.5">R$ {lucroProvisionado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* ══════════ COLUNA 3: DESPESAS E INFORMAÇÕES ══════════ */}
                                <div className="flex flex-col">
                                  <h4 className="text-xs font-black text-brand-ocre uppercase tracking-wider font-vomzom flex items-center gap-1.5 pb-2 mb-4 border-b border-card-border/50 order-first">
                                    <Coins size={14} className="text-brand-blue" /> Despesas e Lançamentos
                                  </h4>

                                  {/* Despesas Recentes */}
                                  <div className="order-2 md:order-1 mt-4 md:mt-0">
                                    <span className="text-[10px] text-desc font-black uppercase tracking-wider block mb-1.5">Últimas Despesas</span>
                                    <div className="bg-slate-500/5 dark:bg-white/[0.01] border border-card-border/60 rounded-xl overflow-hidden">
                                      {(() => {
                                        const custosRecentes = [...(proj.custosObra || [])]
                                          .sort((a, b) => new Date(b.data_custo).getTime() - new Date(a.data_custo).getTime())
                                          .slice(0, 5);

                                        if (custosRecentes.length === 0) {
                                          return (
                                            <div className="p-3 text-center text-xs text-desc font-semibold">
                                              Nenhuma despesa lançada.
                                            </div>
                                          );
                                        }

                                        return (
                                          <div className="divide-y divide-card-border/50 text-xs">
                                            {custosRecentes.map((c, i) => (
                                              <div 
                                                key={i} 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedCusto(c as CustoRealizado);
                                                  setIsCustoModalOpen(true);
                                                }}
                                                className="flex justify-between items-center p-2 hover:bg-slate-500/10 transition-colors cursor-pointer"
                                              >
                                                <div className="space-y-0.5 text-left min-w-0">
                                                  <span className="text-xs font-bold text-main block truncate">
                                                    {CATEGORIAS_CUSTO_LABELS[c.categoria as CategoriaCusto] || c.categoria}
                                                  </span>
                                                  <span className="text-[10px] text-desc block font-medium">
                                                    {new Date(c.data_custo).toLocaleDateString('pt-BR')}
                                                  </span>
                                                </div>
                                                <span className="text-xs font-bold text-red-500 shrink-0 ml-2">
                                                  - R$ {Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  {/* Lançamento Rápido */}
                                  <div className="order-1 md:order-2">
                                    <span className="text-[10px] text-desc font-black uppercase tracking-wider block mb-1.5">Lançamento Rápido</span>
                                    <div className="flex flex-wrap gap-1">
                                      {/* Lançar Entradas */}
                                      <button
                                        type="button"
                                        onClick={() => router.push(`/recebimentos?projeto_id=${proj.id}`)}
                                        title="Lançar Recebimento (Entrada)"
                                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40 text-[10px] text-emerald-600 transition-all cursor-pointer shadow-2xs font-bold"
                                      >
                                        <TrendingUp size={11} className="text-emerald-600 shrink-0" />
                                        <span>Entradas</span>
                                      </button>

                                      {Object.entries(CATEGORIAS_CUSTO_LABELS).map(([cat, label]) => {
                                        const CATEGORIAS_ICONS: Record<string, React.ComponentType<any>> = {
                                          insumos: Package, mao_de_obra: HardHat, empreiteiros: Users, ferramentas: Wrench, locacoes: Key, logistica: Truck, administrativo: FileText, alimentacao: Utensils, outros: MoreHorizontal
                                        };
                                        const Icon = CATEGORIAS_ICONS[cat] || Coins;
                                        return (
                                          <button
                                            key={cat}
                                            type="button"
                                            onClick={() => {
                                              if (cat === 'mao_de_obra' || cat === 'empreiteiros') {
                                                router.push(`/rh/pagamentos-parceiros?projeto_id=${proj.id}`);
                                              } else {
                                                router.push(`/custos?projetoId=${proj.id}&categoria=${cat}`);
                                              }
                                            }}
                                            title={`Lançamento Rápido: ${label}`}
                                            className="flex items-center gap-1 px-2 py-1 rounded-md border border-card-border bg-background hover:bg-brand-blue/5 hover:border-brand-blue/30 dark:hover:bg-brand-ocre/5 dark:hover:border-brand-ocre/30 text-[10px] text-sub hover:text-brand-blue dark:hover:text-brand-ocre transition-all cursor-pointer shadow-2xs font-bold"
                                          >
                                            <Icon size={11} className="text-brand-blue dark:text-brand-ocre shrink-0" />
                                            <span>{label}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Resumo por Categoria */}
                                  <div>
                                    <span className="text-[10px] text-desc font-black uppercase tracking-wider block mb-1.5">Gastos Orçado vs Realizado</span>
                                    <div className="bg-slate-500/5 dark:bg-white/[0.01] border border-card-border/60 rounded-xl p-2 space-y-1">
                                      <div className="flex items-center justify-between text-[10px] font-bold text-desc uppercase tracking-wider pb-1 border-b border-card-border/50">
                                        <span>Total Orçado</span>
                                        <span className="text-main">R$ {custoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] font-bold text-desc uppercase tracking-wider pb-1 border-b border-card-border/50">
                                        <span>Total Realizado</span>
                                        <span className={`${custoRealizado > custoPrevisto ? 'text-red-500' : 'text-main'}`}>R$ {custoRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] font-bold text-desc uppercase tracking-wider">
                                        <span>Saldo</span>
                                        <span className={`font-black ${(custoPrevisto - custoRealizado) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                          R$ {(custoPrevisto - custoRealizado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* ══════════ COLUNA 4: GRÁFICOS E RELATÓRIOS ══════════ */}
                                <div className="space-y-4">
                                  <h4 className="text-xs font-black text-brand-ocre uppercase tracking-wider font-vomzom flex items-center gap-1.5 pb-2 border-b border-card-border/50">
                                    <Calculator size={14} className="text-brand-blue" /> Gráficos e Relatórios
                                  </h4>

                                  {/* Gráfico de Barras dos Cenários */}
                                  <div className="bg-slate-500/5 dark:bg-white/[0.01] border border-card-border/60 rounded-xl p-3 space-y-3">
                                    {(() => {
                                      const pctOrcado = valorContrato > 0 ? (custoPrevisto / valorContrato) * 100 : 0;
                                      const pctRealizado = valorContrato > 0 ? (custoRealizado / valorContrato) * 100 : 0;
                                      const pctProjetado = valorContrato > 0 ? (custoProjetadoTotal / valorContrato) * 100 : 0;

                                      const renderBarra = (
                                        titulo: string,
                                        gastoValor: number,
                                        pctGasto: number,
                                        sobraValor: number,
                                        pctSobra: number,
                                        gastoCor: string
                                      ) => {
                                        const estourou = gastoValor > valorContrato;
                                        const valorEstouro = estourou ? gastoValor - valorContrato : 0;
                                        const pctEstouro = valorContrato > 0 ? (valorEstouro / valorContrato) * 100 : 0;
                                        let larguraGasto = Math.min(100, pctGasto);
                                        let larguraSobra = estourou ? 0 : Math.max(0, pctSobra);

                                        return (
                                          <div className="space-y-1">
                                            <div className="text-[10px] font-bold text-main">{titulo}</div>
                                            <div className="flex items-center w-full gap-1">
                                              <div className="relative flex-1 h-5 bg-slate-100 dark:bg-zinc-800/60 rounded-md border border-card-border overflow-hidden flex shadow-inner">
                                                {larguraGasto > 0 && (
                                                  <div style={{ width: `${larguraGasto}%` }} className={`h-full ${gastoCor} transition-all duration-350 flex items-center justify-center border-r border-black/5`} title={`Gasto: ${pctGasto.toFixed(1)}%`}>
                                                    {larguraGasto >= 12 && <span className="text-[8px] font-black text-white">{pctGasto.toFixed(0)}%</span>}
                                                  </div>
                                                )}
                                                {larguraSobra > 0 && (
                                                  <div style={{ width: `${larguraSobra}%` }} className="h-full bg-emerald-600/75 transition-all duration-350 flex items-center justify-center" title={`Sobra: ${pctSobra.toFixed(1)}%`}>
                                                    {larguraSobra >= 12 && <span className="text-[8px] font-black text-white">{pctSobra.toFixed(0)}%</span>}
                                                  </div>
                                                )}
                                              </div>
                                              {estourou && pctEstouro > 0 && (
                                                <div style={{ width: `${Math.min(25, pctEstouro)}%`, minWidth: '35px' }} className="h-5 bg-red-950 border border-red-500 text-red-200 rounded-md flex items-center justify-center shrink-0 px-1 animate-pulse">
                                                  <span className="text-[7px] font-black">+{pctEstouro.toFixed(0)}%</span>
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-3 text-[9px] text-sub">
                                              <span className="flex items-center gap-1 font-semibold"><span className={`w-1.5 h-1.5 rounded-full ${gastoCor}`} /> R$ {gastoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                              <span className="flex items-center gap-1 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600/75" /> R$ {sobraValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                          </div>
                                        );
                                      };

                                      return (
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between text-[10px] font-bold text-sub pb-1.5 border-b border-card-border/50">
                                            <span>Contrato (100%)</span>
                                            <span className="text-main font-black">R$ {valorContrato.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                          </div>
                                          {renderBarra("1. Orçado", custoPrevisto, pctOrcado, lucroPrevisto, margemPrevistaPct, "bg-[#b45309]")}
                                          {renderBarra("2. Realizado", custoRealizado, pctRealizado, lucroMomento, margemMomentoPct, "bg-[#2563eb]")}
                                          {renderBarra("3. Projetado", custoProjetadoTotal, pctProjetado, lucroProvisionado, margemProvisionadaPct, "bg-[#7b263a]")}
                                        </div>
                                      );
                                    })()}
                                    {/* Régua */}
                                    <div className="relative pt-1 border-t border-card-border/60">
                                      <div className="flex justify-between text-[8px] text-desc font-black uppercase tracking-wider">
                                        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Ações e Relatórios */}
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] text-desc font-black uppercase tracking-wider block mb-1">Ações Rápidas</span>
                                    <Link
                                      href={`/engenharia/relatorio-fotografico?projetoId=${proj.id}`}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-ocre/30 bg-brand-ocre/10 hover:bg-brand-ocre/20 text-xs font-bold text-brand-ocre transition-colors shadow-2xs cursor-pointer w-full"
                                    >
                                      <Camera size={12} /> Criar / Abrir Relatório Fotográfico
                                    </Link>
                                    <Link
                                      href={`/projetos/editar?id=${proj.id}`}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-card-border bg-background hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-bold text-sub transition-colors shadow-2xs cursor-pointer w-full"
                                    >
                                      <Edit size={12} className="text-brand-blue" /> Editar Obra
                                    </Link>
                                    <Link
                                      href={`/custos?projetoId=${proj.id}`}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-card-border bg-background hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-bold text-sub transition-colors shadow-2xs cursor-pointer w-full"
                                    >
                                      <Coins size={12} className="text-brand-blue" /> Lançar Custo
                                    </Link>
                                    <Link
                                      href={`/recebimentos?projetoId=${proj.id}`}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400 transition-colors shadow-2xs cursor-pointer w-full"
                                    >
                                      <DollarSign size={12} /> Lançar Entrada
                                    </Link>
                                    <Link
                                      href={`/relatorios/obra?id=${proj.id}`}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-blue/25 bg-brand-blue/5 hover:bg-brand-blue/10 text-xs font-bold text-brand-blue transition-colors shadow-2xs cursor-pointer w-full"
                                    >
                                      <FileText size={12} /> Relatório da Obra
                                    </Link>
                                  </div>
                                </div>

                              </div>
                            </td>
                          </tr>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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

      {selectedCusto && (
        <DespesaDetalhesModal
          isOpen={isCustoModalOpen}
          onClose={() => setIsCustoModalOpen(false)}
          custo={selectedCusto}
        />
      )}

    </div>
  );
}
