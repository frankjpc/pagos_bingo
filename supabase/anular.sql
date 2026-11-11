-- ==============================================================================
-- EXTENSIÓN: FUNCIÓN PARA ANULAR VENTA DE BINGO (AUDITORÍA & TARIMA)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.anular_venta_bingo(
    p_venta_id UUID,
    p_motivo TEXT,
    p_admin_id UUID
)
RETURNS TABLE (
    venta_id UUID,
    estado_anterior TEXT,
    estado_nuevo TEXT,
    carton_desde INT,
    carton_hasta INT,
    comprador_nombre TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_venta ventas_bingo%ROWTYPE;
BEGIN
    -- Validar que la venta exista y esté aprobada
    SELECT * INTO v_venta
    FROM ventas_bingo
    WHERE id = p_venta_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venta con ID % no encontrada.', p_venta_id;
    END IF;

    IF v_venta.estado = 'anulado' THEN
        RAISE EXCEPTION 'La venta ya se encuentra anulada previamente.';
    END IF;

    -- Marcar la venta como anulada
    UPDATE ventas_bingo
    SET estado = 'anulado'
    WHERE id = p_venta_id;

    -- NOTA DE NEGOCIO: Los cartones físicos que ya fueron desprendidos NO se
    -- reincorporan al talonario correlativo para evitar confusión física con los
    -- cartones que ya están circulando en el salón. Quedan marcados como anulados.

    RETURN QUERY
    SELECT 
        v_venta.id, 
        v_venta.estado, 
        'anulado'::TEXT, 
        v_venta.carton_desde, 
        v_venta.carton_hasta, 
        v_venta.comprador_nombre;
END;
$$;

