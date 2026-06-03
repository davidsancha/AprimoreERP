'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { Calculator, Save, AlertCircle, Plus, Loader2, ArrowLeft, Check, Calendar, HardHat, DollarSign } from 'lucide-react';
import Link from 'next/link';

interface Parceiro {
  id: string;
  nome: string;
  tipo_parceiro: string;
  valor_diaria: number;
}

interface Projeto {
  id: string;
  nome: string;
  os: string;
}

export default function GestaoPagamentosParceiros() {
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSave, setLoadingSave] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);

  const [formData, setFormData] = useState({
    parceiro_id: '',
    projeto_id: '',
    data_pagamento: new Date().toISOString().split('T')[0],
    dias_trabalhados: '1',
    valor_base: 0,
    bonificacao: '0',
    desconto: '0',
    status: 'Pago'
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [resParceiros, resProjetos] = await Promise.all([
          supabase.from('rh_parceiros').select('id, nome, tipo_parceiro, valor_diaria').order('nome'),
          supabase.from('projetos').select('id, nome, os').order('nome')
        ]);

        if (resParceiros.data) setParceiros(resParceiros.data);
        if (resProjetos.data) setProjetos(resProjetos.data);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, []);

  // Atualiza o valor base ao trocar de parceiro
  useEffect(() => {
    if (formData.parceiro_id) {
      const p = parceiros.find(x => x.id === formData.parceiro_id);
      if (p) {
        setFormData(prev => ({ ...prev, valor_base: p.valor_diaria }));
      }
    }
  }, [formData.parceiro_id, parceiros]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Tratamento de valores monetários para input
    if (name === 'bonificacao' || name === 'desconto') {
      // Limitar a apenas números e virgula
      const cleanValue = value.replace(/[^\d]/g, '');
      const numberValue = Number(cleanValue) / 100;
      if (cleanValue === '') {
        setFormData(prev => ({ ...prev, [name]: '0' }));
        return;
      }
      setFormData(prev => ({ ...prev, [name]: numberValue.toString() }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDiasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^\d.]/g, '');
    setFormData(prev => ({ ...prev, dias_trabalhados: val }));
  };

  // Cálculos
  const diasNum = parseFloat(formData.dias_trabalhados) || 0;
  const bonificacaoNum = parseFloat(formData.bonificacao) || 0;
  const descontoNum = parseFloat(formData.desconto) || 0;
  const totalPagamento = (formData.valor_base * diasNum) + bonificacaoNum - descontoNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.parceiro_id || !formData.projeto_id) {
      setErro('Selecione um parceiro e uma obra.');
      return;
    }

    setLoadingSave(true);
    setErro(null);
    setSucesso(false);

    try {
      const { error } = await supabase.from('rh_pagamentos_parceiros').insert([{
        parceiro_id: formData.parceiro_id,
        projeto_id: formData.projeto_id,
        data_pagamento: formData.data_pagamento,
        dias_trabalhados: diasNum,
        valor_base: formData.valor_base,
        bonificacao: bonificacaoNum,
        desconto: descontoNum,
        valor_total: totalPagamento,
        status: formData.status
      }]);

      if (error) throw error;
      setSucesso(true);
      
      // Reset campos de valores e dias
      setFormData(prev => ({
        ...prev,
        dias_trabalhados: '1',
        bonificacao: '0',
        desconto: '0',
      }));

      setTimeout(() => setSucesso(false), 3000);
    } catch (err: any) {
      setErro('Erro ao registrar pagamento: ' + err.message);
    } finally {
      setLoadingSave(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (loadingData) {
    return (
      <div className="flex justify-center items-center h-64 text-brand-blue">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-16">
      
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-card-border pb-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-main flex items-center gap-1.5 uppercase tracking-wider font-vomzom">
            <Calculator className="text-brand-blue dark:text-brand-ocre" size={16} /> Lançar Diárias e Empreitadas
          </h2>
          <p className="text-sub text-[10px] mt-0.5">
            Registre os dias trabalhados por parceiros nas obras e calcule o pagamento automaticamente.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/rh/parceiros/novo" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-brand-blue/30 text-brand-blue hover:bg-brand-blue hover:text-white transition-all text-xs font-bold shadow-sm">
            <Plus size={14} /> Novo Parceiro
          </Link>
        </div>
      </div>

      {erro && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <AlertCircle size={20} />
          <span className="text-xs font-bold">{erro}</span>
        </div>
      )}

      {sucesso && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-600 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <Check size={20} />
          <span className="text-xs font-bold">Pagamento lançado e registrado nos custos da obra com sucesso!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        
        {/* Formulário de Lançamento */}
        <div className="md:col-span-8 bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-5">
          <div className="grid grid-cols-2 gap-4">
            
            {/* Parceiro */}
            <div className="space-y-1 col-span-2 md:col-span-1">
              <label className="text-[10px] font-bold text-desc uppercase tracking-wider text-brand-ocre">Parceiro / Prestador *</label>
              <select name="parceiro_id" value={formData.parceiro_id} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-ocre transition-all font-bold" required>
                <option value="">Selecione o Parceiro...</option>
                {parceiros.map(p => (
                  <option key={p.id} value={p.id}>{p.nome} ({p.tipo_parceiro})</option>
                ))}
              </select>
            </div>

            {/* Obra */}
            <div className="space-y-1 col-span-2 md:col-span-1">
              <label className="text-[10px] font-bold text-desc uppercase tracking-wider text-brand-blue">Obra / Projeto *</label>
              <select name="projeto_id" value={formData.projeto_id} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue transition-all font-bold" required>
                <option value="">Selecione a Obra...</option>
                {projetos.map(p => (
                  <option key={p.id} value={p.id}>[{p.os}] {p.nome}</option>
                ))}
              </select>
            </div>

            {/* Data e Dias Trabalhados */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Data do Registro *</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
                <input type="date" name="data_pagamento" value={formData.data_pagamento} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg pl-9 pr-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue transition-all" required />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Dias Trabalhados *</label>
              <div className="relative">
                <HardHat size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
                <input type="text" name="dias_trabalhados" value={formData.dias_trabalhados} onChange={handleDiasChange} className="w-full bg-background border border-card-border rounded-lg pl-9 pr-3 py-2 text-xs text-main font-bold focus:outline-none focus:border-brand-blue transition-all" placeholder="Ex: 5.5" required />
              </div>
            </div>

            {/* Bonificação e Desconto */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-desc uppercase tracking-wider text-green-600">Bonificação Extra (+)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-bold">R$</span>
                <input type="text" name="bonificacao" value={(parseFloat(formData.bonificacao) * 100).toString()} onChange={handleChange} className="w-full bg-background border border-green-500/30 rounded-lg pl-9 pr-3 py-2 text-xs text-green-600 focus:outline-none focus:border-green-500 transition-all font-bold" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-desc uppercase tracking-wider text-red-500">Descontos (-)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-red-500 font-bold">R$</span>
                <input type="text" name="desconto" value={(parseFloat(formData.desconto) * 100).toString()} onChange={handleChange} className="w-full bg-background border border-red-500/30 rounded-lg pl-9 pr-3 py-2 text-xs text-red-500 focus:outline-none focus:border-red-500 transition-all font-bold" />
              </div>
            </div>

          </div>
        </div>

        {/* Resumo do Cálculo */}
        <div className="md:col-span-4 bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-brand-blue border-b border-brand-blue/20 pb-2 uppercase tracking-wider flex items-center gap-2">
            <Calculator size={14} /> Resumo do Pagamento
          </h3>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-sub font-medium">Diária Padrão do Parceiro:</span>
              <span className="font-bold text-main">{formatCurrency(formData.valor_base)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-sub font-medium">Dias Trabalhados:</span>
              <span className="font-bold text-main">{diasNum} dia(s)</span>
            </div>
            <div className="border-t border-brand-blue/10 pt-2 flex justify-between items-center text-xs">
              <span className="text-sub font-medium">Subtotal:</span>
              <span className="font-bold text-main">{formatCurrency(formData.valor_base * diasNum)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-green-600">
              <span className="font-medium">Bonificações:</span>
              <span className="font-bold">+{formatCurrency(bonificacaoNum)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-red-500">
              <span className="font-medium">Descontos:</span>
              <span className="font-bold">-{formatCurrency(descontoNum)}</span>
            </div>
          </div>

          <div className="bg-brand-blue border border-brand-blue/20 rounded-lg p-4 mt-4 shadow-inner">
            <p className="text-[10px] text-white/80 uppercase tracking-wider font-bold mb-1">Total a Pagar</p>
            <h2 className="text-2xl font-black text-white">{formatCurrency(totalPagamento)}</h2>
          </div>

          <button
            type="submit"
            disabled={loadingSave || !formData.parceiro_id || !formData.projeto_id}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-ocre text-brand-dark text-sm font-bold hover:bg-brand-ocre/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md mt-4"
          >
            {loadingSave ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
            {loadingSave ? 'Lançando...' : 'Confirmar e Lançar Pagamento'}
          </button>
        </div>

      </form>
    </div>
  );
}
