import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aprimoreegf.erp',
  appName: 'Aprimore ERP',
  webDir: 'public',
  // O app carrega o Next.js remoto (SSR + rotas de API, ex. geração de PPTX
  // com `sharp`, que não roda num export estático) em vez de empacotar HTML.
  // Dev: aponte para o IP da máquina rodando `npm run dev` na mesma rede
  // Wi-Fi do celular (ver `allowedDevOrigins` em next.config.ts). Produção:
  // troque `CAPACITOR_SERVER_URL` pela URL do deploy antes de gerar o
  // APK/AAB final — ver android/README-BUILD.md.
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'https://aprimore.vercel.app',
    cleartext: true,
    allowNavigation: ['*'],
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
