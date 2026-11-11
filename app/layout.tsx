import type { Metadata, Viewport } from 'next';
import './globals.css';
import NetworkStatusBanner from '@/components/NetworkStatusBanner';

export const metadata: Metadata = {
  title: 'Bingo Taquilla Móvil - Verificador de Pagos',
  description: 'PWA minimalista fintech para verificación de pagos móviles y asignación de cartones de Bingo.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Bingo Taquilla',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#fafafa',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className="min-h-screen bg-[#fafafa] text-zinc-900 antialiased selection:bg-emerald-100 selection:text-emerald-900"
        suppressHydrationWarning
      >
        <NetworkStatusBanner />
        {children}
      </body>
    </html>
  );
}
