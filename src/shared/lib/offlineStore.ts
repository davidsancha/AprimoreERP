/**
 * Camada bruta de persistência local (IndexedDB) usada pelo modo offline
 * do Relatório Fotográfico. Guarda: fila de operações pendentes (a serem
 * replicadas no Supabase quando a conexão voltar), fotos ainda não
 * enviadas (como Blob) e um cache dos catálogos globais (banco/serviço/
 * ambiente) pra ter opções pra escolher mesmo sem sinal.
 *
 * Deliberadamente sem libs externas (idb, dexie) — o uso é pequeno e
 * bem definido, e evitar dependência nova aqui reduz risco.
 */

const DB_NAME = "aprimore_offline";
const DB_VERSION = 1;

const STORE_FILA = "fila";
const STORE_FOTOS = "fotos_blob";
const STORE_CATALOGO = "catalogo_cache";
const STORE_ESTRUTURAS = "estruturas_cache";
const STORE_PROGRESSO = "progresso_cache";
const STORE_PROJETOS = "projetos_cache";

export type TipoOperacaoOffline =
  | "criar_estrutura"
  | "atualizar_estrutura"
  | "criar_progresso"
  | "atualizar_progresso"
  | "excluir_progresso";

/**
 * Uma operação pendente. `payload` varia por `tipo` — ver
 * apiRelatorioFotograficoOffline.ts pra shape de cada um. IDs que começam
 * com "local-" referenciam recursos ainda não criados no servidor —
 * `sincronizador.ts` resolve esses ids pra reais conforme processa a fila.
 */
