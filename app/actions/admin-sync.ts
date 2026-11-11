'use server';

import {
  buildModeradoresStatsFromRows,
  DEFAULT_DOS_MODERADORES,
  LoteQueryRow,
} from '@/components/admin/formatters';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { ModeradorStats, VentaBingo } from '@/lib/types';

export async function isSupabaseEnvConfigured(): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const hasKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return (
    hasKey &&
    Boolean(supabaseUrl) &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseUrl.includes('tu-proyecto')
  );
}

const VENTAS_SELECT = `
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
`;

export async function fetchAdminSnapshot(): Promise<{
  moderadores: ModeradorStats[];
  ventas: VentaBingo[];
  configured: boolean;
}> {
  const configured = await isSupabaseEnvConfigured();
  if (!configured) {
    return {
      moderadores: DEFAULT_DOS_MODERADORES,
      ventas: [],
      configured: false,
    };
  }

  try {
    const supabase = await createAdminSupabaseClient();

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
          .select(VENTAS_SELECT)
          .order('created_at', { ascending: false })
          .limit(300),
      ]);

    if (lotesErr) {
      console.error('Error consultando lotes_talonarios:', lotesErr.message);
    }
    if (ventasErr) {
      console.error('Error consultando ventas_bingo:', ventasErr.message);
    }

    const ventas: VentaBingo[] =
      !ventasErr && ventasRows ? (ventasRows as unknown as VentaBingo[]) : [];

    const moderadores: ModeradorStats[] =
      !lotesErr && lotes && lotes.length > 0
        ? buildModeradoresStatsFromRows(lotes as unknown as LoteQueryRow[], ventas)
        : DEFAULT_DOS_MODERADORES;

    return {
      moderadores,
      ventas,
      configured: true,
    };
  } catch (err) {
    console.error('Error en fetchAdminSnapshot:', err);
    return {
      moderadores: DEFAULT_DOS_MODERADORES,
      ventas: [],
      configured,
    };
  }
}

export async function buscarCartonEnServidor(numero: number): Promise<VentaBingo | null> {
  if (!(await isSupabaseEnvConfigured()) || isNaN(numero) || numero <= 0) {
    return null;
  }

  try {
    const supabase = await createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('ventas_bingo')
      .select(VENTAS_SELECT)
      .lte('carton_desde', numero)
      .gte('carton_hasta', numero)
      .eq('estado', 'aprobado')
      .maybeSingle();

    if (error) {
      console.error('Error al buscar cartón:', error.message);
      return null;
    }

    return (data as unknown as VentaBingo) || null;
  } catch (err) {
    console.error('Error en buscarCartonEnServidor:', err);
    return null;
  }
}

