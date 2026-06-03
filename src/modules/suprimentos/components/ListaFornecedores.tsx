'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import Link from 'next/link';
import { Plus, Search, Truck, Wrench, FileText, CheckCircle2 } from 'lucide-react';

interface Fornecedor {
  id: string;
  razao_social: string;
  cnpj: string;
  categoria: string;
  status: string;
  created_at: string;
}

export default function ListaFornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    carregarFornecedores();
  }, []);

  const carregarFornecedores = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suprimentos_fornecedores')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFornecedores(data || []);
    } catch (err) {
      console.error('Erro ao buscar fornecedores:', err);
    } finally {
      setLoading(false);
    }
  };

  const fornecedoresFiltrados = fornecedores.filter(f => 
    f.razao_social.toLowerCase().includes(busca.toLowerCase()) ||
    f.cnpj.includes(busca)
  );

  const formatarCNPJ = (cnpj: string) => {
    if (cnpj.length === 14) {
      return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return cnpj;
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header e Busca */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-card-border pb-5">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-main capitalize font-vomzom">Gestão de Fornecedores</h2>
          <p className="text-sub text-sm mt-1">Gerencie prestadores de serviços e fornecedores de materiais.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
            <input 
              type="text" 
              placeholder="Buscar fornecedor ou CNPJ..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-card border border-card-border rounded-lg text-main focus:outline-none focus:border-brand-blue"
            />
          </div>
          <Link href="/suprimentos/fornecedores/novo" className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-xl font-bold hover:bg-brand-blue/90 shadow-md transition-all text-sm whitespace-nowrap">
            <Plus size={16} /> Novo Fornecedor
          </Link>
        </div>
      </div>

      {/* Grid de Fornecedores */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
        </div>
      ) : fornecedoresFiltrados.length === 0 ? (
        <div className="text-center py-20 bg-card border border-card-border rounded-2xl">
          <Truck className="mx-auto h-12 w-12 text-sub mb-3 opacity-20" />
          <h3 className="text-lg font-bold text-main">Nenhum fornecedor encontrado</h3>
          <p className="text-sub text-sm mt-1 mb-6">Comece cadastrando o seu primeiro fornecedor de obra.</p>
          <Link href="/suprimentos/fornecedores/novo" className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-xl font-bold hover:bg-brand-blue/90 shadow-md transition-all text-sm w-fit mx-auto">
            <Plus size={16} /> Cadastrar Fornecedor
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fornecedoresFiltrados.map((fornecedor) => (
            <div key={fornecedor.id} className="bg-card border border-card-border rounded-2xl p-5 hover:border-brand-blue/30 transition-all group flex flex-col h-full relative">
              
              <div className="absolute top-5 right-5">
                {fornecedor.status === 'ativo' ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded uppercase tracking-wider">
                    <CheckCircle2 size={12} /> Ativo
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded uppercase tracking-wider">
                    Inativo
                  </span>
                )}
              </div>

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
                    {fornecedor.categoria === 'servicos' ? <Wrench size={20} /> : <Truck size={20} />}
                  </div>
                  <div className="pr-16">
                    <h3 className="font-bold text-main text-sm line-clamp-2">{fornecedor.razao_social}</h3>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mt-auto pt-4 border-t border-card-border">
                <div className="flex items-center gap-2 text-xs font-semibold text-sub tracking-wider">
                  <FileText size={14} className="text-brand-ocre opacity-70" />
                  <span>{formatarCNPJ(fornecedor.cnpj)}</span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Categoria: <span className="text-main">{fornecedor.categoria}</span>
                </div>
              </div>
              
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
