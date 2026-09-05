-- ==============================================================================
-- MIGRATION: 00018_uniorg_e_maiusculas.sql
-- Pedido do David em 05/09/2026: cadastro de projetos precisa de um campo
-- UNIORG (Santander, máscara XXX-XXXX) e todos os campos de texto do
-- cadastro de projetos devem ficar em maiúsculas — inclusive os já
-- cadastrados. Ver src/modules/operacional/components/FormProjeto.tsx.
-- ==============================================================================

ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS uniorg text;

UPDATE public.projetos SET
  nome = UPPER(nome),
  os = UPPER(os),
  tipologia = UPPER(tipologia),
  agencia = UPPER(agencia),
  upe = UPPER(upe),
  sap = UPPER(sap),
  gestor = UPPER(gestor),
  fiscalizacao_empresa = UPPER(fiscalizacao_empresa),
  fiscal = UPPER(fiscal),
  construtora = UPPER(construtora),
  responsavel = UPPER(responsavel),
  logradouro = UPPER(logradouro),
  bairro = UPPER(bairro),
  cidade = UPPER(cidade),
  uf = UPPER(uf),
  numero = UPPER(numero),
  complemento = UPPER(complemento);
