'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/shared/lib/supabaseClient';
import { Save, AlertCircle, Building2, User, ArrowLeft, MapPin, Phone, Mail, Plus, Trash2, Loader2, Briefcase, Globe, FileText, Activity, Check } from 'lucide-react';
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

const ORIGENS_LEAD = [
  'Indicação',
  'Prospecção Ativa',
  'Google Ads',
  'Instagram / Facebook Ads',
  'Feira / Evento',
  'Redes Sociais (Orgânico)',
  'Outros'
];

const STATUS_CLIENTE = [
  'Prospect',
  'Ativo',
  'Inativo'
];

const SEGMENTOS = [
  'Residencial de Alto Padrão',
  'Residencial Popular',
  'Comercial / Corporativo',
  'Indústria',
  'Infraestrutura',
  'Varejo',
  'Saúde',
  'Educação',
  'Outro'
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
    // BI / Comercial
    origem_lead: 'Indicação',
    faturamento_estimado: '',
    segmento_atuacao: 'Residencial de Alto Padrão',
    status: 'Prospect',
    redes_sociais: '',
    observacoes: ''
  });

  const [contatos, setContatos] = useState<ContatoExtra[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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

    // Formatador Monetário
    if (name === 'faturamento_estimado') {
      const rawValue = value.replace(/\D/g, '');
      const numberValue = Number(rawValue) / 100;
      if (rawValue === '') {
        setFormData(prev => ({ ...prev, faturamento_estimado: '' }));
        return;
      }
      const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberValue);
      setFormData(prev => ({ ...prev, faturamento_estimado: formatted }));
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

      const faturamentoNum = formData.faturamento_estimado ? Number(formData.faturamento_estimado.replace(/\D/g, '')) / 100 : 0;

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
        // BI Fields
        origem_lead: formData.origem_lead,
        faturamento_estimado: faturamentoNum,
        segmento_atuacao: formData.segmento_atuacao,
        status: formData.status,
        redes_sociais: formData.redes_sociais,
        observacoes: formData.observacoes
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
    <form onSubmit={handleSubmit} className="space-y-6 w-full pb-16">
      
      {/* Título da Página e Ações */}
      <div className="flex items-center justify-between border-b border-card-border pb-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-main flex items-center gap-1.5 uppercase tracking-wider font-vomzom">
            <User className="text-brand-blue dark:text-brand-ocre" size={16} /> Cadastrar Novo Cliente
          </h2>
          <p className="text-sub text-[10px] mt-0.5">
            Cadastro estratégico de clientes com inteligência comercial integrada.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/crm" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-card-border text-sub hover:text-main hover:bg-slate-50 transition-all text-xs font-bold shadow-sm">
            <ArrowLeft size={14} /> Voltar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-ocre text-brand-dark text-xs font-bold hover:bg-brand-ocre/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md cursor-pointer"
          >
            {loading ? (
              <><Loader2 className="animate-spin" size={16} /> Salvando...</>
            ) : (
              <><Check size={16} /> Salvar Cliente</>
            )}
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <AlertCircle size={20} />
          <span className="text-xs font-bold">{erro}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
        
        {/* ══════════ COLUNA 1 e 2: DADOS BÁSICOS & INTELIGÊNCIA ══════════ */}
        <div className="md:col-span-2 space-y-5">
          
          {/* Módulo 1: Perfil do Cliente */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom">
              <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">1</span>
              Perfil do Cliente
            </h3>
            
            <div className="grid grid-cols-2 gap-3 mb-2">
              <label className={`cursor-pointer border rounded-xl p-3 flex items-center gap-2 transition-all ${
                formData.tipo === 'pessoa_fisica' 
                  ? 'border-brand-blue bg-brand-blue/5 text-brand-blue shadow-inner' 
                  : 'border-card-border bg-card text-sub hover:border-brand-blue/50'
              }`}>
                <input type="radio" name="tipo" value="pessoa_fisica" checked={formData.tipo === 'pessoa_fisica'} onChange={handleChange} className="hidden" />
                <User size={16} />
                <span className="font-bold text-[10px] uppercase tracking-wider">Pessoa Física</span>
              </label>
              
              <label className={`cursor-pointer border rounded-xl p-3 flex items-center gap-2 transition-all ${
                formData.tipo === 'pessoa_juridica' 
                  ? 'border-brand-blue bg-brand-blue/5 text-brand-blue shadow-inner' 
                  : 'border-card-border bg-card text-sub hover:border-brand-blue/50'
              }`}>
                <input type="radio" name="tipo" value="pessoa_juridica" checked={formData.tipo === 'pessoa_juridica'} onChange={handleChange} className="hidden" />
                <Building2 size={16} />
                <span className="font-bold text-[10px] uppercase tracking-wider">Pessoa Jurídica</span>
              </label>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">
                  {formData.tipo === 'pessoa_fisica' ? 'Nome Completo' : 'Razão Social'} <span className="text-red-500">*</span>
                </label>
                <input type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue transition-all" placeholder={formData.tipo === 'pessoa_fisica' ? 'Ex: João da Silva' : 'Ex: Empresa Exemplo LTDA'} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">
                    {formData.tipo === 'pessoa_fisica' ? 'CPF' : 'CNPJ'} <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="documento" value={formData.documento} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main font-bold focus:outline-none focus:border-brand-blue transition-all" placeholder={formData.tipo === 'pessoa_fisica' ? '000.000.000-00' : '00.000.000/0000-00'} required maxLength={formData.tipo === 'pessoa_fisica' ? 14 : 18} />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Telefone Principal</label>
                  <div className="relative">
                    <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
                    <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg pl-8 pr-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue transition-all font-bold" placeholder="(00) 00000-0000" maxLength={15} />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">E-mail Principal</label>
                <div className="relative">
                  <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg pl-8 pr-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue transition-all font-bold" placeholder="contato@exemplo.com.br" />
                </div>
              </div>
            </div>
          </div>

          {/* Módulo 2: Inteligência Comercial (BI) */}
          <div className="bg-card border border-brand-blue/20 bg-brand-blue/5 rounded-xl p-4 space-y-4 shadow-sm relative overflow-hidden">
            <div className="absolute -right-6 -top-6 text-brand-blue/10">
              <Activity size={100} />
            </div>
            
            <h3 className="text-xs font-bold text-brand-blue flex items-center gap-2 border-b border-brand-blue/20 pb-2 uppercase tracking-wider font-vomzom relative z-10">
              <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/20 text-brand-blue font-black text-[10px]">2</span>
              Inteligência Comercial (BI)
            </h3>
            
            <div className="grid grid-cols-2 gap-3 relative z-10">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Categoria Estratégica *</label>
                <select name="categoria" value={formData.categoria} onChange={handleChange} className="w-full bg-background border border-brand-blue/30 rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue transition-all font-bold" required>
                  {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Origem do Lead</label>
                <select name="origem_lead" value={formData.origem_lead} onChange={handleChange} className="w-full bg-background border border-brand-blue/30 rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue transition-all font-bold">
                  {ORIGENS_LEAD.map(origem => <option key={origem} value={origem}>{origem}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Faturamento Estimado</label>
                <input type="text" name="faturamento_estimado" value={formData.faturamento_estimado} onChange={handleChange} className="w-full bg-background border border-brand-blue/30 rounded-lg px-3 py-2 text-xs text-brand-blue font-bold focus:outline-none focus:border-brand-blue transition-all" placeholder="R$ 0,00" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Status Comercial</label>
                <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-background border border-brand-blue/30 rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue transition-all font-bold">
                  {STATUS_CLIENTE.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Segmento de Atuação</label>
                <select name="segmento_atuacao" value={formData.segmento_atuacao} onChange={handleChange} className="w-full bg-background border border-brand-blue/30 rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue transition-all font-bold">
                  {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Redes Sociais (LinkedIn/Instagram)</label>
                <div className="relative">
                  <Globe size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
                  <input type="text" name="redes_sociais" value={formData.redes_sociais} onChange={handleChange} className="w-full bg-background border border-brand-blue/30 rounded-lg pl-8 pr-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue transition-all" placeholder="https://linkedin.com/in/..." />
                </div>
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider flex items-center gap-1">
                  <FileText size={10} /> Observações Estratégicas
                </label>
                <textarea name="observacoes" value={formData.observacoes} onChange={handleChange} rows={2} className="w-full bg-background border border-brand-blue/30 rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue transition-all resize-none" placeholder="Anotações sobre o cliente, perfil de investimento, dores principais..." />
              </div>
            </div>
          </div>

        </div>

        {/* ══════════ COLUNA 3 e 4: ENDEREÇO & CONTATOS ══════════ */}
        <div className="md:col-span-2 space-y-5">
          
          {/* Módulo 3: Endereço Inteligente */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom">
              <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">3</span>
              Endereço Inteligente
            </h3>

            <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
              <div className="space-y-1 xl:col-span-2">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">CEP</label>
                <div className="relative">
                  <MapPin size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ocre" />
                  <input type="text" name="cep" value={formData.cep} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg pl-8 pr-3 py-2 text-xs text-main focus:outline-none focus:border-brand-ocre transition-all font-bold" placeholder="00000-000" maxLength={9} />
                  {cepLoading && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-ocre animate-spin" />}
                </div>
              </div>

              <div className="space-y-1 xl:col-span-4">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Logradouro / Rua</label>
                <input type="text" name="logradouro" value={formData.logradouro} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-ocre transition-all" placeholder="Ex: Av. Paulista" />
              </div>

              <div className="space-y-1 xl:col-span-2">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Número</label>
                <input id="numero" type="text" name="numero" value={formData.numero} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-ocre transition-all" placeholder="1000" />
              </div>

              <div className="space-y-1 xl:col-span-4">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Complemento</label>
                <input type="text" name="complemento" value={formData.complemento} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-ocre transition-all" placeholder="Sala, Apto, Galpão..." />
              </div>

              <div className="space-y-1 xl:col-span-2">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Bairro</label>
                <input type="text" name="bairro" value={formData.bairro} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-ocre transition-all" />
              </div>

              <div className="space-y-1 xl:col-span-3">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Cidade</label>
                <input type="text" name="cidade" value={formData.cidade} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-ocre transition-all" />
              </div>

              <div className="space-y-1 xl:col-span-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">UF</label>
                <input type="text" name="uf" value={formData.uf} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-ocre transition-all" maxLength={2} />
              </div>
            </div>
          </div>

          {/* Módulo 4: Contatos Adicionais */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-card-border pb-2">
              <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 uppercase tracking-wider font-vomzom">
                <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">4</span>
                Contatos Estratégicos
              </h3>
              <button type="button" onClick={addContato} className="flex items-center gap-1 text-[10px] font-bold text-brand-blue hover:text-brand-blue/80 transition-colors">
                <Plus size={12} /> Adicionar
              </button>
            </div>

            {contatos.length === 0 ? (
              <div className="text-center py-6 text-sub text-[11px] bg-slate-50 dark:bg-zinc-800/20 rounded-lg border border-dashed border-card-border">
                Adicione sócios, diretores ou responsáveis do cliente.
              </div>
            ) : (
              <div className="space-y-3">
                {contatos.map((contato, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start bg-background p-3 rounded-lg border border-card-border relative group">
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[9px] font-bold text-desc uppercase tracking-wider">Nome</label>
                      <input type="text" value={contato.nome} onChange={(e) => handleContatoChange(index, 'nome', e.target.value)} className="w-full bg-card border border-card-border rounded-md px-2 py-1.5 text-xs text-main focus:outline-none focus:border-brand-blue" placeholder="Nome" />
                    </div>
                    
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[9px] font-bold text-desc uppercase tracking-wider">Cargo</label>
                      <input type="text" value={contato.funcao} onChange={(e) => handleContatoChange(index, 'funcao', e.target.value)} className="w-full bg-card border border-card-border rounded-md px-2 py-1.5 text-xs text-main focus:outline-none focus:border-brand-blue" placeholder="Ex: Diretor" />
                    </div>
                    
                    <div className="md:col-span-5 space-y-1 relative">
                      <label className="text-[9px] font-bold text-desc uppercase tracking-wider">Telefone</label>
                      <div className="flex gap-2">
                        <input type="text" value={contato.telefone} onChange={(e) => handleContatoChange(index, 'telefone', e.target.value)} className="w-full bg-card border border-card-border rounded-md px-2 py-1.5 text-xs text-main focus:outline-none focus:border-brand-blue" placeholder="(00) 00000-0000" maxLength={15} />
                        <button type="button" onClick={() => removeContato(index)} className="text-red-400 hover:text-red-500 hover:bg-red-500/10 px-2 rounded-md transition-colors border border-transparent hover:border-red-500/20">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>
      
    </form>
  );
}
