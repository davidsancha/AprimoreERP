-- ==========================================
-- Módulo: RH & Departamento Pessoal
-- ==========================================
CREATE TABLE IF NOT EXISTS rh_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  cargo TEXT,
  salario NUMERIC,
  data_admissao DATE,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- Módulo: Suprimentos & Compras
-- ==========================================
CREATE TABLE IF NOT EXISTS suprimentos_fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  categoria TEXT,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suprimentos_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID REFERENCES projetos(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES suprimentos_fornecedores(id),
  solicitante_id UUID REFERENCES profiles(id),
  data_pedido DATE NOT NULL,
  valor_total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pendente_aprovacao',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- Módulo: Equipamentos, Frota & Patrimônio
-- ==========================================
CREATE TABLE IF NOT EXISTS patrimonio_equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT, -- veiculo, maquina_pesada, ferramenta
  placa_ou_serial TEXT UNIQUE,
  status TEXT DEFAULT 'disponivel', -- disponivel, em_uso, manutencao
  projeto_atual_id UUID REFERENCES projetos(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- Módulo: QSMS (Qualidade e Segurança)
-- ==========================================
CREATE TABLE IF NOT EXISTS qsms_epis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
  equipamento TEXT NOT NULL,
  data_entrega DATE NOT NULL,
  data_validade DATE,
  ca_numero TEXT,
  status TEXT DEFAULT 'entregue',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- Módulo: CRM & Pós-Venda
-- ==========================================
CREATE TABLE IF NOT EXISTS crm_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  documento TEXT UNIQUE,
  telefone TEXT,
  email TEXT,
  tipo TEXT, -- pessoa_fisica, pessoa_juridica
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e Politicas básicas para as novas tabelas
ALTER TABLE rh_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE suprimentos_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE suprimentos_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrimonio_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE qsms_epis ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_clientes ENABLE ROW LEVEL SECURITY;

-- Politica temporária para Admin/God acesso total
CREATE POLICY "Acesso total para todos na v1" ON rh_colaboradores FOR ALL USING (true);
CREATE POLICY "Acesso total para todos na v1" ON suprimentos_fornecedores FOR ALL USING (true);
CREATE POLICY "Acesso total para todos na v1" ON suprimentos_pedidos FOR ALL USING (true);
CREATE POLICY "Acesso total para todos na v1" ON patrimonio_equipamentos FOR ALL USING (true);
CREATE POLICY "Acesso total para todos na v1" ON qsms_epis FOR ALL USING (true);
CREATE POLICY "Acesso total para todos na v1" ON crm_clientes FOR ALL USING (true);
