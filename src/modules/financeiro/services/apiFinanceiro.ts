import { supabase } from '@/shared/lib/supabaseClient';
import { Recebimento } from '../types';

export async function fetchRecebimentos(): Promise<Recebimento[]> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase
    .from('cronograma_recebimentos')
    .select('*')
    .order('data_prevista', { ascending: true });

  if (error) {
    console.error('Erro ao buscar recebimentos do Supabase:', error);
    throw error;
  }

  return data || [];
}

export function calcularPrevisaoCaixa(recebimentos: Recebimento[]): { periodo15Dias: number; periodo30Dias: number } {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dataLimite15 = new Date();
  dataLimite15.setDate(hoje.getDate() + 15);
  dataLimite15.setHours(23, 59, 59, 999);

  const dataLimite30 = new Date();
  dataLimite30.setDate(hoje.getDate() + 30);
  dataLimite30.setHours(23, 59, 59, 999);

  let total15 = 0;
  let total30 = 0;

  recebimentos.forEach((rec) => {
    // Apenas parcelas não pagas (status 'pendente' ou 'atrasado') entram na previsão de recebimentos futuros
    if (rec.status !== 'pago') {
      const dataPrev = new Date(rec.data_prevista);
      
      // Se for atrasada ou vencer nos próximos 15 dias
      if (dataPrev <= dataLimite15) {
        total15 += Number(rec.valor);
      }
      
      // Se for atrasada ou vencer nos próximos 30 dias
      if (dataPrev <= dataLimite30) {
        total30 += Number(rec.valor);
      }
    }
  });

  return {
    periodo15Dias: total15,
    periodo30Dias: total30
  };
}

export async function fetchRecebimentosByProjeto(projetoId: string): Promise<Recebimento[]> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase
    .from('cronograma_recebimentos')
    .select('*')
    .eq('projeto_id', projetoId)
    .order('parcela_numero', { ascending: true });

  if (error) {
    console.error(`Erro ao buscar recebimentos do projeto ${projetoId} do Supabase:`, error);
    throw error;
  }

  return data || [];
}

export async function salvarRecebimento(
  recebimento: Omit<Recebimento, 'created_at' | 'updated_at'>
): Promise<Recebimento> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  if (recebimento.id) {
    // Update
    const { data, error } = await supabase
      .from('cronograma_recebimentos')
      .update({
        projeto_id: recebimento.projeto_id,
        parcela_numero: recebimento.parcela_numero,
        percentual: recebimento.percentual,
        valor: recebimento.valor,
        data_prevista: recebimento.data_prevista,
        status: recebimento.status,
        data_pagamento: recebimento.data_pagamento
      })
      .eq('id', recebimento.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar recebimento no Supabase:', error);
      throw error;
    }
    return data;
  } else {
    // Insert
    const { data, error } = await supabase
      .from('cronograma_recebimentos')
      .insert({
        projeto_id: recebimento.projeto_id,
        parcela_numero: recebimento.parcela_numero,
        percentual: recebimento.percentual,
        valor: recebimento.valor,
        data_prevista: recebimento.data_prevista,
        status: recebimento.status,
        data_pagamento: recebimento.data_pagamento
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir recebimento no Supabase:', error);
      throw error;
    }
    return data;
  }
}
