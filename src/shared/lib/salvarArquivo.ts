import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";

/**
 * Baixar um Blob gerado no navegador (`<a download>` + URL.createObjectURL)
 * funciona em navegador de verdade, mas dentro do WebView do app Android
 * (Capacitor) não aciona nada — não existe gerenciador de downloads ali, o
 * clique simplesmente não faz nada visível. Por isso salva direto no
 * aparelho via `@capacitor/filesystem` quando roda nativo; no navegador
 * (PC ou celular fora do app) continua usando o download normal.
 */
export async function salvarArquivoNoAparelho(blob: Blob, nomeArquivo: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const base64 = await blobParaBase64(blob);
    const caminho = `AprimoreERP/${nomeArquivo}`;
    await Filesystem.writeFile({
      path: caminho,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });
    return `Salvo em Documentos/${caminho} — abra pelo app Arquivos do celular.`;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoga só depois de dar tempo do navegador iniciar o download — revogar
  // na hora podia invalidar o blob antes do download começar
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return `"${nomeArquivo}" baixado.`;
}

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultado = reader.result as string;
      // FileReader.readAsDataURL devolve "data:<mime>;base64,AAAA..." — o
      // Filesystem do Capacitor espera só a parte depois da vírgula
      resolve(resultado.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
