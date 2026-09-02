/**
 * Tipos do módulo de relatório fotográfico — porta de
 * C:\Users\david\OneDrive\APRIMORE\EGF\ITAÚ\APRIMORE_ERP (packages/shared).
 * Ver README.md desta pasta para o status da integração.
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

export interface Servico {
  nome: string;
  etapas?: readonly string[];
}

/** Equivalente ao antigo projeto.json — aqui vira linha(s) de tabela, não arquivo. */
export interface EstruturaFotografica {
  tipoProjeto: TipoProjetoFotografico;
  equipamentos: Equipamento[];
  servicos: Servico[];
}

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

/** Referência à foto já enviada pro Supabase Storage (nunca a foto solta). */
export interface FotoReferencia {
  storagePath: string;
  nomeOriginal: string;
}

export interface ProgressoReformaSlide {
  servico: string;
  ambiente: string;
  etapa1: "ANTES" | "DURANTE";
  antes: FotoReferencia;
  depois: FotoReferencia;
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
