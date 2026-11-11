import React from 'react';
import AdminBingoCheck from '@/components/AdminBingoCheck';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ModeradorStats } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Lista inicial de los 7 bloques asignados a los 7 moderadores
  const initialModeradores: ModeradorStats[] = [
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
    {
      moderador_id: '00000000-0000-0000-0000-000000000003',
      moderador_nombre: 'Mesa 3 - Luis Gómez',
      bloque_nombre: 'Lote 3 (201 - 300)',
      numero_inicial: 201,
      numero_final: 300,
      siguiente_disponible: 201,
      total_lote: 100,
      cartones_vendidos: 0,
      cartones_restantes: 100,
      monto_total_recaudado: 0,
    },
    {
      moderador_id: '00000000-0000-0000-0000-000000000004',
      moderador_nombre: 'Mesa 4 - Elena Rivas',
      bloque_nombre: 'Lote 4 (301 - 400)',
      numero_inicial: 301,
      numero_final: 400,
      siguiente_disponible: 301,
      total_lote: 100,
      cartones_vendidos: 0,
      cartones_restantes: 100,
      monto_total_recaudado: 0,
    },
    {
      moderador_id: '00000000-0000-0000-0000-000000000005',
      moderador_nombre: 'Mesa 5 - Jorge Silva',
      bloque_nombre: 'Lote 5 (401 - 500)',
      numero_inicial: 401,
      numero_final: 500,
      siguiente_disponible: 401,
      total_lote: 100,
      cartones_vendidos: 0,
      cartones_restantes: 100,
      monto_total_recaudado: 0,
    },
    {
      moderador_id: '00000000-0000-0000-0000-000000000006',
      moderador_nombre: 'Mesa 6 - Mariana Díaz',
      bloque_nombre: 'Lote 6 (501 - 600)',
      numero_inicial: 501,
      numero_final: 600,
      siguiente_disponible: 501,
      total_lote: 100,
      cartones_vendidos: 0,
      cartones_restantes: 100,
      monto_total_recaudado: 0,
    },
    {
      moderador_id: '00000000-0000-0000-0000-000000000007',
      moderador_nombre: 'Mesa 7 - Ricardo Peña',
      bloque_nombre: 'Lote 7 (601 - 700)',
      numero_inicial: 601,
      numero_final: 700,
      siguiente_disponible: 601,
      total_lote: 100,
      cartones_vendidos: 0,
      cartones_restantes: 100,
      monto_total_recaudado: 0,
    },
  ];

  const precioUnitario = Number(process.env.BINGO_PRECIO_UNITARIO) || 50;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="bg-white border-b border-zinc-200/80 text-xs px-4 py-2.5 flex items-center justify-between">
        <Link
          href="/"
          className="text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 font-medium transition"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
          <span>Volver a Terminal Taquilla</span>
        </Link>
        <span className="text-zinc-400 font-mono text-[11px] uppercase tracking-wider">Consola de Auditoría</span>
      </div>

      <AdminBingoCheck
        initialModeradores={initialModeradores}
        precioUnitario={precioUnitario}
        moneda="Bs."
      />
    </div>
  );
}
