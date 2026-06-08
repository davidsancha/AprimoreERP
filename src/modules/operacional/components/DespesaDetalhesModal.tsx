'use client';

import React, { useState, useEffect } from 'react';
import { X, Receipt, Store, Calendar, CreditCard, Box, Tag, Loader2, Info } from 'lucide-react';
import { CustoRealizado, NotaFiscal } from '@/modules/operacional/types';
import { fetchNotaFiscalByCustoId } from '@/modules/operacional/services/apiProjetos';
import ValorPremium from '@/shared/components/ValorPremium';

interface DespesaDetalhesModalProps {
  isOpen: boolean;
  onClose: () => void;
  custo: CustoRealizado | null;
}

export default function DespesaDetalhesModal({ isOpen, onClose, custo }: DespesaDetalhesModalProps) {
  const [loading, setLoading] = useState(true);
  const [notaFiscal, setNotaFiscal] = useState<NotaFiscal | null>(null);

  useEffect(() => {
    async function loadNotaFiscal() {
      if (!isOpen || !custo?.id) return;
      
      setLoading(true);
      try {
        const nf = await fetchNotaFiscalByCustoId(custo.id);
        setNotaFiscal(nf);
      } catch (err) {
        console.error('Erro ao buscar nota fiscal da despesa:', err);
      } finally {
        setLoading(false);
      }
    }

    loadNotaFiscal();
  }, [isOpen, custo?.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-card-border flex justify-between items-center bg-background/80">
          <div className="flex items-center gap-2">
            <div className="bg-brand-ocre/10 p-2 rounded-lg text-brand-ocre">
              <Receipt size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-main font-vomzom leading-tight">
                Detalhes da Despesa
              </h3>
              <p className="text-xs text-sub font-medium mt-0.5">
                Lançamento efetuado em {custo ? new Date(custo.data_custo).toLocaleDateString('pt-BR') : ''}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-sub hover:text-main p-1.5 rounded-lg hover:bg-card-border transition-colors cursor-pointer"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          
          {/* Informações Principais do Custo */}
          <div className="bg-slate-50/50 dark:bg-zinc-900/50 border border-card-border rounded-xl p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider block mb-1">Descrição</span>
                <span className="text-sm font-semibold text-main">{custo?.descricao}</span>
              </div>
              <div className="sm:text-right">
                <span className="text-[10px] font-bold text-desc uppercase tracking-wider block mb-1">Valor Total Lançado</span>
                <ValorPremium valor={custo?.valor || 0} size="lg" colorClass="text-red-500" />
              </div>
            </div>
          </div>

          {/* Área da Nota Fiscal */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-desc bg-card border border-card-border rounded-xl border-dashed">
              <Loader2 className="animate-spin text-brand-ocre" size={24} />
              <span className="text-xs font-semibold">Buscando detalhes do cupom...</span>
            </div>
          ) : notaFiscal ? (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-main flex items-center gap-2 border-b border-card-border pb-2">
                <Store size={16} className="text-brand-blue dark:text-brand-ocre" /> 
                Dados do Fornecedor / Estabelecimento
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <span className="text-[10px] font-bold text-desc uppercase tracking-wider">Loja</span>
                  <span className="text-xs font-semibold text-main truncate" title={notaFiscal.loja_nome}>{notaFiscal.loja_nome || 'Não identificado'}</span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-[10px] font-bold text-desc uppercase tracking-wider">CNPJ</span>
                  <span className="text-xs font-semibold text-main">{notaFiscal.cnpj || 'Não identificado'}</span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-[10px] font-bold text-desc uppercase tracking-wider flex items-center gap-1"><Calendar size={10} /> Data da Emissão</span>
                  <span className="text-xs font-semibold text-main">
                    {notaFiscal.data_emissao ? new Date(notaFiscal.data_emissao).toLocaleString('pt-BR') : 'Não identificada'}
                  </span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-[10px] font-bold text-desc uppercase tracking-wider flex items-center gap-1"><CreditCard size={10} /> Pagamento</span>
                  <span className="text-xs font-semibold text-main truncate" title={notaFiscal.forma_pagamento || 'Não identificada'}>
                    {notaFiscal.forma_pagamento || 'Não identificada'}
                  </span>
                </div>
              </div>

              {/* Itens Comprados */}
              {notaFiscal.itens && notaFiscal.itens.length > 0 && (
                <div className="pt-4">
                  <h4 className="text-sm font-bold text-main flex items-center gap-2 border-b border-card-border pb-2 mb-3">
                    <Box size={16} className="text-brand-blue dark:text-brand-ocre" /> 
                    Itens da Compra ({notaFiscal.itens.length})
                  </h4>
                  
                  <div className="bg-background rounded-lg border border-card-border overflow-hidden">
                    {/* Cabeçalho Desktop */}
                    <div className="hidden sm:grid grid-cols-[3fr_1fr_1.5fr_1.5fr] gap-2 px-4 py-2 bg-slate-50 dark:bg-zinc-800/50 border-b border-card-border text-[10px] font-bold text-desc uppercase tracking-wider">
                      <div>Descrição do Item</div>
                      <div className="text-center">Qtd</div>
                      <div className="text-right">Unitário</div>
                      <div className="text-right">Subtotal</div>
                    </div>
                    
                    {/* Lista */}
                    <div className="divide-y divide-card-border">
                      {notaFiscal.itens.map((item, idx) => (
                        <div key={idx} className="p-3 sm:py-2.5 sm:px-4 sm:grid sm:grid-cols-[3fr_1fr_1.5fr_1.5fr] sm:gap-2 items-center hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                          <div className="font-semibold text-xs text-main mb-1 sm:mb-0 pr-2">
                            {item.nome_item}
                          </div>
                          <div className="flex justify-between sm:justify-center text-xs text-sub">
                            <span className="sm:hidden font-bold uppercase tracking-wider text-[10px]">Qtd:</span>
                            <span>{item.quantidade}</span>
                          </div>
                          <div className="flex justify-between sm:justify-end text-xs text-sub">
                            <span className="sm:hidden font-bold uppercase tracking-wider text-[10px]">Unit:</span>
                            <span>R$ {Number(item.valor_unitario).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between sm:justify-end text-xs font-bold text-main mt-1 sm:mt-0 pt-1 sm:pt-0 border-t border-card-border sm:border-0">
                            <span className="sm:hidden font-bold uppercase tracking-wider text-[10px] text-desc">Subtotal:</span>
                            <span>R$ {Number(item.valor_total).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-zinc-900/50 border border-card-border rounded-xl p-6 text-center space-y-3">
              <Info size={32} className="mx-auto text-desc opacity-50" />
              <p className="text-sm font-semibold text-main">Despesa Lançada Manualmente</p>
              <p className="text-xs text-sub max-w-md mx-auto">
                Não há uma nota fiscal ou cupom digital (QR Code) atrelado a este lançamento. Os dados foram inseridos manualmente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
