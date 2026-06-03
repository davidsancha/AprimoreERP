-- =============================================================================
-- Aprimore ERP — Schema Completo v1.0
-- Execute este arquivo inteiro no Supabase SQL Editor
-- Limpa e recria tudo do zero com acesso irrestrito
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. LIMPAR ESTRUTURA ANTERIOR (seguro — dados fictícios)
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS public.custos_realizados   CASCADE;
DROP TABLE IF EXISTS public.orcamentos_custos   CASCADE;
DROP TABLE IF EXISTS public.cronograma_recebimentos CASCADE;
DROP TABLE IF EXISTS public.projetos            CASCADE;

DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;


-- -----------------------------------------------------------------------------
-- 1. FUNÇÃO AUXILIAR — atualiza updated_at automaticamente
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- -----------------------------------------------------------------------------
-- 2. PROJETOS (Obras)
--    Registro principal de cada obra/OS da construtora
-- -----------------------------------------------------------------------------

CREATE TABLE public.projetos (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  nome                  VARCHAR(255)  NOT NULL,
  os                    VARCHAR(50)   NOT NULL UNIQUE,
  tipologia             VARCHAR(100)  NOT NULL DEFAULT 'Residencial',
  status                VARCHAR(20)   NOT NULL DEFAULT 'em_andamento'
                        CHECK (status IN ('planejado', 'em_andamento', 'concluido', 'suspenso')),

  -- Financeiro
  valor_total_contrato  NUMERIC(15,2) NOT NULL DEFAULT 0
                        CHECK (valor_total_contrato >= 0),

  -- Cronograma
  data_prevista_inicio  DATE          NOT NULL,
  data_prevista_termino DATE          NOT NULL,
  data_efetiva_inicio   DATE,
  data_efetiva_termino  DATE,

  -- Endereço
  cep                   VARCHAR(9)    NOT NULL,
  logradouro            VARCHAR(255)  NOT NULL,
  numero                VARCHAR(20)   NOT NULL,
  complemento           VARCHAR(100),
  bairro                VARCHAR(100)  NOT NULL,
  cidade                VARCHAR(100)  NOT NULL,
  uf                    CHAR(2)       NOT NULL,

  -- Controle
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT timezone('utc', now()),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso_irrestrito_projetos"
  ON public.projetos FOR ALL
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_projetos_updated_at
  BEFORE UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- -----------------------------------------------------------------------------
-- 3. CRONOGRAMA DE RECEBIMENTOS
--    Parcelas de faturamento vinculadas a uma obra
-- -----------------------------------------------------------------------------

CREATE TABLE public.cronograma_recebimentos (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id      UUID          NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,

  parcela_numero  INT           NOT NULL,
  percentual      NUMERIC(6,2)  NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  valor           NUMERIC(15,2) NOT NULL CHECK (valor >= 0),

  data_prevista   DATE          NOT NULL,
  data_pagamento  DATE,
  status          VARCHAR(20)   NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'pago', 'atrasado')),

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT timezone('utc', now()),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.cronograma_recebimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso_irrestrito_cronograma"
  ON public.cronograma_recebimentos FOR ALL
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_cronograma_updated_at
  BEFORE UPDATE ON public.cronograma_recebimentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- -----------------------------------------------------------------------------
-- 4. ORÇAMENTOS DE CUSTOS
--    Teto planejado por categoria de custo, por obra
-- -----------------------------------------------------------------------------

CREATE TABLE public.orcamentos_custos (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id     UUID          NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,

  categoria      VARCHAR(50)   NOT NULL
                 CHECK (categoria IN (
                   'insumos', 'mao_de_obra', 'empreiteiros', 'ferramentas',
                   'locacoes', 'logistica', 'administrativo', 'alimentacao', 'outros'
                 )),
  valor_previsto NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (valor_previsto >= 0),

  created_at     TIMESTAMPTZ   NOT NULL DEFAULT timezone('utc', now()),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT uq_projeto_categoria UNIQUE (projeto_id, categoria)
);

ALTER TABLE public.orcamentos_custos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso_irrestrito_orcamentos"
  ON public.orcamentos_custos FOR ALL
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_orcamentos_updated_at
  BEFORE UPDATE ON public.orcamentos_custos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- -----------------------------------------------------------------------------
-- 5. CUSTOS REALIZADOS
--    Despesas efetivas lançadas por obra (NF, pagamentos, etc.)
-- -----------------------------------------------------------------------------

CREATE TABLE public.custos_realizados (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id  UUID          NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,

  categoria   VARCHAR(50)   NOT NULL
              CHECK (categoria IN (
                'insumos', 'mao_de_obra', 'empreiteiros', 'ferramentas',
                'locacoes', 'logistica', 'administrativo', 'alimentacao', 'outros'
              )),
  descricao   VARCHAR(500)  NOT NULL,
  valor       NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  data_custo  DATE          NOT NULL DEFAULT CURRENT_DATE,

  created_at  TIMESTAMPTZ   NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.custos_realizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso_irrestrito_custos"
  ON public.custos_realizados FOR ALL
  USING (true) WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 6. ÍNDICES DE PERFORMANCE
--    Aceleram as consultas mais comuns do sistema
-- -----------------------------------------------------------------------------

CREATE INDEX idx_projetos_status          ON public.projetos (status);
CREATE INDEX idx_cronograma_projeto       ON public.cronograma_recebimentos (projeto_id);
CREATE INDEX idx_cronograma_status        ON public.cronograma_recebimentos (status);
CREATE INDEX idx_cronograma_data_prevista ON public.cronograma_recebimentos (data_prevista);
CREATE INDEX idx_orcamentos_projeto       ON public.orcamentos_custos (projeto_id);
CREATE INDEX idx_custos_projeto           ON public.custos_realizados (projeto_id);
CREATE INDEX idx_custos_data              ON public.custos_realizados (data_custo);


-- =============================================================================
-- CONCLUÍDO — Estrutura criada com sucesso
-- Tabelas: projetos · cronograma_recebimentos · orcamentos_custos · custos_realizados
-- Acesso: irrestrito (RLS habilitado com política pública)
-- =============================================================================
