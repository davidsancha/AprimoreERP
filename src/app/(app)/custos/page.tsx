'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Coins, 
  Check, 
  Loader2, 
  ArrowLeft,
  DollarSign,
  Calendar,
  Layers,
  FileText
} from 'lucide-react';
import Link from 'next/link';
import { fetchProjetos, salvarCustoRealizado } from '@/modules/operacional/services/apiProjetos';
import { Projeto, CategoriaCusto, CATEGORIAS_CUSTO_LABELS } from '@/modules/operacional/types';
import MoneyInput from '@/shared/components/MoneyInput';
import Toast, { ToastType } from '@/shared/components/Toast';

import QrCodeModal from '@/modules/operacional/components/QrCodeModal';
import { NotaFiscal } from '@/modules/operacional/types';
import { QrCode, Receipt } from 'lucide-react';

function CustosFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjetoId = searchParams.get('projetoId');
  const queryCategoria = searchParams.get('categoria');
  const queryOpenScanner = searchParams.get('openScanner');

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loadingProjetos, setLoadingProjetos] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Estados do formulário de lançamento de custo
  const [projetoId, setProjetoId] = useState('');
  const [categoria, setCategoria] = useState<CategoriaCusto>('insumos');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState<number>(0);
  const [dataCusto, setDataCusto] = useState(new Date().toISOString().split('T')[0]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  
  // Estados para o Leitor de QR Code e Nota Fiscal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [processandoNota, setProcessandoNota] = useState(false);
  const [notaFiscal, setNotaFiscal] = useState<NotaFiscal | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };

  const handleQrScan = async (text: string) => {
    setIsQrModalOpen(false);
    setProcessandoNota(true);
    
    try {
      const res = await fetch('/api/extract-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: text })
      });

      if (!res.ok) {
        throw new Error('Falha ao extrair dados da nota fiscal');
      }

      const data = await res.json();
      
      if (data && data.notaFiscal) {
        const nf: NotaFiscal = data.notaFiscal;
        setNotaFiscal(nf);
        
        // Auto-preencher campos do formulário
        if (nf.valor_total) setValor(nf.valor_total);
        if (nf.loja_nome) {
          const firstItem = nf.itens?.[0]?.nome_item || 'Materiais';
          setDescricao(`Compra em ${nf.loja_nome} - ${firstItem}${nf.itens && nf.itens.length > 1 ? ' e outros' : ''}`);
        }
        if (nf.data_emissao) {
          // Extrair apenas a data (YYYY-MM-DD) do timestamp retornado
          const dataApenas = nf.data_emissao.split('T')[0];
          setDataCusto(dataApenas);
        }
        
        showToast('Nota Fiscal processada com sucesso!', 'success');
      } else {
        throw new Error('Formato de resposta inválido');
      }
    } catch (err) {
      console.error('Erro ao ler QR Code:', err);
      showToast('Não foi possível processar o QR Code. Tente novamente ou preencha manualmente.', 'error');
    } finally {
      setProcessandoNota(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchProjetos();
        setProjetos(data);
        
        // Se houver um projetoId na query string e ele existir na lista, pré-seleciona
        if (queryProjetoId && data.some(p => p.id === queryProjetoId)) {
          setProjetoId(queryProjetoId);
        } else if (data.length > 0) {
          setProjetoId(data[0].id!);
        }

        // Se houver uma categoria válida na query string, pré-seleciona
        const categoriasValidas = Object.keys(CATEGORIAS_CUSTO_LABELS);
        if (queryCategoria && categoriasValidas.includes(queryCategoria)) {
          setCategoria(queryCategoria as CategoriaCusto);
        }

        if (queryOpenScanner === 'true') {
          setIsQrModalOpen(true);
        }
      } catch (err) {
        console.error('Erro ao carregar projetos:', err);
      } finally {
        setLoadingProjetos(false);
      }
    }
    loadData();
  }, [queryProjetoId, queryCategoria]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projetoId || !categoria || !descricao || valor <= 0 || !dataCusto) {
      showToast('Por favor, preencha todos os campos corretamente com valores maiores que zero.', 'warning');
      return;
    }

    setSalvando(true);
    try {
      await salvarCustoRealizado({
        projeto_id: projetoId,
        categoria,
        descricao,
        valor,
        data_custo: dataCusto,
        nota_fiscal: notaFiscal || undefined
      });

      showToast('Despesa lançada com sucesso! A saúde financeira do projeto foi atualizada no painel.', 'success');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err) {
      console.error('Erro ao salvar despesa:', err);
      showToast('Ocorreu um erro ao registrar a despesa.', 'error');
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
          Nenhuma obra cadastrada no sistema. Cadastre uma obra primeiro para poder lançar custos.
        </p>
        <Link 
          href="/projetos/novo"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-brand-ocre text-brand-dark font-bold text-sm hover:bg-brand-ocre/90 transition-colors shadow-md"
        >
          Cadastrar Primeira Obra
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-card-border rounded-2xl p-6 space-y-5 shadow-sm">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
      
      <QrCodeModal 
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onScan={handleQrScan}
      />

      {/* Botão de Leitura Inteligente */}
      <div className="bg-gradient-to-r from-brand-ocre/10 to-transparent border border-brand-ocre/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm">
          <p className="font-semibold text-main flex items-center gap-1.5">
            <Receipt size={16} className="text-brand-ocre" />
            Lançamento Inteligente
          </p>
          <p className="text-sub text-xs mt-1">
            Faça a leitura do QR Code do cupom fiscal para extrair os itens e o valor total automaticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsQrModalOpen(true)}
          disabled={processandoNota}
          className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-ocre/20 text-brand-ocre font-semibold hover:bg-brand-ocre/30 transition-colors border border-brand-ocre/40 text-sm disabled:opacity-50"
        >
          {processandoNota ? (
            <><Loader2 className="animate-spin" size={16} /> Processando...</>
          ) : (
            <><QrCode size={16} /> Ler QR Code</>
          )}
        </button>
      </div>

      {notaFiscal && (
        <div className="bg-black/20 border border-green-500/30 rounded-xl p-5 space-y-4 text-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2 border-b border-card-border">
            <span className="font-bold text-green-400 uppercase tracking-wider flex items-center gap-2">
              <Check size={16} /> Dados Extraídos do Cupom
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Nome da Loja</label>
              <input
                type="text"
                value={notaFiscal.loja_nome}
                onChange={(e) => setNotaFiscal({...notaFiscal, loja_nome: e.target.value})}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:border-brand-ocre focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-desc uppercase tracking-wider">CNPJ</label>
              <input
                type="text"
                value={notaFiscal.cnpj}
                onChange={(e) => setNotaFiscal({...notaFiscal, cnpj: e.target.value})}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:border-brand-ocre focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Data da Compra</label>
              <input
                type="datetime-local"
                value={notaFiscal.data_emissao ? notaFiscal.data_emissao.slice(0, 16) : ''}
                onChange={(e) => setNotaFiscal({...notaFiscal, data_emissao: new Date(e.target.value).toISOString()})}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:border-brand-ocre focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Chave de Acesso</label>
              <input
                type="text"
                value={notaFiscal.chave_acesso || ''}
                onChange={(e) => setNotaFiscal({...notaFiscal, chave_acesso: e.target.value})}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:border-brand-ocre focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Endereço</label>
            <input
              type="text"
              value={notaFiscal.endereco || ''}
              onChange={(e) => setNotaFiscal({...notaFiscal, endereco: e.target.value})}
              className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:border-brand-ocre focus:outline-none"
            />
          </div>

          {notaFiscal.itens && notaFiscal.itens.length > 0 && (
            <div className="mt-4 pt-4 border-t border-card-border">
              <p className="text-[10px] font-bold text-desc uppercase tracking-wider mb-3">Itens Comprados ({notaFiscal.itens.length})</p>
              <div className="bg-background rounded-lg border border-card-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-card border-b border-card-border">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Nome do Item</th>
                      <th className="py-2 px-3 font-semibold text-right">Qtd</th>
                      <th className="py-2 px-3 font-semibold text-right">Vl. Unit</th>
                      <th className="py-2 px-3 font-semibold text-right">Vl. Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {notaFiscal.itens.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                        <td className="py-2 px-3 truncate max-w-[150px]">{item.nome_item}</td>
                        <td className="py-2 px-3 text-right">
                          <input 
                            type="number" 
                            className="w-14 bg-transparent text-right focus:outline-none border-b border-dashed border-card-border focus:border-brand-ocre" 
                            value={item.quantidade} 
                            onChange={(e) => {
                              const newItens = [...notaFiscal.itens!];
                              newItens[idx].quantidade = parseFloat(e.target.value) || 0;
                              newItens[idx].valor_total = newItens[idx].quantidade * newItens[idx].valor_unitario;
                              setNotaFiscal({...notaFiscal, itens: newItens});
                            }}
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input 
                            type="number" 
                            className="w-16 bg-transparent text-right focus:outline-none border-b border-dashed border-card-border focus:border-brand-ocre" 
                            value={item.valor_unitario} 
                            onChange={(e) => {
                              const newItens = [...notaFiscal.itens!];
                              newItens[idx].valor_unitario = parseFloat(e.target.value) || 0;
                              newItens[idx].valor_total = newItens[idx].quantidade * newItens[idx].valor_unitario;
                              setNotaFiscal({...notaFiscal, itens: newItens});
                            }}
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-brand-ocre">
                          R$ {item.valor_total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Projeto */}
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

      {/* Categoria */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-sub uppercase tracking-wider">
          Categoria do Custo *
        </label>
        <select
          required
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaCusto)}
          className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-main focus:outline-none focus:border-brand-ocre"
        >
          {(Object.keys(CATEGORIAS_CUSTO_LABELS) as CategoriaCusto[]).map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORIAS_CUSTO_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      {/* Descrição */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-sub uppercase tracking-wider flex items-center gap-1.5">
          <FileText size={14} className="text-brand-ocre" /> Descrição da Despesa *
        </label>
        <input
          type="text"
          required
          placeholder="Ex: Compra de 50 sacos de cimento Votoran"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-main placeholder-slate-500 focus:outline-none focus:border-brand-ocre"
        />
      </div>

      {/* Valor */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-sub uppercase tracking-wider flex items-center gap-1.5">
          <DollarSign size={14} className="text-brand-ocre" /> Valor Efetivo (R$) *
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

      {/* Data */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-sub uppercase tracking-wider flex items-center gap-1.5">
          <Calendar size={14} className="text-brand-ocre" /> Data do Pagamento *
        </label>
        <input
          type="date"
          required
          value={dataCusto}
          onChange={(e) => setDataCusto(e.target.value)}
          className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-main focus:outline-none focus:border-brand-ocre"
        />
      </div>

      {/* Enviar */}
      <button
        type="submit"
        disabled={salvando}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-ocre text-brand-dark font-bold hover:bg-brand-ocre/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-ocre/10 cursor-pointer"
      >
        {salvando ? (
          <>
            <Loader2 className="animate-spin" size={18} /> Registrando...
          </>
        ) : (
          <>
            <Check size={18} /> Registrar Despesa Efetiva
          </>
        )}
      </button>

    </form>
  );
}

export default function CustosPage() {
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
        <h2 className="text-2xl font-bold tracking-tight text-main flex items-center gap-2">
          <Coins className="text-brand-ocre" /> Registrar Custo Efetivo
        </h2>
        <p className="text-sub text-sm mt-1">
          Lance notas fiscais, faturas ou despesas realizadas da obra para medir a saúde financeira.
        </p>
      </div>

      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-desc">
          <Loader2 className="animate-spin text-brand-ocre" size={32} />
          <span className="text-sm font-medium">Carregando formulário...</span>
        </div>
      }>
        <CustosFormContent />
      </Suspense>

    </div>
  );
}
