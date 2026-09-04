# Aprimore ERP — Android (Capacitor)

Este projeto Android foi gerado com Capacitor (`npx cap add android`) e
carrega o Next.js remoto num WebView — não é um export estático, porque
rotas de API (ex. geração de PPTX com `sharp`) precisam rodar num server
Node de verdade. Ver `capacitor.config.ts` na raiz do projeto.

## Ambiente necessário (não disponível nesta sessão)

Esta máquina não tem JDK 17+ nem o Android SDK instalados (só um JDK 1.8
antigo), então não dá pra compilar/rodar o APK a partir daqui. Pra
compilar você precisa, no seu computador de desenvolvimento:

1. **Android Studio** (traz o SDK, o emulador e um JDK compatível
   embutido — mais simples que instalar tudo separado).
2. Abrir a pasta `android/` deste projeto no Android Studio — ele baixa
   as dependências do Gradle sozinho na primeira abertura.

## Rodando em modo desenvolvimento (hot reload do Next.js)

1. Descubra o IP da sua máquina na rede Wi-Fi (`ipconfig`, algo tipo
   `192.168.x.x`) — o `capacitor.config.ts` já está apontando pra
   `192.168.10.10:3010` (o IP usado nas sessões de teste anteriores);
   ajuste se o seu for diferente.
2. Rode `npm run dev -- -p 3010 -H 0.0.0.0` (ou `npm run dev` mudando a
   porta em `package.json`) — precisa escutar em todas as interfaces
   pra o celular/emulador alcançar.
3. `npx cap sync android` depois de qualquer mudança em
   `capacitor.config.ts` ou nas dependências de plugins.
4. No Android Studio: Run ▶ no dispositivo/emulador. O app abre com o
   Next.js rodando na sua máquina, com hot reload normal.

## Antes de gerar o APK/AAB de produção

Troque a URL do `server.url` pra apontar pro deploy real (ex. Vercel),
via variável de ambiente `CAPACITOR_SERVER_URL` antes de rodar
`npx cap sync android`, ou editando `capacitor.config.ts` direto.

## Seletor de fotos nativo (estilo WhatsApp)

O plugin customizado `FastGallery`
(`android/app/src/main/java/com/aprimoreegf/erp/`) substitui o seletor
de arquivos genérico do Android por uma grade própria que:
- consulta o MediaStore direto (sem Intent/SAF) pra abrir instantâneo;
- abre por padrão só com as fotos da pasta **DCIM/Camera** (a mesma
  pasta que o app de câmera do aparelho grava), com um botão pra
  alternar pra "Todas as fotos";
- usa Glide pra cache/reciclagem de miniaturas, então rola liso mesmo
  com muitas fotos.

No lado web (`src/shared/lib/fastGallery.ts`), `temGaleriaNativa()`
detecta se está rodando dentro do app nativo (`Capacitor.isNativePlatform()`)
— no navegador comum (`localhost:3010` no PC/celular fora do app) o
fluxo continua usando o `<input type="file">` de sempre, sem mudança de
comportamento.

Isso precisa das permissões `READ_MEDIA_IMAGES` (Android 13+) ou
`READ_EXTERNAL_STORAGE` (versões antigas), já declaradas no
`AndroidManifest.xml` — o app pede em runtime na primeira vez que a
galeria nativa é aberta.

## Build sem Android Studio (GitHub Actions)

O workflow `.github/workflows/android-build.yml` compila o `.apk`
automaticamente a cada push na branch `main` ou manualmente via
`workflow_dispatch` (com opção de informar `server_url` customizado).

O APK compilado é disponibilizado em múltiplos canais:
1. **Download direto público (Supabase Storage)**:
   `https://fbctoskurwbdlqwrdbqg.supabase.co/storage/v1/object/public/relatorios-fotograficos/apk/aprimore-erp.apk`
2. **GitHub Releases** (tag `apk-latest`):
   `https://github.com/davidsancha/AprimoreERP/releases`
3. **Artifacts** na aba Actions do repositório.

## Modo offline

O relatório fotográfico funciona sem sinal pra relatórios **avulsos**
(sem vínculo a projeto corporativo — buscar projeto exige rede). Criar
um relatório novo, adicionar equipamentos/serviços/ambientes e fotos
tudo continua funcionando offline: fica salvo no IndexedDB do aparelho e
uma fila sincroniza sozinha assim que a internet volta (evento
`online`/`offline` do navegador + verificação real de conectividade a
cada 30s, porque `navigator.onLine` sozinho não é confiável). Ver
`src/shared/lib/offlineStore.ts`,
`src/modules/engenharia/relatorio-fotografico/services/apiRelatorioFotograficoOffline.ts`
e `sincronizadorOffline.ts`. A tela mostra um aviso amarelo quando
offline/com pendências e um aviso verde quando termina de sincronizar.

## Ícone e splash screen

Gerados a partir do glifo (só o prédio, sem o texto) recortado de
`public/brand/Logo1.png` — `@capacitor/assets` não instalou nesta
máquina (node-gyp/Python ausente, o pacote traz seu próprio `sharp`
nativo), então gerei manualmente com o `sharp` que o projeto já usa
(script não versionado, só o resultado): `resources/icon.png`,
`resources/splash.png` e todas as densidades em
`android/app/src/main/res/mipmap-*` e `drawable-{port,land}-*`.

## Login por biometria

`capacitor-native-biometric` (`src/shared/lib/biometria.ts`) — só
funciona dentro do app nativo. Depois do primeiro login com senha, o
usuário pode ativar; o app guarda o `refresh_token` da sessão atrás da
biometria do aparelho (nunca a senha), e a próxima entrada troca esse
token por uma sessão nova via `supabase.auth.refreshSession()`.
Logout explícito desativa a biometria automaticamente (evita reabrir a
sessão de quem saiu, em aparelho compartilhado).

## Pendências conhecidas

- Nada disso foi testado num dispositivo/emulador real ainda (ver
  seção acima — precisa de Android Studio numa máquina com SDK, ou do
  APK compilado pelo GitHub Actions).
- Cache de projetos vinculados cobre busca/seleção e religação
  automática ao voltar a rede; não existe ainda uma tela pra "religar
  manualmente" um relatório que ficou avulso por não achar match único
  do projeto — hoje isso só é resolvido via edição direta no banco se
  a religação automática falhar (0 ou 2+ candidatos com nome parecido).
