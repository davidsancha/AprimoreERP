'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/shared/lib/supabaseClient';
import { Save, AlertCircle, Building2, User, ArrowLeft, MapPin, Phone, Mail, Plus, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { validarCPF, validarCNPJ } from '@/shared/utils/validators';

const CATEGORIAS = [
  'Construtora',
  'Incorporadora',
  'Consumidor Final',
  'Investidor',
  'Arquiteto / Projetista',
  'Órgão Público',
  'Parceiro Comercial',
  'Outros'
];

interface ContatoExtra {
  nome: string;
  funcao: string;
  telefone: string;
  email: string;
}

export default function FormCliente() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    tipo: 'pessoa_fisica',
    categoria: 'Consumidor Final',
    nome: '',
    documento: '',
    telefone: '',
    email: '',
    // Endereço
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
  });

  const [contatos, setContatos] = useState<ContatoExtra[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Máscara documento
    if (name === 'documento') {
      const numbersOnly = value.replace(/\D/g, '');
      let formatted = numbersOnly;
      if (formData.tipo === 'pessoa_fisica' && numbersOnly.length <= 11) {
        formatted = numbersOnly.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      } else if (formData.tipo === 'pessoa_juridica' && numbersOnly.length <= 14) {
        formatted = numbersOnly.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      }
      setFormData(prev => ({ ...prev, documento: formatted }));
      return;
    }

    // Máscara telefone
    if (name === 'telefone') {
      const numbersOnly = value.replace(/\D/g, '');
      let formatted = numbersOnly;
      if (numbersOnly.length <= 11 && numbersOnly.length > 2) {
        formatted = `(${numbersOnly.slice(0, 2)}) ${numbersOnly.slice(2, 7)}-${numbersOnly.slice(7)}`;
      }
      setFormData(prev => ({ ...prev, telefone: formatted }));
      return;
    }

    // Máscara CEP
    if (name === 'cep') {
      const numbersOnly = value.replace(/\D/g, '');
      let formatted = numbersOnly;
      if (numbersOnly.length <= 8 && numbersOnly.length > 5) {
        formatted = `${numbersOnly.slice(0, 5)}-${numbersOnly.slice(5)}`;
      }
      setFormData(prev => ({ ...prev, cep: formatted }));
      
      if (numbersOnly.length === 8) {
        buscarEnderecoPorCep(numbersOnly);
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const buscarEnderecoPorCep = async (cepLimpo: string) => {
    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          logradouro: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          uf: data.uf || '',
        }));
        setTimeout(() => document.getElementById('numero')?.focus(), 100);
      }
    } catch (err) {
      console.error('Erro ao consultar ViaCEP:', err);
    } finally {
      setCepLoading(false);
    }
  };

  // Funções de Contatos Extras
  const addContato = () => {
    setContatos([...contatos, { nome: '', funcao: '', telefone: '', email: '' }]);
  };

  const removeContato = (index: number) => {
    setContatos(contatos.filter((_, i) => i !== index));
  };

  const handleContatoChange = (index: number, campo: keyof ContatoExtra, valor: string) => {
    const novosContatos = [...contatos];
    if (campo === 'telefone') {
      const numbersOnly = valor.replace(/\D/g, '');
      let formatted = numbersOnly;
      if (numbersOnly.length <= 11 && numbersOnly.length > 2) {
        formatted = `(${numbersOnly.slice(0, 2)}) ${numbersOnly.slice(2, 7)}-${numbersOnly.slice(7)}`;
      }
      novosContatos[index][campo] = formatted;
    } else {
      novosContatos[index][campo] = valor;
    }
    setContatos(novosContatos);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);

    try {
      const documentoLimpo = formData.documento.replace(/\D/g, '');
      
      if (!formData.nome || !documentoLimpo) {
        throw new Error('Preencha os campos obrigatórios.');
      }

      if (formData.tipo === 'pessoa_fisica' && !validarCPF(documentoLimpo)) {
        throw new Error('O CPF informado é inválido. Verifique os números digitados.');
      }

      if (formData.tipo === 'pessoa_juridica' && !validarCNPJ(documentoLimpo)) {
        throw new Error('O CNPJ informado é inválido. Verifique os números digitados.');
      }

      // 1. Inserir Cliente
      const { data: clienteData, error: clienteError } = await supabase.from('crm_clientes').insert([{
        tipo: formData.tipo,
        categoria: formData.categoria,
        nome: formData.nome,
        documento: documentoLimpo,
        telefone: formData.telefone,
        email: formData.email,
        cep: formData.cep.replace(/\D/g, ''),
        logradouro: formData.logradouro,
        numero: formData.numero,
        complemento: formData.complemento,
        bairro: formData.bairro,
        cidade: formData.cidade,
        uf: formData.uf,
      }]).select('id').single();

      if (clienteError) {
        if (clienteError.code === '23505') throw new Error('Este documento (CPF/CNPJ) já está cadastrado.');
        throw clienteError;
      }

      // 2. Inserir Contatos Extras se houver
      const contatosValidos = contatos.filter(c => c.nome || c.telefone || c.email);
      if (contatosValidos.length > 0 && clienteData?.id) {
        const contatosInsert = contatosValidos.map(c => ({
          cliente_id: clienteData.id,
          nome: c.nome,
          funcao: c.funcao,
          telefone: c.telefone,
          email: c.email
        }));

        const { error: contatoError } = await supabase.from('crm_clientes_contatos').insert(contatosInsert);
        if (contatoError) throw contatoError;
      }

      router.push('/crm');
    } catch (err: any) {
      setErro(err.message || 'Erro ao cadastrar cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8 pb-16">
      
      {/* Header do Form */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-card-border pb-5">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-main capitalize font-vomzom">Novo Cliente</h2>
          <p className="text-sub text-sm mt-1">Cadastro completo de clientes físicos ou jurídicos.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/crm" className="flex items-center gap-2 px-4 py-2 bg-card border border-card-border text-main rounded-xl font-bold hover:bg-slate-50 transition-all text-sm shadow-sm">
            <ArrowLeft size={16} /> Voltar
          </Link>
          <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2 bg-brand-ocre text-brand-dark rounded-xl font-bold hover:bg-brand-ocre/90 transition-all text-sm shadow-md disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {loading ? 'Salvando...' : 'Salvar Cadastro'}
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          <span className="text-sm font-semibold">{erro}</span>
        </div>
      )}

      {/* Tipo e Categoria */}
      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-6">
        <h3 className="text-sm font-black text-brand-ocre uppercase tracking-wider border-b border-card-border pb-3 flex items-center gap-2">
          <User size={16} /> Perfil do Cliente
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <label className={`cursor-pointer border rounded-xl p-4 flex items-center gap-3 transition-all ${
              formData.tipo === 'pessoa_fisica' 
                ? 'border-brand-blue bg-brand-blue/5 text-brand-blue shadow-inner' 
                : 'border-card-border bg-card text-sub hover:border-brand-blue/50'
            }`}>
              <input type="radio" name="tipo" value="pessoa_fisica" checked={formData.tipo === 'pessoa_fisica'} onChange={handleChange} className="hidden" />
              <User size={20} />
              <span className="font-bold text-sm">Pessoa Física (CPF)</span>
            </label>
            
            <label className={`cursor-pointer border rounded-xl p-4 flex items-center gap-3 transition-all ${
              formData.tipo === 'pessoa_juridica' 
                ? 'border-brand-blue bg-brand-blue/5 text-brand-blue shadow-inner' 
                : 'border-card-border bg-card text-sub hover:border-brand-blue/50'
            }`}>
              <input type="radio" name="tipo" value="pessoa_juridica" checked={formData.tipo === 'pessoa_juridica'} onChange={handleChange} className="hidden" />
              <Building2 size={20} />
              <span className="font-bold text-sm">Pessoa Jurídica (CNPJ)</span>
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-sub uppercase tracking-wider">Categoria no CRM *</label>
            <select name="categoria" value={formData.categoria} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-3 text-sm text-main focus:outline-none focus:border-brand-blue transition-all font-semibold" required>
              {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-sub uppercase tracking-wider">
              {formData.tipo === 'pessoa_fisica' ? 'Nome Completo' : 'Razão Social'} <span className="text-red-500">*</span>
            </label>
            <input type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm text-main focus:outline-none focus:border-brand-blue transition-all" placeholder={formData.tipo === 'pessoa_fisica' ? 'Ex: João da Silva' : 'Ex: Empresa Exemplo LTDA'} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-sub uppercase tracking-wider">
              {formData.tipo === 'pessoa_fisica' ? 'CPF' : 'CNPJ'} <span className="text-red-500">*</span>
            </label>
            <input type="text" name="documento" value={formData.documento} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm text-main font-semibold focus:outline-none focus:border-brand-blue transition-all" placeholder={formData.tipo === 'pessoa_fisica' ? '000.000.000-00' : '00.000.000/0000-00'} required maxLength={formData.tipo === 'pessoa_fisica' ? 14 : 18} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-sub uppercase tracking-wider">Telefone Principal</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
              <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-main focus:outline-none focus:border-brand-blue transition-all" placeholder="(00) 00000-0000" maxLength={15} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-sub uppercase tracking-wider">E-mail Principal</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-main focus:outline-none focus:border-brand-blue transition-all" placeholder="contato@exemplo.com.br" />
            </div>
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-6">
        <h3 className="text-sm font-black text-brand-ocre uppercase tracking-wider border-b border-card-border pb-3 flex items-center gap-2">
          <MapPin size={16} /> Endereço Completo
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[10px] font-bold text-sub uppercase tracking-wider">CEP</label>
            <div className="relative">
              <input type="text" name="cep" value={formData.cep} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm text-main focus:outline-none focus:border-brand-blue transition-all" placeholder="00000-000" maxLength={9} />
              {cepLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-blue animate-spin" />}
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-4">
            <label className="text-[10px] font-bold text-sub uppercase tracking-wider">Logradouro / Rua</label>
            <input type="text" name="logradouro" value={formData.logradouro} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm text-main focus:outline-none focus:border-brand-blue transition-all" placeholder="Ex: Av. Paulista" />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[10px] font-bold text-sub uppercase tracking-wider">Número</label>
            <input id="numero" type="text" name="numero" value={formData.numero} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm text-main focus:outline-none focus:border-brand-blue transition-all" placeholder="Ex: 1000" />
          </div>

          <div className="space-y-1.5 md:col-span-4">
            <label className="text-[10px] font-bold text-sub uppercase tracking-wider">Complemento</label>
            <input type="text" name="complemento" value={formData.complemento} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm text-main focus:outline-none focus:border-brand-blue transition-all" placeholder="Sala, Apto, Galpão..." />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[10px] font-bold text-sub uppercase tracking-wider">Bairro</label>
            <input type="text" name="bairro" value={formData.bairro} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm text-main focus:outline-none focus:border-brand-blue transition-all" />
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <label className="text-[10px] font-bold text-sub uppercase tracking-wider">Cidade</label>
            <input type="text" name="cidade" value={formData.cidade} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm text-main focus:outline-none focus:border-brand-blue transition-all" />
          </div>

          <div className="space-y-1.5 md:col-span-1">
            <label className="text-[10px] font-bold text-sub uppercase tracking-wider">UF</label>
            <input type="text" name="uf" value={formData.uf} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm text-main focus:outline-none focus:border-brand-blue transition-all" maxLength={2} />
          </div>
        </div>
      </div>

      {/* Contatos Adicionais */}
      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-card-border pb-3">
          <div>
            <h3 className="text-sm font-black text-brand-ocre uppercase tracking-wider flex items-center gap-2">
              <Phone size={16} /> Contatos Adicionais
            </h3>
            <p className="text-[11px] text-sub mt-1">
              {formData.tipo === 'pessoa_fisica' 
                ? 'Adicione outros telefones ou e-mails do cliente (opcional).' 
                : 'Cadastre os responsáveis, diretores ou contatos internos da empresa.'}
            </p>
          </div>
          <button type="button" onClick={addContato} className="flex items-center gap-1.5 text-xs font-bold text-brand-blue bg-brand-blue/10 px-3 py-1.5 rounded-lg hover:bg-brand-blue hover:text-white transition-colors">
            <Plus size={14} /> Adicionar
          </button>
        </div>

        {contatos.length === 0 ? (
          <div className="text-center py-6 text-sub text-sm">
            Nenhum contato adicional. Clique em "Adicionar" para incluir mais opções.
          </div>
        ) : (
          <div className="space-y-4">
            {contatos.map((contato, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-background p-4 rounded-xl border border-card-border relative group">
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-[10px] font-bold text-sub uppercase tracking-wider">Nome do Contato</label>
                  <input type="text" value={contato.nome} onChange={(e) => handleContatoChange(index, 'nome', e.target.value)} className="w-full bg-card border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue" placeholder="Nome da pessoa" />
                </div>
                
                {formData.tipo === 'pessoa_juridica' && (
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-[10px] font-bold text-sub uppercase tracking-wider">Função / Cargo</label>
                    <input type="text" value={contato.funcao} onChange={(e) => handleContatoChange(index, 'funcao', e.target.value)} className="w-full bg-card border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue" placeholder="Ex: Financeiro" />
                  </div>
                )}
                
                <div className={formData.tipo === 'pessoa_juridica' ? "md:col-span-2 space-y-1.5" : "md:col-span-4 space-y-1.5"}>
                  <label className="text-[10px] font-bold text-sub uppercase tracking-wider">Telefone</label>
                  <input type="text" value={contato.telefone} onChange={(e) => handleContatoChange(index, 'telefone', e.target.value)} className="w-full bg-card border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue" placeholder="(00) 00000-0000" maxLength={15} />
                </div>

                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-[10px] font-bold text-sub uppercase tracking-wider">E-mail</label>
                  <input type="email" value={contato.email} onChange={(e) => handleContatoChange(index, 'email', e.target.value)} className="w-full bg-card border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue" placeholder="E-mail" />
                </div>

                <div className="md:col-span-1 flex justify-end md:mt-6">
                  <button type="button" onClick={() => removeContato(index)} className="text-red-400 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
    </form>
  );
}
