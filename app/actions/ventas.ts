'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AsignarCartonesResponse } from '@/lib/types';

export async function registrarVentaYAsignarCartones(
  formData: FormData
): Promise<AsignarCartonesResponse> {
  try {
    const supabase = await createServerSupabaseClient();

    const moderadorId = formData.get('moderador_id') as string;
    const compradorNombre = (formData.get('comprador_nombre') as string)?.trim();
    const bancoOrigen = (formData.get('banco_origen') as string)?.trim().toUpperCase();
    const referencia = (formData.get('referencia') as string)?.trim();
    const monto = parseFloat(formData.get('monto') as string);
    const cantidadCartones = parseInt(formData.get('cantidad_cartones') as string, 10);
    const comprobanteFile = formData.get('comprobante_file') as File | null;

    // Validaciones de entrada
    if (!moderadorId) {
      return { success: false, error: 'Identificador de moderador no proporcionado.' };
    }
    if (!compradorNombre) {
      return { success: false, error: 'El nombre del comprador es obligatorio.' };
    }
    if (!bancoOrigen || !referencia) {
      return { success: false, error: 'El banco y el número de referencia son obligatorios.' };
    }
    if (isNaN(monto) || monto <= 0) {
      return { success: false, error: 'El monto ingresado no es válido.' };
    }
    if (isNaN(cantidadCartones) || cantidadCartones < 1 || cantidadCartones > 3) {
      return { success: false, error: 'Solo se pueden asignar entre 1 y 3 cartones por operación.' };
    }

    // 1. Subida opcional del comprobante físico a Supabase Storage
    let comprobanteUrl: string | null = null;
    if (comprobanteFile && comprobanteFile.size > 0) {
      const fileExt = comprobanteFile.name.split('.').pop() || 'jpg';
      const cleanRef = referencia.replace(/[^a-zA-Z0-9]/g, '');
      const filePath = `receipts/${Date.now()}_${cleanRef}_${bancoOrigen}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('comprobantes')
        .upload(filePath, comprobanteFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from('comprobantes')
          .getPublicUrl(uploadData.path);
        comprobanteUrl = publicUrlData.publicUrl;
      } else {
        console.warn('No se pudo guardar la imagen en Storage, continuando con la asignación:', uploadError);
      }
    }

    // 2. Ejecutar la función atómica en PostgreSQL con SELECT ... FOR UPDATE
    const { data, error } = await supabase.rpc('asignar_cartones_moderador', {
      p_moderador_id: moderadorId,
      p_comprador_nombre: compradorNombre,
      p_banco_origen: bancoOrigen,
      p_referencia: referencia,
      p_monto: monto,
      p_cantidad_cartones: cantidadCartones,
      p_comprobante_url: comprobanteUrl,
    });

    if (error) {
      // Manejo específico del constraint UNIQUE (referencia, banco_origen) -> Código Postgres 23505
      if (error.code === '23505' || error.message.includes('uq_referencia_banco')) {
        return {
          success: false,
          error: `⚠️ PAGO DUPLICADO: La referencia ${referencia} del banco ${bancoOrigen} YA fue registrada en el sistema. Verifique con el cliente o avise al administrador.`,
        };
      }

      if (error.message.includes('LOTE AGOTADO')) {
        return {
          success: false,
          error: `🚫 ${error.message}. Contacte al administrador para reasignar un nuevo talonario.`,
        };
      }

      return {
        success: false,
        error: error.message || 'Error al procesar la reserva atómica en base de datos.',
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'No se recibieron datos de confirmación de los cartones.',
      };
    }

    const resultado = data[0];

    return {
      success: true,
      venta_id: resultado.venta_id,
      carton_desde: resultado.carton_desde,
      carton_hasta: resultado.carton_hasta,
      restantes: resultado.restantes,
      comprador_nombre: resultado.comprador_nombre,
      bloque_nombre: resultado.bloque_nombre,
    };
  } catch (err: any) {
    console.error('Error en registrarVentaYAsignarCartones:', err);
    return {
      success: false,
      error: err.message || 'Error del servidor al registrar la venta.',
    };
  }
}

