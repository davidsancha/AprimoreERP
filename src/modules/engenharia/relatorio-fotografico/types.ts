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
  // ordem dos ambientes NESTE relatório (migration 00012) — cada relatório
  // pode querer os mesmos ambientes do catálogo global em ordem diferente;
  // ambiente fora da lista cai no fim, em ordem alfabética
  ambientes_ordem: string[];
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
  // campos específicos do modelo Santander (migration 00017) — só
  // preenchidos quando banco === "Santander"; vivem direto na estrutura
  // (nunca em `projetos`) porque são conteúdo do relatório em si (chamado,
  // descrição do problema etc.), não dado organizacional da obra
  // reaproveitável entre relatórios diferentes do mesmo projeto.
  uniorg: string | null;
  mantenedor: string | null;
  chamado: string | null;
  relatorio_titulo: string | null;
  data_relatorio: string | null;
  descricao_problema: string | null;
  causa_origem: string | null;
  danos: string | null;
  paliativo_retirada_risco: string | null;
  escopo_proposta: string | null;
  cronograma: string | null;
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
  // exclusivos do modelo Santander (opcionais — só preenchidos quando o
  // modelo é Santander). mantenedor/chamado/relatorioTitulo/dataRelatorio/
  // descricaoProblema...cronograma são valores diretos; resumoUniorg e
  // resumoOsUniorg chegam JÁ COMPOSTOS (uniorg + nome da loja + chamado
  // combinados) porque os marcadores do template juntam vários dados numa
  // linha só — ver comentário em MODELOS_CFG["santander-add"] (lib/pptx.ts).
  mantenedor?: string;
  chamado?: string;
  relatorioTitulo?: string;
  dataRelatorio?: string;
  descricaoProblema?: string;
  causaOrigem?: string;
  danos?: string;
  paliativoRetiradaRisco?: string;
  escopoProposta?: string;
  cronograma?: string;
  resumoUniorg?: string;
  resumoOsUniorg?: string;
}

export const CAMPOS_RELATORIO_VAZIOS: CamposRelatorio = {
  agencia: "", programa: "", upe: "", sap: "", gestor: "", fiscEmpresa: "",
  fiscal: "", construtora: "", responsavel: "", inicio: "", termino: "",
  mantenedor: "", chamado: "", relatorioTitulo: "", dataRelatorio: "",
  descricaoProblema: "", causaOrigem: "", danos: "", paliativoRetiradaRisco: "",
  escopoProposta: "", cronograma: "", resumoUniorg: "", resumoOsUniorg: "",
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
  // Terceira foto (migration 00017) — só o modelo Santander usa (ANTES x
  // DURANTE x DEPOIS lado a lado); nula pros demais modelos.
  foto_durante_path: string | null;
  // Texto livre por slide do modelo Santander — a tela pré-preenche com o
  // comentário do slide anterior ao criar um novo (ver page.tsx), mas o
  // valor em si é só mais uma coluna, sem lógica especial aqui.
  comentario: string | null;
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
  // Modelos Itaú numeram e renomeiam esses rótulos por slide clonado ("Foto
  // 01 - ANTES", "Foto 02 - DEPOIS", trocando ANTES/DURANTE); modelos sem
  // numeração (Santander, rótulos fixos ANTES/DURANTE/DEPOIS) deixam de fora.
  marcadorFoto1?: string;
  marcadorFoto2?: string;
  marcadorRotuloAntes?: string;
  // Descrição única (Itaú: equipamento+ponto ou serviço+ambiente numa string
  // só) — modelos com campos separados (Santander: Ambiente/Comentários) usam
  // marcadorAmbiente/marcadorComentario abaixo em vez deste.
  marcadorDescricao?: string;
  marcadorAmbiente?: string;
  marcadorComentario?: string;
  formaAntes: string;
  formaDepois: string;
  // Terceira foto por slide (só Santander, ANTES x DURANTE x DEPOIS) — os
  // demais modelos não definem isso e o motor ignora a foto "durante".
  formaDurante?: string;
  // Slide que tem que continuar sendo SEMPRE o último (ex.: "OBRIGADO" do
  // Santander) — o motor preserva esse slide e insere os clones antes dele,
  // em vez de anexar no fim do arquivo.
  slideFinal?: number;
  campos: ModeloCfgCampo[];
}
