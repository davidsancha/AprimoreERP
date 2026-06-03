'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import Link from 'next/link';
import { Plus, Building2, User, Search, MapPin, Phone, Mail } from 'lucide-react';

interface Cliente {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  tipo: string;
  created_at: string;
}

export default function ListaClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    carregarClientes();
  }, []);

  const carregarClientes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  const clientesFiltrados = clientes.filter(c => 
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.documento.includes(busca)
  );

  const formatarDocumento = (doc: string, tipo: string) => {
    if (tipo === 'pessoa_fisica' && doc.length === 11) {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (tipo === 'pessoa_juridica' && doc.length === 14) {
      return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header e Busca */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-card-border pb-5">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-main capitalize font-vomzom">Painel de Clientes</h2>
          <p className="text-sub text-sm mt-1">Gerencie os clientes e contratantes das suas obras.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
            <input 
              type="text" 
              placeholder="Buscar cliente..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-card border border-card-border rounded-lg text-main focus:outline-none focus:border-brand-blue"
            />
          </div>
          <Link href="/crm/clientes/novo" className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-xl font-bold hover:bg-brand-blue/90 shadow-md transition-all text-sm whitespace-nowrap">
            <Plus size={16} /> Novo Cliente
          </Link>
        </div>
      </div>

      {/* Grid de Clientes */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="text-center py-20 bg-card border border-card-border rounded-2xl">
          <UsersIcon className="mx-auto h-12 w-12 text-sub mb-3 opacity-20" />
          <h3 className="text-lg font-bold text-main">Nenhum cliente encontrado</h3>
          <p className="text-sub text-sm mt-1 mb-6">Comece cadastrando o seu primeiro cliente ou contratante.</p>
          <Link href="/crm/clientes/novo" className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-xl font-bold hover:bg-brand-blue/90 shadow-md transition-all text-sm w-fit mx-auto">
            <Plus size={16} /> Cadastrar Cliente
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clientesFiltrados.map((cliente) => (
            <div key={cliente.id} className="bg-card border border-card-border rounded-2xl p-5 hover:border-brand-blue/30 transition-all group flex flex-col h-full">
              
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    cliente.tipo === 'pessoa_fisica' 
                      ? 'bg-blue-500/10 text-blue-500' 
                      : 'bg-brand-ocre/10 text-brand-ocre'
                  }`}>
                    {cliente.tipo === 'pessoa_fisica' ? <User size={20} /> : <Building2 size={20} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-main text-sm line-clamp-1">{cliente.nome}</h3>
                    <span className="text-xs font-semibold text-sub tracking-wider">
                      {formatarDocumento(cliente.documento, cliente.tipo)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mt-auto pt-4 border-t border-card-border">
                {cliente.telefone && (
                  <div className="flex items-center gap-2 text-xs text-sub">
                    <Phone size={14} className="text-brand-blue opacity-70" />
                    <span>{cliente.telefone}</span>
                  </div>
                )}
                {cliente.email && (
                  <div className="flex items-center gap-2 text-xs text-sub line-clamp-1">
                    <Mail size={14} className="text-brand-blue opacity-70" />
                    <span>{cliente.email}</span>
                  </div>
                )}
              </div>
              
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper icon
function UsersIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
