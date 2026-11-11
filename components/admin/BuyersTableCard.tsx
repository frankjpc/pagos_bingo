'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Eye,
  Search,
  Ticket,
  Users,
} from 'lucide-react';
import { ModeradorStats, VentaBingo } from '@/lib/types';
import {
  formatBs,
  formatCartonRange,
  formatUsd,
  getInitials,
} from './formatters';

interface BuyersTableCardProps {
  ventas: VentaBingo[];
  moderadores: ModeradorStats[];
  tasaUsd: number;
  scrollMaxHeightClass?: string;
  selectedModeratorId?: string | null;
  onSelectModerator?: (id: string | null) => void;
  onViewReceipt: (url: string) => void;
  onRequestVoid: (venta: VentaBingo) => void;
  onExpandAll?: () => void;
  onLoadDemo?: () => void;
  isSupabaseConfigured?: boolean;
}

export default function BuyersTableCard({
  ventas,
  moderadores,
  tasaUsd,
  scrollMaxHeightClass = 'max-h-[340px]',
  selectedModeratorId = null,
  onSelectModerator,
  onViewReceipt,
  onRequestVoid,
  onExpandAll,
  onLoadDemo,
  isSupabaseConfigured = true,
}: BuyersTableCardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'aprobado' | 'todos' | 'anulado'>('aprobado');

  const filteredVentas = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const numericQuery = parseInt(query.replace('#', ''), 10);

    return ventas.filter((v) => {
      if (statusFilter !== 'todos' && v.estado !== statusFilter) return false;
      if (selectedModeratorId && v.moderador_id !== selectedModeratorId) return false;

      if (!query) return true;

      const matchName = v.comprador_nombre.toLowerCase().includes(query);
      const matchRef = v.referencia.toLowerCase().includes(query);
      const matchBank = v.banco_origen.toLowerCase().includes(query);
      const matchTicket =
        !isNaN(numericQuery) &&
        numericQuery > 0 &&
        numericQuery >= v.carton_desde &&
        numericQuery <= v.carton_hasta;

      return matchName || matchRef || matchBank || matchTicket;
    });
  }, [ventas, searchTerm, statusFilter, selectedModeratorId]);

  const scrollbarClasses =
    '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-200 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-300';

  return (
    <div className="bg-white rounded-[24px] p-5 border border-zinc-200/70 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.03)] space-y-4">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-zinc-900 tracking-tight">
              Personas que ya Cancelaron
            </h3>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[11px] font-semibold px-2 py-0.5 rounded-full font-mono">
              {filteredVentas.length}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Historial de compradores confirmados, cartones asignados y monto en Bs / USD
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Buscador rápido de comprador / cartón */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nombre, ref o #cartón..."
              className="w-full h-9 pl-8 pr-3 bg-zinc-50 border border-zinc-200/80 focus:border-emerald-500 rounded-full text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none transition"
            />
          </div>

          {onExpandAll && (
            <button
              type="button"
              onClick={onExpandAll}
              title="Ver lista completa"
              className="w-9 h-9 rounded-full border border-zinc-200/80 hover:bg-zinc-50 text-zinc-600 flex items-center justify-center transition shrink-0 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filtros por Moderador (2 mesas) y Estado */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectModerator && onSelectModerator(null)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
              !selectedModeratorId
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
            }`}
          >
            Todas las mesas
          </button>

          {moderadores.map((mod, idx) => {
            const active = selectedModeratorId === mod.moderador_id;
            const label = mod.moderador_nombre.split('-')[0]?.trim() || `Mesa ${idx + 1}`;
            return (
              <button
                key={mod.moderador_id}
                type="button"
                onClick={() =>
                  onSelectModerator && onSelectModerator(active ? null : mod.moderador_id)
                }
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
                  active
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Filtro de Estado */}
        <div className="inline-flex items-center bg-zinc-100 p-0.5 rounded-full">
          {(['aprobado', 'todos', 'anulado'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium capitalize transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {st === 'aprobado' ? 'Pagados' : st === 'anulado' ? 'Anulados' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido: Tabla Desktop / Cards Mobile con scroll interno */}
      {filteredVentas.length === 0 ? (
        <div className="py-10 px-4 text-center bg-zinc-50/70 border border-dashed border-zinc-200 rounded-2xl space-y-2.5">
          <div className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center mx-auto text-zinc-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-700">
              {searchTerm ? 'No hay compradores que coincidan con tu búsqueda' : 'Aún no hay pagos registrados'}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {searchTerm
                ? 'Prueba buscando otro nombre, referencia o número de cartón.'
                : 'Cuando las 2 mesas aprueben pagos móviles aparecerán aquí en tiempo real.'}
            </p>
          </div>
          {!isSupabaseConfigured && onLoadDemo && !searchTerm && (
            <button
              type="button"
              onClick={onLoadDemo}
              className="mt-2 inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium px-4 py-2 rounded-full shadow-xs transition cursor-pointer"
            >
              <span>Cargar datos de ejemplo (2 mesas)</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Vista Tabla (Desktop / Tablet >= md) */}
          <div className={`hidden md:block overflow-x-auto overflow-y-auto pr-1.5 ${scrollMaxHeightClass} ${scrollbarClasses}`}>
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_0_rgba(244,244,245,1)]">
                <tr className="text-[11px] font-medium text-zinc-400">
                  <th className="pb-2.5 pt-0.5 font-medium bg-white">Comprador / Cartones</th>
                  <th className="pb-2.5 pt-0.5 font-medium bg-white">Moderador</th>
                  <th className="pb-2.5 pt-0.5 font-medium bg-white">Hora & Referencia</th>
                  <th className="pb-2.5 pt-0.5 font-medium bg-white">Estado</th>
                  <th className="pb-2.5 pt-0.5 font-medium text-right bg-white">Monto (Bs / USD)</th>
                  <th className="pb-2.5 pt-0.5 font-medium text-right bg-white">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100/90 text-xs">
                {filteredVentas.map((venta) => {
                  const dt = new Date(venta.created_at);
                  const fechaStr = dt.toLocaleDateString('es-VE', {
                    day: '2-digit',
                    month: 'short',
                  });
                  const horaStr = dt.toLocaleTimeString('es-VE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const modShort = venta.perfiles?.nombre?.split('-')[0]?.trim() || 'Mesa';
                  const isPaid = venta.estado === 'aprobado';

                  return (
                    <tr
                      key={venta.id}
                      className="group hover:bg-zinc-50/70 transition-colors"
                    >
                      {/* Comprador */}
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-800 font-semibold text-[11px] flex items-center justify-center shrink-0">
                            {getInitials(venta.comprador_nombre)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-900 truncate max-w-[190px]">
                              {venta.comprador_nombre}
                            </p>
                            <p className="text-[11px] text-emerald-700 font-mono font-medium flex items-center gap-1 mt-0.5">
                              <Ticket className="w-3 h-3 shrink-0" />
                              <span>
                                {formatCartonRange(venta.carton_desde, venta.carton_hasta)} ({venta.cantidad_cartones})
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Moderador */}
                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 font-medium text-[11px]">
                          {modShort}
                        </span>
                      </td>

                      {/* Hora y Referencia */}
                      <td className="py-3 pr-3">
                        <p className="text-zinc-700 font-medium">
                          {fechaStr} • {horaStr}
                        </p>
                        <p className="text-[11px] text-zinc-400 font-mono truncate max-w-[160px]">
                          {venta.banco_origen} • {venta.referencia}
                        </p>
                      </td>

                      {/* Estado */}
                      <td className="py-3 pr-3">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-[11px] font-medium px-2.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Cancelado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-medium px-2.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Anulado
                          </span>
                        )}
                      </td>

                      {/* Monto Bs y USD */}
                      <td className="py-3 pr-2 text-right font-mono">
                        <p className="font-semibold text-zinc-900">
                          {formatBs(venta.monto)}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {formatUsd(venta.monto, tasaUsd)} USD
                        </p>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {venta.comprobante_url && (
                            <button
                              type="button"
                              onClick={() => onViewReceipt(venta.comprobante_url!)}
                              title="Ver comprobante"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isPaid && (
                            <button
                              type="button"
                              onClick={() => onRequestVoid(venta)}
                              title="Anular pago"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista Cards Mobile (< md) */}
          <div className={`md:hidden space-y-2.5 overflow-y-auto pr-1 ${scrollMaxHeightClass} ${scrollbarClasses}`}>
            {filteredVentas.map((venta) => {
              const dt = new Date(venta.created_at);
              const horaStr = dt.toLocaleTimeString('es-VE', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const modShort = venta.perfiles?.nombre?.split('-')[0]?.trim() || 'Mesa';
              const isPaid = venta.estado === 'aprobado';

              return (
                <div
                  key={venta.id}
                  className="bg-zinc-50/70 border border-zinc-200/70 rounded-2xl p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-800 font-semibold text-xs flex items-center justify-center shrink-0">
                        {getInitials(venta.comprador_nombre)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 truncate">
                          {venta.comprador_nombre}
                        </p>
                        <p className="text-[11px] text-zinc-500 font-mono">
                          {modShort} • {horaStr} • Ref {venta.referencia}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono">
                      <p className="text-xs font-bold text-zinc-900">{formatBs(venta.monto)}</p>
                      <p className="text-[10px] text-zinc-400">
                        {formatUsd(venta.monto, tasaUsd)} USD
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-zinc-200/60">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                        <Ticket className="w-3 h-3" />
                        {formatCartonRange(venta.carton_desde, venta.carton_hasta)}
                      </span>
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Pagado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 font-medium">
                          <Ban className="w-3 h-3" /> Anulado
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {venta.comprobante_url && (
                        <button
                          type="button"
                          onClick={() => onViewReceipt(venta.comprobante_url!)}
                          className="text-[11px] font-medium text-emerald-700 bg-white border border-zinc-200 px-2.5 py-1 rounded-full"
                        >
                          Comprobante
                        </button>
                      )}
                      {isPaid && (
                        <button
                          type="button"
                          onClick={() => onRequestVoid(venta)}
                          className="text-[11px] font-medium text-rose-600 bg-white border border-rose-200 px-2.5 py-1 rounded-full"
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {filteredVentas.length > 0 && (
        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
          <span>
            Mostrando <strong className="text-zinc-700 font-medium">{filteredVentas.length}</strong>{' '}
            {filteredVentas.length === 1 ? 'registro' : 'registros'} (desliza para ver más)
          </span>
          {onExpandAll && (
            <button
              type="button"
              onClick={onExpandAll}
              className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
            >
              Ampliar vista →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

