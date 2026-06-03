'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Landmark, 
  Check, 
  Loader2, 
  ArrowLeft,
  DollarSign,
  Calendar,
  Layers,
  FileText,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { fetchProjetos } from '@/modules/operacional/services/apiProjetos';
import { fetchRecebimentosByProjeto, salvarRecebimento } from '@/modules/financeiro/services/apiFinanceiro';
import { Projeto } from '@/modules/operacional/types';
import { Recebimento } from '@/modules/financeiro/types';
import ValorPremium from '@/shared/components/ValorPremium';
import Toast, { ToastType } from '@/shared/components/Toast';
import MoneyInput from '@/shared/components/MoneyInput';

interface ParcelaSaldo {
  valor: number;
  data_prevista: string;
}

function RecebimentosFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjetoId = searchParams.get('projetoId');

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loadingProjetos, setLoadingProjetos] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Estados do formulário de lançamento de entrada
  const [projetoId, setProjetoId] = useState('');
  const [tipoEntrada, setTipoEntrada] = useState<'programada' | 'avulsa'>('programada');
  const [parcelas, setParcelas] = useState<Recebimento[]>([]);
  const [loadingParcelas, setLoadingParcelas] = useState(false);

  // Campos de quitação de parcela programada
  const [parcelaSelecionadaId, setParcelaSelecionadaId] = useState('');

  // Campos de receita avulsa
  const [valor, setValor] = useState<number>(0);
  const [dataRecebimento, setDataRecebimento] = useState(new Date().toISOString().split('T')[0]);
  const [descricao, setDescricao] = useState('');

  // Quitação parcial e Toast
  const [valorProgramadoPago, setValorProgramadoPago] = useState<number>(0);
  const [dataDiferenca, setDataDiferenca] = useState('');
  const [parcelasSaldo, setParcelasSaldo] = useState<ParcelaSaldo[]>([]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };

  const selectedParcela = parcelas.find(p => p.id === parcelaSelecionadaId);
  const saldoRestante = selectedParcela ? Number(selectedParcela.valor) - valorProgramadoPago : 0;

  useEffect(() => {
    const selected = parcelas.find(p => p.id === parcelaSelecionadaId);
    if (selected) {
      const vOriginal = Number(selected.valor);
      setValorProgramadoPago(vOriginal);
      const dt = new Date(selected.data_prevista);
      dt.setDate(dt.getDate() + 30);
      const dataPadrao = dt.toISOString().split('T')[0];
      setDataDiferenca(dataPadrao);
      setParcelasSaldo([{ valor: 0, data_prevista: dataPadrao }]);
    } else {
      setValorProgramadoPago(0);
      setParcelasSaldo([]);
    }
  }, [parcelaSelecionadaId, parcelas]);

  useEffect(() => {
    if (parcelasSaldo.length === 1 && selectedParcela) {
      setParcelasSaldo([{
        valor: parseFloat(saldoRestante.toFixed(2)),
        data_prevista: dataDiferenca
      }]);
    }
  }, [valorProgramadoPago, selectedParcela, parcelasSaldo.length, dataDiferenca]);

  const adicionarParcelaSaldo = () => {
    let dataBase = new Date();
    if (parcelasSaldo.length > 0) {
      dataBase = new Date(parcelasSaldo[parcelasSaldo.length - 1].data_prevista || new Date());
    }
    dataBase.setDate(dataBase.getDate() + 30);
    const dataStr = dataBase.toISOString().split('T')[0];

    const somaAlocada = parcelasSaldo.reduce((acc, curr) => acc + curr.valor, 0);
    const naoAlocado = Math.max(0, parseFloat((saldoRestante - somaAlocada).toFixed(2)));

    setParcelasSaldo([
      ...parcelasSaldo,
      { valor: naoAlocado, data_prevista: dataStr }
    ]);
  };

  const removerParcelaSaldo = (idx: number) => {
    const filtradas = parcelasSaldo.filter((_, i) => i !== idx);
    setParcelasSaldo(filtradas);
  };

  const handleParcelaSaldoChange = (idx: number, campo: keyof ParcelaSaldo, val: any) => {
    const novas = [...parcelasSaldo];
    if (campo === 'valor') {
      novas[idx] = {
        ...novas[idx],
        valor: parseFloat(val) || 0
      };
    } else {
      novas[idx] = {
        ...novas[idx],
        [campo]: val
      };
    }
    setParcelasSaldo(novas);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchProjetos();
        setProjetos(data);
        
        // Se houver projetoId na URL, pré-seleciona
        if (queryProjetoId && data.some(p => p.id === queryProjetoId)) {
          setProjetoId(queryProjetoId);
        } else if (data.length > 0) {
          setProjetoId(data[0].id!);
        }
      } catch (err) {
        console.error('Erro ao carregar projetos:', err);
      } finally {
        setLoadingProjetos(false);
      }
    }
    loadData();
  }, [queryProjetoId]);

  // Carrega as parcelas pendentes toda vez que o projeto ou o tipo muda
  useEffect(() => {
    if (!projetoId || tipoEntrada !== 'programada') {
      setParcelas([]);
      setParcelaSelecionadaId('');
      return;
    }

    async function loadParcelas() {
      setLoadingParcelas(true);
      try {
        const data = await fetchRecebimentosByProjeto(projetoId);
        // Apenas parcelas que ainda não foram pagas
        const pendentes = data.filter(r => r.status !== 'pago');
        setParcelas(pendentes);
        if (pendentes.length > 0) {
          setParcelaSelecionadaId(pendentes[0].id!);
        } else {
          setParcelaSelecionadaId('');
        }
      } catch (err) {
        console.error('Erro ao buscar parcelas:', err);
      } finally {
        setLoadingParcelas(false);
      }
    }
    loadParcelas();
  }, [projetoId, tipoEntrada]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projetoId) {
      showToast('Por favor, selecione a obra.', 'warning');
      return;
    }

    setSalvando(true);
    try {
      const projetoSelecionado = projetos.find(p => p.id === projetoId);
      const valorContrato = projetoSelecionado ? Number(projetoSelecionado.valor_total_contrato) : 0;

      if (tipoEntrada === 'programada') {
        if (!parcelaSelecionadaId) {
          showToast('Nenhuma parcela programada selecionada para quitação.', 'warning');
          setSalvando(false);
          return;
        }

        const parcelaInfo = parcelas.find(p => p.id === parcelaSelecionadaId);
        if (!parcelaInfo) throw new Error('Informações da parcela não encontradas.');

        const valorOriginal = Number(parcelaInfo.valor);
        const valorPago = Number(valorProgramadoPago);

        if (isNaN(valorPago) || valorPago <= 0) {
          showToast('Por favor, digite um valor recebido válido maior que zero.', 'warning');
          setSalvando(false);
          return;
        }

        if (valorPago > valorOriginal) {
          showToast('O valor recebido não pode ser maior do que o valor programado.', 'warning');
          setSalvando(false);
          return;
        }

        if (valorPago < valorOriginal) {
          // Fluxo de Quitação Parcial (Split Multi)
          const diferencaTotal = parseFloat((valorOriginal - valorPago).toFixed(2));
          
          const somaAlocada = parcelasSaldo.reduce((acc, curr) => acc + curr.valor, 0);
          if (Math.abs(somaAlocada - diferencaTotal) > 0.01) {
            showToast(`A soma das parcelas adicionais (R$ ${somaAlocada.toFixed(2)}) deve ser exatamente igual ao saldo restante (R$ ${diferencaTotal.toFixed(2)}).`, 'warning');
            setSalvando(false);
            return;
          }

          const temInvalidos = parcelasSaldo.some(p => p.valor <= 0 || !p.data_prevista);
          if (temInvalidos) {
            showToast('Todas as parcelas adicionais do saldo devem ter valor maior que zero e data preenchida.', 'warning');
            setSalvando(false);
            return;
          }

          // 1. Quitar a parcela atual com o valor parcial
          const percentualOriginal = Number(parcelaInfo.percentual);
          const percentualPago = parseFloat(((valorPago / valorOriginal) * percentualOriginal).toFixed(4));

          await salvarRecebimento({
            ...parcelaInfo,
            valor: valorPago,
            percentual: percentualPago,
            status: 'pago',
            data_pagamento: dataRecebimento
          });

          // 2. Criar as novas parcelas programadas para o saldo desmembrado
          const parcelasObra = await fetchRecebimentosByProjeto(projetoId);
          let proxNumero = parcelasObra.reduce((max, p) => p.parcela_numero > max ? p.parcela_numero : max, 0) + 1;

          for (const parc of parcelasSaldo) {
            const pctParc = parseFloat(((parc.valor / valorOriginal) * percentualOriginal).toFixed(4));
            await salvarRecebimento({
              projeto_id: projetoId,
              parcela_numero: proxNumero,
              percentual: pctParc,
              valor: parc.valor,
              data_prevista: parc.data_prevista,
              status: 'pendente'
            });
            proxNumero++;
          }

          showToast(`Entrada parcial de R$ ${valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} quitada! Criadas ${parcelasSaldo.length} novas parcelas para o saldo de R$ ${diferencaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`, 'success');
        } else {
          // Quitação Integral
          await salvarRecebimento({
            ...parcelaInfo,
            status: 'pago',
            data_pagamento: dataRecebimento
          });
          showToast('Entrada de parcela programada registrada com sucesso!', 'success');
        }
      } else {
        // Receita Avulsa
        if (valor <= 0) {
          showToast('Por favor, preencha o valor com um número maior que zero.', 'warning');
          setSalvando(false);
          return;
        }

        if (!descricao.trim()) {
          showToast('Por favor, informe a origem ou descrição do recebimento avulso.', 'warning');
          setSalvando(false);
          return;
        }

        // Buscar parcelas existentes da obra para calcular o número da próxima parcela
        const parcelasObra = await fetchRecebimentosByProjeto(projetoId);
        const proxNumero = parcelasObra.reduce((max, p) => p.parcela_numero > max ? p.parcela_numero : max, 0) + 1;

        // Calcular percentual baseado no valor total do contrato
        const percentualCalculado = valorContrato > 0 ? parseFloat(((valor / valorContrato) * 100).toFixed(2)) : 0;

        await salvarRecebimento({
          projeto_id: projetoId,
          parcela_numero: proxNumero,
          percentual: percentualCalculado,
          valor: valor,
          data_prevista: dataRecebimento, // Data prevista assume a mesma data do pagamento
          status: 'pago',
          data_pagamento: dataRecebimento
        });
        showToast('Receita avulsa registrada com sucesso!', 'success');
      }

      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err) {
      console.error('Erro ao salvar recebimento:', err);
      showToast('Ocorreu um erro ao registrar o recebimento.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  if (loadingProjetos) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-desc">
        <Loader2 className="animate-spin text-brand-ocre" size={32} />
        <span className="text-sm font-medium">Carregando obras ativas...</span>
      </div>
    );
  }

  if (projetos.length === 0) {
    return (
      <div className="bg-card border border-dashed border-card-border rounded-2xl p-8 text-center space-y-4 shadow-sm">
        <p className="text-sm text-sub">
          Nenhuma obra cadastrada no sistema. Cadastre uma obra primeiro para poder registrar entradas financeiras.
        </p>
        <Link 
          href="/projetos/novo"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-brand-ocre text-brand-dark font-bold text-sm hover:bg-brand-ocre/90 transition-colors shadow-md animate-pulse"
        >
          Cadastrar Primeira Obra
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-card-border rounded-2xl p-6 space-y-5 shadow-sm">
      
      {/* Obra */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-sub uppercase tracking-wider flex items-center gap-1.5">
          <Layers size={14} className="text-brand-ocre" /> Selecionar Obra *
        </label>
        <select
          required
          value={projetoId}
          onChange={(e) => setProjetoId(e.target.value)}
          className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-main focus:outline-none focus:border-brand-ocre"
        >
          {projetos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({p.os})
            </option>
          ))}
        </select>
      </div>

      {/* Tipo de Entrada (Programada ou Avulsa) */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-sub uppercase tracking-wider">
          Tipo de Entrada Financeira *
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setTipoEntrada('programada')}
            className={`py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              tipoEntrada === 'programada'
                ? 'bg-brand-blue text-white border-brand-blue dark:bg-brand-ocre dark:text-brand-dark dark:border-brand-ocre shadow-md'
                : 'bg-background border-card-border text-sub hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            Quitar Parcela Programada
          </button>
          <button
            type="button"
            onClick={() => setTipoEntrada('avulsa')}
            className={`py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              tipoEntrada === 'avulsa'
                ? 'bg-brand-blue text-white border-brand-blue dark:bg-brand-ocre dark:text-brand-dark dark:border-brand-ocre shadow-md'
                : 'bg-background border-card-border text-sub hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            Aporte / Receita Avulsa
          </button>
        </div>
      </div>

      {/* Inputs específicos baseados no Tipo de Entrada */}
      {tipoEntrada === 'programada' ? (
        <div className="space-y-4 border-t border-card-border pt-4">
          {loadingParcelas ? (
            <div className="flex items-center gap-2 py-4 justify-center text-xs text-desc">
              <Loader2 className="animate-spin text-brand-ocre" size={16} />
              <span>Buscando parcelas do cronograma...</span>
            </div>
          ) : parcelas.length === 0 ? (
            <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                <Check size={16} /> Sem parcelas em aberto! Todo o cronograma desta obra já foi liquidado.
              </span>
              <button
                type="button"
                onClick={() => setTipoEntrada('avulsa')}
                className="mt-2 text-[10px] text-brand-ocre hover:underline font-bold uppercase tracking-wider block mx-auto"
              >
                Registrar entrada avulsa
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-sub uppercase tracking-wider">
                  Selecionar Parcela em Aberto *
                </label>
                <select
                  required
                  value={parcelaSelecionadaId}
                  onChange={(e) => setParcelaSelecionadaId(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-main focus:outline-none focus:border-brand-ocre"
                >
                  {parcelas.map((p) => (
                    <option key={p.id} value={p.id}>
                      Parcela #{p.parcela_numero} - Vence em {new Date(p.data_prevista).toLocaleDateString('pt-BR')} (R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                    </option>
                  ))}
                </select>
              </div>

              {selectedParcela && (
                <div className="space-y-4">
                  <div 
                    onClick={() => setValorProgramadoPago(Number(selectedParcela.valor))}
                    title="Clique para restaurar o valor previsto original"
                    className="bg-background border border-card-border p-4 rounded-xl space-y-2.5 text-xs text-sub shadow-2xs cursor-pointer hover:border-brand-blue/35 dark:hover:border-brand-ocre/35 hover:bg-slate-500/5 dark:hover:bg-white/[0.01] transition-all group select-none"
                  >
                    <div className="flex justify-between items-center">
                      <span>Número da Parcela:</span>
                      <strong className="text-main font-bold">#{selectedParcela.parcela_numero}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Fração do Contrato:</span>
                      <strong className="text-main font-bold">{Number(selectedParcela.percentual).toFixed(2)}%</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Vencimento Programado:</span>
                      <strong className="text-main font-bold">{new Date(selectedParcela.data_prevista).toLocaleDateString('pt-BR')}</strong>
                    </div>
                    <div className="flex justify-between items-center border-t border-card-border pt-2 text-sm">
                      <span className="font-semibold text-main group-hover:text-brand-blue dark:group-hover:text-brand-ocre flex items-center gap-1 transition-colors">
                        Valor Previsto <span className="text-[9px] font-normal opacity-0 group-hover:opacity-100 transition-opacity">(Clique para restaurar)</span>:
                      </span>
                      <ValorPremium valor={Number(selectedParcela.valor)} size="sm" />
                    </div>

                    <div className="mt-2 pt-2 border-t border-card-border/50 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/projetos/editar?id=${projetoId}`}
                        className="text-xs text-brand-blue dark:text-brand-ocre hover:underline font-bold flex items-center justify-end gap-1"
                      >
                        &rarr; Voltar para edição e dividir parcelas manualmente
                      </Link>
                    </div>
                  </div>

                  {/* Valor efetivamente recebido */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-sub uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign size={14} className="text-brand-ocre" /> Valor Efetivamente Recebido (R$) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-desc font-semibold text-xs">
                        R$
                      </div>
                      <MoneyInput
                        value={valorProgramadoPago}
                        onChange={setValorProgramadoPago}
                        required
                        placeholder="0,00"
                        className="w-full bg-background border border-card-border rounded-xl pl-8 pr-4 py-2.5 text-main focus:outline-none focus:border-brand-ocre font-semibold text-sm"
                      />
                    </div>
                    <p className="text-[10px] text-desc">
                      Se você recebeu um valor menor, digite o valor e programe o saldo restante abaixo.
                    </p>
                  </div>

                  {/* Programação da diferença (se o valor recebido for menor que o previsto) */}
                  {valorProgramadoPago < Number(selectedParcela.valor) && (
                    <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-start justify-between gap-2 border-b border-amber-500/10 pb-2">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={15} />
                          <div className="text-[11px] text-amber-800 dark:text-amber-300">
                            <span className="font-bold">Quitação Parcial Detectada!</span> Saldo restante:{' '}
                            <span className="font-bold">
                              R$ {saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={adicionarParcelaSaldo}
                          className="text-[10px] font-extrabold uppercase text-brand-blue dark:text-brand-ocre hover:underline bg-white/20 px-2 py-1 rounded"
                        >
                          + Dividir Saldo
                        </button>
                      </div>

                      {/* Lista de Parcelas de Saldo */}
                      <div className="space-y-3">
                        {parcelasSaldo.map((parc, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2.5 items-end bg-background/50 p-2.5 rounded-lg border border-card-border/50">
                            {/* Valor */}
                            <div className="col-span-5 space-y-1">
                              <label className="text-[9px] font-bold text-desc uppercase">Valor</label>
                              <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-[10px] font-bold text-desc">R$</span>
                                <MoneyInput
                                  value={parc.valor}
                                  onChange={(val) => handleParcelaSaldoChange(idx, 'valor', val)}
                                  required
                                  placeholder="0,00"
                                  className="w-full bg-background border border-card-border rounded-lg pl-6 pr-1.5 py-1.5 text-xs text-main focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* Vencimento */}
                            <div className="col-span-5 space-y-1">
                              <label className="text-[9px] font-bold text-desc uppercase">Vencimento</label>
                              <input
                                type="date"
                                required
                                value={parc.data_prevista}
                                onChange={(e) => handleParcelaSaldoChange(idx, 'data_prevista', e.target.value)}
                                className="w-full bg-background border border-card-border rounded-lg px-2 py-1 text-xs text-main focus:outline-none"
                              />
                            </div>

                            {/* Excluir Parcela de Saldo */}
                            <div className="col-span-2 text-right">
                              <button
                                type="button"
                                disabled={parcelasSaldo.length === 1}
                                onClick={() => removerParcelaSaldo(idx)}
                                className="px-2 py-1.5 rounded-lg border border-card-border bg-card text-[10px] font-bold text-desc hover:text-red-500 hover:bg-red-500/10 disabled:opacity-40 transition-colors cursor-pointer"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Validação e Alocação do Saldo */}
                      <div className="flex justify-between items-center text-[10px] font-bold mt-2 pt-2 border-t border-amber-500/10">
                        <span className="text-desc uppercase">
                          Soma Alocada: R$ {parcelasSaldo.reduce((acc, curr) => acc + curr.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {Math.abs(parcelasSaldo.reduce((acc, curr) => acc + curr.valor, 0) - saldoRestante) > 0.01 ? (
                          <span className="text-red-500">
                            Falta alocar: R$ {Math.max(0, saldoRestante - parcelasSaldo.reduce((acc, curr) => acc + curr.valor, 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-emerald-500">Saldo 100% alocado</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 border-t border-card-border pt-4">
          
          {/* Valor */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-sub uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={14} className="text-brand-ocre" /> Valor Recebido (R$) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-desc font-semibold text-xs">
                R$
              </div>
              <MoneyInput
                value={valor}
                onChange={setValor}
                required
                placeholder="0,00"
                className="w-full bg-background border border-card-border rounded-xl pl-8 pr-4 py-2.5 text-main focus:outline-none focus:border-brand-ocre"
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-sub uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={14} className="text-brand-ocre" /> Origem / Descrição *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Aporte adicional de fundos / Receita extra aditivo de contrato"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-main placeholder-slate-500 focus:outline-none focus:border-brand-ocre"
            />
          </div>

        </div>
      )}

      {/* Data do Pagamento (comum a ambos) */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-sub uppercase tracking-wider flex items-center gap-1.5">
          <Calendar size={14} className="text-brand-ocre" /> Data do Recebimento (Caixa) *
        </label>
        <input
          type="date"
          required
          value={dataRecebimento}
          onChange={(e) => setDataRecebimento(e.target.value)}
          className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-main focus:outline-none focus:border-brand-ocre"
        />
      </div>

      {/* Enviar */}
      <button
        type="submit"
        disabled={salvando || (tipoEntrada === 'programada' && parcelas.length === 0)}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-ocre text-brand-dark font-bold hover:bg-brand-ocre/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-ocre/10 cursor-pointer"
      >
        {salvando ? (
          <>
            <Loader2 className="animate-spin" size={18} /> Registrando entrada...
          </>
        ) : (
          <>
            <Check size={18} /> Registrar Recebimento / Entrada
          </>
        )}
      </button>

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </form>
  );
}

export default function RecebimentosPage() {
  return (
    <div className="max-w-xl mx-auto space-y-6 pb-16">
      
      {/* Voltar */}
      <div>
        <Link 
          href="/" 
          className="flex items-center gap-1.5 text-xs text-sub hover:text-brand-ocre transition-colors"
        >
          <ArrowLeft size={14} /> Voltar ao Dashboard
        </Link>
      </div>

      {/* Título */}
      <div className="border-b border-card-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-main flex items-center gap-2 font-vomzom">
          <Landmark className="text-brand-ocre" /> Registrar Entrada Financeira
        </h2>
        <p className="text-sub text-sm mt-1">
          Registre entradas no caixa da construtora quitando parcelas programadas de obras ou lançando receitas extras.
        </p>
      </div>

      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-desc">
          <Loader2 className="animate-spin text-brand-ocre" size={32} />
          <span className="text-sm font-medium">Carregando formulário de entrada...</span>
        </div>
      }>
        <RecebimentosFormContent />
      </Suspense>

    </div>
  );
}
