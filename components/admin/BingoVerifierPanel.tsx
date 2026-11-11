'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  Trophy,
  X,
} from 'lucide-react';
import { VentaBingo } from '@/lib/types';
import { anularVentaBingo } from '@/app/actions/anular';
import { buscarCartonEnServidor } from '@/app/actions/admin-sync';
import { formatBs, formatUsd } from './formatters';

interface BingoVerifierPanelProps {
  ventasLocales: VentaBingo[];
  tasaUsd: number;
  isSupabaseConfigured: boolean;
  isDemoMode: boolean;
  onViewReceipt: (url: string) => void;
  onRequestVoid: (venta: VentaBingo) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export default function BingoVerifierPanel({
  ventasLocales,
  tasaUsd,
  isSupabaseConfigured,
  isDemoMode,
  onViewReceipt,
  onRequestVoid,
  inputRef,
}: BingoVerifierPanelProps) {
  const [numeroCarton, setNumeroCarton] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultadoVenta, setResultadoVenta] = useState<VentaBingo | null>(null);
  const [busquedaEjecutada, setBusquedaEjecutada] = useState(false);

  const handleBuscarCarton = async (e: React.FormEvent) => {
    e.preventDefault();
    const numero = parseInt(numeroCarton.trim(), 10);
    if (isNaN(numero) || numero <= 0) return;

    setBuscando(true);
    setBusquedaEjecutada(true);
    setResultadoVenta(null);

    try {
      // Si estamos en modo demo o sin Supabase, buscar en la lista cargada en memoria
      if (isDemoMode || !isSupabaseConfigured) {
        const localMatch =
          ventasLocales.find(
            (v) =>
              v.estado === 'aprobado' &&
              numero >= v.carton_desde &&
              numero <= v.carton_hasta
          ) || null;
        setResultadoVenta(localMatch);
        return;
      }

      const match = await buscarCartonEnServidor(numero);
      setResultadoVenta(match);
    } catch (err) {
      console.error('Error buscando cartón:', err);
    } finally {
      setBuscando(false);
    }
  };

  // Mantener estado sincronizado si la venta mostrada fue anulada desde la lista
  const liveVenta = resultadoVenta
    ? ventasLocales.find((v) => v.id === resultadoVenta.id) || resultadoVenta
    : null;

