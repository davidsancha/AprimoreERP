-- ==============================================================================
-- MIGRATION: 00011_bancos_modelos_relatorio.sql
-- Catálogo de bancos e modelos de relatório fotográfico — pedido do David
-- em 02/09/2026: "Banco" vira seleção (não texto livre), e o modelo de
-- relatório é derivado do banco escolhido, guardado no banco de dados
-- (não digitado). Ver src/modules/engenharia/relatorio-fotografico/README.md.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.engenharia_bancos_catalogo (
  nome text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.engenharia_bancos_catalogo (nome) VALUES
  ('Itaú'), ('Itaú Personnalité'), ('Bradesco'), ('Santander')
ON CONFLICT (nome) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.engenharia_modelos_relatorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banco text NOT NULL REFERENCES public.engenharia_bancos_catalogo(nome) ON DELETE CASCADE,
  tipo_projeto text CHECK (tipo_projeto IN ('infraestrutura', 'reforma')),
  nome text NOT NULL,
  -- chave interna usada por lib/pptx.ts (MODELOS_CFG) para saber quais
  -- marcadores de texto/forma usar ao montar o .pptx — null quando o banco
  -- ainda não tem marcadores mapeados (gera nome de arquivo genérico, sem
  -- substituição de campos por marcador).
  config_id text,
  -- caminho do arquivo .pptx-modelo no bucket de Storage, quando for
  -- guardado um arquivo de verdade em vez de só a configuração de marcadores.
  storage_template_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modelos_relatorio_banco ON public.engenharia_modelos_relatorio (banco);

-- Seed — mesmos nomes já usados no app de referência local
-- (relatorio-fotografico.html / MODELOS_SUGERIDOS). Só "itau-personnalite"
-- e "itau-personnalite-reforma" têm marcadores de verdade mapeados hoje —
-- ver docs/02-REGRAS-DE-NEGOCIO.md daquele projeto.
INSERT INTO public.engenharia_modelos_relatorio (banco, tipo_projeto, nome, config_id) VALUES
  ('Itaú', 'infraestrutura', 'Itaú Infra — Padrão', NULL),
  ('Itaú', 'reforma', 'Itaú Reforma — Padrão', NULL),
  ('Itaú Personnalité', 'infraestrutura', 'Personnalité Infra', 'itau-personnalite'),
  ('Itaú Personnalité', 'reforma', 'Personnalité Reforma', 'itau-personnalite-reforma'),
  ('Bradesco', 'infraestrutura', 'Bradesco Infra — Segurança', NULL),
  ('Bradesco', 'reforma', 'Bradesco Reforma', NULL),
  ('Santander', 'infraestrutura', 'Santander Infra', NULL),
  ('Santander', 'reforma', 'Santander Reforma', NULL)
ON CONFLICT DO NOTHING;

ALTER TABLE public.engenharia_bancos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engenharia_modelos_relatorio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura de bancos catalogo para autenticados"
  ON public.engenharia_bancos_catalogo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escrita de bancos catalogo para autenticados"
  ON public.engenharia_bancos_catalogo FOR ALL TO authenticated USING (true);

CREATE POLICY "Leitura de modelos relatorio para autenticados"
  ON public.engenharia_modelos_relatorio FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escrita de modelos relatorio para autenticados"
  ON public.engenharia_modelos_relatorio FOR ALL TO authenticated USING (true);
