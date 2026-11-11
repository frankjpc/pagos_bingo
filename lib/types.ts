export type RolUsuario = 'admin' | 'moderador';

export interface Perfil {
  id: string;
  nombre: string;
  rol: RolUsuario;
  telefono_contacto?: string | null;
  activo: boolean;
  created_at: string;
}

export interface LoteTalonario {
  id: string;
  moderador_id: string;
  bloque_nombre: string;
  numero_inicial: number;
  numero_final: number;
  siguiente_disponible: number;
  activo: boolean;
  created_at: string;
}

export interface VentaBingo {
  id: string;
  moderador_id: string;
  lote_id: string;
  comprador_nombre: string;
  banco_origen: string;
  referencia: string;
  monto: number;
  cantidad_cartones: number;
  carton_desde: number;
  carton_hasta: number;
  comprobante_url?: string | null;
  estado: 'aprobado' | 'anulado';
  created_at: string;
  perfiles?: {
    nombre: string;
  };
}

export interface OCRReceiptResult {
  banco_origen: string;
  referencia: string;
  monto: number;
  telefono_origen?: string;
  fecha_hora?: string;
  confianza?: 'alta' | 'media' | 'baja';
}

export interface AsignarCartonesResponse {
  success: boolean;
  venta_id?: string;
  carton_desde?: number;
  carton_hasta?: number;
  restantes?: number;
  comprador_nombre?: string;
  bloque_nombre?: string;
  error?: string;
}

export interface ModeradorStats {
  moderador_id: string;
  moderador_nombre: string;
  bloque_nombre: string;
  numero_inicial: number;
  numero_final: number;
  siguiente_disponible: number;
  total_lote: number;
  cartones_vendidos: number;
  cartones_restantes: number;
  monto_total_recaudado: number;
}

