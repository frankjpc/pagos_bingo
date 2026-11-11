-- ==============================================================================
-- SISTEMA DE VALIDACIÓN Y ASIGNACIÓN DE PAGOS - BINGO PWA
-- Next.js 15 + Tailwind CSS + Supabase + Google Gemini 1.5 Flash
-- ==============================================================================

-- 1. TABLA: perfiles (Extensión de Supabase Auth)
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'moderador')) DEFAULT 'moderador',
    telefono_contacto TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. TABLA: lotes_talonarios (Rango físico asignado a cada moderador)
CREATE TABLE IF NOT EXISTS public.lotes_talonarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderador_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    bloque_nombre TEXT NOT NULL, -- ej. 'Talonario Mesa 1 (001 - 100)'
    numero_inicial INT NOT NULL,  -- ej. 1
    numero_final INT NOT NULL,    -- ej. 100
    siguiente_disponible INT NOT NULL, -- Puntero atómico actual
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Integridad del rango de cartones
    CONSTRAINT chk_rango_valido CHECK (numero_final >= numero_inicial),
    CONSTRAINT chk_siguiente_valido CHECK (siguiente_disponible >= numero_inicial AND siguiente_disponible <= numero_final + 1)
);

-- 3. TABLA: ventas_bingo (Registro inmutable de ventas y asignación de cartones)
CREATE TABLE IF NOT EXISTS public.ventas_bingo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderador_id UUID NOT NULL REFERENCES public.perfiles(id),
    lote_id UUID NOT NULL REFERENCES public.lotes_talonarios(id),
    comprador_nombre TEXT NOT NULL,
    banco_origen TEXT NOT NULL,
    referencia TEXT NOT NULL,
    monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
    cantidad_cartones INT NOT NULL CHECK (cantidad_cartones BETWEEN 1 AND 3),
    carton_desde INT NOT NULL,
    carton_hasta INT NOT NULL,
    comprobante_url TEXT,
    estado TEXT NOT NULL CHECK (estado IN ('aprobado', 'anulado')) DEFAULT 'aprobado',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- REQUERIMIENTO CRÍTICO: Prevenir duplicidad de pagos interbancarios
    CONSTRAINT uq_referencia_banco UNIQUE (referencia, banco_origen)
);

-- 4. ÍNDICES DE ALTO RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_ventas_cartones_range 
ON public.ventas_bingo (carton_desde, carton_hasta) 
WHERE estado = 'aprobado';

