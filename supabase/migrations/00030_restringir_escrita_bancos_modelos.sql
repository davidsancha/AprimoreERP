-- ==============================================================================
-- MIGRATION: 00030_restringir_escrita_bancos_modelos.sql
-- `engenharia_bancos_catalogo` e `engenharia_modelos_relatorio` (00011) têm
-- policy "Escrita ... FOR ALL TO authenticated USING (true)": qualquer
-- usuário autenticado -- inclusive um Parceiro EGF (`convidado`) -- podia
-- inserir/alterar/apagar bancos e modelos, e com isso mexer em `config_id` /
-- `storage_template_path`, que controlam a geração do PowerPoint.
--
-- Auditoria no código: o app só LÊ essas tabelas (lerBancosCatalogo,
-- lerModelosPorBanco); as escritas legítimas vêm de migrations (00011, 00016,
-- 00017), que rodam como superuser e ignoram RLS. Então restringir a escrita
-- a is_internal_staff() (role != 'convidado', ver 00028) não quebra nenhuma
-- tela. A leitura para `authenticated` continua como está.
-- ==============================================================================

DROP POLICY IF EXISTS "Escrita de bancos catalogo para autenticados"
  ON public.engenharia_bancos_catalogo;
CREATE POLICY "Escrita de bancos catalogo para equipe interna"
  ON public.engenharia_bancos_catalogo FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "Escrita de modelos relatorio para autenticados"
  ON public.engenharia_modelos_relatorio;
CREATE POLICY "Escrita de modelos relatorio para equipe interna"
  ON public.engenharia_modelos_relatorio FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());
