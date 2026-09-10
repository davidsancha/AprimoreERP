-- ==============================================================================
-- MIGRATION: 00028_seguranca_financeira_projetos.sql
-- Auditoria pedida pelo David encontrou uma lacuna séria: `projetos`,
-- `orcamentos_custos`, `custos_realizados` e `cronograma_recebimentos` têm
-- policy "acesso_irrestrito_*" (USING (true) WITH CHECK (true), sem `TO`,
-- ou seja liberado até pra `anon`). Qualquer usuário autenticado -- inclusive
-- um Parceiro EGF (`convidado`), que na UI só deveria ver relatório
-- fotográfico -- conseguia ler/alterar/apagar o dinheiro de qualquer obra
-- direto pela API do Supabase.
--
-- Também corrige `is_internal_staff()` (criada em 00014 pro relatório
-- fotográfico): ela só considerava role IN ('god','admin','user'), mas o
-- sistema hoje tem papéis internos reais (engenheiro, financeiro, comercial,
-- rh, juridico, diretoria) que NÃO passavam nessa checagem -- um bug latente
-- que também afetava o acesso deles ao relatório fotográfico. Trocado pra
-- "qualquer role que não seja convidado", já que convidado é o único papel
-- externo do sistema.
--
-- Além disso: RPC transacional `salvar_projeto_completo` substitui o
-- delete-e-recria em duas chamadas separadas (não atômico, e capaz de
-- reverter silenciosamente um pagamento registrado em /recebimentos
-- enquanto a tela de edição do projeto está aberta em outra aba) por uma
-- única função que nunca sobrescreve status/data_pagamento de parcelas já
-- existentes, e só apaga parcela que sumiu do formulário se ela ainda
-- estiver "pendente".
--
-- E duas constraints de coerência de data (NOT VALID -- não falha por causa
-- de dado histórico, mas passa a valer pra todo INSERT/UPDATE novo).
-- ==============================================================================

-- 1. is_internal_staff(): qualquer role != convidado é "staff interno"
CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IS DISTINCT FROM 'convidado'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. RLS de projetos e das 3 tabelas financeiras -- só staff interno,
--    nunca convidado, nunca anon.
DROP POLICY IF EXISTS "acesso_irrestrito_projetos" ON public.projetos;
DROP POLICY IF EXISTS "god_projetos" ON public.projetos;
CREATE POLICY "acesso_staff_interno_projetos"
  ON public.projetos FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "acesso_irrestrito_cronograma" ON public.cronograma_recebimentos;
DROP POLICY IF EXISTS "god_cronograma" ON public.cronograma_recebimentos;
CREATE POLICY "acesso_staff_interno_cronograma"
  ON public.cronograma_recebimentos FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "acesso_irrestrito_orcamentos" ON public.orcamentos_custos;
DROP POLICY IF EXISTS "god_orcamentos" ON public.orcamentos_custos;
CREATE POLICY "acesso_staff_interno_orcamentos"
  ON public.orcamentos_custos FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "acesso_irrestrito_custos" ON public.custos_realizados;
DROP POLICY IF EXISTS "god_custos" ON public.custos_realizados;
CREATE POLICY "acesso_staff_interno_custos"
  ON public.custos_realizados FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

-- 3. Coerência de datas (NOT VALID: vale pra dado novo, não quebra a
--    migration por causa de projeto antigo com datas invertidas).
ALTER TABLE public.projetos
  ADD CONSTRAINT chk_projetos_datas_previstas
  CHECK (data_prevista_termino >= data_prevista_inicio) NOT VALID;

ALTER TABLE public.projetos
  ADD CONSTRAINT chk_projetos_datas_efetivas
  CHECK (
    data_efetiva_inicio IS NULL OR data_efetiva_termino IS NULL
    OR data_efetiva_termino >= data_efetiva_inicio
  ) NOT VALID;