  return (
    <section className="bg-white rounded-[24px] p-5 sm:p-6 border border-zinc-200/70 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.03)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
            <Trophy className="w-3 h-3" /> Verificador de Tarima
          </span>
          <h2 className="text-base sm:text-lg font-semibold text-zinc-900 mt-1.5 tracking-tight">
            Validar cartón que cantó &quot;¡Bingo!&quot;
          </h2>
          <p className="text-xs text-zinc-500">
            Ingresa el número físico del cartón para comprobar comprador, mesa validadora y pago al instante.
          </p>
        </div>
      </div>

      <form onSubmit={handleBuscarCarton} className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="number"
            min="1"
            placeholder="Número de cartón físico (ej: 4 o 102)"
            value={numeroCarton}
            onChange={(e) => {
              setNumeroCarton(e.target.value);
              setBusquedaEjecutada(false);
            }}
            className="w-full h-12 bg-zinc-50 border border-zinc-200 focus:border-emerald-600 rounded-full px-5 text-sm sm:text-base font-semibold font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none transition"
          />
          {numeroCarton && (
            <button
              type="button"
              onClick={() => {
                setNumeroCarton('');
                setResultadoVenta(null);
                setBusquedaEjecutada(false);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={buscando || !numeroCarton}
          className="h-12 px-6 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm rounded-full flex items-center justify-center gap-2 transition shadow-xs cursor-pointer shrink-0"
        >
          {buscando ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>Verificar Cartón</span>
        </button>
      </form>

      {/* Resultado */}
      {busquedaEjecutada && (
        <div className="pt-1 animate-in zoom-in-95 duration-150">
          {liveVenta ? (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-200/70 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-emerald-950 font-semibold text-sm block">
                      Cartón Válido y Pagado
                    </span>
                    <p className="text-xs text-emerald-700">
                      Lote correlativo #{liveVenta.carton_desde} al #{liveVenta.carton_hasta}
                    </p>
                  </div>
                </div>

                <span className="text-2xl sm:text-3xl font-bold text-emerald-800 font-mono">
                  #{numeroCarton}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70">
                  <span className="text-[10px] text-zinc-400 uppercase font-medium block">
                    Comprador Titular
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 mt-0.5 block">
                    {liveVenta.comprador_nombre}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70">
                  <span className="text-[10px] text-zinc-400 uppercase font-medium block">
                    Mesa Validadora
                  </span>
                  <span className="text-sm font-semibold text-zinc-800 mt-0.5 block">
                    {liveVenta.perfiles?.nombre || 'Moderador Asignado'}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70">
                  <span className="text-[10px] text-zinc-400 uppercase font-medium block">
                    Pago Móvil & Monto
                  </span>
                  <span className="text-xs font-mono font-semibold text-zinc-900 mt-0.5 block">
                    {liveVenta.banco_origen} • Ref {liveVenta.referencia}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold font-mono block mt-0.5">
                    {formatBs(liveVenta.monto)} ({formatUsd(liveVenta.monto, tasaUsd)} USD)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <span className="text-zinc-500 flex items-center gap-1.5 text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  {new Date(liveVenta.created_at).toLocaleTimeString('es-VE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  • {new Date(liveVenta.created_at).toLocaleDateString('es-VE')}
                </span>

                <div className="flex items-center gap-2">
                  {liveVenta.comprobante_url && (
                    <button
                      type="button"
                      onClick={() => onViewReceipt(liveVenta.comprobante_url!)}
                      className="inline-flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 px-3.5 py-1.5 rounded-full font-medium text-xs transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver comprobante</span>
                    </button>
                  )}

                  {liveVenta.estado === 'aprobado' ? (
                    <button
                      type="button"
                      onClick={() => onRequestVoid(liveVenta)}
                      className="inline-flex items-center gap-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 px-3.5 py-1.5 rounded-full font-medium text-xs transition cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Anular venta</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-rose-200">
                      <Ban className="w-3 h-3" /> Venta Anulada
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-900 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-rose-900">
                  Cartón #{numeroCarton} no vendido o no registrado
                </h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  Ninguna de las 2 mesas ha registrado este número como pago aprobado.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

interface ReceiptModalProps {
  url: string | null;
  onClose: () => void;
}

export function ReceiptPreviewModal({ url, onClose }: ReceiptModalProps) {
  if (!url) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative max-w-sm w-full bg-white border border-zinc-200 rounded-[24px] p-4 shadow-xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide">
            Comprobante Original
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-center max-h-[70vh] overflow-auto rounded-2xl bg-zinc-100 p-1">
          <img
            src={url}
            alt="Comprobante de Pago Móvil"
            className="object-contain max-h-[65vh] w-auto rounded-xl"
          />
        </div>
      </div>
    </div>
  );
}

interface VoidSaleModalProps {
  venta: VentaBingo | null;
  isDemoMode: boolean;
  onClose: () => void;
  onVoidSuccess: (ventaId: string) => void;
}

export function VoidSaleModal({
  venta,
  isDemoMode,
  onClose,
  onVoidSuccess,
}: VoidSaleModalProps) {
  const [motivo, setMotivo] = useState('');
  const [anulando, setAnulando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!venta) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnulando(true);
    setErrorMsg(null);

    try {
      if (isDemoMode || venta.id.startsWith('demo-')) {
        onVoidSuccess(venta.id);
        setMotivo('');
        onClose();
        return;
      }

      const res = await anularVentaBingo(venta.id, motivo);
      if (res.success) {
        onVoidSuccess(venta.id);
        setMotivo('');
        onClose();
      } else {
        setErrorMsg(res.error || 'No se pudo anular la venta.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de conexión al anular.';
      setErrorMsg(msg);
    } finally {
      setAnulando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-[24px] p-5 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-150 space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-zinc-900">Anular Venta</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-zinc-50 border border-zinc-200/70 rounded-xl p-3 text-xs space-y-1">
          <p className="font-semibold text-zinc-900">{venta.comprador_nombre}</p>
          <p className="text-zinc-500 font-mono">
            Cartones #{venta.carton_desde}–#{venta.carton_hasta} • {formatBs(venta.monto)}
          </p>
        </div>

        <form onSubmit={handleConfirm} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 block mb-1">
              Motivo de la anulación
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Comprobante duplicado o pago reversado"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full h-10 bg-zinc-50 border border-zinc-200 focus:border-rose-500 rounded-xl px-3 text-xs text-zinc-900 focus:outline-none"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-full border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={anulando}
              className="flex-1 h-10 rounded-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-xs font-semibold text-white cursor-pointer"
            >
              {anulando ? 'Anulando...' : 'Confirmar Anulación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

