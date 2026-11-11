'use client';

import React, { useState, useRef, useEffect, useTransition } from 'react';
import { 
  Camera, 
  QrCode, 
  Copy, 
  Check, 
  AlertTriangle, 
  Sparkles, 
  RefreshCw, 
  ArrowRight, 
  Ticket, 
  User, 
  Building2, 
  Hash, 
  DollarSign, 
  X,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { OCRReceiptResult, AsignarCartonesResponse } from '@/lib/types';
import { procesarComprobantePagoMovil } from '@/app/actions/ocr-receipt';
import { registrarVentaYAsignarCartones } from '@/app/actions/ventas';
import { playSuccessSound, playWarningSound, playTapSound } from '@/lib/audio';
import TerminalCobro from './TerminalCobro';

interface ModeradorTerminalProps {
  moderadorId: string;
  moderadorNombre: string;
  loteInfo: {
    bloqueNombre: string;
    numeroInicial: number;
    numeroFinal: number;
    siguienteDisponible: number;
  };
  pagoMovilConfig: {
    banco: string;
    telefono: string;
    cedula: string;
    titular?: string;
    precioUnitario: number; // Precio por cartón (ej. 50 Bs)
    moneda: string; // 'Bs.' o '$'
    qrImageUrl?: string;
  };
}

type TerminalState = 'IDLE' | 'SCANNING' | 'EDIT_SHEET' | 'CONFIRMATION_GIANT';

export default function ModeradorTerminal({
  moderadorId,
  moderadorNombre,
  loteInfo: initialLote,
  pagoMovilConfig,
}: ModeradorTerminalProps) {
  // Estado general
  const [lote, setLote] = useState(initialLote);
  const [terminalState, setTerminalState] = useState<TerminalState>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Datos capturados
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);

  // Formulario editable
  const [bancoOrigen, setBancoOrigen] = useState('');
  const [referencia, setReferencia] = useState('');
  const [monto, setMonto] = useState<number>(pagoMovilConfig.precioUnitario);
  const [cantidadCartones, setCantidadCartones] = useState<number>(1);
  const [compradorNombre, setCompradorNombre] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState<'alta' | 'media' | 'baja'>('alta');

  // Resultado de asignación
  const [resultadoAsignacion, setResultadoAsignacion] = useState<AsignarCartonesResponse | null>(null);

  // Transiciones y referencias
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const compradorInputRef = useRef<HTMLInputElement>(null);

  // Feedback háptico (Vibration API) para eventos ruidosos
  const triggerHaptic = (pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignorar si no está soportado por el navegador
      }
    }
  };

  // Copiar datos de Pago Móvil al portapapeles
  const handleCopyPagoMovil = async () => {
    const text = `Pago Móvil:\nBanco: ${pagoMovilConfig.banco}\nTeléfono: ${pagoMovilConfig.telefono}\nCédula: ${pagoMovilConfig.cedula}\nTitular: ${pagoMovilConfig.titular}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      playTapSound();
      triggerHaptic(50);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Error al copiar', err);
    }
  };

  // Disparar cámara trasera del móvil
  const handleTriggerCamera = () => {
    playTapSound();
    triggerHaptic(50);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Procesar imagen capturada con Gemini 1.5 Flash
  const processReceiptFile = (file: File) => {
    setReceiptImage(file);
    const previewUrl = URL.createObjectURL(file);
    setReceiptPreviewUrl(previewUrl);

    // Cambiar a estado de escaneo
    setTerminalState('SCANNING');
    setErrorMsg(null);
    triggerHaptic([50, 50]);

    startTransition(async () => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await procesarComprobantePagoMovil(formData);

      if (res.success && res.data) {
        setBancoOrigen(res.data.banco_origen || '');
        setReferencia(res.data.referencia || '');
        const extractedMonto = Number(res.data.monto) || pagoMovilConfig.precioUnitario;
        setMonto(extractedMonto);
        setOcrConfidence(res.data.confianza || 'alta');

        // Autocalcular sugerencia de cartones según el monto
        const cartonesCalculados = Math.round(extractedMonto / pagoMovilConfig.precioUnitario);
        if (cartonesCalculados >= 1 && cartonesCalculados <= 3) {
          setCantidadCartones(cartonesCalculados);
        } else {
          setCantidadCartones(1);
        }

        setTerminalState('EDIT_SHEET');
        triggerHaptic([100, 50, 100]);

        // Foco automático en el nombre del comprador
        setTimeout(() => {
          compradorInputRef.current?.focus();
        }, 300);
      } else {
        // Fallback: Si Gemini tuvo dificultades con la foto borrosa, permitir llenado manual sin bloquear la taquilla
        setErrorMsg(
          res.error || 'No se pudo leer automáticamente el comprobante. Ingrese los datos manualmente.'
        );
        setBancoOrigen('');
        setReferencia('');
        setMonto(pagoMovilConfig.precioUnitario);
        setCantidadCartones(1);
        setTerminalState('EDIT_SHEET');
        playWarningSound();
        triggerHaptic([200, 100, 200]);
      }
    });
  };

  const handleImageCaptured = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processReceiptFile(file);
  };

  // Validación de descuadre en tiempo real
  const montoEsperado = cantidadCartones * pagoMovilConfig.precioUnitario;
  const hayDescuadreMonto = Math.abs(monto - montoEsperado) > 0.01;

  // Confirmar y Asignar Cartones Físicos en PostgreSQL (Transacción Atómica)
  const handleAprobarYAsignar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compradorNombre.trim()) {
      setErrorMsg('Por favor ingrese el nombre del comprador.');
      triggerHaptic(200);
      return;
    }
    if (!referencia.trim() || !bancoOrigen.trim()) {
      setErrorMsg('Referencia y Banco son obligatorios para prevenir duplicados.');
      triggerHaptic(200);
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append('moderador_id', moderadorId);
      formData.append('comprador_nombre', compradorNombre);
      formData.append('banco_origen', bancoOrigen);
      formData.append('referencia', referencia);
      formData.append('monto', monto.toString());
      formData.append('cantidad_cartones', cantidadCartones.toString());
      if (receiptImage) {
        formData.append('comprobante_file', receiptImage);
      }

      const res = await registrarVentaYAsignarCartones(formData);

      if (res.success && res.carton_desde !== undefined && res.carton_hasta !== undefined) {
        setResultadoAsignacion(res);
        // Actualizar contador local de lote
        setLote((prev) => ({
          ...prev,
          siguienteDisponible: (res.carton_hasta ?? prev.siguienteDisponible) + 1,
        }));

        setTerminalState('CONFIRMATION_GIANT');
        // Fanfarria auditiva + Vibración triunfal de éxito (3 pulsos fuertes)
        playSuccessSound();
        triggerHaptic([200, 100, 200, 100, 400]);
      } else {
        setErrorMsg(res.error || 'Error al asignar cartones.');
        playWarningSound();
        triggerHaptic([300, 150, 300]);
      }
    });
  };

  // Reiniciar para el siguiente cliente
  const handleResetForNextCustomer = () => {
    setReceiptImage(null);
    if (receiptPreviewUrl) {
      URL.revokeObjectURL(receiptPreviewUrl);
      setReceiptPreviewUrl(null);
    }
    setCompradorNombre('');
    setBancoOrigen('');
    setReferencia('');
    setMonto(pagoMovilConfig.precioUnitario);
    setCantidadCartones(1);
    setResultadoAsignacion(null);
    setErrorMsg(null);
    setTerminalState('IDLE');
    triggerHaptic(50);
  };

  // Cartones restantes en el lote
  const cartonesRestantes = Math.max(0, lote.numeroFinal - lote.siguienteDisponible + 1);

  if (terminalState === 'IDLE') {
    return (
      <TerminalCobro
        moderador={{
          nombre: moderadorNombre.replace(/^Mesa\s*\d+\s*[-•]\s*/i, ''),
          mesa: moderadorNombre.split(/[-•]/)[0]?.trim() || 'Mesa 1',
          bloqueNombre: lote.bloqueNombre,
          rango: `#${String(lote.numeroInicial).padStart(3, '0')} - #${String(lote.numeroFinal).padStart(3, '0')}`,
          disponibles: cartonesRestantes,
        }}
        pagoMovil={{
          banco: pagoMovilConfig.banco,
          telefono: pagoMovilConfig.telefono,
          cedula: pagoMovilConfig.cedula,
          titular: pagoMovilConfig.titular || 'Comité Organizador Bingo',
          precioUnitario: pagoMovilConfig.precioUnitario,
          moneda: pagoMovilConfig.moneda,
          maxCartones: 3,
          qrImageUrl: pagoMovilConfig.qrImageUrl || '/image.png',
        }}
        onCaptureImage={processReceiptFile}
        adminHref="/admin"
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#fafafa] text-zinc-900 flex flex-col justify-between max-w-md mx-auto select-none font-sans antialiased pb-safe p-4 sm:p-6">
      {/* Input oculto para cámara trasera de alta velocidad */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleImageCaptured}
        className="hidden"
      />

      {/* =========================================================================
          ESTADO 2: ESCANEANDO CON GEMINI 1.5 FLASH (LIGHT THEME MINIMAL)
          ========================================================================= */}
      {terminalState === 'SCANNING' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-5">
          <div className="relative">
            <div className="w-28 h-28 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-sm relative overflow-hidden">
              {receiptPreviewUrl ? (
                <img
                  src={receiptPreviewUrl}
                  alt="Comprobante"
                  className="w-full h-full object-cover opacity-40 filter blur-[1px]"
                />
              ) : null}
              <div className="absolute inset-0 bg-white/40 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-emerald-600 animate-spin" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">
              Leyendo comprobante...
            </h2>
            <p className="text-xs text-zinc-500 max-w-[260px] mx-auto font-normal">
              Extrayendo banco, referencia y monto del pago móvil con IA
            </p>
          </div>

          <div className="inline-flex items-center space-x-2 bg-white px-3.5 py-1.5 rounded-full border border-zinc-200 text-xs text-zinc-600 shadow-xs">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            <span>Procesando imagen</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          ESTADO 3: MODAL EDITABLE CON DATOS EXTRAÍDOS (LIGHT THEME MINIMAL)
          ========================================================================= */}
      {terminalState === 'EDIT_SHEET' && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4">
          <div className="bg-white border-t sm:border border-zinc-200 rounded-t-2xl sm:rounded-2xl p-5 shadow-xl max-h-[92vh] overflow-y-auto flex flex-col space-y-4 animate-in slide-in-from-bottom duration-200 max-w-md mx-auto w-full">
            
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
                  Verificar y Asignar Cartones
                </h2>
              </div>
              <button
                type="button"
                onClick={handleResetForNextCustomer}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center active:scale-95 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ADVERTENCIA DE DESCUADRE EN VIVO (AMBAR SUTIL) */}
            {hayDescuadreMonto && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl flex items-start space-x-2.5 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900 text-xs">
                    Atención: Descuadre de monto
                  </h4>
                  <p className="mt-0.5 text-amber-800">
                    Monto pagado: <span className="font-semibold">{monto} {pagoMovilConfig.moneda}</span>
                    {' • '}
                    Esperado para {cantidadCartones} cartón(es):{' '}
                    <span className="font-semibold">{montoEsperado} {pagoMovilConfig.moneda}</span>
                  </p>
                  <p className="text-[11px] text-amber-700/80 mt-1">
                    Verifique con el comprobante o edite los campos antes de aprobar.
                  </p>
                </div>
              </div>
            )}

            {/* Error banner si existe */}
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAprobarYAsignar} className="space-y-3.5">
              
              {/* SELECTOR DE CARTONES (1, 2, 3) */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                  <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                  Cantidad de Cartones
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((num) => {
                    const isSelected = cantidadCartones === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setCantidadCartones(num);
                          playTapSound();
                          triggerHaptic(40);
                        }}
                        className={`min-h-[50px] rounded-xl font-semibold text-lg flex flex-col items-center justify-center transition border ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-600 shadow-xs'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200 active:scale-95'
                        }`}
                      >
                        <span>{num}</span>
                        <span className="text-[10px] font-normal opacity-80">
                          {num * pagoMovilConfig.precioUnitario} {pagoMovilConfig.moneda}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* NOMBRE DEL COMPRADOR */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  Nombre del Comprador *
                </label>
                <input
                  ref={compradorInputRef}
                  type="text"
                  required
                  placeholder="Ej: Carmen Gómez"
                  value={compradorNombre}
                  onChange={(e) => setCompradorNombre(e.target.value)}
                  className="w-full min-h-[44px] bg-white border border-zinc-200 focus:border-emerald-500 rounded-xl px-3.5 text-sm font-semibold text-zinc-900 placeholder-zinc-400 focus:outline-none transition"
                />
              </div>

              {/* BANCO Y REFERENCIA */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
                    <Building2 className="w-3 h-3 text-zinc-400" />
                    Banco Origen
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Banesco / BDV..."
                    value={bancoOrigen}
                    onChange={(e) => setBancoOrigen(e.target.value.toUpperCase())}
                    className="w-full min-h-[42px] bg-white border border-zinc-200 focus:border-emerald-500 rounded-xl px-3 text-xs font-semibold text-zinc-900 uppercase focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
                    <Hash className="w-3 h-3 text-zinc-400" />
                    Referencia
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Dígitos ref"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value.trim())}
                    className="w-full min-h-[42px] bg-white border border-zinc-200 focus:border-emerald-500 rounded-xl px-3 text-xs font-mono font-semibold text-zinc-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* MONTO DEL COMPROBANTE */}
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1 flex items-center justify-between uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-zinc-400" />
                    Monto Comprobante ({pagoMovilConfig.moneda})
                  </span>
                  {ocrConfidence && (
                    <span className="text-[10px] font-normal text-zinc-400 lowercase">
                      OCR: {ocrConfidence}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={monto || ''}
                  onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
                  className={`w-full min-h-[42px] bg-white border rounded-xl px-3 text-sm font-semibold focus:outline-none ${
                    hayDescuadreMonto
                      ? 'border-amber-400 text-amber-900 focus:border-amber-500'
                      : 'border-zinc-200 text-zinc-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              {/* MINIATURA DEL COMPROBANTE */}
              {receiptPreviewUrl && (
                <div className="flex items-center gap-2.5 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/60">
                  <img
                    src={receiptPreviewUrl}
                    alt="Miniatura"
                    className="w-10 h-10 object-cover rounded-lg border border-zinc-200 shrink-0"
                  />
                  <div className="flex-1 truncate">
                    <span className="text-[11px] text-zinc-500 block font-normal">Foto comprobante adjunta</span>
                    <button
                      type="button"
                      onClick={handleTriggerCamera}
                      className="text-xs text-emerald-700 font-medium hover:underline"
                    >
                      Tomar otra foto
                    </button>
                  </div>
                </div>
              )}

              {/* BOTÓN DE APROBACIÓN */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full h-13 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-medium text-base rounded-xl shadow-sm flex items-center justify-center space-x-2 transition"
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-white" />
                      <span>Reservando cartones...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 stroke-[2.5]" />
                      <span>Aprobar y Asignar ({cantidadCartones})</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResetForNextCustomer}
                  className="w-full text-zinc-400 hover:text-zinc-600 font-medium text-xs text-center py-1 transition"
                >
                  Cancelar operación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          ESTADO 4: CONFIRMACIÓN DE ASIGNACIÓN (LIGHT THEME MINIMAL)
          ========================================================================= */}
      {terminalState === 'CONFIRMATION_GIANT' && resultadoAsignacion && (
        <div className="fixed inset-0 z-50 bg-[#fafafa] flex flex-col justify-between p-6 text-center select-none animate-in zoom-in-95 duration-150 max-w-md mx-auto">
          
          {/* Header Superior */}
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider shadow-xs">
              <Check className="w-4 h-4 stroke-[2.5] text-emerald-600" /> Pago y Cartones Aprobados
            </span>
          </div>

          {/* CUERPO CENTRAL */}
          <div className="space-y-4 my-auto">
            <p className="text-zinc-500 font-medium tracking-wider text-xs uppercase">
              Entregar Cartones al Comprador:
            </p>

            <div className="bg-white border-2 border-emerald-500 rounded-2xl p-6 shadow-sm space-y-1">
              <div className="text-4xl sm:text-5xl font-bold text-emerald-700 tracking-tight font-mono">
                {resultadoAsignacion.carton_desde === resultadoAsignacion.carton_hasta ? (
                  `#${resultadoAsignacion.carton_desde}`
                ) : (
                  `#${resultadoAsignacion.carton_desde} al #${resultadoAsignacion.carton_hasta}`
                )}
              </div>
              <div className="text-zinc-500 font-medium text-xs uppercase tracking-wider">
                {resultadoAsignacion.carton_hasta! - resultadoAsignacion.carton_desde! + 1}{' '}
                Cartón(es) del talonario físico
              </div>
            </div>

            {/* Datos del Comprador */}
            <div className="bg-white border border-zinc-200 rounded-xl p-4 text-zinc-700 text-sm space-y-0.5 shadow-xs">
              <p className="text-[11px] text-zinc-400 uppercase font-medium">Comprador:</p>
              <p className="text-lg font-semibold text-zinc-900">{compradorNombre}</p>
              <p className="text-xs font-mono text-zinc-500 mt-1">
                Ref: <span className="font-semibold text-zinc-800">{referencia}</span> • {bancoOrigen}
              </p>
            </div>
          </div>

          {/* BOTÓN INFERIOR DE RETORNO */}
          <div className="pb-4 space-y-2">
            <button
              type="button"
              onClick={handleResetForNextCustomer}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-base rounded-xl shadow-sm flex items-center justify-center gap-2 transition"
            >
              <span>Siguiente Venta (Listo)</span>
              <ArrowRight className="w-5 h-5 stroke-[2]" />
            </button>
            <p className="text-xs text-zinc-400 font-normal">
              Quedan {resultadoAsignacion.restantes ?? cartonesRestantes} cartones en este lote
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

