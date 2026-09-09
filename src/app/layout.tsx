import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import { AuthProvider } from '@/core/auth/AuthProvider';
import VerificadorAtualizacaoApp from '@/shared/components/VerificadorAtualizacaoApp';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Aprimore Construções - ERP Corporativo',
  description: 'Sistema integrado de gestão de obras e faturamento para construtoras e incorporadoras.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex bg-background text-foreground font-sans selection:bg-brand-ocre selection:text-brand-dark overflow-x-hidden transition-colors duration-300">
        {/* `beforeInteractive` — carrega e roda antes de qualquer código da
            página, inclusive a hidratação. Sem isso a primeira pintura da
            tela sempre saía clara (é o que `:root` sem classe define) e só
            corrigia pro tema certo um instante depois, quando o
            ThemeContext rodava seu próprio useEffect (um `<script>` cru no
            JSX não é suportado pelo Next — nunca garantido rodar). Mesma
            prioridade que o ThemeContext usa (localStorage salvo > tema do
            aparelho), só que síncrona — sem esse flash inicial. */}
        <Script id="tema-inicial" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('aprimore-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.add(t);}catch(e){}})();`}
        </Script>
        <AuthProvider>
          {children}
          <VerificadorAtualizacaoApp />
        </AuthProvider>
      </body>
    </html>
  );
}
