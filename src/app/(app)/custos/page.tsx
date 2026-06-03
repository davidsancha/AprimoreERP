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

function CustosFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjetoId = searchParams.get('projetoId');
  const queryCategoria = searchParams.get('categoria');

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loadingProjetos, setLoadingProjetos] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Estados do formulário de lançamento de custo
  const [projetoId, setProjetoId] = useState('');
  const [categoria, setCategoria] = useState<CategoriaCusto>('insumos');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState<number>(0);
  const [dataCusto, setDataCusto] = useState(new Date().toISOString().split('T')[0]);

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
      alert('Por favor, preencha todos os campos corretamente com valores maiores que zero.');
      return;
    }

    setSalvando(true);
    try {
      await salvarCustoRealizado({
        projeto_id: projetoId,
        categoria,
        descricao,
        valor,
        data_custo: dataCusto
      });

      alert('Despesa lançada com sucesso! A saúde financeira da obra foi atualizada no painel.');
      router.push('/');
    } catch (err) {
      console.error('Erro ao salvar despesa:', err);
      alert('Ocorreu um erro ao registrar a despesa.');
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
