export interface Recebimento {
  id?: string;
  projeto_id: string;
  parcela_numero: number;
  percentual: number;
  valor: number;
  data_prevista: string;
  status: 'pendente' | 'pago' | 'atrasado';
  data_pagamento?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PrevisaoCaixa {
  periodo15Dias: number;
  periodo30Dias: number;
}
