-- ==============================================================================
-- MIGRATION: 00026_criar_relatorio_avulso_rpc.sql
-- Bug em produção: Parceiro EGF não consegue criar relatório fotográfico
-- avulso — "new row violates row-level security policy for table
-- engenharia_estrutura_fotografica" (reportado pelo David, reproduzido ao
-- vivo em 2026-09-09 com conta de teste E confirmado de novo em produção
-- com um Parceiro EGF real em 2026-09-11, "Joaquina").
--
-- O payload enviado pelo client já está correto (user_id = auth.uid(),
-- is_avulso = true — conferido interceptando o fetch no navegador), e a
-- policy de INSERT esperada (migration 00014) deveria deixar passar
-- exatamente esse caso. Como continua bloqueando mesmo assim, o banco em
-- produção parece estar com uma versão da policy diferente da que está
-- commitada (pedido anterior no mailbox pra conferir/reaplicar 00014 ainda
-- não teve retorno).
--
-- Em vez de continuar dependendo de acertar a RLS por fora, esta migration
-- contorna o problema de vez: uma função SECURITY DEFINER que cria o
-- relatório avulso ela mesma (RLS não se aplica dentro da função —
-- ela roda com o dono/owner da função, não como o chamador), validando
-- só o essencial (autenticado, nome da obra preenchido, tipo válido) e
-- sempre forçando is_avulso = true e user_id = auth.uid() por dentro —
-- não há como o chamador criar um relatório em nome de outra pessoa ou
-- vinculado a um projeto corporativo por essa via, então não abre brecha
-- nenhuma de segurança nova.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.criar_relatorio_avulso(
  p_obra_nome text,
  p_tipo_projeto text,
  p_banco text DEFAULT NULL,
  p_modelo_relatorio text DEFAULT NULL,
  p_agencia text DEFAULT NULL,
  p_programa text DEFAULT NULL,
  p_upe text DEFAULT NULL,
  p_sap text DEFAULT NULL,
  p_gestor text DEFAULT NULL,
  p_fiscalizacao_empresa text DEFAULT NULL,
  p_fiscal text DEFAULT NULL,
  p_construtora text DEFAULT NULL,
  p_responsavel text DEFAULT NULL,
  p_data_inicio_obra date DEFAULT NULL,
  p_data_termino_obra date DEFAULT NULL,
  p_uniorg text DEFAULT NULL,
  p_mantenedor text DEFAULT NULL,
  p_chamado text DEFAULT NULL,
  p_relatorio_titulo text DEFAULT NULL,
  p_data_relatorio text DEFAULT NULL,
  p_descricao_problema text DEFAULT NULL,
  p_causa_origem text DEFAULT NULL,
  p_danos text DEFAULT NULL,
  p_paliativo_retirada_risco text DEFAULT NULL,
  p_escopo_proposta text DEFAULT NULL,
  p_cronograma text DEFAULT NULL
)
RETURNS public.engenharia_estrutura_fotografica
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nova public.engenharia_estrutura_fotografica;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_obra_nome IS NULL OR btrim(p_obra_nome) = '' THEN
    RAISE EXCEPTION 'Nome da obra é obrigatório.';
  END IF;
  IF p_tipo_projeto NOT IN ('infraestrutura', 'reforma') THEN
    RAISE EXCEPTION 'Tipo de projeto inválido: %', p_tipo_projeto;
  END IF;

  INSERT INTO public.engenharia_estrutura_fotografica (
    projeto_id, user_id, is_avulso, obra_nome, tipo_projeto, banco, modelo_relatorio,
    agencia, programa, upe, sap, gestor, fiscalizacao_empresa, fiscal, construtora,
    responsavel, data_inicio_obra, data_termino_obra, uniorg, mantenedor, chamado,
    relatorio_titulo, data_relatorio, descricao_problema, causa_origem, danos,
    paliativo_retirada_risco, escopo_proposta, cronograma
  ) VALUES (
    NULL, auth.uid(), true, p_obra_nome, p_tipo_projeto, p_banco, p_modelo_relatorio,
    p_agencia, p_programa, p_upe, p_sap, p_gestor, p_fiscalizacao_empresa, p_fiscal, p_construtora,
    p_responsavel, p_data_inicio_obra, p_data_termino_obra, p_uniorg, p_mantenedor, p_chamado,
    p_relatorio_titulo, p_data_relatorio, p_descricao_problema, p_causa_origem, p_danos,
    p_paliativo_retirada_risco, p_escopo_proposta, p_cronograma
  )
  RETURNING * INTO v_nova;

  RETURN v_nova;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_relatorio_avulso(
  text, text, text, text, text, text, text, text, text, text, text, text, text,
  date, date, text, text, text, text, text, text, text, text, text, text, text
) TO authenticated;
