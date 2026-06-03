-- Adicionando colunas de endereço e categoria em crm_clientes
ALTER TABLE crm_clientes 
ADD COLUMN IF NOT EXISTS cep VARCHAR(9),
ADD COLUMN IF NOT EXISTS logradouro VARCHAR(255),
ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
ADD COLUMN IF NOT EXISTS complemento VARCHAR(100),
ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
ADD COLUMN IF NOT EXISTS uf VARCHAR(2),
ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);

-- Tabela de múltiplos contatos para o Cliente
CREATE TABLE IF NOT EXISTS crm_clientes_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES crm_clientes(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  funcao VARCHAR(100),
  telefone VARCHAR(20),
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Políticas de segurança
ALTER TABLE crm_clientes_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total contatos na v1" ON crm_clientes_contatos FOR ALL USING (true);
