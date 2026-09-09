export interface VersaoRemotaApk {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  notes?: string;
  publishedAt?: string;
}

/** Mesmo arquivo publicado no Storage que o app nativo lê pra se autoatualizar (ver VerificadorAtualizacaoApp.tsx). */
export const URL_VERSAO_APK_JSON =
  'https://fbctoskurwbdlqwrdbqg.supabase.co/storage/v1/object/public/relatorios-fotograficos/apk/version.json';
