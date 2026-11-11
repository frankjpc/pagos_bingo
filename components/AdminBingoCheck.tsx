'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { 
  Search, 
  Trophy, 
  CheckCircle2, 
  Users, 
  DollarSign, 
  Ticket, 
  Clock, 
  ShieldAlert, 
  Eye,
  RefreshCw,
  X,
  Ban,
  AlertTriangle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { VentaBingo, ModeradorStats } from '@/lib/types';
import { anularVentaBingo } from '@/app/actions/anular';

interface AdminBingoCheckProps {
  initialModeradores: ModeradorStats[];
  precioUnitario: number;
  moneda: string;
}

export default function AdminBingoCheck({
  initialModeradores,
  precioUnitario,
  moneda,
}: AdminBingoCheckProps) {
  const supabase = createClient();

  // Estados de búsqueda de cartón ganador
  const [numeroCarton, setNumeroCarton] = useState<string>('');
  const [buscando, setBuscando] = useState(false);
  const [resultadoVenta, setResultadoVenta] = useState<VentaBingo | null>(null);
  const [busquedaEjecutada, setBusquedaEjecutada] = useState(false);

  // Modal para ver imagen del comprobante
  const [comprobanteModalUrl, setComprobanteModalUrl] = useState<string | null>(null);

  // Estados para anulación de venta
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulando, setAnulando] = useState(false);
  const [anulacionMsg, setAnulacionMsg] = useState<string | null>(null);

  // Métricas en tiempo real de los 7 moderadores
  const [moderadores, setModeradores] = useState<ModeradorStats[]>(initialModeradores);
  const [isPending, startTransition] = useTransition();

  // Función para recargar estadísticas
  const recargarEstadisticas = async () => {
    try {
      const { data: lotes, error: lotesErr } = await supabase
        .from('lotes_talonarios')
        .select(`
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
        `)
        .eq('activo', true)
        .order('numero_inicial', { ascending: true });

      const { data: ventas, error: ventasErr } = await supabase
        .from('ventas_bingo')
        .select('moderador_id, monto, cantidad_cartones')
        .eq('estado', 'aprobado');

      if (lotes && !lotesErr) {
        const statsMap = lotes.map((lote: any) => {
          const ventasMod = (ventas || []).filter((v) => v.moderador_id === lote.moderador_id);
          const totalRecaudado = ventasMod.reduce((sum, v) => sum + Number(v.monto), 0);
          const cartonesVendidos = Math.max(0, lote.siguiente_disponible - lote.numero_inicial);
          const totalLote = lote.numero_final - lote.numero_inicial + 1;
          const cartonesRestantes = Math.max(0, lote.numero_final - lote.siguiente_disponible + 1);

          return {
            moderador_id: lote.moderador_id,
            moderador_nombre: lote.perfiles?.nombre || 'Moderador',
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

        startTransition(() => {
          setModeradores(statsMap);
        });
      }
    } catch (err) {
      console.error('Error al actualizar métricas:', err);
    }
  };

  // Suscripción Realtime a nuevas ventas y cambios en lotes
  useEffect(() => {
    const channel = supabase
      .channel('admin-bingo-live-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ventas_bingo' },
        () => {
          recargarEstadisticas();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lotes_talonarios' },
        () => {
          recargarEstadisticas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Búsqueda instantánea de Cartón Ganador al presionar Enter o escribir
  const handleBuscarCarton = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numero = parseInt(numeroCarton.trim(), 10);
    if (isNaN(numero) || numero <= 0) return;

    setBuscando(true);
    setBusquedaEjecutada(true);
    setResultadoVenta(null);

    try {
      const { data, error } = await supabase
        .from('ventas_bingo')
        .select(`
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
        `)
        .lte('carton_desde', numero)
        .gte('carton_hasta', numero)
        .eq('estado', 'aprobado')
        .maybeSingle();

      if (error) {
        console.error('Error en búsqueda de cartón:', error);
      }

      setResultadoVenta(data as unknown as VentaBingo);
    } catch (err) {
      console.error(err);
    } finally {
      setBuscando(false);
    }
  };

  // Función para anular la venta verificada
  const handleConfirmarAnulacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultadoVenta) return;
    setAnulando(true);
    setAnulacionMsg(null);
    try {
      const res = await anularVentaBingo(resultadoVenta.id, motivoAnulacion);
      if (res.success) {
        setResultadoVenta((prev) => (prev ? { ...prev, estado: 'anulado' } : null));
        setShowAnularModal(false);
        setMotivoAnulacion('');
        recargarEstadisticas();
      } else {
        setAnulacionMsg(res.error || 'Error al anular la venta.');
      }
    } catch (err: any) {
      setAnulacionMsg(err.message || 'Error de conexión al anular.');
    } finally {
      setAnulando(false);
    }
  };

  // Totales globales
  const totalRecaudadoGlobal = moderadores.reduce((acc, m) => acc + m.monto_total_recaudado, 0);
  const totalCartonesVendidos = moderadores.reduce((acc, m) => acc + m.cartones_vendidos, 0);
  const totalCartonesCapacidad = moderadores.reduce((acc, m) => acc + m.total_lote, 0);

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans pb-16 antialiased">
      
      {/* HEADER DE CONTROL PRINCIPAL */}
      <header className="bg-white border-b border-zinc-200/80 px-4 py-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700">
              <Trophy className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
                Auditoría & Verificación de Bingo
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> En vivo
                </span>
              </h1>
              <p className="text-xs text-zinc-500 font-normal">
                Control central de las 7 mesas y validación de cartones cantados
              </p>
            </div>
          </div>

          <button
            onClick={() => recargarEstadisticas()}
            className="p-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200 active:scale-95 transition"
            title="Refrescar métricas"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">

        {/* =========================================================================
            SECCIÓN 1: BUSCADOR DE CARTÓN GANADOR ("¡BINGO!")
            ========================================================================= */}
        <section className="bg-white border border-zinc-200/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1.5">
              <Trophy className="w-3 h-3 text-emerald-600" /> Verificador de Tarima
            </span>
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900 mt-2">
              Validar cartón que cantó &quot;¡Bingo!&quot;
            </h2>
            <p className="text-xs text-zinc-500 font-normal">
              Ingresa el número físico que el jugador tiene en la mano para auditar su legitimidad al instante.
            </p>
          </div>

          <form onSubmit={handleBuscarCarton} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min="1"
                placeholder="Número de Cartón (ej: 142)"
                value={numeroCarton}
                onChange={(e) => {
                  setNumeroCarton(e.target.value);
                  setBusquedaEjecutada(false);
                }}
                className="w-full h-12 bg-zinc-50 border border-zinc-200 focus:border-emerald-500 rounded-xl px-4 text-base font-semibold font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none transition"
              />
              {numeroCarton && (
                <button
                  type="button"
                  onClick={() => {
                    setNumeroCarton('');
                    setResultadoVenta(null);
                    setBusquedaEjecutada(false);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={buscando || !numeroCarton}
              className="h-12 px-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-medium text-sm rounded-xl flex items-center gap-2 transition shadow-sm"
            >
              {buscando ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4 stroke-[2]" />
              )}
              <span>Verificar</span>
            </button>
          </form>

          {/* TARJETA DE RESULTADO DE AUDITORÍA */}
          {busquedaEjecutada && (
            <div className="pt-1 animate-in zoom-in-95 duration-100">
              {resultadoVenta ? (
                // CARTÓN VÁLIDO Y VENDIDO
                <div className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-4 sm:p-5 text-emerald-950 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-emerald-900 font-semibold text-sm uppercase tracking-wide">
                          Cartón Válido y Registrado
                        </span>
                        <p className="text-xs text-emerald-700">
                          Asignado en el lote correlativo #{resultadoVenta.carton_desde} al #{resultadoVenta.carton_hasta}
                        </p>
                      </div>
                    </div>

                    <span className="text-2xl font-bold text-emerald-800 font-mono">
                      #{numeroCarton}
                    </span>
                  </div>

                  {/* Fila de detalles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs">
                      <span className="text-[10px] text-zinc-400 uppercase font-medium block">
                        Comprador Titular:
                      </span>
                      <span className="text-sm font-semibold text-zinc-900 mt-0.5 block">
                        {resultadoVenta.comprador_nombre}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs">
                      <span className="text-[10px] text-zinc-400 uppercase font-medium block">
                        Mesa / Moderador:
                      </span>
                      <span className="text-sm font-semibold text-zinc-800 mt-0.5 block">
                        {resultadoVenta.perfiles?.nombre || 'Moderador Asignado'}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs">
                      <span className="text-[10px] text-zinc-400 uppercase font-medium block">
                        Pago y Referencia:
                      </span>
                      <span className="text-xs font-mono font-semibold text-zinc-900 mt-0.5 block">
                        {resultadoVenta.banco_origen} • Ref: {resultadoVenta.referencia}
                      </span>
                      <span className="text-[11px] text-emerald-700 font-medium">
                        {resultadoVenta.monto} {moneda} ({resultadoVenta.cantidad_cartones} cartón(es))
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-zinc-500 flex items-center gap-1 font-normal text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      Registrado: {new Date(resultadoVenta.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(resultadoVenta.created_at).toLocaleDateString()})
                    </span>

                    <div className="flex items-center gap-2">
                      {resultadoVenta.comprobante_url && (
                        <button
                          type="button"
                          onClick={() => setComprobanteModalUrl(resultadoVenta.comprobante_url || null)}
                          className="inline-flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg font-medium text-xs transition shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ver comprobante</span>
                        </button>
                      )}

                      {resultadoVenta.estado === 'aprobado' ? (
                        <button
                          type="button"
                          onClick={() => setShowAnularModal(true)}
                          className="inline-flex items-center gap-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg font-medium text-xs transition shadow-2xs"
                        >
                          <Ban className="w-3.5 h-3.5 text-rose-600" />
                          <span>Anular venta</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-rose-200">
                          <Ban className="w-3 h-3 text-rose-600" /> Venta Anulada
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // CARTÓN NO ENCONTRADO
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-900 shadow-xs flex items-start space-x-3">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-semibold text-rose-900 uppercase tracking-wide">
                      Cartón #{numeroCarton} no vendido o no registrado
                    </h3>
                    <p className="text-xs text-rose-700 font-normal mt-0.5">
                      Ningún moderador ha registrado este número. El cartón aún figura disponible en talonarios físicos o podría tratarse de un cartón no pagado.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* =========================================================================
            SECCIÓN 2: KPIS TOTALES GLOBALES DEL EVENTO
            ========================================================================= */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shrink-0">
              <DollarSign className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Recaudación Total</span>
              <div className="text-xl font-bold text-emerald-700 tracking-tight font-mono">
                {totalRecaudadoGlobal.toLocaleString()} {moneda}
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700 shrink-0">
              <Ticket className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Cartones Vendidos</span>
              <div className="text-xl font-semibold text-zinc-900 tracking-tight">
                {totalCartonesVendidos}{' '}
                <span className="text-xs text-zinc-400 font-normal">/ {totalCartonesCapacidad}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700 shrink-0">
              <Users className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Mesas Activas</span>
              <div className="text-xl font-semibold text-zinc-900 tracking-tight">
                {moderadores.length} <span className="text-xs text-zinc-400 font-normal">taquillas</span>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECCIÓN 3: MONITOR DE LAS 7 MESAS Y LOTES FÍSICOS
            ========================================================================= */}
        <section className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] space-y-3.5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
              Estado por Mesa y Talonario Físico
            </h3>
            <p className="text-xs text-zinc-500 font-normal">
              Seguimiento de correlativos, saldo restante y volumen por mesa
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {moderadores.map((mod) => {
              const porcentaje = Math.min(100, Math.round((mod.cartones_vendidos / mod.total_lote) * 100));
              const estaAgotado = mod.cartones_restantes === 0;

              return (
                <div
                  key={mod.moderador_id}
                  className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 flex flex-col justify-between space-y-2.5 hover:bg-zinc-50 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 text-xs">
                          {mod.moderador_nombre}
                        </span>
                        {estaAgotado ? (
                          <span className="bg-rose-50 text-rose-700 text-[10px] font-medium px-2 py-0.5 rounded border border-rose-200">
                            Agotado
                          </span>
                        ) : (
                          <span className="bg-white text-zinc-600 text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-200">
                            {mod.bloque_nombre}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5 font-normal">
                        Rango: #{mod.numero_inicial} – #{mod.numero_final} (Siguiente: #{mod.siguiente_disponible})
                      </p>
                    </div>

                    <span className="text-xs font-semibold text-emerald-700 font-mono">
                      {mod.monto_total_recaudado.toLocaleString()} {moneda}
                    </span>
                  </div>

                  {/* Barra de Progreso */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-500 font-normal">
                        Vendidos: <strong className="text-zinc-800 font-medium">{mod.cartones_vendidos}</strong>
                      </span>
                      <span className="text-zinc-500 font-normal">
                        Restan: <strong className={mod.cartones_restantes < 15 ? 'text-amber-700 font-semibold' : 'text-zinc-700'}>{mod.cartones_restantes}</strong>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          estaAgotado
                            ? 'bg-rose-500'
                            : porcentaje > 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* MODAL PARA VER EL COMPROBANTE ORIGINAL */}
      {comprobanteModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-sm w-full bg-white border border-zinc-200 rounded-2xl p-4 overflow-hidden shadow-xl animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide">
                Comprobante Original Capturado
              </h3>
              <button
                onClick={() => setComprobanteModalUrl(null)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-center max-h-[70vh] overflow-auto rounded-xl bg-zinc-100">
              <img
                src={comprobanteModalUrl}
                alt="Comprobante de Pago Móvil"
                className="object-contain max-h-[65vh] w-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
