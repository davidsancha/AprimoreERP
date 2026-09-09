import type { Metadata } from 'next';
import { buscarConvite, palavraConvidado } from './dados';
import ConviteLanding from './ConviteLanding';

type Params = { params: Promise<{ token: string }> };

/**
 * Server Component de propósito — o link é compartilhado pelo WhatsApp, que
 * lê as meta tags Open Graph direto do HTML (não executa JS), então esse
 * fetch e o título/descrição abaixo precisam estar disponíveis no
 * carregamento inicial, sem depender de um `useEffect` no client.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const convite = await buscarConvite(token);

  if (!convite?.valido) {
    return { title: 'Convite — Aprimore ERP', description: 'Convite indisponível.' };
  }

  const primeiroNome = convite.nome?.split(' ')[0] || 'Você';
  const ehParceiroEgf = convite.role === 'convidado';
  const convidadoPalavra = palavraConvidado(convite.genero);
  const titulo = `${primeiroNome}, você foi ${convidadoPalavra}! — Aprimore ERP`;
  const descricao = ehParceiroEgf
    ? 'A EGF Construtora foi convidada a fazer parte do Aprimore ERP — acesse o módulo de Relatórios Fotográficos.'
    : `Você foi ${convidadoPalavra} para acessar o Aprimore ERP. Toque para completar seu cadastro.`;

  return {
    title: titulo,
    description: descricao,
    openGraph: { title: titulo, description: descricao },
  };
}

export default async function ConvitePage({ params }: Params) {
  const { token } = await params;
  const convite = await buscarConvite(token);
  return <ConviteLanding token={token} convite={convite} />;
}
