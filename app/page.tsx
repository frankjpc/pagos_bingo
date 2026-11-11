import React from 'react';
import ModeradorTerminal from '@/components/ModeradorTerminal';
import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Configuración de Pago Móvil para el evento (puede venir de base de datos o env)
  const pagoMovilConfig = {
    banco: process.env.PAGO_MOVIL_BANCO || 'BANCO DE VENEZUELA (0102)',
    telefono: process.env.PAGO_MOVIL_TELEFONO || '0424-4462006',
    cedula: process.env.PAGO_MOVIL_CEDULA || 'V31753009',
    titular: process.env.PAGO_MOVIL_TITULAR || 'Cristian Espinoza',
    precioUnitario: Number(process.env.BINGO_PRECIO_UNITARIO) || 1,
    moneda: 'Dólar',
    qrImageUrl: '/qr.png',
  };

  // Simulación / Datos por defecto del moderador actual (o extraído de Supabase Auth en producción)
  const moderadorActivo = {
    id: '00000000-0000-0000-0000-000000000001',
    nombre: 'Mesa 1 - Ana Morales',
    lote: {
      bloqueNombre: 'Lote 1 (001 - 100)',
      numeroInicial: 1,
      numeroFinal: 100,
      siguienteDisponible: 1,
    },
  };

  return (
    <main className="min-h-[100dvh] bg-[#fafafa] flex flex-col justify-between">
      <ModeradorTerminal
        moderadorId={moderadorActivo.id}
        moderadorNombre={moderadorActivo.nombre}
        loteInfo={moderadorActivo.lote}
        pagoMovilConfig={pagoMovilConfig}
      />
    </main>
  );
}
