-- Migração 00005: Relacionamento obrigatório de Cliente em Projetos

-- Cria um cliente legado para evitar quebra de foreign key nos projetos existentes
INSERT INTO crm_clientes (id, nome, documento, tipo)
VALUES ('00000000-0000-0000-0000-000000000000', 'Cliente Legado (Atualizar)', '00000000000', 'pessoa_fisica')
ON CONFLICT (id) DO NOTHING;

-- Adiciona a coluna permitindo null temporariamente
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES crm_clientes(id) ON DELETE RESTRICT;

-- Atualiza projetos existentes para o cliente legado
UPDATE projetos SET cliente_id = '00000000-0000-0000-0000-000000000000' WHERE cliente_id IS NULL;

-- Força a obrigatoriedade
ALTER TABLE projetos ALTER COLUMN cliente_id SET NOT NULL;
