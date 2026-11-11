'use client';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  DollarSign,
  Download,
  Edit2,
  LayoutGrid,
  Radio,
  Receipt,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fetchAdminSnapshot } from '@/app/actions/admin-sync';
import { ModeradorStats, VentaBingo } from '@/lib/types';
import {
  buildVentasCsv,
  createDemoPreviewData,
  DEFAULT_DOS_MODERADORES,
  formatBs,
  formatUsd,
  getInitials,
} from './admin/formatters';
import SalesChartCard from './admin/SalesChartCard';
import BuyersTableCard from './admin/BuyersTableCard';
import BingoVerifierPanel, {
  ReceiptPreviewModal,
  VoidSaleModal,
} from './admin/BingoVerifierPanel';

interface AdminBingoCheckProps {
  initialModeradores: ModeradorStats[];
  initialVentas?: VentaBingo[];
  precioUnitario: number;
  moneda: string;
  tasaUsdInicial?: number;
  isSupabaseConfigured?: boolean;
}

type AdminTab = 'resumen' | 'pagos' | 'verificar' | 'moderadores';

const TASA_STORAGE_KEY = 'bingo_admin_tasa_usd';

export default function AdminBingoCheck({
  initialModeradores,
  initialVentas = [],
  precioUnitario,
  tasaUsdInicial = 50,
  isSupabaseConfigured = false,
}: AdminBingoCheckProps) {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<AdminTab>('resumen');
  const [moderadores, setModeradores] = useState<ModeradorStats[]>(
    initialModeradores.length > 0 ? initialModeradores : DEFAULT_DOS_MODERADORES
  );
  const [ventas, setVentas] = useState<VentaBingo[]>(initialVentas);
  const [selectedModFilter, setSelectedModFilter] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Tasa de cambio Bs / USD editable en vivo
  const [tasaUsd, setTasaUsd] = useState<number>(tasaUsdInicial > 0 ? tasaUsdInicial : 50);
  const [editingTasa, setEditingTasa] = useState(false);
  const [tasaDraft, setTasaDraft] = useState(String(tasaUsdInicial > 0 ? tasaUsdInicial : 50));

  // Modales y verificador rápido
  const [showQuickVerifier, setShowQuickVerifier] = useState(false);
  const [comprobanteModalUrl, setComprobanteModalUrl] = useState<string | null>(null);
  const [ventaAAnular, setVentaAAnular] = useState<VentaBingo | null>(null);
  const [isPending, startTransition] = useTransition();
  const verifierInputRef = useRef<HTMLInputElement | null>(null);

  // Cargar tasa guardada en localStorage al montar
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TASA_STORAGE_KEY);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed > 0) {
          setTasaUsd(parsed);
          setTasaDraft(String(parsed));
        }
      }
    } catch {
      // Ignorar si el almacenamiento está restringido
    }
  }, []);

  const handleSaveTasa = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseFloat(tasaDraft.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      setTasaUsd(parsed);
      setTasaDraft(String(parsed));
      try {
        window.localStorage.setItem(TASA_STORAGE_KEY, String(parsed));
      } catch {
        // Ignorar
      }
    } else {
      setTasaDraft(String(tasaUsd));
    }
    setEditingTasa(false);
  };

  // Recargar lotes y lista completa de compradores vía Server Action
  const recargarEstadisticas = async () => {
    if (!isSupabaseConfigured || isDemoMode) return;

    try {
      const snapshot = await fetchAdminSnapshot();
      startTransition(() => {
        setModeradores(
          snapshot.moderadores.length > 0 ? snapshot.moderadores : DEFAULT_DOS_MODERADORES
        );
        setVentas(snapshot.ventas);
      });
    } catch (err) {
      console.error('Error al actualizar métricas en vivo:', err);
    }
  };

  // Suscripción Supabase Realtime + respaldo de sincronización cada 8s
  useEffect(() => {
    if (!isSupabaseConfigured || isDemoMode) return;

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

    const intervalId = setInterval(() => {
      recargarEstadisticas();
    }, 8000);

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [isSupabaseConfigured, isDemoMode]);

  // Activar/Desactivar vista demo (para pruebas sin Supabase conectado)
  const handleToggleDemo = () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      setModeradores(initialModeradores.length > 0 ? initialModeradores : DEFAULT_DOS_MODERADORES);
      setVentas(initialVentas);
      setSelectedModFilter(null);
    } else {
      const demo = createDemoPreviewData(precioUnitario);
      setIsDemoMode(true);
      setModeradores(demo.moderadores);
      setVentas(demo.ventas);
      setSelectedModFilter(null);
    }
  };

  // Actualizar estado local tras anulación
  const handleVoidSuccess = (ventaId: string) => {
    setVentas((prev) => {
      const updated = prev.map((v) =>
        v.id === ventaId ? { ...v, estado: 'anulado' as const } : v
      );

      setModeradores((mods) =>
        mods.map((m) => {
          const modValidSales = updated.filter(
            (v) => v.moderador_id === m.moderador_id && v.estado === 'aprobado'
          );
          return {
            ...m,
            cartones_vendidos: modValidSales.reduce(
              (s, v) => s + Number(v.cantidad_cartones || 0),
              0
            ),
            monto_total_recaudado: modValidSales.reduce(
              (s, v) => s + Number(v.monto || 0),
              0
            ),
          };
        })
      );

      return updated;
    });

    if (isSupabaseConfigured && !isDemoMode) {
      recargarEstadisticas();
    }
  };

  // Totales globales en Bs., USD y Cartones
  const ventasAprobadas = useMemo(
    () => ventas.filter((v) => v.estado === 'aprobado'),
    [ventas]
  );

  const totalRecaudadoBs = useMemo(() => {
    if (ventasAprobadas.length > 0) {
      return ventasAprobadas.reduce((acc, v) => acc + Number(v.monto || 0), 0);
    }
    return moderadores.reduce((acc, m) => acc + m.monto_total_recaudado, 0);
  }, [ventasAprobadas, moderadores]);

  const totalCartonesVendidos = useMemo(() => {
    if (ventasAprobadas.length > 0) {
      return ventasAprobadas.reduce((acc, v) => acc + Number(v.cantidad_cartones || 0), 0);
    }
    return moderadores.reduce((acc, m) => acc + m.cartones_vendidos, 0);
  }, [ventasAprobadas, moderadores]);

  const totalCartonesCapacidad = useMemo(
    () => moderadores.reduce((acc, m) => acc + m.total_lote, 0),
    [moderadores]
  );

  const totalCartonesRestantes = useMemo(
    () => moderadores.reduce((acc, m) => acc + m.cartones_restantes, 0),
    [moderadores]
  );

  const porcentajeVendido =
    totalCartonesCapacidad > 0
      ? Math.min(100, Math.round((totalCartonesVendidos / totalCartonesCapacidad) * 100))
      : 0;

  // Puntos SVG para la curva de tendencia en la tarjeta "Cartones Vendidos"
  const sparklinePath = useMemo(() => {
    if (ventasAprobadas.length < 2) {
      return {
        line: 'M 0 54 C 50 52, 90 48, 140 46 C 190 44, 230 38, 280 34',
        area: 'M 0 54 C 50 52, 90 48, 140 46 C 190 44, 230 38, 280 34 L 280 70 L 0 70 Z',
      };
    }

    const chronological = [...ventasAprobadas].reverse();
    let running = 0;
    const pts = chronological.map((v, idx) => {
      running += Number(v.cantidad_cartones || 1);
      const x = (idx / Math.max(1, chronological.length - 1)) * 280;
      return { x, val: running };
    });

    const maxVal = Math.max(...pts.map((p) => p.val), 1);
    const coords = pts.map((p) => {
      const y = 60 - (p.val / maxVal) * 44;
      return `${p.x.toFixed(1)} ${y.toFixed(1)}`;
    });

    const line = `M ${coords.join(' L ')}`;
    const area = `${line} L 280 70 L 0 70 Z`;
    return { line, area };
  }, [ventasAprobadas]);

  // Exportar CSV de personas que cancelaron
  const handleExportCsv = () => {
    const csv = buildVentasCsv(ventas, tasaUsd);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bingo-recaudacion-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openVerifier = () => {
    if (activeTab === 'resumen') {
      setShowQuickVerifier(true);
    } else {
      setActiveTab('verificar');
    }
    setTimeout(() => verifierInputRef.current?.focus(), 120);
  };

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'resumen', label: 'Resumen', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'pagos', label: 'Pagos', icon: <Receipt className="w-4 h-4" /> },
    { id: 'verificar', label: '¡Bingo!', icon: <Trophy className="w-4 h-4" /> },
    { id: 'moderadores', label: 'Moderadores', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#f2f4f6] text-zinc-900 font-sans antialiased p-2 sm:p-4 lg:p-6">
      {/* Contenedor Shell principal estilo Dashboard Fintech */}
      <div className="max-w-[1280px] mx-auto bg-[#fafafa] rounded-[24px] sm:rounded-[32px] border border-zinc-200/80 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.08)] p-3.5 sm:p-6 space-y-5">
        {/* =====================================================================
            BARRA SUPERIOR (TOP PILL NAV)
            ===================================================================== */}
        <header className="bg-white rounded-full px-3 sm:px-5 py-2 border border-zinc-200/70 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.03)] flex items-center justify-between gap-2">
          {/* Logo Marca */}
          <div className="flex items-center gap-2.5 pl-1">
            <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <span className="font-semibold text-sm sm:text-base text-zinc-900 tracking-tight block">
                BingoPay
              </span>
              <span className="text-[10px] text-zinc-400 hidden sm:block">
                Panel Administrador
              </span>
            </div>
          </div>

          {/* Tabs centrales (Desktop / Tablet) */}
          <nav className="hidden md:flex items-center bg-zinc-100/85 p-1 rounded-full border border-zinc-200/50 gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Controles derechos */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={openVerifier}
              title="Buscar y verificar cartón ¡Bingo!"
              className="w-9 h-9 rounded-full bg-zinc-100/80 hover:bg-emerald-50 hover:text-emerald-700 text-zinc-600 flex items-center justify-center transition cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => recargarEstadisticas()}
              title="Refrescar datos"
              className="w-9 h-9 rounded-full bg-zinc-100/80 hover:bg-zinc-200/70 text-zinc-600 flex items-center justify-center transition relative cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin text-emerald-700' : ''}`} />
              {isSupabaseConfigured && !isDemoMode && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1.5 right-1.5 ring-2 ring-white animate-pulse" />
              )}
            </button>

            <Link
              href="/"
              className="h-9 px-3 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium inline-flex items-center gap-1.5 transition shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Taquilla</span>
            </Link>
          </div>
        </header>

        {/* Navegación móvil (< md) */}
        <nav className="flex md:hidden items-center bg-white p-1 rounded-full border border-zinc-200/80 gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 py-1.5 px-3 rounded-full text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-2xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* =====================================================================
            CUERPO CON RAIL IZQUIERDO + ÁREA PRINCIPAL
            ===================================================================== */}
        <div className="flex gap-5 items-stretch">
          {/* Rail flotante izquierdo (Desktop >= lg, fiel a la referencia) */}
          <aside className="hidden lg:flex flex-col justify-between items-center w-13 shrink-0 py-1 gap-4">
            {/* Grupo 1: Navegación */}
            <div className="bg-white border border-zinc-200/70 rounded-full p-1.5 shadow-2xs flex flex-col gap-1.5">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    title={item.label}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer ${
                      isActive
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    {item.icon}
                  </button>
                );
              })}
            </div>

            {/* Grupo 2: Herramientas rápidas */}
            <div className="bg-white border border-zinc-200/70 rounded-full p-1.5 shadow-2xs flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setEditingTasa((prev) => !prev)}
                title="Ajustar tasa Bs / USD"
                className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition cursor-pointer"
              >
                <DollarSign className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                title="Descargar reporte CSV"
                className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
              {!isSupabaseConfigured && (
                <button
                  type="button"
                  onClick={handleToggleDemo}
                  title={isDemoMode ? 'Desactivar vista demo' : 'Cargar vista demo'}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer ${
                    isDemoMode
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Grupo 3: Salida a taquilla */}
            <div className="bg-white border border-zinc-200/70 rounded-full p-1.5 shadow-2xs flex flex-col gap-1.5">
              <Link
                href="/"
                title="Volver a Terminal Taquilla"
                className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          </aside>

          {/* Contenido Principal */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Fila de Saludo y Acciones Rápidas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 tracking-tight leading-tight">
                  Bienvenido, <span className="text-zinc-400 font-normal">Admin</span>
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                    <Radio
                      className={`w-3.5 h-3.5 ${
                        isDemoMode
                          ? 'text-amber-500'
                          : isSupabaseConfigured
                          ? 'text-emerald-600'
                          : 'text-zinc-400'
                      }`}
                    />
                    {isDemoMode
                      ? 'Modo Vista Demo (2 moderadores simulados)'
                      : isSupabaseConfigured
                      ? `En vivo • ${moderadores.length} moderadores activos`
                      : `Modo local • ${moderadores.length} moderadores listos`}
                  </span>
                </div>
              </div>

              {/* Controles de Tasa USD + Botón Verificar */}
              <div className="flex flex-wrap items-center gap-2">
                {editingTasa ? (
                  <form
                    onSubmit={handleSaveTasa}
                    className="inline-flex items-center gap-1.5 bg-white border border-emerald-500 rounded-full px-3 py-1 shadow-xs"
                  >
                    <span className="text-[11px] font-medium text-zinc-500">Bs/$:</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      autoFocus
                      value={tasaDraft}
                      onChange={(e) => setTasaDraft(e.target.value)}
                      className="w-16 text-xs font-mono font-semibold text-zinc-900 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTasa(true)}
                    className="h-9 px-3.5 rounded-full bg-white hover:bg-zinc-50 border border-zinc-200/90 text-xs font-medium text-zinc-700 inline-flex items-center gap-2 shadow-2xs transition cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                    <span>
                      Tasa: <strong className="font-mono">{tasaUsd} Bs/$</strong>
                    </span>
                    <Edit2 className="w-3 h-3 text-zinc-400" />
                  </button>
                )}

                {!isSupabaseConfigured && (
                  <button
                    type="button"
                    onClick={handleToggleDemo}
                    className={`h-9 px-3.5 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer ${
                      isDemoMode
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-white hover:bg-zinc-50 border-zinc-200/90 text-zinc-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isDemoMode ? 'Salir de Demo' : 'Ver Demo'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={openVerifier}
                  className="h-9 px-4 rounded-full bg-white hover:bg-zinc-50 border border-zinc-200/90 text-xs font-semibold text-zinc-900 inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5 text-emerald-700" />
                  <span>+ Verificar Cartón</span>
                </button>
              </div>
            </div>

            {/* Verificador rápido desplegable dentro de Resumen */}
            {showQuickVerifier && activeTab === 'resumen' && (
              <div className="relative animate-in slide-in-from-top-2 duration-150">
                <button
                  type="button"
                  onClick={() => setShowQuickVerifier(false)}
                  title="Cerrar verificador rápido"
                  className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <BingoVerifierPanel
                  ventasLocales={ventas}
                  tasaUsd={tasaUsd}
                  isSupabaseConfigured={isSupabaseConfigured}
                  isDemoMode={isDemoMode}
                  onViewReceipt={(url) => setComprobanteModalUrl(url)}
                  onRequestVoid={(v) => setVentaAAnular(v)}
                  inputRef={verifierInputRef}
                />
              </div>
            )}

            {/* =================================================================
                VISTA 1: RESUMEN (BENTO GRID INSPIRADO EN LA IMAGEN QUIXOTIC)
                ================================================================= */}
            {activeTab === 'resumen' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Columna Izquierda + Centro (8 cols) */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Fila Superior: Tarjeta Bs + Tarjeta USD | Gráfico de Actividad */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Sub-columna Izquierda: Recaudado en Bs + Recaudado en USD */}
                    <div className="md:col-span-5 flex flex-col gap-4">
                      {/* 1. TARJETA PRINCIPAL: RECAUDADO EN BOLÍVARES */}
                      <div className="bg-white rounded-[24px] p-4 border border-zinc-200/70 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.03)] space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">
                              Recaudado en Bs.
                            </h2>
                            <p className="text-[11px] text-zinc-400">
                              Total consolidado en taquilla
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('pagos')}
                            title="Ver desglose de pagos"
                            className="w-8 h-8 rounded-full border border-zinc-200/80 hover:bg-zinc-50 text-zinc-600 flex items-center justify-center transition cursor-pointer"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Bloque Esmeralda tipo Tarjeta Bancaria (como en la imagen) */}
                        <div className="bg-gradient-to-br from-[#0e8658] via-[#0a6b45] to-[#064c31] text-white rounded-2xl p-4 relative overflow-hidden shadow-[0_8px_20px_-6px_rgba(6,78,50,0.45)]">
                          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-100">
                              PAGO MÓVIL
                            </span>
                            <Wifi className="w-4 h-4 text-emerald-100 rotate-90" />
                          </div>

                          <div className="mt-4">
                            <span className="text-[11px] text-emerald-100/80 block">
                              Bolívares Confirmados
                            </span>
                            <div className="text-2xl sm:text-[26px] font-bold font-mono tracking-tight leading-tight mt-0.5 truncate">
                              {formatBs(totalRecaudadoBs)}
                            </div>
                          </div>

                          <div className="mt-4 pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-emerald-100/90 font-mono">
                            <span>0102 • B. Venezuela</span>
                            <span>{ventasAprobadas.length} pagos</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. TARJETA EQUIVALENTE EN DÓLARES (estilo "Weekly Revenue") */}
                      <div className="bg-white rounded-[22px] p-4 border border-zinc-200/70 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.03)] flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-xs text-zinc-500 block">
                            Recaudado en Dólares
                          </span>
                          <div className="text-xl sm:text-2xl font-bold text-zinc-900 font-mono tracking-tight mt-0.5 truncate">
                            {formatUsd(totalRecaudadoBs, tasaUsd)}{' '}
                            <span className="text-xs font-semibold text-zinc-400">USD</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setEditingTasa(true)}
                          title="Cambiar tasa Bs/$"
                          className="bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shrink-0 font-mono transition cursor-pointer"
                        >
                          {tasaUsd} Bs/$
                        </button>
                      </div>
                    </div>

                    {/* Sub-columna Centro: Gráfico de Actividad / 2 Moderadores */}
                    <div className="md:col-span-7">
                      <SalesChartCard
                        ventas={ventas}
                        moderadores={moderadores}
                        tasaUsd={tasaUsd}
                        onInspectModeradores={() => setActiveTab('moderadores')}
                      />
                    </div>
                  </div>

                  {/* Fila Inferior: Lista de Personas que ya Cancelaron */}
                  <BuyersTableCard
                    ventas={ventas}
                    moderadores={moderadores}
                    tasaUsd={tasaUsd}
                    scrollMaxHeightClass="max-h-[300px]"
                    selectedModeratorId={selectedModFilter}
                    onSelectModerator={setSelectedModFilter}
                    onViewReceipt={(url) => setComprobanteModalUrl(url)}
                    onRequestVoid={(v) => setVentaAAnular(v)}
                    onExpandAll={() => setActiveTab('pagos')}
                    onLoadDemo={handleToggleDemo}
                    isSupabaseConfigured={isSupabaseConfigured}
                  />
                </div>

                {/* Columna Derecha (4 cols): Total Cartones Vendidos + 2 Moderadores */}
                <div className="lg:col-span-4 space-y-4">
                  {/* 3. TOTAL CARTONES VENDIDOS (estilo "Payment Goal / Total Balance") */}
                  <div className="bg-white rounded-[24px] p-5 border border-zinc-200/70 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">
                          Total Cartones Vendidos
                        </h2>
                        <p className="text-[11px] text-zinc-400">
                          Meta física de los {moderadores.length} talonarios
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('moderadores')}
                        className="w-8 h-8 rounded-full border border-zinc-200/80 hover:bg-zinc-50 text-zinc-600 flex items-center justify-center transition cursor-pointer"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-center pt-1">
                      <span className="text-[11px] text-zinc-400 block">
                        Cartones Asignados
                      </span>
                      <div className="text-3xl sm:text-4xl font-bold text-zinc-900 font-mono tracking-tight mt-0.5">
                        {totalCartonesVendidos}
                        <span className="text-lg font-normal text-zinc-400">
                          {' '}
                          / {totalCartonesCapacidad}
                        </span>
                      </div>
                      <span className="inline-block mt-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full">
                        {porcentajeVendido}% completado • {totalCartonesRestantes} disp.
                      </span>
                    </div>

                    {/* Curva SVG Esmeralda (Sparkline) */}
                    <div className="w-full h-16 overflow-hidden">
                      <svg
                        viewBox="0 0 280 70"
                        preserveAspectRatio="none"
                        className="w-full h-full"
                      >
                        <defs>
                          <linearGradient id="bingoSparkFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path d={sparklinePath.area} fill="url(#bingoSparkFill)" />
                        <path
                          d={sparklinePath.line}
                          fill="none"
                          stroke="#059669"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    {/* Botones duales estilo pill */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={openVerifier}
                        className="h-10 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>¡Bingo!</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportCsv}
                        className="h-10 rounded-full bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Exportar CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* 4. LOS 2 MODERADORES (estilo "Amount of credit / Mandatory Payments") */}
                  <div className="bg-white rounded-[24px] p-5 border border-zinc-200/70 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.03)] space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200/70 flex items-center justify-center text-zinc-700 shrink-0">
                          <Ticket className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-900">
                            Stock en Talonarios
                          </h3>
                          <p className="text-[11px] text-zinc-400">
                            {moderadores.length} moderadores activos
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <div className="text-2xl sm:text-3xl font-bold text-zinc-900 font-mono tracking-tight">
                        {totalCartonesRestantes}{' '}
                        <span className="text-xs font-sans font-normal text-zinc-400">
                          cartones libres
                        </span>
                      </div>
                      <span className="bg-emerald-700 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                        {moderadores.length} Mesas
                      </span>
                    </div>

                    {/* Sub-tarjeta con las 2 Mesas / Moderadores */}
                    <div className="bg-zinc-50/90 border border-zinc-200/60 rounded-2xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-900">
                            Moderadores ({moderadores.length})
                          </h4>
                          <p className="text-[10px] text-zinc-400">
                            Pulsa una mesa para filtrar compradores
                          </p>
                        </div>

                        {/* Avatares apilados */}
                        <div className="flex -space-x-2">
                          {moderadores.map((mod, idx) => (
                            <div
                              key={mod.moderador_id}
                              className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold ${
                                idx === 0
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-zinc-800 text-white'
                              }`}
                            >
                              {getInitials(mod.moderador_nombre.split('-')[1] || `M${idx + 1}`)}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {moderadores.map((mod, idx) => {
                          const modPct =
                            mod.total_lote > 0
                              ? Math.min(100, Math.round((mod.cartones_vendidos / mod.total_lote) * 100))
                              : 0;
                          const isSelected = selectedModFilter === mod.moderador_id;

                          return (
                            <button
                              key={mod.moderador_id}
                              type="button"
                              onClick={() =>
                                setSelectedModFilter(isSelected ? null : mod.moderador_id)
                              }
                              className={`w-full text-left bg-white border rounded-xl p-3 space-y-2 transition cursor-pointer ${
                                isSelected
                                  ? 'border-emerald-600 ring-1 ring-emerald-500/30'
                                  : 'border-zinc-200/80 hover:border-zinc-300'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                      idx === 0
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-zinc-100 text-zinc-800'
                                    }`}
                                  >
                                    M{idx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-zinc-900 truncate">
                                      {mod.moderador_nombre}
                                    </p>
                                    <p className="text-[10px] text-zinc-400 font-mono">
                                      #{String(mod.numero_inicial).padStart(3, '0')}–#
                                      {String(mod.numero_final).padStart(3, '0')} • Sig: #
                                      {mod.siguiente_disponible}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right font-mono shrink-0">
                                  <p className="text-xs font-bold text-emerald-700">
                                    {formatBs(mod.monto_total_recaudado)}
                                  </p>
                                  <p className="text-[10px] text-zinc-400">
                                    {formatUsd(mod.monto_total_recaudado, tasaUsd)} USD
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-zinc-500">
                                  <span>
                                    Vendidos:{' '}
                                    <strong className="text-zinc-800">{mod.cartones_vendidos}</strong>
                                  </span>
                                  <span>
                                    Restan:{' '}
                                    <strong className="text-zinc-800">{mod.cartones_restantes}</strong>
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                                    style={{ width: `${modPct}%` }}
                                  />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================================
                VISTA 2: PAGOS / PERSONAS QUE YA CANCELARON (COMPLETO)
                ================================================================= */}
            {activeTab === 'pagos' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white rounded-2xl p-4 border border-zinc-200/70">
                    <span className="text-[11px] text-zinc-400 uppercase font-medium">
                      Total en Bolívares
                    </span>
                    <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
                      {formatBs(totalRecaudadoBs)}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-zinc-200/70">
                    <span className="text-[11px] text-zinc-400 uppercase font-medium">
                      Total en Dólares ({tasaUsd} Bs/$)
                    </span>
                    <div className="text-xl font-bold text-zinc-900 font-mono mt-1">
                      {formatUsd(totalRecaudadoBs, tasaUsd)} USD
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-zinc-200/70 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-zinc-400 uppercase font-medium">
                        Cartones Vendidos
                      </span>
                      <div className="text-xl font-bold text-zinc-900 font-mono mt-1">
                        {totalCartonesVendidos} / {totalCartonesCapacidad}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="h-9 px-3.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                <BuyersTableCard
                  ventas={ventas}
                  moderadores={moderadores}
                  tasaUsd={tasaUsd}
                  scrollMaxHeightClass="max-h-[540px]"
                  selectedModeratorId={selectedModFilter}
                  onSelectModerator={setSelectedModFilter}
                  onViewReceipt={(url) => setComprobanteModalUrl(url)}
                  onRequestVoid={(v) => setVentaAAnular(v)}
                  onLoadDemo={handleToggleDemo}
                  isSupabaseConfigured={isSupabaseConfigured}
                />
              </div>
            )}

            {/* =================================================================
                VISTA 3: VERIFICADOR DE CARTÓN "¡BINGO!"
                ================================================================= */}
            {activeTab === 'verificar' && (
              <div className="space-y-4">
                <BingoVerifierPanel
                  ventasLocales={ventas}
                  tasaUsd={tasaUsd}
                  isSupabaseConfigured={isSupabaseConfigured}
                  isDemoMode={isDemoMode}
                  onViewReceipt={(url) => setComprobanteModalUrl(url)}
                  onRequestVoid={(v) => setVentaAAnular(v)}
                  inputRef={verifierInputRef}
                />

                <BuyersTableCard
                  ventas={ventas}
                  moderadores={moderadores}
                  tasaUsd={tasaUsd}
                  scrollMaxHeightClass="max-h-[340px]"
                  selectedModeratorId={selectedModFilter}
                  onSelectModerator={setSelectedModFilter}
                  onViewReceipt={(url) => setComprobanteModalUrl(url)}
                  onRequestVoid={(v) => setVentaAAnular(v)}
                  onLoadDemo={handleToggleDemo}
                  isSupabaseConfigured={isSupabaseConfigured}
                />
              </div>
            )}

            {/* =================================================================
                VISTA 4: DETALLE DE LOS 2 MODERADORES
                ================================================================= */}
            {activeTab === 'moderadores' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {moderadores.map((mod, idx) => {
                    const pct =
                      mod.total_lote > 0
                        ? Math.min(100, Math.round((mod.cartones_vendidos / mod.total_lote) * 100))
                        : 0;
                    const ventasMod = ventasAprobadas.filter(
                      (v) => v.moderador_id === mod.moderador_id
                    );

                    return (
                      <div
                        key={mod.moderador_id}
                        className="bg-white rounded-[24px] p-5 border border-zinc-200/70 shadow-2xs space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${
                                idx === 0
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-zinc-900 text-white'
                              }`}
                            >
                              M{idx + 1}
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-zinc-900">
                                {mod.moderador_nombre}
                              </h3>
                              <p className="text-xs text-zinc-500 font-mono">
                                {mod.bloque_nombre} • Siguiente: #{mod.siguiente_disponible}
                              </p>
                            </div>
                          </div>

                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-3 py-1 rounded-full font-mono">
                            {pct}% vendido
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5 bg-zinc-50 border border-zinc-200/60 rounded-2xl p-3">
                          <div>
                            <span className="text-[10px] text-zinc-400 uppercase block">
                              Recaudado Bs
                            </span>
                            <span className="text-sm font-bold text-emerald-700 font-mono">
                              {formatBs(mod.monto_total_recaudado)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-400 uppercase block">
                              Equiv. USD
                            </span>
                            <span className="text-sm font-bold text-zinc-900 font-mono">
                              {formatUsd(mod.monto_total_recaudado, tasaUsd)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-400 uppercase block">
                              Compradores
                            </span>
                            <span className="text-sm font-bold text-zinc-900 font-mono">
                              {ventasMod.length}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-zinc-600">
                            <span>
                              Cartones vendidos:{' '}
                              <strong className="text-zinc-900">{mod.cartones_vendidos}</strong>
                            </span>
                            <span>
                              Disponibles:{' '}
                              <strong className="text-zinc-900">{mod.cartones_restantes}</strong>
                            </span>
                          </div>
                          <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <BuyersTableCard
                  ventas={ventas}
                  moderadores={moderadores}
                  tasaUsd={tasaUsd}
                  scrollMaxHeightClass="max-h-[420px]"
                  selectedModeratorId={selectedModFilter}
                  onSelectModerator={setSelectedModFilter}
                  onViewReceipt={(url) => setComprobanteModalUrl(url)}
                  onRequestVoid={(v) => setVentaAAnular(v)}
                  onLoadDemo={handleToggleDemo}
                  isSupabaseConfigured={isSupabaseConfigured}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modales globales de auditoría */}
      <ReceiptPreviewModal
        url={comprobanteModalUrl}
        onClose={() => setComprobanteModalUrl(null)}
      />

      <VoidSaleModal
        venta={ventaAAnular}
        isDemoMode={isDemoMode}
        onClose={() => setVentaAAnular(null)}
        onVoidSuccess={handleVoidSuccess}
      />
    </div>
  );
}
