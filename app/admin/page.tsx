import React from 'react';
import AdminBingoCheck from '@/components/AdminBingoCheck';
import {
  buildModeradoresStatsFromRows,
  DEFAULT_DOS_MODERADORES,
  LoteQueryRow,
} from '@/components/admin/formatters';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ModeradorStats, VentaBingo } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const isSupabaseConfigured =
    Boolean(supabaseUrl && supabaseKey) &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseUrl.includes('tu-proyecto');

  let initialModeradores: ModeradorStats[] = DEFAULT_DOS_MODERADORES;
  let initialVentas: VentaBingo[] = [];

  if (isSupabaseConfigured) {
    try {
      const supabase = await createServerSupabaseClient();

      const [{ data: lotes, error: lotesErr }, { data: ventasRows, error: ventasErr }] =
        await Promise.all([
          supabase
            .from('lotes_talonarios')
            .select(
              `
              id,
              moderador_id,
              bloque_nombre,
              numero_inicial,
              numero_final,
              siguiente_disponible,
              activo,
              perfiles:moderador_id (
                nombre
              )
            `
            )
            .eq('activo', true)
            .order('numero_inicial', { ascending: true }),
          supabase
            .from('ventas_bingo')
            .select(
              `
              id,
              moderador_id,
              lote_id,
              comprador_nombre,
              banco_origen,
              referencia,
              monto,
              cantidad_cartones,
              carton_desde,
              carton_hasta,
              comprobante_url,
              estado,
              created_at,
              perfiles:moderador_id (
                nombre
              )
            `
            )
            .order('created_at', { ascending: false })
            .limit(300),
        ]);

      if (!ventasErr && ventasRows) {
        initialVentas = ventasRows as unknown as VentaBingo[];
      }

      if (!lotesErr && lotes && lotes.length > 0) {
        initialModeradores = buildModeradoresStatsFromRows(
          lotes as unknown as LoteQueryRow[],
          initialVentas
        );
      }
    } catch (err) {
      console.error('Error precargando métricas de admin en servidor:', err);
    }
  }

  const precioUnitario = Number(process.env.BINGO_PRECIO_UNITARIO) || 50;
  const tasaUsdInicial = Number(process.env.NEXT_PUBLIC_TASA_USD) || 50;

  return (
    <AdminBingoCheck
      initialModeradores={initialModeradores}
      initialVentas={initialVentas}
      precioUnitario={precioUnitario}
      moneda="Bs."
      tasaUsdInicial={tasaUsdInicial}
      isSupabaseConfigured={isSupabaseConfigured}
    />
  );
}
