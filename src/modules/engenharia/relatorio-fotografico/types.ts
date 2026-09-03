/**
 * Tipos do módulo de relatório fotográfico. Espelha a tabela
 * `engenharia_estrutura_fotografica` (migrations 00008 + 00009) — ver
 * schema-proposta.sql para o histórico e README.md para o status.
 */

export type TipoProjetoFotografico = "infraestrutura" | "reforma";

export const ETAPAS = ["ANTES", "DURANTE", "DEPOIS"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const EXTENSOES_FOTO = [
  "jpg", "jpeg", "png", "heic", "heif", "webp", "bmp", "tif", "tiff",
] as const;

export interface Ponto {
  numero: string;
  local: string;
}

export interface Equipamento {
  nome: string;
  pontos: Ponto[];
}

/** Linha real da tabela engenharia_estrutura_fotografica. */
export interface EstruturaFotografica {
  id: string;
  projeto_id: string | null;
  user_id: string | null;
  is_avulso: boolean;
  obra_nome: string | null;
  tipo_projeto: TipoProjetoFotografico;
  banco: string | null;
  modelo_relatorio: string | null;
  equipamentos: Equipamento[];
  servicos_habilitados: string[];
  // campos de cabeçalho (slides 1 e 2) — migration 00009
  agencia: string | null;
  programa: string | null;
  upe: string | null;
  sap: string | null;
  gestor: string | null;
  fiscalizacao_empresa: string | null;
  fiscal: string | null;
  construtora: string | null;
  responsavel: string | null;
  data_inicio_obra: string | null;
  data_termino_obra: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Campos de obra que vivem em `projetos` (migration 00010) quando o
 * relatório está vinculado — Agência/UPE/SAP/gestor/fiscalização/
 * construtora/responsável são dados da obra, úteis pra empresa toda, não
 * exclusivos do relatório fotográfico. Só duplicados localmente em
 * `engenharia_estrutura_fotografica` para o caso avulso (sem projeto_id).
 */
export interface CamposObraProjeto {
  agencia: string | null;
  upe: string | null;
  sap: string | null;
  gestor: string | null;
  fiscalizacao_empresa: string | null;
  fiscal: string | null;
  construtora: string | null;
  responsavel: string | null;
}

/** Resumo de `projetos` usado no seletor de projeto (não é uma tabela nova). */
export interface ProjetoResumo extends CamposObraProjeto {
  id: string;
  nome: string;
  os: string;
  tipologia: string;
  status: string;
  data_prevista_inicio: string | null;
  data_prevista_termino: string | null;
  data_efetiva_inicio: string | null;
  data_efetiva_termino: string | null;
  cliente_final_id: string | null;
  cliente_final_nome: string | null;
}

/** Filtros da busca ampliada de projetos (lista completa, não só autocomplete). */
export interface FiltrosBuscaProjeto {
  texto?: string;
  clienteFinalId?: string;
  status?: string;
}

/** Linha de `engenharia_modelos_relatorio` (migration 00011). */
export interface ModeloRelatorioOpcao {
  id: string;
  banco: string;
  tipo_projeto: TipoProjetoFotografico | null;
  nome: string;
  config_id: string | null;
  storage_template_path: string | null;
}

/** Campos que alimentam os slides 1 e 2 do PowerPoint — mesmo formato usado por lib/pptx.ts. */
export interface CamposRelatorio {
  agencia: string;
  programa: string;
  upe: string;
  sap: string;
  gestor: string;
  fiscEmpresa: string;
  fiscal: string;
  construtora: string;
  responsavel: string;
  inicio: string;
  termino: string;
}

export const CAMPOS_RELATORIO_VAZIOS: CamposRelatorio = {
  agencia: "", programa: "", upe: "", sap: "", gestor: "", fiscEmpresa: "",
  fiscal: "", construtora: "", responsavel: "", inicio: "", termino: "",
};

/** Caminho da foto já enviada pro bucket `relatorios-fotograficos` (nunca a foto solta). */
export interface FotoReferencia {
  storagePath: string;
  nomeOriginal: string;
}

export interface ProgressoSlide {
  id: string;
  relatorio_id: string;
  ordem: number;
  servico: string | null;
  ambiente: string | null;
  equipamento: string | null;
  numero_ponto: string | null;
  local: string | null;
  etapa1: "ANTES" | "DURANTE";
  // NULL = foto ainda não enviada (pendência — migration 00013). Bloqueia a
  // montagem do PowerPoint, não a criação do slide (serviço/ambiente valem
  // sozinhos).
  foto_antes_path: string | null;
  foto_depois_path: string | null;
  created_at: string;
}

export interface ModeloCfgCampo {
  id: keyof CamposRelatorio;
  slide: number;
  marcador: string;
  prefixo?: string;
}

export interface ModeloCfg {
  nome: string;
  slideModelo: number;
  marcadorFoto1: string;
  marcadorFoto2: string;
  marcadorRotuloAntes?: string;
  marcadorDescricao: string;
  formaAntes: string;
  formaDepois: string;
  campos: ModeloCfgCampo[];
}
