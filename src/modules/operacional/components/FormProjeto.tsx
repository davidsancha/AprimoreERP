'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MapPin, 
  DollarSign, 
  Calendar, 
  Briefcase, 
  Trash2, 
  Plus, 
  Percent, 
  Check, 
  Loader2, 
  ShieldAlert,
  Calculator,
  ArrowRight,
  Search,
  UserPlus,
  Camera
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/core/auth/AuthProvider';
import { Projeto, CategoriaCusto, CATEGORIAS_CUSTO_LABELS } from '../types';
import { Recebimento } from '../../financeiro/types';
import { salvarProjetoCompleto, fetchProjetoById, fetchOrcamentosByProjeto } from '../services/apiProjetos';
import { fetchRecebimentosByProjeto } from '../../financeiro/services/apiFinanceiro';
import { supabase } from '@/shared/lib/supabaseClient';
import ValorPremium from '@/shared/components/ValorPremium';
import Toast, { ToastType } from '@/shared/components/Toast';
import MoneyInput from '@/shared/components/MoneyInput';

interface FormProjetoProps {
  projetoId?: string;
}

export default function FormProjeto({ projetoId }: FormProjetoProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  
  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };

  // 1. Estados de Dados Gerais da Obra
  const [nome, setNome] = useState('');
  const [os, setOs] = useState('');
  const [dataPrevistaInicio, setDataPrevistaInicio] = useState('');
  const [dataPrevistaTermino, setDataPrevistaTermino] = useState('');
  const [dataEfetivaInicio, setDataEfetivaInicio] = useState('');
  const [dataEfetivaTermino, setDataEfetivaTermino] = useState('');
  const [valorTotalContrato, setValorTotalContrato] = useState<number>(0);
  const [status, setStatus] = useState<'planejado' | 'em_andamento' | 'concluido' | 'suspenso'>('em_andamento');
  const [tipologia, setTipologia] = useState('');
  // Dados de obra usados por outros módulos (ex.: relatório fotográfico de engenharia)
  const [agencia, setAgencia] = useState('');
  const [upe, setUpe] = useState('');
  const [sap, setSap] = useState('');
  const [gestor, setGestor] = useState('');
  const [fiscalizacaoEmpresa, setFiscalizacaoEmpresa] = useState('');
  const [fiscal, setFiscal] = useState('');
  const [construtora, setConstrutora] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [clienteFinalId, setClienteFinalId] = useState('');
  const [clientesDisponiveis, setClientesDisponiveis] = useState<any[]>([]);
  
  // Autocomplete e Privilégios
  const { profile } = useAuth();
  const podeCadastrarCliente = profile?.role === 'god' || profile?.role === 'admin';
  const [clienteBusca, setClienteBusca] = useState('');
  const [mostrarDropdownClientes, setMostrarDropdownClientes] = useState(false);
  
  const [clienteFinalBusca, setClienteFinalBusca] = useState('');
  const [mostrarDropdownClienteFinal, setMostrarDropdownClienteFinal] = useState(false);

  // Inicializar o campo de busca quando carregar edição
  useEffect(() => {
    if (clienteId && clientesDisponiveis.length > 0) {
      const cliente = clientesDisponiveis.find(c => c.id === clienteId);
      if (cliente && clienteBusca === '') {
        setClienteBusca(cliente.nome);
      }
    }
  }, [clienteId, clientesDisponiveis]);

  useEffect(() => {
    if (clienteFinalId && clientesDisponiveis.length > 0) {
      const cliente = clientesDisponiveis.find(c => c.id === clienteFinalId);
      if (cliente && clienteFinalBusca === '') {
        setClienteFinalBusca(cliente.nome);
      }
    }
  }, [clienteFinalId, clientesDisponiveis]);

  const clientesFiltrados = clientesDisponiveis.filter(c => 
    c.nome.toLowerCase().includes(clienteBusca.toLowerCase()) || 
    c.documento.includes(clienteBusca)
  );

  const clientesFinalFiltrados = clientesDisponiveis.filter(c => 
    c.nome.toLowerCase().includes(clienteFinalBusca.toLowerCase()) || 
    c.documento.includes(clienteFinalBusca)
  );

  // 2. Estados de Endereço Inteligente (Módulo 2)
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [enderecoBloqueado, setEnderecoBloqueado] = useState(false);

  // Estados específicos para Busca por Google Places
  const [metodoBusca, setMetodoBusca] = useState<'cep' | 'google'>('cep');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [googlePlacesLoaded, setGooglePlacesLoaded] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // 3. Estados de Orçamento Previsto de Custos (Módulo 4)
  const [orcamentos, setOrcamentos] = useState<Record<CategoriaCusto, number>>({
    insumos: 0,
    mao_de_obra: 0,
    empreiteiros: 0,
    ferramentas: 0,
    locacoes: 0,
    logistica: 0,
    administrativo: 0,
    alimentacao: 0,
    outros: 0,
  });

  // 4. Estados de Cronograma de Recebimento (Módulo 3 - Regra dos 50%)
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [somaPercentual, setSomaPercentual] = useState<number>(0);
  const [cronogramaValido, setCronogramaValido] = useState<boolean>(true);

  // Carregar dados caso seja modo de edição
  useEffect(() => {
    if (!projetoId) return;

    const carregarProjetoParaEdicao = async () => {
      setLoading(true);
      try {
        const proj = await fetchProjetoById(projetoId);
        if (proj) {
          setClienteId(proj.cliente_id || '');
          setClienteFinalId(proj.cliente_final_id || '');
          setNome(proj.nome);
          setOs(proj.os);
          setDataPrevistaInicio(proj.data_prevista_inicio);
          setDataPrevistaTermino(proj.data_prevista_termino);
          setDataEfetivaInicio(proj.data_efetiva_inicio || '');
          setDataEfetivaTermino(proj.data_efetiva_termino || '');
          setValorTotalContrato(Number(proj.valor_total_contrato));
          setStatus(proj.status);
          setTipologia(proj.tipologia || '');
          setAgencia(proj.agencia || '');
          setUpe(proj.upe || '');
          setSap(proj.sap || '');
          setGestor(proj.gestor || '');
          setFiscalizacaoEmpresa(proj.fiscalizacao_empresa || '');
          setFiscal(proj.fiscal || '');
          setConstrutora(proj.construtora || '');
          setResponsavel(proj.responsavel || '');

          setCep(proj.cep);
          setLogradouro(proj.logradouro);
          setBairro(proj.bairro);
          setCidade(proj.cidade);
          setUf(proj.uf);
          setNumero(proj.numero);
          setComplemento(proj.complemento || '');
          setEnderecoBloqueado(true);

          // Carregar orçamentos
          const orcamentosObra = await fetchOrcamentosByProjeto(projetoId);
          if (orcamentosObra && orcamentosObra.length > 0) {
            const orcMap = {
              insumos: 0,
              mao_de_obra: 0,
              empreiteiros: 0,
              ferramentas: 0,
              locacoes: 0,
              logistica: 0,
              administrativo: 0,
              alimentacao: 0,
              outros: 0,
            };
            orcamentosObra.forEach(o => {
              if (o.categoria in orcMap) {
                orcMap[o.categoria as CategoriaCusto] = Number(o.valor_previsto);
              }
            });
            setOrcamentos(orcMap);
          }

          // Carregar recebimentos
          const recebimentosObra = await fetchRecebimentosByProjeto(projetoId);
          if (recebimentosObra && recebimentosObra.length > 0) {
            const recs = recebimentosObra.map(r => ({
              id: r.id,
              parcela_numero: r.parcela_numero,
              percentual: Number(r.percentual),
              valor: Number(r.valor),
              data_prevista: r.data_prevista,
              status: r.status,
              projeto_id: r.projeto_id,
              data_pagamento: r.data_pagamento
            }));
            setRecebimentos(recs);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar projeto para edição:', err);
        showToast('Erro ao carregar os dados do projeto.', 'error');
      } finally {
        setLoading(false);
      }
    };

    carregarProjetoParaEdicao();
  }, [projetoId]);

  // Carregar Clientes Disponíveis
  useEffect(() => {
    const carregarClientes = async () => {
      try {
        const { data, error } = await supabase.from('crm_clientes').select('id, nome, documento');
        if (!error && data) {
          setClientesDisponiveis(data);
        }
      } catch (err) {
        console.error('Erro ao buscar clientes:', err);
      }
    };
    carregarClientes();
  }, []);

  // Auto-geração das parcelas de 50% (Módulo 3)
  useEffect(() => {
    // Só auto-gera se não for projeto existente e recebimentos estiver vazio
    if (!projetoId && valorTotalContrato > 0 && dataPrevistaInicio && dataPrevistaTermino && recebimentos.length === 0) {
      // Calcular Data Prevista 1: 30 dias a partir da data de início
      const dataInicio = new Date(dataPrevistaInicio);
      const dataParcela1 = new Date(dataInicio);
      dataParcela1.setDate(dataInicio.getDate() + 30);
      const data1Str = dataParcela1.toISOString().split('T')[0];

      // Parcela 2: Data de término da obra
      const data2Str = dataPrevistaTermino;

      const valorParcela = valorTotalContrato / 2;

      setRecebimentos([
        {
          parcela_numero: 1,
          percentual: 50.00,
          valor: valorParcela,
          data_prevista: data1Str,
          status: 'pendente',
          projeto_id: ''
        },
        {
          parcela_numero: 2,
          percentual: 50.00,
          valor: valorParcela,
          data_prevista: data2Str,
          status: 'pendente',
          projeto_id: ''
        }
      ]);
    } else if (valorTotalContrato > 0 && recebimentos.length > 0) {
      // Se o valor total do contrato mudar, recalcular os valores proporcionais às porcentagens atuais
      const novosRecebimentos = recebimentos.map(r => ({
        ...r,
        valor: parseFloat(((valorTotalContrato * r.percentual) / 100).toFixed(2))
      }));
      // Evitar recriação infinita do estado caso os valores sejam idênticos
      const valoresMudaram = novosRecebimentos.some((r, idx) => r.valor !== recebimentos[idx]?.valor);
      if (valoresMudaram) {
        setRecebimentos(novosRecebimentos);
      }
    }
  }, [valorTotalContrato, dataPrevistaInicio, dataPrevistaTermino, projetoId]);

  // Recalcular soma dos percentuais e validar
  useEffect(() => {
    const soma = recebimentos.reduce((acc, curr) => acc + Number(curr.percentual), 0);
    setSomaPercentual(Number(soma.toFixed(2)));
    setCronogramaValido(Math.abs(soma - 100) < 0.01);
  }, [recebimentos]);

  // Busca CEP via ViaCEP (Módulo 2)
  const buscarEnderecoPorCep = async (cepDigitado: string) => {
    const cepLimpo = cepDigitado.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setCepLoading(true);
    setCepError('');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (data.erro) {
        setCepError('CEP não encontrado.');
        setEnderecoBloqueado(false);
      } else {
        setLogradouro(data.logradouro || '');
        setBairro(data.bairro || '');
        setCidade(data.localidade || '');
        setUf(data.uf || '');
        setEnderecoBloqueado(true);
        // Focar no campo de número automaticamente após preencher
        setTimeout(() => {
          document.getElementById('numero-input')?.focus();
        }, 100);
      }
    } catch (err) {
      console.error('Erro ao consultar ViaCEP:', err);
      setCepError('Erro de conexão ao buscar o CEP.');
      setEnderecoBloqueado(false);
    } finally {
      setCepLoading(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setCep(valor);
    if (valor.replace(/\D/g, '').length === 8) {
      buscarEnderecoPorCep(valor);
    } else {
      setEnderecoBloqueado(false);
    }
  };

  // Efeito para carregar script da API Google Places de forma assíncrona sob demanda
  useEffect(() => {
    if (metodoBusca === 'google' && !googlePlacesLoaded) {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        console.warn('Chave Google Places não encontrada.');
        return;
      }

      const scriptId = 'google-maps-places-script';
      let script = document.getElementById(scriptId) as HTMLScriptElement;

      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=pt-BR`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          setGooglePlacesLoaded(true);
        };
        document.head.appendChild(script);
      } else {
        if ((window as any).google) {
          setGooglePlacesLoaded(true);
        } else {
          script.addEventListener('load', () => {
            setGooglePlacesLoaded(true);
          });
        }
      }
    }
  }, [metodoBusca, googlePlacesLoaded]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (val.length < 3) {
      setSuggestions([]);
      return;
    }

    if ((window as any).google && googlePlacesLoaded) {
      const autocompleteService = new (window as any).google.maps.places.AutocompleteService();
      autocompleteService.getPlacePredictions(
        { input: val, componentRestrictions: { country: 'br' } },
        (predictions: any[], status: any) => {
          if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions);
          } else {
            setSuggestions([]);
          }
        }
      );
    }
  };

  const handleSelectSuggestion = (placeId: string) => {
    setGoogleLoading(true);
    setSuggestions([]);
    
    const dummyDiv = document.createElement('div');
    const service = new (window as any).google.maps.places.PlacesService(dummyDiv);

    service.getDetails({ placeId, fields: ['address_components', 'formatted_address'] }, (place: any, status: any) => {
      setGoogleLoading(false);
      if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && place && place.address_components) {
        let cepVal = '';
        let logradouroVal = '';
        let bairroVal = '';
        let cidadeVal = '';
        let ufVal = '';
        let numeroVal = '';

        place.address_components.forEach((component: any) => {
          const types = component.types;
          if (types.includes('postal_code')) {
            cepVal = component.long_name;
          }
          if (types.includes('route')) {
            logradouroVal = component.long_name;
          }
          if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
            bairroVal = component.long_name;
          }
          if (types.includes('administrative_area_level_2') || types.includes('locality')) {
            cidadeVal = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            ufVal = component.short_name;
          }
          if (types.includes('street_number')) {
            numeroVal = component.long_name;
          }
        });

        setCep(cepVal);
        setLogradouro(logradouroVal);
        setBairro(bairroVal);
        setCidade(cidadeVal);
        setUf(ufVal);
        if (numeroVal) setNumero(numeroVal);
        setSearchQuery(place.formatted_address || '');
        setEnderecoBloqueado(true);
        
        setTimeout(() => {
          document.getElementById('numero-input')?.focus();
        }, 100);
      }
    });
  };

  // Alterações de parcelas individuais
  const handleParcelaChange = (index: number, campo: keyof Recebimento, valor: any) => {
    const novosRecebimentos = [...recebimentos];
    
    if (campo === 'percentual') {
      const pct = parseFloat(valor) || 0;
      novosRecebimentos[index] = {
        ...novosRecebimentos[index],
        percentual: pct,
        valor: parseFloat(((valorTotalContrato * pct) / 100).toFixed(2))
      };
    } else if (campo === 'valor') {
      const val = parseFloat(valor) || 0;
      novosRecebimentos[index] = {
        ...novosRecebimentos[index],
        valor: val,
        percentual: valorTotalContrato > 0 ? parseFloat(((val / valorTotalContrato) * 100).toFixed(2)) : 0
      };
    } else {
      novosRecebimentos[index] = {
        ...novosRecebimentos[index],
        [campo]: valor
      };
    }

    setRecebimentos(novosRecebimentos);
  };

  // Adicionar Parcela ao Cronograma
  const adicionarParcela = () => {
    const novoNumero = recebimentos.length + 1;
    const pctRestante = Math.max(0, 100 - somaPercentual);
    const valorRestante = parseFloat(((valorTotalContrato * pctRestante) / 100).toFixed(2));
    
    setRecebimentos([
      ...recebimentos,
      {
        parcela_numero: novoNumero,
        percentual: pctRestante,
        valor: valorRestante,
        data_prevista: dataPrevistaTermino || new Date().toISOString().split('T')[0],
        status: 'pendente',
        projeto_id: ''
      }
    ]);
  };

  // Remover Parcela
  const removerParcela = (index: number) => {
    const filtradas = recebimentos.filter((_, idx) => idx !== index);
    // Reordenar números das parcelas
    const reordenadas = filtradas.map((r, idx) => ({
      ...r,
      parcela_numero: idx + 1
    }));
    setRecebimentos(reordenadas);
  };

  // Cálculos de Margem Teórica da Obra
  const somaOrcamento = Object.values(orcamentos).reduce((acc, curr) => acc + curr, 0);
  const margemTeorica = valorTotalContrato - somaOrcamento;
  const margemPercentual = valorTotalContrato > 0 ? (margemTeorica / valorTotalContrato) * 100 : 0;

  // Envio de Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clienteId || !nome || !os || !dataPrevistaInicio || !dataPrevistaTermino || !cep || !logradouro || !bairro || !cidade || !uf || !numero || !tipologia) {
      showToast('Por favor, selecione um cliente e preencha todos os campos obrigatórios do projeto e endereço.', 'warning');
      return;
    }

    if (!cronogramaValido) {
      showToast('A soma das parcelas de recebimento deve ser exatamente igual a 100%!', 'warning');
      return;
    }

    setLoading(true);

    const projetoPayload: Projeto = {
      id: projetoId, // Enviando o ID para atualizar se já existir
      cliente_id: clienteId,
      cliente_final_id: clienteFinalId || undefined,
      nome,
      os,
      data_prevista_inicio: dataPrevistaInicio,
      data_prevista_termino: dataPrevistaTermino,
      data_efetiva_inicio: dataEfetivaInicio || null,
      data_efetiva_termino: dataEfetivaTermino || null,
      valor_total_contrato: valorTotalContrato,
      cep,
      logradouro,
      bairro,
      cidade,
      uf,
      numero,
      complemento: complemento || null,
      status,
      tipologia,
      agencia: agencia || null,
      upe: upe || null,
      sap: sap || null,
      gestor: gestor || null,
      fiscalizacao_empresa: fiscalizacaoEmpresa || null,
      fiscal: fiscal || null,
      construtora: construtora || null,
      responsavel: responsavel || null
    };

    try {
      await salvarProjetoCompleto(projetoPayload, orcamentos, recebimentos);
      
      showToast(projetoId ? 'Projeto e cronograma atualizados com sucesso!' : 'Projeto cadastrado e salvo com sucesso!', 'success');
      setTimeout(() => {
        router.push(projetoId ? '/projetos' : '/');
      }, 1500);
    } catch (err) {
      console.error('Erro ao salvar projeto:', err);
      showToast('Houve um erro ao processar o cadastro do projeto.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full pb-16">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
      
      {/* Título da Página */}
      <div className="flex items-center justify-between border-b border-card-border pb-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-main flex items-center gap-1.5 uppercase tracking-wider font-vomzom">
            <Briefcase className="text-brand-blue dark:text-brand-ocre" size={16} /> {projetoId ? 'Editar Projeto' : 'Cadastrar Novo Projeto'}
          </h2>
          <p className="text-sub text-[10px] mt-0.5">
            {projetoId ? `Editando OS ${os} - Planejamento financeiro, endereço inteligente e orçamento.` : 'Planejamento estruturado de engenharia, endereço inteligente e faturamento financeiro.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {projetoId && (
            <Link
              href={`/engenharia/relatorio-fotografico?projetoId=${projetoId}`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-brand-ocre/30 bg-brand-ocre/10 hover:bg-brand-ocre/20 text-brand-ocre text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Abrir ou cadastrar o Relatório Fotográfico deste projeto"
            >
              <Camera size={15} /> Relatório Fotográfico
            </Link>
          )}
          <button
            type="submit"
            disabled={loading || !cronogramaValido}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-ocre text-brand-dark text-xs font-bold hover:bg-brand-ocre/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Salvando...
              </>
            ) : (
              <>
                <Check size={18} /> {projetoId ? 'Salvar Alterações' : 'Salvar Projeto Integrado'}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
        
        {/* ══════════ COLUNA 1: DADOS DO PROJETO + ENDEREÇO ══════════ */}
        <div className="space-y-5">
          {/* Módulo 1: Dados Gerais do Projeto */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom">
              <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">1</span>
              Dados Gerais do Projeto
            </h3>
            
            <div className="space-y-3">
              <div className="space-y-1 relative">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider text-brand-ocre">Cliente / Contratante *</label>
                  {podeCadastrarCliente && (
                    <Link href="/crm/clientes/novo" className="text-[10px] font-bold text-brand-blue hover:text-brand-blue/80 flex items-center gap-1">
                      <UserPlus size={10} /> Novo Cliente
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={14} className="text-sub" />
                  </div>
                  <input
                    type="text"
                    required={!clienteId}
                    value={clienteBusca}
                    onChange={(e) => {
                      setClienteBusca(e.target.value);
                      setClienteId('');
                      setMostrarDropdownClientes(true);
                    }}
                    onFocus={() => setMostrarDropdownClientes(true)}
                    onBlur={() => setTimeout(() => setMostrarDropdownClientes(false), 200)}
                    className="w-full pl-9 pr-3 py-2 bg-background border border-card-border rounded-lg text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-ocre focus:ring-1 focus:ring-brand-ocre transition-all font-bold"
                    placeholder="Busque pelo nome ou documento..."
                  />
                  {mostrarDropdownClientes && clientesFiltrados.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-card border border-card-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {clientesFiltrados.map(c => (
                        <div
                          key={c.id}
                          className="px-3 py-2 text-xs text-main hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer font-medium border-b border-card-border/50 last:border-0"
                          onClick={() => {
                            setClienteId(c.id);
                            setClienteBusca(c.nome);
                            setMostrarDropdownClientes(false);
                          }}
                        >
                          <div className="font-bold">{c.nome}</div>
                          <div className="text-[10px] text-sub">{c.documento}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {clientesDisponiveis.length === 0 && (
                  <p className="text-[9px] text-red-500 mt-0.5 font-bold">Nenhum cliente cadastrado no CRM. Cadastre um cliente antes de criar o projeto.</p>
                )}
              </div>

              {/* Cliente Final / Banco (Opcional) */}
              <div className="space-y-1 relative">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Cliente Final / Banco <span className="text-[9px] lowercase font-normal">(opcional)</span></label>
                  {podeCadastrarCliente && (
                    <Link href="/crm/clientes/novo" className="text-[10px] font-bold text-brand-blue hover:text-brand-blue/80 flex items-center gap-1">
                      <UserPlus size={10} /> Novo
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={14} className="text-sub" />
                  </div>
                  <input
                    type="text"
                    value={clienteFinalBusca}
                    onChange={(e) => {
                      setClienteFinalBusca(e.target.value);
                      setClienteFinalId('');
                      setMostrarDropdownClienteFinal(true);
                    }}
                    onFocus={() => setMostrarDropdownClienteFinal(true)}
                    onBlur={() => setTimeout(() => setMostrarDropdownClienteFinal(false), 200)}
                    className="w-full pl-9 pr-3 py-2 bg-background border border-card-border rounded-lg text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-ocre focus:ring-1 focus:ring-brand-ocre transition-all"
                    placeholder="Ex: Itaú, Santander..."
                  />
                  {mostrarDropdownClienteFinal && clientesFinalFiltrados.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-card border border-card-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {clientesFinalFiltrados.map(c => (
                        <div
                          key={c.id}
                          className="px-3 py-2 text-xs text-main hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer font-medium border-b border-card-border/50 last:border-0"
                          onClick={() => {
                            setClienteFinalId(c.id);
                            setClienteFinalBusca(c.nome);
                            setMostrarDropdownClienteFinal(false);
                          }}
                        >
                          <div className="font-bold">{c.nome}</div>
                          <div className="text-[10px] text-sub">{c.documento}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Nome do Projeto / Agência *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Residencial Aurora ou Agência 1234"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">OS *</label>
                  <input
                    type="text"
                    required
                    placeholder="OS-2026-001"
                    value={os}
                    onChange={(e) => setOs(e.target.value)}
                    className="w-full bg-background border border-card-border rounded-lg px-2.5 py-2 text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Tipologia / Programa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Residencial ou Programa"
                    value={tipologia}
                    onChange={(e) => setTipologia(e.target.value)}
                    className="w-full bg-background border border-card-border rounded-lg px-2.5 py-2 text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Datas Previstas */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Previsão Início *</label>
                  <input type="date" required value={dataPrevistaInicio} onChange={(e) => setDataPrevistaInicio(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-2 py-1.5 text-xs text-main focus:outline-none focus:border-brand-blue transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Previsão Término *</label>
                  <input type="date" required value={dataPrevistaTermino} onChange={(e) => setDataPrevistaTermino(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-2 py-1.5 text-xs text-main focus:outline-none focus:border-brand-blue transition-all" />
                </div>
              </div>

              {/* Datas Efetivas (logo abaixo das previstas) */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Início Efetivo</label>
                  <input type="date" value={dataEfetivaInicio} onChange={(e) => setDataEfetivaInicio(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-2 py-1.5 text-xs text-main focus:outline-none focus:border-brand-blue transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Término Efetivo</label>
                  <input type="date" value={dataEfetivaTermino} onChange={(e) => setDataEfetivaTermino(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-2 py-1.5 text-xs text-main focus:outline-none focus:border-brand-blue transition-all" />
                </div>
              </div>

              {/* Dados de engenharia (opcional) */}
              <div className="pt-2 border-t border-card-border/60 space-y-2">
                <p className="text-[9px] font-bold text-desc uppercase tracking-wider">Dados de engenharia (opcional)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Agência</label>
                    <input type="text" value={agencia} onChange={(e) => setAgencia(e.target.value)} placeholder="ex.: 8647PERSONNALITE RJ-CAMPOS" className="w-full bg-background border border-card-border rounded-lg px-2.5 py-2 text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-semibold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Cód UPE</label>
                    <input type="text" value={upe} onChange={(e) => setUpe(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-2.5 py-2 text-xs text-main focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-semibold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Cód SAP</label>
                    <input type="text" value={sap} onChange={(e) => setSap(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-2.5 py-2 text-xs text-main focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-semibold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Gestor de Obras</label>
                    <input type="text" value={gestor} onChange={(e) => setGestor(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-2.5 py-2 text-xs text-main focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-semibold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Fiscalização — Empresa</label>
                    <input type="text" value={fiscalizacaoEmpresa} onChange={(e) => setFiscalizacaoEmpresa(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-2.5 py-2 text-xs text-main focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-semibold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Fiscal</label>
                    <input type="text" value={fiscal} onChange={(e) => setFiscal(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-2.5 py-2 text-xs text-main focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-semibold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Construtora — Empresa</label>
                    <input type="text" value={construtora} onChange={(e) => setConstrutora(e.target.value)} placeholder="ex.: EGF CONSTRUTORA" className="w-full bg-background border border-card-border rounded-lg px-2.5 py-2 text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-semibold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Responsável</label>
                    <input type="text" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-2.5 py-2 text-xs text-main focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-semibold" />
                  </div>
                </div>
              </div>

              {/* Status do Projeto (logo abaixo de Responsável) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Status do Projeto</label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-semibold"
                >
                  <option value="planejado">Planejado</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluido">Concluído</option>
                  <option value="suspenso">Suspenso</option>
                </select>
              </div>

              {/* Valor Total do Contrato (logo abaixo de Status) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Valor Total do Contrato (R$) *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-desc">
                    <DollarSign size={14} className="text-brand-blue" />
                  </div>
                  <MoneyInput
                    value={valorTotalContrato}
                    onChange={setValorTotalContrato}
                    required
                    placeholder="0,00"
                    className="w-full bg-background border border-card-border rounded-lg pl-8 pr-2.5 py-2 text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Módulo 2: Endereço Inteligente */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm text-left">
            <div className="flex items-center justify-between border-b border-card-border pb-2">
              <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 uppercase tracking-wider font-vomzom">
                <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">2</span>
                Endereço Inteligente
              </h3>
              {(cepLoading || googleLoading) && (
                <span className="flex items-center gap-1 text-[10px] text-brand-blue font-bold">
                  <Loader2 className="animate-spin" size={12} /> Buscando...
                </span>
              )}
            </div>

            {/* Alternador de Método de Busca */}
            <div className="grid grid-cols-2 gap-1 bg-background border border-card-border rounded-lg p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => { setMetodoBusca('cep'); setEnderecoBloqueado(false); }}
                className={`py-1.5 rounded-md transition-all cursor-pointer text-center ${
                  metodoBusca === 'cep' ? 'bg-brand-blue/10 text-brand-blue dark:bg-brand-ocre/10 dark:text-brand-ocre' : 'text-sub'
                }`}
              >
                Busca CEP
              </button>
              <button
                type="button"
                onClick={() => { setMetodoBusca('google'); setEnderecoBloqueado(false); }}
                className={`py-1.5 rounded-md transition-all cursor-pointer text-center ${
                  metodoBusca === 'google' ? 'bg-brand-blue/10 text-brand-blue dark:bg-brand-ocre/10 dark:text-brand-ocre' : 'text-sub'
                }`}
              >
                Google Places
              </button>
            </div>

            <div className="space-y-3">
              {metodoBusca === 'cep' ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">CEP *</label>
                  <input
                    type="text"
                    required
                    placeholder="00000-000"
                    value={cep}
                    onChange={handleCepChange}
                    className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-semibold"
                  />
                  {cepError && <span className="text-[10px] text-red-500 font-bold block mt-0.5">{cepError}</span>}
                </div>
              ) : (
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Buscar por Nome / Agência *</label>
                  <input
                    type="text"
                    placeholder="Ex: Agência Banco do Brasil Centro Aprimore"
                    value={searchQuery}
                    onChange={handleQueryChange}
                    className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-semibold"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 z-30 bg-card border border-card-border rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto divide-y divide-card-border text-xs text-main font-semibold">
                      {suggestions.map((suggestion) => (
                        <div
                          key={suggestion.place_id}
                          onClick={() => handleSelectSuggestion(suggestion.place_id)}
                          className="p-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer transition-colors"
                        >
                          {suggestion.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Logradouro *</label>
                  {enderecoBloqueado && (
                    <button
                      type="button"
                      onClick={() => setEnderecoBloqueado(false)}
                      className="text-[9px] text-brand-blue dark:text-brand-ocre hover:underline font-black uppercase"
                    >
                      Editar Campo
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  readOnly={enderecoBloqueado}
                  placeholder="Logradouro"
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-xs text-main focus:outline-none transition-all ${
                    enderecoBloqueado 
                      ? 'bg-zinc-150 dark:bg-zinc-900/50 border-card-border text-desc cursor-not-allowed font-semibold' 
                      : 'bg-background border-card-border focus:border-brand-blue focus:ring-1 focus:ring-brand-blue'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Bairro *</label>
                  <input type="text" required readOnly={enderecoBloqueado} placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-xs text-main focus:outline-none transition-all ${enderecoBloqueado ? 'bg-zinc-150 dark:bg-zinc-900/50 border-card-border text-desc cursor-not-allowed font-semibold' : 'bg-background border-card-border focus:border-brand-blue focus:ring-1 focus:ring-brand-blue'}`} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Cidade *</label>
                  <input type="text" required readOnly={enderecoBloqueado} placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-xs text-main focus:outline-none transition-all ${enderecoBloqueado ? 'bg-zinc-150 dark:bg-zinc-900/50 border-card-border text-desc cursor-not-allowed font-semibold' : 'bg-background border-card-border focus:border-brand-blue focus:ring-1 focus:ring-brand-blue'}`} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">UF *</label>
                  <input type="text" required maxLength={2} readOnly={enderecoBloqueado} placeholder="UF" value={uf} onChange={(e) => setUf(e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-xs text-main focus:outline-none transition-all text-center ${enderecoBloqueado ? 'bg-zinc-150 dark:bg-zinc-900/50 border-card-border text-desc cursor-not-allowed font-bold' : 'bg-background border-card-border focus:border-brand-blue focus:ring-1 focus:ring-brand-blue'}`} />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-brand-blue uppercase tracking-wider">Número *</label>
                  <input type="text" required id="numero-input" placeholder="Ex: 1000" value={numero} onChange={(e) => setNumero(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-bold" />
                </div>
              </div>

              {metodoBusca === 'google' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">CEP *</label>
                  <input
                    type="text"
                    required
                    placeholder="00000-000"
                    value={cep}
                    onChange={(e) => setCep(e.target.value)}
                    className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all font-semibold"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Complemento</label>
                <input type="text" placeholder="Ex: Apt 4B, Bloco A" value={complemento} onChange={(e) => setComplemento(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all" />
              </div>
            </div>
            
            {enderecoBloqueado && (
              <p className="text-[10px] text-desc flex items-center gap-1.5 bg-background/50 p-2 rounded-lg border border-card-border">
                <MapPin size={12} className="text-brand-blue shrink-0" /> 
                <span>Endereço preenchido via {metodoBusca === 'cep' ? 'ViaCEP' : 'Google Places'}.</span>
              </p>
            )}
          </div>
        </div>

        {/* ══════════ COLUNA 2: CRONOGRAMA DE FATURAMENTO + METAS ══════════ */}
        <div className="space-y-5">
          {/* Módulo 3: Cronograma de Faturamento */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm text-left">
            <div className="flex items-center justify-between border-b border-card-border pb-2">
              <div>
                <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 uppercase tracking-wider font-vomzom">
                  <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">3</span>
                  Cronograma de Faturamento
                </h3>
                <p className="text-[10px] text-sub mt-0.5">
                  A soma total das parcelas deve ser igual a 100%.
                </p>
              </div>
              <button
                type="button"
                onClick={adicionarParcela}
                disabled={valorTotalContrato <= 0}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-card-border bg-card hover:bg-brand-blue hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs text-[10px] font-bold"
              >
                <Plus size={12} className="text-brand-blue" /> Parcela
              </button>
            </div>

            {valorTotalContrato <= 0 ? (
              <div className="text-center py-6 bg-background/40 border border-dashed border-card-border rounded-lg">
                <p className="text-xs text-desc font-semibold px-4">
                  Preencha o valor do contrato para habilitar o cronograma.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recebimentos.map((rec, index) => (
                  <div 
                    key={index} 
                    className="bg-background/40 p-3 rounded-xl border border-card-border/60 space-y-2.5 relative group"
                  >
                    <div className="flex justify-between items-center border-b border-card-border/40 pb-1.5">
                      <span className="font-black text-[10px] text-brand-blue uppercase tracking-wider">Parcela #{rec.parcela_numero}</span>
                      {recebimentos.length > 1 && (
                        <button type="button" onClick={() => removerParcela(index)} className="p-1 rounded-md border border-card-border bg-card hover:bg-red-500/10 text-desc hover:text-red-500 transition-colors cursor-pointer shadow-2xs">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Porcentagem</label>
                        <div className="relative">
                          <input type="number" step="0.01" required value={rec.percentual || ''} onChange={(e) => handleParcelaChange(index, 'percentual', e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-brand-blue font-bold" />
                          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-desc text-[10px]">%</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Valor</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-desc text-[10px] font-bold">R$</div>
                          <MoneyInput
                            value={rec.valor}
                            onChange={(val) => handleParcelaChange(index, 'valor', val)}
                            required
                            placeholder="0,00"
                            className="w-full bg-background border border-card-border rounded-lg pl-7 pr-2 py-1.5 text-xs text-main focus:outline-none focus:border-brand-blue font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Data de Previsão</label>
                      <input type="date" required value={rec.data_prevista} onChange={(e) => handleParcelaChange(index, 'data_prevista', e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-brand-blue font-semibold" />
                    </div>
                  </div>
                ))}

                <div className="flex flex-col items-stretch bg-background border border-card-border p-3 rounded-xl gap-2 text-left">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${cronogramaValido ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    <div className="text-[10px] font-semibold">
                      <span className="text-sub">Soma Acumulada: </span>
                      <span className={`font-black ${cronogramaValido ? 'text-emerald-500' : 'text-red-500'}`}>
                        {somaPercentual}%
                      </span>
                    </div>
                  </div>
                  {!cronogramaValido ? (
                    <div className="flex items-center gap-1.5 text-red-500 text-[10px] font-black uppercase tracking-wider">
                      <ShieldAlert size={13} /> A soma deve ser igual a 100%!
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase tracking-wider">
                      <Check size={13} /> Cronograma validado (100%)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Módulo 4: Metas de Gastos */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm text-left">
            <div>
              <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom">
                <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">4</span>
                Metas de Gastos
              </h3>
              <p className="text-[10px] text-sub mt-0.5">
                Defina o teto de gastos previsto por categoria.
              </p>
            </div>

            <div className="space-y-2.5">
              {(Object.keys(orcamentos) as CategoriaCusto[]).map((categoria) => (
                <div key={categoria} className="space-y-1">
                  <span className="text-[10px] font-bold text-desc uppercase tracking-wider block">
                    {CATEGORIAS_CUSTO_LABELS[categoria]}
                  </span>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-desc text-[10px] font-bold">R$</div>
                    <MoneyInput
                      value={orcamentos[categoria]}
                      onChange={(val) => setOrcamentos(prev => ({ ...prev, [categoria]: val }))}
                      placeholder="0,00"
                      className="w-full bg-background border border-card-border rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-main placeholder-slate-600 focus:outline-none focus:border-brand-blue font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════ COLUNA 3: DESPESAS E INFORMAÇÕES DO PROJETO ══════════ */}
        <div className="space-y-5">
          {/* Viabilidade Operacional */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm text-left">
            <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom">
              <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">5</span>
              Viabilidade Operacional
            </h3>

            <div className="bg-background border border-card-border p-3 rounded-xl space-y-2.5 shadow-xs text-left">
              <div className="flex justify-between text-xs text-sub items-center font-semibold">
                <span>Valor do Contrato</span>
                <span className="font-bold text-main">R$ {valorTotalContrato.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs text-sub items-center font-semibold">
                <span>Orçamento de Custos</span>
                <span className="font-bold text-main">R$ {somaOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <div className="border-t border-card-border pt-2 flex justify-between text-xs items-center">
                <span className="font-black text-main uppercase text-[10px]">Margem Prevista</span>
                <div className="text-right flex flex-col items-end">
                  <span className={`font-black text-xs ${margemTeorica >= 0 ? 'text-brand-ocre' : 'text-red-500'}`}>
                    R$ {margemTeorica.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`text-[10px] font-bold ${margemTeorica >= 0 ? 'text-brand-ocre/80' : 'text-red-500/80'}`}>
                    {margemPercentual.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            
            {/* Barra de Distribuição de Custo Teórica */}
            {valorTotalContrato > 0 && (
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-desc text-[10px] font-black uppercase">
                  <span>Proporção Custos / Contrato</span>
                  <span className="font-bold">{((somaOrcamento / valorTotalContrato) * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden flex border border-card-border">
                  <div 
                    style={{ width: `${Math.min(100, (somaOrcamento / valorTotalContrato) * 100)}%` }} 
                    className={`h-full ${somaOrcamento > valorTotalContrato ? 'bg-red-500' : 'bg-brand-blue'}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Distribuição por Categoria */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-3 shadow-sm text-left">
            <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom">
              <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">6</span>
              Distribuição por Categoria
            </h3>
            <div className="space-y-1.5">
              {(Object.keys(orcamentos) as CategoriaCusto[]).map((cat) => {
                const valor = orcamentos[cat];
                const pct = somaOrcamento > 0 ? (valor / somaOrcamento) * 100 : 0;
                if (valor <= 0) return null;
                return (
                  <div key={cat} className="space-y-0.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="font-bold text-desc uppercase tracking-wider">{CATEGORIAS_CUSTO_LABELS[cat]}</span>
                      <span className="font-black text-main">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden border border-card-border">
                      <div style={{ width: `${pct}%` }} className="h-full bg-brand-blue/70 rounded-full transition-all duration-300" />
                    </div>
                  </div>
                );
              })}
              {somaOrcamento <= 0 && (
                <p className="text-[10px] text-desc text-center py-3 font-semibold">Defina metas de gastos para ver a distribuição.</p>
              )}
            </div>
          </div>

          {/* Informações Complementares */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-3 shadow-sm text-left">
            <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom">
              <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">7</span>
              Resumo do Planejamento
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2 bg-background/50 rounded-lg border border-card-border/60">
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider">Parcelas Cadastradas</span>
                <span className="font-black text-main">{recebimentos.length}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-background/50 rounded-lg border border-card-border/60">
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider">Categorias com Meta</span>
                <span className="font-black text-main">{(Object.values(orcamentos).filter(v => v > 0)).length} / {Object.keys(orcamentos).length}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-background/50 rounded-lg border border-card-border/60">
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider">Duração Prevista</span>
                <span className="font-black text-main">
                  {dataPrevistaInicio && dataPrevistaTermino 
                    ? `${Math.ceil((new Date(dataPrevistaTermino).getTime() - new Date(dataPrevistaInicio).getTime()) / (1000 * 60 * 60 * 24))} dias`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 bg-background/50 rounded-lg border border-card-border/60">
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider">Custo/Dia Previsto</span>
                <span className="font-black text-main">
                  {dataPrevistaInicio && dataPrevistaTermino && somaOrcamento > 0
                    ? `R$ ${(somaOrcamento / Math.max(1, Math.ceil((new Date(dataPrevistaTermino).getTime() - new Date(dataPrevistaInicio).getTime()) / (1000 * 60 * 60 * 24)))).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════ COLUNA 4: GRÁFICOS E RELATÓRIOS ══════════ */}
        <div className="space-y-5">
          {/* Gráfico de Proporção */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm text-left">
            <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom">
              <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">8</span>
              Composição Financeira
            </h3>

            <div className="space-y-3">
              {/* Barra Contrato vs Custo vs Margem */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider block">Contrato vs Custos</span>
                {valorTotalContrato > 0 ? (
                  <div className="space-y-2">
                    <div className="h-6 w-full bg-slate-200 dark:bg-zinc-800 rounded-lg overflow-hidden flex border border-card-border shadow-inner">
                      <div 
                        style={{ width: `${Math.min(100, (somaOrcamento / valorTotalContrato) * 100)}%` }}
                        className="h-full bg-[#b45309] flex items-center justify-center transition-all duration-300"
                      >
                        {(somaOrcamento / valorTotalContrato) * 100 >= 15 && (
                          <span className="text-[8px] font-black text-white">Custos {((somaOrcamento / valorTotalContrato) * 100).toFixed(0)}%</span>
                        )}
                      </div>
                      {margemTeorica > 0 && (
                        <div 
                          style={{ width: `${(margemTeorica / valorTotalContrato) * 100}%` }}
                          className="h-full bg-emerald-600/75 flex items-center justify-center transition-all duration-300"
                        >
                          {(margemTeorica / valorTotalContrato) * 100 >= 15 && (
                            <span className="text-[8px] font-black text-white">Margem {margemPercentual.toFixed(0)}%</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[9px] text-sub">
                      <span className="flex items-center gap-1 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-[#b45309]" /> Custos</span>
                      <span className="flex items-center gap-1 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600/75" /> Margem</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-desc py-3 text-center font-semibold">Preencha o contrato e metas para ver o gráfico.</p>
                )}
              </div>

              {/* Cronograma Visual */}
              <div className="space-y-1.5 pt-2 border-t border-card-border/50">
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider block">Cronograma de Parcelas</span>
                {recebimentos.length > 0 ? (
                  <div className="space-y-1.5">
                    {recebimentos.map((rec, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-brand-blue shrink-0 w-4">#{rec.parcela_numero}</span>
                        <div className="flex-1 h-4 bg-slate-200 dark:bg-zinc-800 rounded-md overflow-hidden border border-card-border">
                          <div 
                            style={{ width: `${rec.percentual}%` }}
                            className="h-full bg-[#2563eb] flex items-center justify-center transition-all duration-300"
                          >
                            {rec.percentual >= 15 && <span className="text-[7px] font-black text-white">{rec.percentual}%</span>}
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-sub shrink-0">
                          {rec.data_prevista ? new Date(rec.data_prevista).toLocaleDateString('pt-BR') : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-desc py-3 text-center font-semibold">Adicione parcelas ao cronograma.</p>
                )}
              </div>
            </div>
          </div>

          {/* Indicadores do Projeto */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-3 shadow-sm text-left">
            <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom">
              <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">9</span>
              Indicadores do Projeto
            </h3>
            <div className="space-y-2">
              {/* Margem visual grande */}
              <div className={`p-3 rounded-xl border text-center space-y-1 ${margemTeorica >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <span className="text-[10px] font-black uppercase tracking-wider text-desc block">Margem Prevista</span>
                <span className={`text-2xl font-black ${margemTeorica >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {margemPercentual.toFixed(1)}%
                </span>
                <span className={`text-[10px] font-bold block ${margemTeorica >= 0 ? 'text-emerald-600/70' : 'text-red-500/70'}`}>
                  R$ {margemTeorica.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Status de saúde */}
              <div className={`p-2 rounded-lg border text-center ${
                margemPercentual >= 20 ? 'bg-emerald-500/5 border-emerald-500/20' 
                : margemPercentual >= 10 ? 'bg-amber-500/5 border-amber-500/20'
                : margemPercentual >= 0 ? 'bg-orange-500/5 border-orange-500/20'
                : 'bg-red-500/5 border-red-500/20'
              }`}>
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  margemPercentual >= 20 ? 'text-emerald-600' 
                  : margemPercentual >= 10 ? 'text-amber-600'
                  : margemPercentual >= 0 ? 'text-orange-600'
                  : 'text-red-600'
                }`}>
                  {margemPercentual >= 20 ? '✓ Margem Saudável' 
                  : margemPercentual >= 10 ? '⚠ Margem Aceitável'
                  : margemPercentual >= 0 ? '⚡ Margem Apertada'
                  : '✕ Prejuízo Previsto'}
                </span>
              </div>

              {/* Valor por m² estimado (placeholder informativo) */}
              <div className="p-2 bg-background/50 rounded-lg border border-card-border/60 flex justify-between items-center">
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider">Maior Custo</span>
                <span className="text-[10px] font-black text-main">
                  {(() => {
                    const entries = Object.entries(orcamentos).filter(([, v]) => v > 0);
                    if (entries.length === 0) return '—';
                    const max = entries.reduce((a, b) => a[1] > b[1] ? a : b);
                    return CATEGORIAS_CUSTO_LABELS[max[0] as CategoriaCusto];
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </form>
  );
}
