-- Tabela para armazenar os dados do cabeçalho da Nota Fiscal (NFC-e / SAT)
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  custo_id uuid NOT NULL REFERENCES public.custos_realizados(id) ON DELETE CASCADE,
  loja_nome text NOT NULL,
  cnpj text NOT NULL,
  data_emissao timestamp with time zone,
  endereco text,
  valor_total numeric(12,2) NOT NULL,
  chave_acesso text,
  url_qr_code text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security) para a tabela notas_fiscais
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para notas_fiscais
CREATE POLICY "Notas Fiscais são visíveis para todos os usuários autenticados" 
ON public.notas_fiscais FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Usuários autenticados podem inserir notas fiscais" 
ON public.notas_fiscais FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar notas fiscais" 
ON public.notas_fiscais FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Usuários autenticados podem deletar notas fiscais" 
ON public.notas_fiscais FOR DELETE 
TO authenticated 
USING (true);

-- Tabela para armazenar os itens individuais da Nota Fiscal
CREATE TABLE IF NOT EXISTS public.itens_nota_fiscal (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nota_fiscal_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  nome_item text NOT NULL,
  quantidade numeric(10,3) NOT NULL,
  valor_unitario numeric(12,2) NOT NULL,
  valor_total numeric(12,2) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security) para a tabela itens_nota_fiscal
ALTER TABLE public.itens_nota_fiscal ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para itens_nota_fiscal
CREATE POLICY "Itens da Nota Fiscal são visíveis para todos os usuários autenticados" 
ON public.itens_nota_fiscal FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Usuários autenticados podem inserir itens da nota fiscal" 
ON public.itens_nota_fiscal FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar itens da nota fiscal" 
ON public.itens_nota_fiscal FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Usuários autenticados podem deletar itens da nota fiscal" 
ON public.itens_nota_fiscal FOR DELETE 
TO authenticated 
USING (true);

-- Criar índices para melhorar o desempenho de consultas
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_custo_id ON public.notas_fiscais(custo_id);
CREATE INDEX IF NOT EXISTS idx_itens_nota_fiscal_nota_fiscal_id ON public.itens_nota_fiscal(nota_fiscal_id);
