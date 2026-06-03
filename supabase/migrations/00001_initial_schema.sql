-- 00001_initial_schema.sql
-- Migração inicial para o MVP do ERP da Aprimore Construções

-- 1. Tabela de Projetos (Obras)
CREATE TABLE IF NOT EXISTS public.projetos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    os VARCHAR(50) UNIQUE NOT NULL,
    data_prevista_inicio DATE NOT NULL,
    data_prevista_termino DATE NOT NULL,
    data_efetiva_inicio DATE,
    data_efetiva_termino DATE,
    valor_total_contrato NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (valor_total_contrato >= 0),
    cep VARCHAR(9) NOT NULL,
    logradouro VARCHAR(255) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    uf VARCHAR(2) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    complemento VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('planejado', 'em_andamento', 'concluido', 'suspenso')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security) na tabela de projetos
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso público (temporário para o MVP/simplificação do Supabase)
CREATE POLICY "Permitir acesso total para todos os usuários" ON public.projetos
    FOR ALL USING (true) WITH CHECK (true);

-- 2. Tabela de Cronograma de Recebimentos
CREATE TABLE IF NOT EXISTS public.cronograma_recebimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    parcela_numero INT NOT NULL,
    percentual NUMERIC(5, 2) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
    valor NUMERIC(15, 2) NOT NULL CHECK (valor >= 0),
    data_prevista DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado')),
    data_pagamento DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS na tabela de cronograma_recebimentos
ALTER TABLE public.cronograma_recebimentos ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso público
CREATE POLICY "Permitir acesso total para todos os usuários" ON public.cronograma_recebimentos
    FOR ALL USING (true) WITH CHECK (true);

-- 3. Tabela de Orçamentos Previstos de Custos
CREATE TABLE IF NOT EXISTS public.orcamentos_custos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('insumos', 'mao_de_obra', 'empreiteiros', 'ferramentas', 'locacoes', 'logistica', 'administrativo')),
    valor_previsto NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (valor_previsto >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_projeto_categoria UNIQUE (projeto_id, categoria)
);

-- Habilitar RLS na tabela de orcamentos_custos
ALTER TABLE public.orcamentos_custos ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso público
CREATE POLICY "Permitir acesso total para todos os usuários" ON public.orcamentos_custos
    FOR ALL USING (true) WITH CHECK (true);

-- 4. Tabela de Custos Realizados (para cálculo da Saúde Financeira)
CREATE TABLE IF NOT EXISTS public.custos_realizados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('insumos', 'mao_de_obra', 'empreiteiros', 'ferramentas', 'locacoes', 'logistica', 'administrativo')),
    descricao VARCHAR(255) NOT NULL,
    valor NUMERIC(15, 2) NOT NULL CHECK (valor > 0),
    data_custo DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS na tabela de custos_realizados
ALTER TABLE public.custos_realizados ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso público
CREATE POLICY "Permitir acesso total para todos os usuários" ON public.custos_realizados
    FOR ALL USING (true) WITH CHECK (true);

-- Criar gatilhos para atualizar updated_at automaticamente nas tabelas necessárias
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_projetos_updated_at
    BEFORE UPDATE ON public.projetos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_cronograma_recebimentos_updated_at
    BEFORE UPDATE ON public.cronograma_recebimentos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_orcamentos_custos_updated_at
    BEFORE UPDATE ON public.orcamentos_custos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