-- 4. RPC transacional -- substitui o delete-e-recria de
--    apiProjetos.ts::salvarProjetoCompleto por uma única chamada atômica.
CREATE OR REPLACE FUNCTION public.salvar_projeto_completo(
  p_projeto_id uuid,
  p_projeto jsonb,
  p_orcamentos jsonb,
  p_recebimentos jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
#variable_conflict use_column
DECLARE
  v_projeto_id uuid;
BEGIN
  IF NOT public.is_internal_staff() THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar projetos.';
  END IF;

  IF p_projeto_id IS NULL THEN
    INSERT INTO public.projetos (
      cliente_id, cliente_final_id, nome, os, data_prevista_inicio, data_prevista_termino,
      data_efetiva_inicio, data_efetiva_termino, valor_total_contrato, cep, logradouro, bairro,
      cidade, uf, numero, complemento, status, tipologia, uniorg, agencia, upe, sap, gestor,
      fiscalizacao_empresa, fiscal, construtora, responsavel
    )
    VALUES (
      NULLIF(p_projeto->>'cliente_id','')::uuid, NULLIF(p_projeto->>'cliente_final_id','')::uuid,
      p_projeto->>'nome', p_projeto->>'os',
      (p_projeto->>'data_prevista_inicio')::date, (p_projeto->>'data_prevista_termino')::date,
      NULLIF(p_projeto->>'data_efetiva_inicio','')::date, NULLIF(p_projeto->>'data_efetiva_termino','')::date,
      (p_projeto->>'valor_total_contrato')::numeric, p_projeto->>'cep', p_projeto->>'logradouro', p_projeto->>'bairro',
      p_projeto->>'cidade', p_projeto->>'uf', p_projeto->>'numero', p_projeto->>'complemento', p_projeto->>'status',
      p_projeto->>'tipologia', p_projeto->>'uniorg', p_projeto->>'agencia', p_projeto->>'upe', p_projeto->>'sap',
      p_projeto->>'gestor', p_projeto->>'fiscalizacao_empresa', p_projeto->>'fiscal', p_projeto->>'construtora',
      p_projeto->>'responsavel'
    )
    RETURNING id INTO v_projeto_id;
  ELSE
    v_projeto_id := p_projeto_id;
    UPDATE public.projetos SET
      cliente_id = NULLIF(p_projeto->>'cliente_id','')::uuid,
      cliente_final_id = NULLIF(p_projeto->>'cliente_final_id','')::uuid,
      nome = p_projeto->>'nome',
      os = p_projeto->>'os',
      data_prevista_inicio = (p_projeto->>'data_prevista_inicio')::date,
      data_prevista_termino = (p_projeto->>'data_prevista_termino')::date,
      data_efetiva_inicio = NULLIF(p_projeto->>'data_efetiva_inicio','')::date,
      data_efetiva_termino = NULLIF(p_projeto->>'data_efetiva_termino','')::date,
      valor_total_contrato = (p_projeto->>'valor_total_contrato')::numeric,
      cep = p_projeto->>'cep',
      logradouro = p_projeto->>'logradouro',
      bairro = p_projeto->>'bairro',
      cidade = p_projeto->>'cidade',
      uf = p_projeto->>'uf',
      numero = p_projeto->>'numero',
      complemento = p_projeto->>'complemento',
      status = p_projeto->>'status',
      tipologia = p_projeto->>'tipologia',
      uniorg = p_projeto->>'uniorg',
      agencia = p_projeto->>'agencia',
      upe = p_projeto->>'upe',
      sap = p_projeto->>'sap',
      gestor = p_projeto->>'gestor',
      fiscalizacao_empresa = p_projeto->>'fiscalizacao_empresa',
      fiscal = p_projeto->>'fiscal',
      construtora = p_projeto->>'construtora',
      responsavel = p_projeto->>'responsavel'
    WHERE id = v_projeto_id;
  END IF;

  -- Orçamentos por categoria: upsert + remove categoria que saiu do payload.
  INSERT INTO public.orcamentos_custos (projeto_id, categoria, valor_previsto)
  SELECT v_projeto_id, x.categoria, x.valor_previsto
  FROM jsonb_to_recordset(p_orcamentos) AS x(categoria text, valor_previsto numeric)
  ON CONFLICT (projeto_id, categoria) DO UPDATE
    SET valor_previsto = EXCLUDED.valor_previsto, updated_at = timezone('utc', now());

  DELETE FROM public.orcamentos_custos o
  WHERE o.projeto_id = v_projeto_id
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_orcamentos) AS x(categoria text, valor_previsto numeric)
      WHERE x.categoria = o.categoria
    );

  -- Cronograma de recebimentos: atualiza parcela_numero/percentual/valor/
  -- data_prevista de quem já existe (por id) SEM NUNCA tocar status ou
  -- data_pagamento -- só o fluxo de /recebimentos deve marcar pagamento ou
  -- dividir parcela, então mesmo que o formulário de projeto carregue um
  -- snapshot desatualizado, salvar o projeto não reverte isso. Insere quem
  -- é novo (sem id). Só apaga quem sumiu do payload se ainda "pendente".
  UPDATE public.cronograma_recebimentos c SET
    parcela_numero = x.parcela_numero,
    percentual = x.percentual,
    valor = x.valor,
    data_prevista = x.data_prevista
  FROM jsonb_to_recordset(p_recebimentos)
    AS x(id uuid, parcela_numero int, percentual numeric, valor numeric, data_prevista date, status text, data_pagamento date)
  WHERE c.id = x.id AND c.projeto_id = v_projeto_id;

  INSERT INTO public.cronograma_recebimentos (projeto_id, parcela_numero, percentual, valor, data_prevista, status, data_pagamento)
  SELECT v_projeto_id, x.parcela_numero, x.percentual, x.valor, x.data_prevista, COALESCE(x.status, 'pendente'), x.data_pagamento
  FROM jsonb_to_recordset(p_recebimentos)
    AS x(id uuid, parcela_numero int, percentual numeric, valor numeric, data_prevista date, status text, data_pagamento date)
  WHERE x.id IS NULL;

  DELETE FROM public.cronograma_recebimentos c
  WHERE c.projeto_id = v_projeto_id
    AND c.status = 'pendente'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_recebimentos)
        AS x(id uuid, parcela_numero int, percentual numeric, valor numeric, data_prevista date, status text, data_pagamento date)
      WHERE x.id = c.id
    );

  RETURN v_projeto_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_projeto_completo(uuid, jsonb, jsonb, jsonb) TO authenticated;
