import { supabase } from '@/shared/lib/supabaseClient';
import { Projeto, CategoriaCusto, OrcamentoCusto, CustoRealizado, NotaFiscal } from '../types';
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
          cliente_final_id: projeto.cliente_final_id,
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
          tipologia: projeto.tipologia,
          agencia: projeto.agencia,
          upe: projeto.upe,
          sap: projeto.sap,
          gestor: projeto.gestor,
          fiscalizacao_empresa: projeto.fiscalizacao_empresa,
          fiscal: projeto.fiscal,
          construtora: projeto.construtora,
          responsavel: projeto.responsavel
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
            cliente_final_id: projeto.cliente_final_id,
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
            tipologia: projeto.tipologia,
            agencia: projeto.agencia,
            upe: projeto.upe,
            sap: projeto.sap,
            gestor: projeto.gestor,
            fiscalizacao_empresa: projeto.fiscalizacao_empresa,
            fiscal: projeto.fiscal,
            construtora: projeto.construtora,
            responsavel: projeto.responsavel
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

export async function fetchTodosCustosRealizados(): Promise<CustoRealizado[]> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase
    .from('custos_realizados')
    .select('*')
    .order('data_custo', { ascending: false });

  if (error) {
    console.error(`Erro ao buscar todos os custos:`, error);
    throw error;
  }

  return data || [];
}

export async function fetchHistoricoPrecoItem(nomeItem: string): Promise<number | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('itens_nota_fiscal')
      .select('valor_unitario')
      .ilike('nome_item', `%${nomeItem}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.valor_unitario;
  } catch (err) {
    return null;
  }
}

export async function salvarCustoRealizado(custo: CustoRealizado): Promise<CustoRealizado> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  // 1. Salvar o custo realizado
  const { data: custoData, error: custoError } = await supabase
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
    .select()
    .single();

  if (custoError) {
    console.error('Erro ao salvar custo no Supabase:', custoError);
    throw custoError;
  }

  const custoSalvo = custoData;

  // 2. Salvar a nota fiscal, se existir
  if (custo.nota_fiscal && custoSalvo.id) {
    const { itens, ...notaFiscalData } = custo.nota_fiscal;
    
    const { data: nfData, error: nfError } = await supabase
      .from('notas_fiscais')
      .insert([
        {
          custo_id: custoSalvo.id,
          loja_nome: notaFiscalData.loja_nome,
          cnpj: notaFiscalData.cnpj,
          data_emissao: notaFiscalData.data_emissao,
          endereco: notaFiscalData.endereco,
          valor_total: notaFiscalData.valor_total,
          chave_acesso: notaFiscalData.chave_acesso,
          url_qr_code: notaFiscalData.url_qr_code,
        }
      ])
      .select()
      .single();

    if (nfError) {
      console.error('Erro ao salvar nota fiscal no Supabase:', nfError);
      throw nfError;
    }

    // 3. Salvar os itens da nota fiscal, se existirem
    if (itens && itens.length > 0 && nfData.id) {
      const itensInsert = itens.map(item => ({
        nota_fiscal_id: nfData.id,
        nome_item: item.nome_item,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total
      }));

      const { error: itensError } = await supabase
        .from('itens_nota_fiscal')
        .insert(itensInsert);

      if (itensError) {
        console.error('Erro ao salvar itens da nota fiscal no Supabase:', itensError);
        throw itensError;
      }
    }
  }

  return custoSalvo;
}

/**
 * Atualiza só os campos de obra usados por outros módulos (ex.: relatório
 * fotográfico de engenharia) — evita ter que montar orçamentos/recebimentos
 * só para editar Agência/UPE/SAP/gestor/fiscal/construtora/responsável.
 */
export async function atualizarCamposEngenharia(
  projetoId: string,
  campos: Pick<Projeto, 'agencia' | 'upe' | 'sap' | 'gestor' | 'fiscalizacao_empresa' | 'fiscal' | 'construtora' | 'responsavel'>
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  const { error } = await supabase.from('projetos').update(campos).eq('id', projetoId);
  if (error) throw error;
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

export async function fetchNotaFiscalByCustoId(custoId: string): Promise<NotaFiscal | null> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  try {
    const { data: notaFiscal, error: nfError } = await supabase
      .from('notas_fiscais')
      .select('*')
      .eq('custo_id', custoId)
      .single();

    if (nfError) {
      if (nfError.code === 'PGRST116') return null; // Não encontrada
      throw nfError;
    }

    if (!notaFiscal) return null;

    const { data: itens, error: itensError } = await supabase
      .from('itens_nota_fiscal')
      .select('*')
      .eq('nota_fiscal_id', notaFiscal.id);

    if (itensError) {
      throw itensError;
    }

    return {
      ...notaFiscal,
      itens: itens || []
    } as NotaFiscal;
  } catch (err) {
    console.error(`Erro ao buscar nota fiscal do custo ${custoId}:`, err);
    return null;
  }
}
