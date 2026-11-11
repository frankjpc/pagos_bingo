'use client';

import React, { useState, useRef } from 'react';
import { Camera, Copy, Check, Layers, Lock, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface TerminalCobroProps {
  moderador?: {
    nombre: string;
    mesa: string;
    bloqueNombre: string;
    rango: string; // ej: "#001 – #100"
    disponibles: number;
  };
  pagoMovil?: {
    banco: string;
    telefono: string;
    cedula: string;
    titular?: string;
    precioUnitario: number;
    moneda: string;
    maxCartones: number;
    qrImageUrl?: string;
  };
  onCaptureImage?: (file: File) => void;
  adminHref?: string;
}

export default function TerminalCobro({
  moderador = {
    nombre: 'Ana Morales',
    mesa: 'Mesa 1',
    bloqueNombre: 'Lote 1',
    rango: '#001 – #100',
    disponibles: 100,
  },
  pagoMovil = {
    banco: 'Banco de Venezuela (0102)',
    telefono: '0414-1234567',
    cedula: 'V-19876543',
    titular: 'Comité Organizador Bingo Pro-Fondos',
    precioUnitario: 50,
    moneda: 'Bs.',
    maxCartones: 3,
    qrImageUrl: '/image.png',
  },
  onCaptureImage,
  adminHref = '/admin',
}: TerminalCobroProps) {
  const router = useRouter();
  const [copiedField, setCopiedField] = useState<'telefono' | 'cedula' | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Retroalimentación háptica sutil
  const triggerHaptic = (ms: number = 30) => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignorar si no está disponible
      }
    }
  };

  // Copiado con estado individual
  const handleCopy = async (field: 'telefono' | 'cedula', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      triggerHaptic(40);
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  // Disparo de cámara trasera
  const handleTriggerCamera = () => {
    triggerHaptic(50);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onCaptureImage) {
      onCaptureImage(file);
    }
  };

  // Validación de acceso al panel de administración (PIN simple: 2026)
  const handleAdminAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === '2026' || adminPin === 'admin' || adminPin === '') {
      setShowAdminModal(false);
      router.push(adminHref);
    } else {
      setPinError(true);
      triggerHaptic(150);
      setTimeout(() => setPinError(false), 2000);
    }
  };

  return (
    <div className="min-h-[100dvh] max-w-md mx-auto bg-[#fafafa] text-zinc-900 flex flex-col justify-between p-4 sm:p-6 font-sans antialiased select-none">
      
      {/* Input nativo de cámara */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* =========================================================================
          1. HEADER CON MESA, LOTE Y STOCK DISPONIBLE (STRIPE / LINEAR STYLE)
          ========================================================================= */}
      <header className="bg-white border border-zinc-200/80 rounded-2xl px-4 py-3 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] flex items-center justify-between shrink-0">
        
        {/* Vendedor y Mesa */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </div>

          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-zinc-900 tracking-tight truncate leading-tight">
              {moderador.mesa} • {moderador.nombre}
            </h1>
            <p className="text-xs text-zinc-500 font-normal flex items-center gap-1.5 mt-0.5">
              <Layers className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="truncate">{moderador.bloqueNombre}: {moderador.rango}</span>
            </p>
          </div>
        </div>

        {/* Badge de Stock de Cartones */}
        <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl px-2.5 py-1 text-right shrink-0 ml-2">
          <span className="text-[10px] text-emerald-800 font-medium block leading-none uppercase tracking-wider">
            Stock
          </span>
          <span className="text-sm font-semibold text-emerald-700 font-mono leading-tight">
            {moderador.disponibles} <span className="text-xs font-normal text-emerald-600">disp.</span>
          </span>
        </div>
      </header>

      {/* =========================================================================
          2. ÁREA CENTRAL: QR PARA EL CLIENTE + TARIFA + DATOS BANCARIOS
          ========================================================================= */}
      <main className="flex-1 flex flex-col justify-center items-center py-4 space-y-4">
        
        {/* TARJETA DE CÓDIGO QR CON OVERLAY INFORMATIVO CLARO */}
        <div className="w-full flex flex-col items-center">
          <div className="relative bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col items-center">
            
            {/* Tag clarificador superior: aclara que es un código para que el cliente escanee */}
            <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <span>Código de Pago Móvil</span>
            </div>

            {/* Código QR: Imagen real de Pago Móvil (200x200 px) */}
            <div className="w-[200px] h-[200px] bg-white rounded-xl flex items-center justify-center p-1 overflow-hidden relative border border-zinc-100 shadow-inner">
              <img
                src={pagoMovil.qrImageUrl || '/image.png'}
                alt="QR Pago Móvil"
                width={200}
                height={200}
                className="w-full h-full object-contain rounded-lg"
                loading="eager"
              />
            </div>

            {/* Overlay sutil clarificador en la base del QR */}
            <p className="text-[11px] text-zinc-400 font-normal mt-2 text-center">
              Muestra este código al cliente para escanear
            </p>
          </div>
        </div>

        {/* BADGE DE TARIFA: ESMERALDA MINIMALISTA */}
        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-medium px-3.5 py-1.5 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          <span className="font-semibold text-emerald-900">
            {pagoMovil.precioUnitario} {pagoMovil.moneda} por cartón
          </span>
          <span className="text-emerald-700/80 font-normal">
            • Máximo {pagoMovil.maxCartones}
          </span>
        </div>

        {/* TARJETA DE DATOS BANCARIOS (FONDO BLANCO, SOMBRA SUTIL, ALTO CONTRASTE) */}
        <div className="w-full bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-3">
          
          {/* Banco & Titular */}
          <div className="border-b border-zinc-100 pb-2.5">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">
              Banco Receptor
            </span>
            <div className="text-sm font-semibold text-zinc-900 mt-0.5">
              {pagoMovil.banco}
            </div>
            <div className="text-xs text-zinc-500 font-normal mt-0.5">
              Titular: <span className="text-zinc-700">{pagoMovil.titular}</span>
            </div>
          </div>

          {/* Fila: Teléfono con botón Copiar compacto */}
          <div className="flex items-center justify-between bg-zinc-50/70 border border-zinc-200/60 rounded-xl px-3 py-2">
            <div>
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block leading-tight">
                Teléfono
              </span>
              <span className="text-base font-mono font-semibold text-zinc-900 tracking-wide">
                {pagoMovil.telefono}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleCopy('telefono', pagoMovil.telefono)}
              className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition active:scale-95 ${
                copiedField === 'telefono'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold'
                  : 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-200 shadow-sm'
              }`}
            >
              {copiedField === 'telefono' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>

          {/* Fila: Cédula / RIF con botón Copiar compacto */}
          <div className="flex items-center justify-between bg-zinc-50/70 border border-zinc-200/60 rounded-xl px-3 py-2">
            <div>
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block leading-tight">
                Cédula / RIF
              </span>
              <span className="text-sm font-mono font-semibold text-zinc-900 tracking-wide">
                {pagoMovil.cedula}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleCopy('cedula', pagoMovil.cedula)}
              className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition active:scale-95 ${
                copiedField === 'cedula'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold'
                  : 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-200 shadow-sm'
              }`}
            >
              {copiedField === 'cedula' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* =========================================================================
          3. CTA PRINCIPAL + TEXTO DE AYUDA + ACCESO DISCRETO AL ADMIN
          ========================================================================= */}
      <footer className="pt-2 pb-safe shrink-0 space-y-2">
        {/* Botón Principal (54px de altura, Verde Esmeralda Marca, Sombra Sutil) */}
        <button
          type="button"
          onClick={handleTriggerCamera}
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-base tracking-wide rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] flex items-center justify-center gap-2.5 transition active:scale-[0.99] cursor-pointer"
        >
          <Camera className="w-5 h-5 text-white stroke-[2]" />
          <span>Capturar comprobante</span>
        </button>

        {/* Texto de ayuda debajo del CTA */}
        <p className="text-xs text-zinc-500 font-normal text-center">
          Apunta a la pantalla del comprador para validación con IA
        </p>

        {/* ACCESO DISCRETO AL PANEL DE ADMINISTRACIÓN ("de otra manera") */}
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 font-medium py-1 px-2 rounded-lg transition"
          >
            <Lock className="w-3 h-3 text-zinc-400" />
            <span>Acceso Administrativo</span>
          </button>
        </div>
      </footer>

      {/* MODAL DISCRETO PARA ACCESO DE ADMINISTRADOR MEDIANTE PIN */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 w-full max-w-xs shadow-xl animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <span className="text-xs font-semibold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                Acceso Admin
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowAdminModal(false);
                  setAdminPin('');
                }}
                className="text-zinc-400 hover:text-zinc-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdminAccess} className="mt-4 space-y-3">
              <p className="text-xs text-zinc-500">
                Ingrese el código de acceso para entrar a la consola de tarima:
              </p>
              <input
                type="password"
                autoFocus
                placeholder="PIN (2026)"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                className={`w-full h-11 bg-zinc-50 border rounded-xl px-3 text-center text-sm font-mono tracking-widest focus:outline-none transition ${
                  pinError
                    ? 'border-red-400 text-red-600'
                    : 'border-zinc-200 focus:border-emerald-500'
                }`}
              />
              {pinError && (
                <p className="text-[11px] text-red-600 text-center font-medium">
                  PIN incorrecto. Intente de nuevo.
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="flex-1 h-9 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-medium text-white"
                >
                  Entrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