export interface OperacaoOffline {
  id: string;
  tipo: TipoOperacaoOffline;
  criadoEm: number;
  payload: unknown;
}

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível neste ambiente."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILA)) {
        db.createObjectStore(STORE_FILA, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_FOTOS)) {
        db.createObjectStore(STORE_FOTOS, { keyPath: "caminho" });
      }
      if (!db.objectStoreNames.contains(STORE_CATALOGO)) {
        db.createObjectStore(STORE_CATALOGO, { keyPath: "chave" });
      }
      if (!db.objectStoreNames.contains(STORE_ESTRUTURAS)) {
        db.createObjectStore(STORE_ESTRUTURAS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_PROGRESSO)) {
        const store = db.createObjectStore(STORE_PROGRESSO, { keyPath: "id" });
        store.createIndex("relatorio_id", "relatorio_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PROJETOS)) {
        db.createObjectStore(STORE_PROJETOS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function comStore<T>(nome: string, modo: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrirDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nome, modo);
    const store = tx.objectStore(nome);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ---------- fila de operações pendentes ---------- */

export async function enfileirar(tipo: TipoOperacaoOffline, payload: unknown): Promise<OperacaoOffline> {
  const op: OperacaoOffline = { id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tipo, criadoEm: Date.now(), payload };
  await comStore(STORE_FILA, "readwrite", (s) => s.add(op));
  return op;
}

export async function listarFila(): Promise<OperacaoOffline[]> {
  const itens = await comStore<OperacaoOffline[]>(STORE_FILA, "readonly", (s) => s.getAll());
  return (itens || []).sort((a, b) => a.criadoEm - b.criadoEm);
}

export async function removerDaFila(id: string): Promise<void> {
  await comStore(STORE_FILA, "readwrite", (s) => s.delete(id));
}

/** Atualiza o payload de uma operação ainda na fila — usado quando o usuário edita algo que ainda não foi sincronizado, em vez de empilhar uma operação nova. */
export async function atualizarNaFila(id: string, payload: unknown): Promise<void> {
  const db = await abrirDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FILA, "readwrite");
    const store = tx.objectStore(STORE_FILA);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const atual = getReq.result as OperacaoOffline | undefined;
      if (!atual) {
        resolve();
        return;
      }
      atual.payload = payload;
      const putReq = store.put(atual);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/* ---------- fotos pendentes (Blob local até o upload real) ---------- */

export async function salvarFotoLocal(caminho: string, blob: Blob, mimeType: string, segmento: string[]): Promise<void> {
  await comStore(STORE_FOTOS, "readwrite", (s) => s.put({ caminho, blob, mimeType, segmento }));
}

export async function lerFotoLocal(caminho: string): Promise<{ blob: Blob; mimeType: string; segmento: string[] } | null> {
  const item = await comStore<{ caminho: string; blob: Blob; mimeType: string; segmento: string[] } | undefined>(STORE_FOTOS, "readonly", (s) => s.get(caminho));
  return item ? { blob: item.blob, mimeType: item.mimeType, segmento: item.segmento || [] } : null;
}

export async function listarFotosLocais(): Promise<{ caminho: string; blob: Blob; mimeType: string }[]> {
  return comStore(STORE_FOTOS, "readonly", (s) => s.getAll());
}

export async function removerFotoLocal(caminho: string): Promise<void> {
  await comStore(STORE_FOTOS, "readwrite", (s) => s.delete(caminho));
}

/* ---------- cache de catálogos (banco/serviço/ambiente) pra funcionar offline ---------- */

export async function salvarCatalogoCache(chave: string, valores: string[]): Promise<void> {
  await comStore(STORE_CATALOGO, "readwrite", (s) => s.put({ chave, valores }));
}

export async function lerCatalogoCache(chave: string): Promise<string[]> {
  const item = await comStore<{ chave: string; valores: string[] } | undefined>(STORE_CATALOGO, "readonly", (s) => s.get(chave));
  return item?.valores || [];
}

/* ---------- cache local dos registros (write-through, sobrevive a fechar o app) ---------- */

export async function salvarEstruturaCache<T extends { id: string }>(estrutura: T): Promise<void> {
  await comStore(STORE_ESTRUTURAS, "readwrite", (s) => s.put(estrutura));
}

export async function lerEstruturaCache<T>(id: string): Promise<T | null> {
  const item = await comStore<T | undefined>(STORE_ESTRUTURAS, "readonly", (s) => s.get(id));
  return item ?? null;
}

export async function listarEstruturasCache<T>(): Promise<T[]> {
  return comStore<T[]>(STORE_ESTRUTURAS, "readonly", (s) => s.getAll());
}

export async function removerEstruturaCache(id: string): Promise<void> {
  await comStore(STORE_ESTRUTURAS, "readwrite", (s) => s.delete(id));
}

export async function salvarProgressoCache<T extends { id: string; relatorio_id: string }>(item: T): Promise<void> {
  await comStore(STORE_PROGRESSO, "readwrite", (s) => s.put(item));
}

export async function lerProgressoCache<T>(id: string): Promise<T | null> {
  const item = await comStore<T | undefined>(STORE_PROGRESSO, "readonly", (s) => s.get(id));
  return item ?? null;
}

export async function listarProgressoCachePorRelatorio<T>(relatorioId: string): Promise<T[]> {
  const db = await abrirDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROGRESSO, "readonly");
    const idx = tx.objectStore(STORE_PROGRESSO).index("relatorio_id");
    const req = idx.getAll(IDBKeyRange.only(relatorioId));
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removerProgressoCache(id: string): Promise<void> {
  await comStore(STORE_PROGRESSO, "readwrite", (s) => s.delete(id));
}

/* ---------- cache de projetos corporativos (write-through, enquanto online; leitura quando offline) ---------- */

export async function salvarProjetoCache<T extends { id: string }>(projeto: T): Promise<void> {
  await comStore(STORE_PROJETOS, "readwrite", (s) => s.put(projeto));
}

export async function salvarProjetosCache<T extends { id: string }>(projetos: T[]): Promise<void> {
  for (const p of projetos) await salvarProjetoCache(p);
}

export async function lerProjetoCache<T>(id: string): Promise<T | null> {
  const item = await comStore<T | undefined>(STORE_PROJETOS, "readonly", (s) => s.get(id));
  return item ?? null;
}

export async function listarProjetosCache<T>(): Promise<T[]> {
  return comStore<T[]>(STORE_PROJETOS, "readonly", (s) => s.getAll());
}

/** Gera um id local reconhecível — usado tanto pra relatórios quanto slides de progresso criados offline. */
export function gerarIdLocal(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ehIdLocal(id: string | null | undefined): boolean {
  return !!id && id.startsWith("local-");
}
