import React from 'react';
import ModeradorTerminal from '@/components/ModeradorTerminal';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseEnvConfigured } from '@/app/actions/admin-sync';

export const dynamic = 'force-dynamic';

const MESAS_POR_DEFECTO = {
  '1': {
    id: '00000000-0000-0000-0000-000000000001',
    nombre: 'Mesa 1 - Ana Morales',
    lote: {
      bloqueNombre: 'Lote 1 (001 - 100)',
      numeroInicial: 1,
      numeroFinal: 100,
      siguienteDisponible: 1,
    },
  },
  '2': {
    id: '00000000-0000-0000-0000-000000000002',
    nombre: 'Mesa 2 - Carlos Pérez',
    lote: {
      bloqueNombre: 'Lote 2 (101 - 200)',
      numeroInicial: 101,
      numeroFinal: 200,
      siguienteDisponible: 101,
    },
  },
} as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ mesa?: string }>;
}) {
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

  const params = searchParams ? await searchParams : {};
  const mesaKey = params?.mesa === '2' ? '2' : '1';
  const baseMesa = MESAS_POR_DEFECTO[mesaKey];

  let moderadorActivo = {
    id: baseMesa.id,
    nombre: baseMesa.nombre as string,
    lote: {
      bloqueNombre: baseMesa.lote.bloqueNombre as string,
      numeroInicial: baseMesa.lote.numeroInicial as number,
      numeroFinal: baseMesa.lote.numeroFinal as number,
      siguienteDisponible: baseMesa.lote.siguienteDisponible as number,
    },
  };

  if (await isSupabaseEnvConfigured()) {
    try {
      const supabase = await createAdminSupabaseClient();
      const { data: loteData } = await supabase
        .from('lotes_talonarios')
        .select(
          'bloque_nombre, numero_inicial, numero_final, siguiente_disponible, perfiles:moderador_id(nombre)'
        )
        .eq('moderador_id', moderadorActivo.id)
        .eq('activo', true)
        .maybeSingle();

      if (loteData) {
        const perfilRaw = loteData.perfiles as
          | { nombre?: string }
          | { nombre?: string }[]
          | null;
        const nombreLive = Array.isArray(perfilRaw)
          ? perfilRaw[0]?.nombre
          : perfilRaw?.nombre;

        moderadorActivo = {
          id: moderadorActivo.id,
          nombre: nombreLive || moderadorActivo.nombre,
          lote: {
            bloqueNombre:
              loteData.bloque_nombre || moderadorActivo.lote.bloqueNombre,
            numeroInicial: Number(loteData.numero_inicial),
            numeroFinal: Number(loteData.numero_final),
            siguienteDisponible: Number(loteData.siguiente_disponible),
          },
        };
      }
    } catch {
      // Mantiene el fallback local si Supabase aún no responde o tiene credenciales pendientes
    }
  }

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
