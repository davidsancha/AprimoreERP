import { supabase } from '@/shared/lib/supabaseClient';
import { Projeto, CategoriaCusto, OrcamentoCusto, CustoRealizado } from '../types';
import { Recebimento } from '../../financeiro/types';

export async function fetchProjetos(): Promise<Projeto[]> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase
    .from('projetos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar projetos do Supabase:', error);
    throw error;
  }

  return data || [];
}

export async function salvarProjetoCompleto(
  projeto: Projeto,
  orcamentos: Record<CategoriaCusto, number>,
  recebimentos: Recebimento[]
): Promise<Projeto> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  try {
    let projetoId = projeto.id;

    if (projetoId) {
      // Atualizar projeto existente
      const { error } = await supabase
        .from('projetos')
        .update({
          cliente_id: projeto.cliente_id,
          nome: projeto.nome,
          os: projeto.os,
          data_prevista_inicio: projeto.data_prevista_inicio,
          data_prevista_termino: projeto.data_prevista_termino,
          data_efetiva_inicio: projeto.data_efetiva_inicio,
          data_efetiva_termino: projeto.data_efetiva_termino,
          valor_total_contrato: projeto.valor_total_contrato,
          cep: projeto.cep,
          logradouro: projeto.logradouro,
          bairro: projeto.bairro,
          cidade: projeto.cidade,
          uf: projeto.uf,
          numero: projeto.numero,
          complemento: projeto.complemento,
          status: projeto.status,
          tipologia: projeto.tipologia
        })
        .eq('id', projetoId);

      if (error) throw error;
    } else {
      // Inserir novo projeto
      const { data, error } = await supabase
        .from('projetos')
        .insert([
          {
            cliente_id: projeto.cliente_id,
            nome: projeto.nome,
            os: projeto.os,
            data_prevista_inicio: projeto.data_prevista_inicio,
            data_prevista_termino: projeto.data_prevista_termino,
            data_efetiva_inicio: projeto.data_efetiva_inicio,
            data_efetiva_termino: projeto.data_efetiva_termino,
            valor_total_contrato: projeto.valor_total_contrato,
            cep: projeto.cep,
            logradouro: projeto.logradouro,
            bairro: projeto.bairro,
            cidade: projeto.cidade,
            uf: projeto.uf,
            numero: projeto.numero,
            complemento: projeto.complemento,
            status: projeto.status,
            tipologia: projeto.tipologia
          }
        ])
        .select();

      if (error) throw error;
      projetoId = data[0].id;
    }

    // Salvar Orçamentos (Supabase)
    // 1. Excluir antigos
    await supabase.from('orcamentos_custos').delete().eq('projeto_id', projetoId);
    
    // 2. Inserir novos
    const orcamentosInsert = Object.entries(orcamentos).map(([categoria, valor]) => ({
      projeto_id: projetoId!,
      categoria: categoria as CategoriaCusto,
      valor_previsto: valor
    }));
    const { error: orcError } = await supabase.from('orcamentos_custos').insert(orcamentosInsert);
    if (orcError) throw orcError;

    // Salvar Cronograma (Supabase)
    // 1. Excluir antigos
    await supabase.from('cronograma_recebimentos').delete().eq('projeto_id', projetoId);

    // 2. Inserir novos
    const recebimentosInsert = recebimentos.map((rec, idx) => ({
      projeto_id: projetoId!,
      parcela_numero: idx + 1,
      percentual: rec.percentual,
      valor: rec.valor,
      data_prevista: rec.data_prevista,
      status: rec.status,
      data_pagamento: rec.data_pagamento
    }));
    const { error: recError } = await supabase.from('cronograma_recebimentos').insert(recebimentosInsert);
    if (recError) throw recError;

    return { ...projeto, id: projetoId };
  } catch (error) {
    console.error('Erro na transação de salvar projeto:', error);
    throw error;
  }
}

export async function fetchOrcamentosByProjeto(projetoId: string): Promise<OrcamentoCusto[]> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase
    .from('orcamentos_custos')
    .select('*')
    .eq('projeto_id', projetoId);

  if (error) {
    console.error(`Erro ao buscar orçamentos do projeto ${projetoId}:`, error);
    throw error;
  }

  return data || [];
}

export async function fetchCustosRealizadosByProjeto(projetoId: string): Promise<CustoRealizado[]> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase
    .from('custos_realizados')
    .select('*')
    .eq('projeto_id', projetoId)
    .order('data_custo', { ascending: false });

  if (error) {
    console.error(`Erro ao buscar custos do projeto ${projetoId}:`, error);
    throw error;
  }

  return data || [];
}

export async function salvarCustoRealizado(custo: CustoRealizado): Promise<CustoRealizado> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase
    .from('custos_realizados')
    .insert([
      {
        projeto_id: custo.projeto_id,
        categoria: custo.categoria,
        descricao: custo.descricao,
        valor: custo.valor,
        data_custo: custo.data_custo
      }
    ])
    .select();

  if (error) {
    console.error('Erro ao salvar custo no Supabase:', error);
    throw error;
  }

  return data[0];
}

export async function fetchProjetoById(id: string): Promise<Projeto | null> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  try {
    const { data, error } = await supabase
      .from('projetos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Erro ao buscar projeto ${id} do Supabase:`, error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Erro na chamada fetchProjetoById:', err);
    throw err;
  }
}

export async function deletarProjeto(id: string): Promise<boolean> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  try {
    const { error } = await supabase
      .from('projetos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Erro ao deletar projeto ${id} do Supabase:`, error);
      throw error;
    }

    return true;
  } catch (err) {
    console.error('Erro na chamada deletarProjeto:', err);
    throw err;
  }
}
