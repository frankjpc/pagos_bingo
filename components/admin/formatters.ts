import { ModeradorStats, VentaBingo } from '@/lib/types';

export function formatBs(amount: number): string {
  return `Bs. ${Number(amount || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatUsd(amountBs: number, tasaUsd: number): string {
  const safeRate = tasaUsd > 0 ? tasaUsd : 1;
  const usd = Number(amountBs || 0) / safeRate;
  return `$${usd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getInitials(name: string): string {
  const parts = (name || 'U')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'BG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatCartonRange(desde: number, hasta: number): string {
  const d = String(desde).padStart(3, '0');
  const h = String(hasta).padStart(3, '0');
  return desde === hasta ? `#${d}` : `#${d} – #${h}`;
}

export function buildVentasCsv(ventas: VentaBingo[], tasaUsd: number): string {
  const headers = [
    'Fecha',
    'Hora',
    'Comprador',
    'Moderador',
    'Banco',
    'Referencia',
    'Cartones',
    'Desde',
    'Hasta',
    'Monto_Bs',
    'Equiv_USD',
    'Estado',
  ];

  const rows = ventas.map((v) => {
    const dt = new Date(v.created_at);
    const fecha = dt.toLocaleDateString('es-VE');
    const hora = dt.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    const equivUsd = tasaUsd > 0 ? (Number(v.monto) / tasaUsd).toFixed(2) : '0.00';

    return [
      fecha,
      hora,
      v.comprador_nombre,
      v.perfiles?.nombre || 'Moderador',
      v.banco_origen,
      v.referencia,
      v.cantidad_cartones,
      v.carton_desde,
      v.carton_hasta,
      Number(v.monto).toFixed(2),
      equivUsd,
      v.estado,
    ]
      .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
      .join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

export interface LoteQueryRow {
  id?: string;
  moderador_id: string;
  bloque_nombre: string;
  numero_inicial: number;
  numero_final: number;
  siguiente_disponible: number;
  perfiles?: { nombre?: string } | { nombre?: string }[] | null;
}

export function buildModeradoresStatsFromRows(
  lotes: LoteQueryRow[],
  ventas: VentaBingo[]
): ModeradorStats[] {
  return lotes.map((lote) => {
    const ventasModAprobadas = ventas.filter(
      (v) => v.moderador_id === lote.moderador_id && v.estado === 'aprobado'
    );
    const totalRecaudado = ventasModAprobadas.reduce(
      (sum, v) => sum + Number(v.monto || 0),
      0
    );
    const cartonesVendidos = ventasModAprobadas.reduce(
      (sum, v) => sum + Number(v.cantidad_cartones || 0),
      0
    );
    const totalLote = lote.numero_final - lote.numero_inicial + 1;
    const cartonesRestantes = Math.max(
      0,
      lote.numero_final - lote.siguiente_disponible + 1
    );
    const perfilNombre = Array.isArray(lote.perfiles)
      ? lote.perfiles[0]?.nombre
      : lote.perfiles?.nombre;

    return {
      moderador_id: lote.moderador_id,
      moderador_nombre: perfilNombre || 'Moderador',
      bloque_nombre: lote.bloque_nombre,
      numero_inicial: lote.numero_inicial,
      numero_final: lote.numero_final,
      siguiente_disponible: lote.siguiente_disponible,
      total_lote: totalLote,
      cartones_vendidos: cartonesVendidos,
      cartones_restantes: cartonesRestantes,
      monto_total_recaudado: totalRecaudado,
    };
  });
}

export const DEFAULT_DOS_MODERADORES: ModeradorStats[] = [
  {
    moderador_id: '00000000-0000-0000-0000-000000000001',
    moderador_nombre: 'Mesa 1 - Ana Morales',
    bloque_nombre: 'Lote 1 (001 - 100)',
    numero_inicial: 1,
    numero_final: 100,
    siguiente_disponible: 1,
    total_lote: 100,
    cartones_vendidos: 0,
    cartones_restantes: 100,
    monto_total_recaudado: 0,
  },
  {
    moderador_id: '00000000-0000-0000-0000-000000000002',
    moderador_nombre: 'Mesa 2 - Carlos Pérez',
    bloque_nombre: 'Lote 2 (101 - 200)',
    numero_inicial: 101,
    numero_final: 200,
    siguiente_disponible: 101,
    total_lote: 100,
    cartones_vendidos: 0,
    cartones_restantes: 100,
    monto_total_recaudado: 0,
  },
];

export function createDemoPreviewData(precioUnitario: number): {
  moderadores: ModeradorStats[];
  ventas: VentaBingo[];
} {
  const now = Date.now();
  const h = (hoursAgo: number) => new Date(now - hoursAgo * 3600 * 1000).toISOString();
  const unit = precioUnitario > 0 ? precioUnitario : 50;

  const ventas: VentaBingo[] = [
    {
      id: 'demo-v-1',
      moderador_id: '00000000-0000-0000-0000-000000000001',
      lote_id: 'demo-lote-1',
      comprador_nombre: 'María Fernanda González',
      banco_origen: 'BANESCO',
      referencia: '84920144',
      monto: unit * 3,
      cantidad_cartones: 3,
      carton_desde: 1,
      carton_hasta: 3,
      estado: 'aprobado',
      created_at: h(0.2),
      perfiles: { nombre: 'Mesa 1 - Ana Morales' },
    },
    {
      id: 'demo-v-2',
      moderador_id: '00000000-0000-0000-0000-000000000002',
      lote_id: 'demo-lote-2',
      comprador_nombre: 'Luis Eduardo Ramírez',
      banco_origen: 'BANCO DE VENEZUELA',
      referencia: '51903812',
      monto: unit * 2,
      cantidad_cartones: 2,
      carton_desde: 101,
      carton_hasta: 102,
      estado: 'aprobado',
      created_at: h(0.6),
      perfiles: { nombre: 'Mesa 2 - Carlos Pérez' },
    },
    {
      id: 'demo-v-3',
      moderador_id: '00000000-0000-0000-0000-000000000001',
      lote_id: 'demo-lote-1',
      comprador_nombre: 'Carmen Elena Rodríguez',
      banco_origen: 'MERCANTIL',
      referencia: '39104481',
      monto: unit * 2,
      cantidad_cartones: 2,
      carton_desde: 4,
      carton_hasta: 5,
      estado: 'aprobado',
      created_at: h(1.3),
      perfiles: { nombre: 'Mesa 1 - Ana Morales' },
    },
    {
      id: 'demo-v-4',
      moderador_id: '00000000-0000-0000-0000-000000000002',
      lote_id: 'demo-lote-2',
      comprador_nombre: 'José Antonio Bolívar',
      banco_origen: 'PROVINCIAL',
      referencia: '77421098',
      monto: unit * 3,
      cantidad_cartones: 3,
      carton_desde: 103,
      carton_hasta: 105,
      estado: 'aprobado',
      created_at: h(2.1),
      perfiles: { nombre: 'Mesa 2 - Carlos Pérez' },
    },
    {
      id: 'demo-v-5',
      moderador_id: '00000000-0000-0000-0000-000000000001',
      lote_id: 'demo-lote-1',
      comprador_nombre: 'Valentina Márquez',
      banco_origen: 'BNC',
      referencia: '62019488',
      monto: unit * 1,
      cantidad_cartones: 1,
      carton_desde: 6,
      carton_hasta: 6,
      estado: 'aprobado',
      created_at: h(3.0),
      perfiles: { nombre: 'Mesa 1 - Ana Morales' },
    },
    {
      id: 'demo-v-6',
      moderador_id: '00000000-0000-0000-0000-000000000002',
      lote_id: 'demo-lote-2',
      comprador_nombre: 'Pedro Pablo Mendoza',
      banco_origen: 'BANCO DE VENEZUELA',
      referencia: '11048293',
      monto: unit * 2,
      cantidad_cartones: 2,
      carton_desde: 106,
      carton_hasta: 107,
      estado: 'aprobado',
      created_at: h(4.0),
      perfiles: { nombre: 'Mesa 2 - Carlos Pérez' },
    },
  ];

  const moderadores: ModeradorStats[] = [
    {
      ...DEFAULT_DOS_MODERADORES[0],
      siguiente_disponible: 7,
      cartones_vendidos: 6,
      cartones_restantes: 94,
      monto_total_recaudado: unit * 6,
    },
    {
      ...DEFAULT_DOS_MODERADORES[1],
      siguiente_disponible: 108,
      cartones_vendidos: 7,
      cartones_restantes: 93,
      monto_total_recaudado: unit * 7,
    },
  ];

  return { moderadores, ventas };
}
