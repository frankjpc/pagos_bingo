'use server';

import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase/server';

export async function anularVentaBingo(
  ventaId: string,
  motivo: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    if (!ventaId) {
      return { success: false, error: 'ID de venta requerido.' };
    }

    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    const adminId = user?.id || '00000000-0000-0000-0000-000000000000';
    const supabase = await createAdminSupabaseClient();

    const { error } = await supabase.rpc('anular_venta_bingo', {
      p_venta_id: ventaId,
      p_motivo: motivo || 'Anulación solicitada en tarima',
      p_admin_id: adminId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: 'Venta anulada exitosamente en el sistema de auditoría.',
    };
  } catch (err: any) {
    console.error('Error en anularVentaBingo:', err);
    return {
      success: false,
      error: err.message || 'Error del servidor al anular venta.',
    };
  }
}

