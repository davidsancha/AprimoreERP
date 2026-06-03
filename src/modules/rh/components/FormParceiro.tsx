'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/shared/lib/supabaseClient';
import { Save, AlertCircle, Building2, User, ArrowLeft, MapPin, Phone, Mail, Loader2, Briefcase, FileText, Check, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { validarCPF, validarCNPJ } from '@/shared/utils/validators';

const TIPOS_PARCEIRO = [
  'Mestre de Obras',
  'Pedreiro',
  'Servente / Ajudante',
  'Eletricista',
  'Encanador / Bombeiro',
  'Pintor',
  'Gesseiro',
  'Carpinteiro',
  'Serralheiro',
  'Empreiteiro Geral',
  'Outro'
];

export default function FormParceiro() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    tipo_pessoa: 'pessoa_fisica',
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
    // Comercial / RH
    tipo_parceiro: 'Pedreiro',
    valor_diaria: '',
    observacoes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Máscara documento
    if (name === 'documento') {
      const numbersOnly = value.replace(/\D/g, '');
      let formatted = numbersOnly;
      if (formData.tipo_pessoa === 'pessoa_fisica' && numbersOnly.length <= 11) {
        formatted = numbersOnly.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      } else if (formData.tipo_pessoa === 'pessoa_juridica' && numbersOnly.length <= 14) {
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
    if (name === 'valor_diaria') {
      const rawValue = value.replace(/\D/g, '');
      const numberValue = Number(rawValue) / 100;
      if (rawValue === '') {
        setFormData(prev => ({ ...prev, valor_diaria: '' }));
        return;
      }
      const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberValue);
      setFormData(prev => ({ ...prev, valor_diaria: formatted }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);

    try {
      const documentoLimpo = formData.documento.replace(/\D/g, '');
      
      if (!formData.nome || !documentoLimpo) {
        throw new Error('Preencha os campos obrigatórios.');
      }

      if (formData.tipo_pessoa === 'pessoa_fisica' && !validarCPF(documentoLimpo)) {
        throw new Error('O CPF informado é inválido. Verifique os números digitados.');
      }

      if (formData.tipo_pessoa === 'pessoa_juridica' && !validarCNPJ(documentoLimpo)) {
        throw new Error('O CNPJ informado é inválido. Verifique os números digitados.');
      }

      const valorDiariaNum = formData.valor_diaria ? Number(formData.valor_diaria.replace(/\D/g, '')) / 100 : 0;

      // Inserir Parceiro
      const { error: parceiroError } = await supabase.from('rh_parceiros').insert([{
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
        tipo_parceiro: formData.tipo_parceiro,
        valor_diaria: valorDiariaNum,
        observacoes: formData.observacoes
      }]);

      if (parceiroError) {
        if (parceiroError.code === '23505') throw new Error('Este documento (CPF/CNPJ) já está cadastrado.');
        throw parceiroError;
      }

      // TODO: Redirecionar para lista de parceiros quando ela existir
      router.push('/rh/pagamentos-parceiros');
    } catch (err: any) {
      setErro(err.message || 'Erro ao cadastrar parceiro');
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
            <User className="text-brand-blue dark:text-brand-ocre" size={16} /> Cadastrar Novo Parceiro
          </h2>
          <p className="text-sub text-[10px] mt-0.5">
            Cadastro de empreiteiros e diaristas prestadores de serviço (RH).
          </p>
        </div>
        <div className="flex gap-2">
          {/* Opcional: Link para voltar */}
          <Link href="/rh" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-card-border text-sub hover:text-main hover:bg-slate-50 transition-all text-xs font-bold shadow-sm">
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
              <><Check size={16} /> Salvar Parceiro</>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        
        {/* ══════════ COLUNA 1: DADOS BÁSICOS & COMERCIAL ══════════ */}
        <div className="space-y-5">
          
          {/* Módulo 1: Perfil do Parceiro */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom">
              <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">1</span>
              Perfil do Parceiro
            </h3>
            
            <div className="grid grid-cols-2 gap-3 mb-2">
              <label className={`cursor-pointer border rounded-xl p-3 flex items-center gap-2 transition-all ${
                formData.tipo_pessoa === 'pessoa_fisica' 
                  ? 'border-brand-blue bg-brand-blue/5 text-brand-blue shadow-inner' 
                  : 'border-card-border bg-card text-sub hover:border-brand-blue/50'
              }`}>
                <input type="radio" name="tipo_pessoa" value="pessoa_fisica" checked={formData.tipo_pessoa === 'pessoa_fisica'} onChange={handleChange} className="hidden" />
                <User size={16} />
                <span className="font-bold text-[10px] uppercase tracking-wider">Pessoa Física</span>
              </label>
              
              <label className={`cursor-pointer border rounded-xl p-3 flex items-center gap-2 transition-all ${
                formData.tipo_pessoa === 'pessoa_juridica' 
                  ? 'border-brand-blue bg-brand-blue/5 text-brand-blue shadow-inner' 
                  : 'border-card-border bg-card text-sub hover:border-brand-blue/50'
              }`}>
                <input type="radio" name="tipo_pessoa" value="pessoa_juridica" checked={formData.tipo_pessoa === 'pessoa_juridica'} onChange={handleChange} className="hidden" />
                <Building2 size={16} />
                <span className="font-bold text-[10px] uppercase tracking-wider">Pessoa Jurídica</span>
              </label>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">
                  {formData.tipo_pessoa === 'pessoa_fisica' ? 'Nome Completo' : 'Razão Social'} <span className="text-red-500">*</span>
                </label>
                <input type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue transition-all" placeholder={formData.tipo_pessoa === 'pessoa_fisica' ? 'Ex: João da Silva' : 'Ex: Empreiteira Exemplo LTDA'} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">
                    {formData.tipo_pessoa === 'pessoa_fisica' ? 'CPF' : 'CNPJ'} <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="documento" value={formData.documento} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main font-bold focus:outline-none focus:border-brand-blue transition-all" placeholder={formData.tipo_pessoa === 'pessoa_fisica' ? '000.000.000-00' : '00.000.000/0000-00'} required maxLength={formData.tipo_pessoa === 'pessoa_fisica' ? 14 : 18} />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Telefone Principal *</label>
                  <div className="relative">
                    <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
                    <input type="text" name="telefone" required value={formData.telefone} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg pl-8 pr-3 py-2 text-xs text-main focus:outline-none focus:border-brand-blue transition-all font-bold" placeholder="(00) 00000-0000" maxLength={15} />
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

        </div>

        {/* ══════════ COLUNA 2: COMERCIAL & ENDEREÇO ══════════ */}
        <div className="space-y-5">
          
          {/* Módulo 2: Acordo Comercial (Diária) */}
          <div className="bg-card border border-green-500/20 bg-green-500/5 rounded-xl p-4 space-y-4 shadow-sm relative overflow-hidden">
            <div className="absolute -right-6 -top-6 text-green-500/10">
              <DollarSign size={100} />
            </div>
            
            <h3 className="text-xs font-bold text-green-600 flex items-center gap-2 border-b border-green-500/20 pb-2 uppercase tracking-wider font-vomzom relative z-10">
              <span className="flex items-center justify-center h-5 w-5 rounded-md bg-green-500/20 text-green-600 font-black text-[10px]">2</span>
              Acordo Comercial (RH)
            </h3>
            
            <div className="grid grid-cols-2 gap-3 relative z-10">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Especialidade / Função *</label>
                <select name="tipo_parceiro" value={formData.tipo_parceiro} onChange={handleChange} className="w-full bg-background border border-green-500/30 rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-green-500 transition-all font-bold" required>
                  {TIPOS_PARCEIRO.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Valor Diária Padrão (R$) *</label>
                <input type="text" name="valor_diaria" required value={formData.valor_diaria} onChange={handleChange} className="w-full bg-background border border-green-500/30 rounded-lg px-3 py-2 text-xs text-green-600 font-bold focus:outline-none focus:border-green-500 transition-all" placeholder="R$ 150,00" />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider flex items-center gap-1">
                  <FileText size={10} /> Observações RH
                </label>
                <textarea name="observacoes" value={formData.observacoes} onChange={handleChange} rows={2} className="w-full bg-background border border-green-500/30 rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-green-500 transition-all resize-none" placeholder="Detalhes sobre a contratação, chaves pix, conta bancária, habilidades..." />
              </div>
            </div>
          </div>

          {/* Módulo 3: Endereço Inteligente */}
          <div className="bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom">
              <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">3</span>
              Endereço do Parceiro
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
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Rua</label>
                <input type="text" name="logradouro" value={formData.logradouro} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-ocre transition-all" />
              </div>

              <div className="space-y-1 xl:col-span-2">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Número</label>
                <input id="numero" type="text" name="numero" value={formData.numero} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-ocre transition-all" />
              </div>

              <div className="space-y-1 xl:col-span-4">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Complemento</label>
                <input type="text" name="complemento" value={formData.complemento} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-ocre transition-all" />
              </div>

              <div className="space-y-1 xl:col-span-3">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Bairro</label>
                <input type="text" name="bairro" value={formData.bairro} onChange={handleChange} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-brand-ocre transition-all" />
              </div>

              <div className="space-y-1 xl:col-span-3">
                <label className="text-[10px] font-bold text-desc uppercase tracking-wider">Cidade/UF</label>
                <input type="text" disabled value={formData.cidade ? `${formData.cidade} - ${formData.uf}` : ''} className="w-full bg-slate-50 dark:bg-zinc-800 border border-card-border rounded-lg px-3 py-2 text-xs text-sub cursor-not-allowed" />
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </form>
  );
}
