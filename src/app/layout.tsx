import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AuthProvider } from '@/core/auth/AuthProvider';
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
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