CREATE INDEX IF NOT EXISTS idx_ventas_moderador ON public.ventas_bingo (moderador_id);
CREATE INDEX IF NOT EXISTS idx_ventas_created_at ON public.ventas_bingo (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lotes_moderador_activo ON public.lotes_talonarios (moderador_id) WHERE activo = true;

-- 5. FUNCIÓN TRANSACCIONAL ATÓMICA CON ROW LOCKING (SELECT ... FOR UPDATE)
CREATE OR REPLACE FUNCTION public.asignar_cartones_moderador(
    p_moderador_id UUID,
    p_comprador_nombre TEXT,
    p_banco_origen TEXT,
    p_referencia TEXT,
    p_monto NUMERIC,
    p_cantidad_cartones INT,
    p_comprobante_url TEXT DEFAULT NULL
)
RETURNS TABLE (
    venta_id UUID,
    carton_desde INT,
    carton_hasta INT,
    restantes INT,
    comprador_nombre TEXT,
    bloque_nombre TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lote lotes_talonarios%ROWTYPE;
    v_desde INT;
    v_hasta INT;
    v_nuevo_siguiente INT;
    v_venta_id UUID;
    v_restantes INT;
    v_clean_ref TEXT;
    v_clean_banco TEXT;
BEGIN
    v_clean_ref := TRIM(p_referencia);
    v_clean_banco := UPPER(TRIM(p_banco_origen));

    IF p_cantidad_cartones < 1 OR p_cantidad_cartones > 3 THEN
        RAISE EXCEPTION 'La cantidad de cartones por compra debe ser entre 1 y 3.';
    END IF;

    IF v_clean_ref = '' OR v_clean_banco = '' THEN
        RAISE EXCEPTION 'Referencia y banco de origen son obligatorios.';
    END IF;

    -- BLOQUEO PESIMISTA ATÓMICO (ROW LEVEL LOCK)
    SELECT * INTO v_lote
    FROM lotes_talonarios
    WHERE moderador_id = p_moderador_id AND activo = true
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El moderador (%) no tiene un lote de talonarios activo asignado.', p_moderador_id;
    END IF;

    v_desde := v_lote.siguiente_disponible;
    v_hasta := v_desde + p_cantidad_cartones - 1;

    -- Validar disponibilidad física de cartones en el lote
    IF v_hasta > v_lote.numero_final THEN
        RAISE EXCEPTION 'LOTE AGOTADO. Cartones restantes: %, solicitados: %', 
            GREATEST(0, (v_lote.numero_final - v_desde + 1)), 
            p_cantidad_cartones;
    END IF;

    v_nuevo_siguiente := v_hasta + 1;
    v_restantes := v_lote.numero_final - v_hasta;

    -- 1. Avanzar puntero correlativo del lote
    UPDATE lotes_talonarios
    SET siguiente_disponible = v_nuevo_siguiente
    WHERE id = v_lote.id;

    -- 2. Insertar venta asociada
    INSERT INTO ventas_bingo (
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
        estado
    ) VALUES (
        p_moderador_id,
        v_lote.id,
        TRIM(p_comprador_nombre),
        v_clean_banco,
        v_clean_ref,
        p_monto,
        p_cantidad_cartones,
        v_desde,
        v_hasta,
        p_comprobante_url,
        'aprobado'
    )
    RETURNING id INTO v_venta_id;

    RETURN QUERY
    SELECT 
        v_venta_id, 
        v_desde, 
        v_hasta, 
        v_restantes, 
        TRIM(p_comprador_nombre),
        v_lote.bloque_nombre;
END;
$$;

-- 6. POLÍTICAS DE ROW LEVEL SECURITY (RLS) - IDEMPOTENTES CON DROP POLICY IF EXISTS
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_talonarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_bingo ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE id = auth.uid() AND rol = 'admin' AND activo = true
    );
$$;

-- Políticas de Perfiles
DROP POLICY IF EXISTS "Lectura de perfiles para usuarios autenticados" ON public.perfiles;
CREATE POLICY "Lectura de perfiles para usuarios autenticados"
ON public.perfiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admin puede gestionar perfiles" ON public.perfiles;
CREATE POLICY "Admin puede gestionar perfiles"
ON public.perfiles FOR ALL
TO authenticated
USING (public.is_admin());

-- Políticas de Lotes
DROP POLICY IF EXISTS "Moderadores ven su propio lote" ON public.lotes_talonarios;
CREATE POLICY "Moderadores ven su propio lote"
ON public.lotes_talonarios FOR SELECT
TO authenticated
USING (moderador_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admin gestiona lotes" ON public.lotes_talonarios;
CREATE POLICY "Admin gestiona lotes"
ON public.lotes_talonarios FOR ALL
TO authenticated
USING (public.is_admin());

-- Políticas de Ventas
DROP POLICY IF EXISTS "Moderador puede ver sus propias ventas o admin ver todas" ON public.ventas_bingo;
CREATE POLICY "Moderador puede ver sus propias ventas o admin ver todas"
ON public.ventas_bingo FOR SELECT
TO authenticated
USING (moderador_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Ventas ejecutadas via stored procedure o admin" ON public.ventas_bingo;
CREATE POLICY "Ventas ejecutadas via stored procedure o admin"
ON public.ventas_bingo FOR INSERT
TO authenticated
WITH CHECK (moderador_id = auth.uid() OR public.is_admin());

-- 7. CONFIGURACIÓN DE SUPABASE REALTIME
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'ventas_bingo'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ventas_bingo;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'lotes_talonarios'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lotes_talonarios;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Realtime publication notice: %', SQLERRM;
END $$;

-- 8. STORAGE BUCKET PARA COMPROBANTES DE PAGO MÓVIL (PROTEGIDO CONTRA ERRORES DE PERMISO)
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'comprobantes', 
        'comprobantes', 
        true, 
        5242880, -- 5MB
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    )
    ON CONFLICT (id) DO UPDATE SET 
        public = true,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
EXCEPTION
    WHEN OTHERS THEN
        -- Si storage.buckets está protegido por RLS en tu proyecto, créalo en Supabase Dashboard > Storage
        RAISE NOTICE 'Bucket comprobantes omitido en script: créalo manualmente en Storage si no existe';
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Comprobantes publicamente accesibles para lectura" ON storage.objects;
    CREATE POLICY "Comprobantes publicamente accesibles para lectura"
    ON storage.objects FOR SELECT
    TO authenticated, anon
    USING (bucket_id = 'comprobantes');

    DROP POLICY IF EXISTS "Moderadores autenticados pueden subir comprobantes" ON storage.objects;
    CREATE POLICY "Moderadores autenticados pueden subir comprobantes"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'comprobantes');
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Políticas de storage.objects omitidas: configurar en Storage > Policies';
END $$;

-- 9. FUNCIÓN DE ANULACIÓN DE VENTAS (TARIMA / ADMIN AUDITORÍA)
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

    UPDATE ventas_bingo
    SET estado = 'anulado'
    WHERE id = p_venta_id;

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
