'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/shared/lib/supabaseClient';
import { Save, AlertCircle, Truck, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { validarCNPJ } from '@/shared/utils/validators';

export default function FormFornecedor() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    razao_social: '',
    cnpj: '',
    categoria: 'materiais',
    status: 'ativo'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Máscara CNPJ
    if (name === 'cnpj') {
      const numbersOnly = value.replace(/\D/g, '');
      let formatted = numbersOnly;
      if (numbersOnly.length <= 14) {
        formatted = numbersOnly.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      }
      setFormData(prev => ({ ...prev, cnpj: formatted }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);

    try {
      const cnpjLimpo = formData.cnpj.replace(/\D/g, '');
      
      if (!formData.razao_social || !cnpjLimpo) {
        throw new Error('Preencha os campos obrigatórios.');
      }

      if (!validarCNPJ(cnpjLimpo)) {
        throw new Error('O CNPJ informado é inválido. Verifique os números digitados.');
      }

      const { error } = await supabase.from('suprimentos_fornecedores').insert([{
        razao_social: formData.razao_social,
        cnpj: cnpjLimpo,
        categoria: formData.categoria,
        status: formData.status
      }]);

      if (error) {
        if (error.code === '23505') throw new Error('Este CNPJ já está cadastrado.');
        throw error;
      }

      router.push('/suprimentos');
    } catch (err: any) {
      setErro(err.message || 'Erro ao cadastrar fornecedor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      
      {/* Header do Form */}
      <div className="flex items-center justify-between border-b border-card-border pb-5">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-main capitalize font-vomzom">Novo Fornecedor</h2>
          <p className="text-sub text-sm mt-1">Cadastre fornecedores de materiais ou serviços.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/suprimentos" className="btn-secondary">
            <ArrowLeft size={16} /> Voltar
          </Link>
          <button type="submit" disabled={loading} className="btn-primary">
            <Save size={16} />
            {loading ? 'Salvando...' : 'Salvar Fornecedor'}
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          <span className="text-sm font-semibold">{erro}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-card border border-card-border rounded-2xl p-6">
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-bold text-main uppercase tracking-wider">
            Razão Social <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="razao_social"
            value={formData.razao_social}
            onChange={handleChange}
            className="input-field"
            placeholder="Nome da empresa"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-main uppercase tracking-wider">
            CNPJ <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Truck size={16} className="text-sub" />
            </div>
            <input
              type="text"
              name="cnpj"
              value={formData.cnpj}
              onChange={handleChange}
              className="input-field pl-10"
              placeholder="00.000.000/0000-00"
              required
              maxLength={18}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-main uppercase tracking-wider">Categoria</label>
          <select
            name="categoria"
            value={formData.categoria}
            onChange={handleChange}
            className="input-field"
          >
            <option value="materiais">Materiais de Construção</option>
            <option value="servicos">Serviços / Subempreiteiros</option>
            <option value="locacao">Locação de Equipamentos</option>
            <option value="diversos">Diversos</option>
          </select>
        </div>
      </div>
    </form>
  );
}
