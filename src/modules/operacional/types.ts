export interface Projeto {
  id?: string;
  cliente_id?: string;
  cliente_final_id?: string;
  nome: string;
  os: string;
  data_prevista_inicio: string;
  data_prevista_termino: string;
  data_efetiva_inicio?: string | null;
  data_efetiva_termino?: string | null;
  valor_total_contrato: number;
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  numero: string;
  complemento?: string | null;
  status: 'planejado' | 'em_andamento' | 'concluido' | 'suspenso';
  tipologia: string;
  // Santander: código UNIORG da loja (máscara XXX-XXXX) — migration 00018
  uniorg?: string | null;
  // Dados de obra usados por outros módulos (ex.: relatório fotográfico de engenharia) — migration 00010
  agencia?: string | null;
  upe?: string | null;
  sap?: string | null;
  gestor?: string | null;
  fiscalizacao_empresa?: string | null;
  fiscal?: string | null;
  construtora?: string | null;
  responsavel?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type CategoriaCusto =
  | 'insumos'
  | 'mao_de_obra'
  | 'empreiteiros'
  | 'ferramentas'
  | 'locacoes'
  | 'logistica'
  | 'administrativo'
  | 'alimentacao'
  | 'outros';

export interface OrcamentoCusto {
  id?: string;
  projeto_id: string;
  categoria: CategoriaCusto;
  valor_previsto: number;
  created_at?: string;
  updated_at?: string;
}

export interface NotaFiscal {
  id?: string;
  custo_id?: string;
  loja_nome: string;
  cnpj: string;
  data_emissao?: string | null;
  endereco?: string | null;
  valor_total: number;
  chave_acesso?: string | null;
  url_qr_code?: string | null;
  forma_pagamento?: string | null;
  created_at?: string;
  itens?: ItemNotaFiscal[];
}

export interface ItemNotaFiscal {
  id?: string;
  nota_fiscal_id?: string;
  nome_item: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  created_at?: string;
  variacao?: number;
  preco_anterior?: number;
}

export interface CustoRealizado {
  id?: string;
  projeto_id: string;
  categoria: CategoriaCusto;
  descricao: string;
  valor: number;
  data_custo: string;
  created_at?: string;
  nota_fiscal?: NotaFiscal; // Opcional, para armazenar a nota vinculada no envio
}

export const CATEGORIAS_CUSTO_LABELS: Record<CategoriaCusto, string> = {
  insumos: 'Insumos',
  mao_de_obra: 'Mão de Obra',
  empreiteiros: 'Empreiteiros',
  ferramentas: 'Ferramentas',
  locacoes: 'Locações',
  logistica: 'Logística',
  administrativo: 'Custos Administrativos',
  alimentacao: 'Alimentação',
  outros: 'Outros',
};
