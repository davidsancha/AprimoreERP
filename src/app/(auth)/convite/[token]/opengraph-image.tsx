import { ImageResponse } from 'next/og';
import { buscarConvite } from './dados';

export const runtime = 'edge';
export const alt = 'Convite — Aprimore ERP';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Domínio fixo de produção (capacitor.config.ts usa o mesmo) — o gerador de
// imagem roda no servidor e precisa de uma URL absoluta pra buscar a logo.
const ORIGEM = 'https://aprimore.vercel.app';

export default async function Image({ params }: { params: { token: string } }) {
  const convite = await buscarConvite(params.token);
  const valido = !!convite?.valido;
  const primeiroNome = valido ? convite!.nome?.split(' ')[0] || 'Você' : null;
  const ehParceiroEgf = valido && convite!.role === 'convidado';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0B1B33 0%, #12294A 55%, #1B3A63 100%)',
          fontFamily: 'sans-serif',
          padding: 60,
          textAlign: 'center',
        }}
      >
        {ehParceiroEgf && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${ORIGEM}/brand/egflogo.jpg`}
            width={140}
            height={140}
            style={{ borderRadius: '50%', marginBottom: 32, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}
            alt=""
          />
        )}
        <div style={{ fontSize: 30, fontWeight: 700, color: '#D9A441', letterSpacing: 4, textTransform: 'uppercase', display: 'flex' }}>
          Aprimore ERP
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, color: '#FFFFFF', marginTop: 20, lineHeight: 1.2, display: 'flex' }}>
          {valido ? `${primeiroNome}, você foi convidado(a)!` : 'Convite'}
        </div>
        {ehParceiroEgf && (
          <div style={{ fontSize: 30, color: '#C7D2E0', marginTop: 24, display: 'flex' }}>Parceria Aprimore × EGF Construtora</div>
        )}
      </div>
    ),
    { ...size },
  );
}
