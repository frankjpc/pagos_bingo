'use client';

import React, { useMemo, useState } from 'react';
import { ArrowUpRight, BarChart3 } from 'lucide-react';
import { ModeradorStats, VentaBingo } from '@/lib/types';
import { formatBs, formatUsd } from './formatters';

interface SalesChartCardProps {
  ventas: VentaBingo[];
  moderadores: ModeradorStats[];
  tasaUsd: number;
  onInspectModeradores?: () => void;
}

interface BarBucket {
  id: string;
  label: string;
  cartones: number;
  montoBs: number;
}

export default function SalesChartCard({
  ventas,
  moderadores,
  tasaUsd,
  onInspectModeradores,
}: SalesChartCardProps) {
  const [viewMode, setViewMode] = useState<'horas' | 'mesas'>('horas');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ventasAprobadas = useMemo(
    () => ventas.filter((v) => v.estado === 'aprobado'),
    [ventas]
  );

  // Construir 6 bloques horarios consecutivos hasta la hora actual o última venta
  const hourlyBuckets = useMemo<BarBucket[]>(() => {
    const latestMs =
      ventasAprobadas.length > 0
        ? Math.max(...ventasAprobadas.map((v) => new Date(v.created_at).getTime()))
        : Date.now();
    const anchorDate = new Date(latestMs);
    anchorDate.setMinutes(0, 0, 0);

    const buckets: BarBucket[] = [];
    for (let offset = 5; offset >= 0; offset--) {
      const slotStart = new Date(anchorDate.getTime() - offset * 3600 * 1000);
      const slotEnd = new Date(slotStart.getTime() + 3600 * 1000);
      const label = `${String(slotStart.getHours()).padStart(2, '0')}:00`;

      const inSlot = ventasAprobadas.filter((v) => {
        const t = new Date(v.created_at).getTime();
        return t >= slotStart.getTime() && t < slotEnd.getTime();
      });

      buckets.push({
        id: `h-${slotStart.getTime()}`,
        label,
        cartones: inSlot.reduce((s, v) => s + Number(v.cantidad_cartones || 0), 0),
        montoBs: inSlot.reduce((s, v) => s + Number(v.monto || 0), 0),
      });
    }
    return buckets;
  }, [ventasAprobadas]);

  // Comparativa por cada uno de los 2 moderadores
  const mesaBuckets = useMemo<BarBucket[]>(() => {
    return moderadores.map((mod, idx) => {
      const shortName = mod.moderador_nombre.split('-')[0]?.trim() || `Mesa ${idx + 1}`;
      return {
        id: mod.moderador_id,
        label: shortName,
        cartones: mod.cartones_vendidos,
        montoBs: mod.monto_total_recaudado,
      };
    });
  }, [moderadores]);

  const activeBuckets = viewMode === 'horas' ? hourlyBuckets : mesaBuckets;

  const maxCartones = useMemo(() => {
    const max = Math.max(...activeBuckets.map((b) => b.cartones), 0);
    return max > 0 ? max : 10;
  }, [activeBuckets]);

  const peakId = useMemo(() => {
    if (selectedId && activeBuckets.some((b) => b.id === selectedId)) return selectedId;
    let best = activeBuckets[0];
    for (const b of activeBuckets) {
      if (!best || b.cartones > best.cartones) best = b;
    }
    return best?.id || null;
  }, [activeBuckets, selectedId]);

  const highlightedBucket = activeBuckets.find((b) => b.id === peakId) || activeBuckets[0];

  // Etiquetas limpias para el eje Y
  const yTicks = useMemo(() => {
    const top = Math.max(4, Math.ceil(maxCartones / 4) * 4);
    return [top, Math.round(top * 0.75), Math.round(top * 0.5), Math.round(top * 0.25), 0];
  }, [maxCartones]);

  const scaleMax = yTicks[0] || 10;

  return (
    <div className="bg-white rounded-[24px] p-5 border border-zinc-200/70 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.03)] flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-700 shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
              Actividad de Taquilla
            </h3>
            <p className="text-[11px] text-zinc-400">
              {highlightedBucket
                ? `${highlightedBucket.label}: ${highlightedBucket.cartones} cart. (${formatBs(highlightedBucket.montoBs)})`
                : 'Sin movimientos aún'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Toggle pill similar a Monthly / Annually */}
          <div className="inline-flex items-center bg-zinc-100 p-0.5 rounded-full border border-zinc-200/50">
            <button
              type="button"
              onClick={() => {
                setViewMode('horas');
                setSelectedId(null);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
                viewMode === 'horas'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Por Hora
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('mesas');
                setSelectedId(null);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
                viewMode === 'mesas'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              2 Mesas
            </button>
          </div>

          {onInspectModeradores && (
            <button
              type="button"
              onClick={onInspectModeradores}
              title="Ver detalle de moderadores"
              className="w-8 h-8 rounded-full border border-zinc-200/80 hover:bg-zinc-50 text-zinc-600 flex items-center justify-center transition shrink-0 cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Área del gráfico estilo cápsula */}
      <div className="mt-5 pt-4 flex items-end gap-3 flex-1 min-h-[190px]">
        {/* Eje Y */}
        <div className="flex flex-col justify-between h-[156px] pb-6 text-[10px] font-medium text-zinc-400 font-mono select-none shrink-0">
          {yTicks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>

        {/* Columnas cápsula */}
        <div
          className={`flex-1 grid gap-3 sm:gap-4 items-end h-[156px] ${
            activeBuckets.length <= 2 ? 'grid-cols-2 max-w-[260px] mx-auto w-full' : 'grid-cols-6'
          }`}
        >
          {activeBuckets.map((bucket) => {
            const isHighlighted = bucket.id === peakId;
            const rawPct = bucket.cartones > 0 ? (bucket.cartones / scaleMax) * 100 : 8;
            const barHeightPct = Math.max(12, Math.min(100, rawPct));

            return (
              <button
                key={bucket.id}
                type="button"
                onClick={() => setSelectedId(bucket.id)}
                className="flex flex-col items-center justify-end h-full group cursor-pointer focus:outline-none"
              >
                {/* Contenedor de barra con espacio superior para tooltip */}
                <div className="relative w-full flex-1 flex flex-col justify-end items-center">
                  {/* Tooltip flotante sobre barra seleccionada/pico */}
                  {isHighlighted && (
                    <div className="mb-1.5 flex flex-col items-center animate-in fade-in duration-150">
                      <span className="bg-emerald-800 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shadow-xs font-mono">
                        {bucket.cartones} cart.
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-white border-2 border-emerald-700 -mb-1 mt-0.5 z-10" />
                    </div>
                  )}

                  {/* Barra cápsula con bordes redondeados arriba y abajo */}
                  <div
                    className={`w-full max-w-[44px] rounded-2xl transition-all duration-300 ${
                      bucket.cartones === 0
                        ? 'bg-zinc-100 border border-dashed border-zinc-200'
                        : isHighlighted
                        ? 'bg-gradient-to-b from-[#0d8254] to-[#065234] shadow-[0_6px_16px_-4px_rgba(6,78,50,0.35)]'
                        : 'hover:opacity-90'
                    }`}
                    style={{
                      height: `${barHeightPct}%`,
                      ...(bucket.cartones > 0 && !isHighlighted
                        ? {
                            backgroundImage:
                              'repeating-linear-gradient(135deg, #8fd0b5 0px, #8fd0b5 4px, #a8dec7 4px, #a8dec7 8px)',
                          }
                        : {}),
                    }}
                  />
                </div>

                {/* Etiqueta eje X */}
                <span
                  className={`mt-2 text-[10px] font-semibold tracking-wide uppercase truncate max-w-full ${
                    isHighlighted ? 'text-emerald-800' : 'text-zinc-400 group-hover:text-zinc-600'
                  }`}
                >
                  {bucket.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pie resumen rápido en modo 2 Mesas o Hora */}
      <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          Equiv. bloque:{' '}
          <strong className="text-zinc-800 font-semibold font-mono">
            {highlightedBucket ? formatUsd(highlightedBucket.montoBs, tasaUsd) : '$0.00'} USD
          </strong>
        </span>
        <span className="text-emerald-700 font-medium">
          {viewMode === 'mesas' ? 'Comparativa 2 moderadores' : 'Últimas 6 horas'}
        </span>
      </div>
    </div>
  );
}

