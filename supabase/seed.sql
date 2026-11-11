-- ==============================================================================
-- SCRIPT DE SEMILLA PARA EVENTO DE BINGO (2 MODERADORES + 1 ADMIN)
-- ==============================================================================

-- 1. CREACIÓN DE USUARIOS EN AUTH.USERS (Contraseña común para taquilla: 'bingo2026')
-- NOTA: En Supabase, las contraseñas usan bcrypt. Este hash corresponde a 'bingo2026'
DO $$
DECLARE
    v_admin_id UUID := '00000000-0000-0000-0000-000000000000';
    v_mod_ids UUID[] := ARRAY[
        '00000000-0000-0000-0000-000000000001'::UUID,
        '00000000-0000-0000-0000-000000000002'::UUID
    ];
    v_mod_nombres TEXT[] := ARRAY[
        'Mesa 1 - Ana Morales',
        'Mesa 2 - Carlos Pérez'
    ];
    i INT;
BEGIN
    -- Crear / Actualizar Administrador
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
    VALUES (
        v_admin_id,
        'admin@bingo.local',
        crypt('admin2026', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"nombre":"Administrador General"}'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.perfiles (id, nombre, rol, activo)
    VALUES (v_admin_id, 'Administrador Tarima & Auditoría', 'admin', true)
    ON CONFLICT (id) DO UPDATE SET rol = 'admin', activo = true;

    -- Desactivar lotes/perfiles heredados (mesas 3..7) si existieran de una corrida anterior
    UPDATE public.lotes_talonarios
    SET activo = false
    WHERE moderador_id IN (
        '00000000-0000-0000-0000-000000000003'::UUID,
        '00000000-0000-0000-0000-000000000004'::UUID,
        '00000000-0000-0000-0000-000000000005'::UUID,
        '00000000-0000-0000-0000-000000000006'::UUID,
        '00000000-0000-0000-0000-000000000007'::UUID
    );
    UPDATE public.perfiles
    SET activo = false
    WHERE id IN (
        '00000000-0000-0000-0000-000000000003'::UUID,
        '00000000-0000-0000-0000-000000000004'::UUID,
        '00000000-0000-0000-0000-000000000005'::UUID,
        '00000000-0000-0000-0000-000000000006'::UUID,
        '00000000-0000-0000-0000-000000000007'::UUID
    );

    -- Crear los 2 Moderadores y asignar sus lotes físicos correlativos
    FOR i IN 1..2 LOOP
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
        VALUES (
            v_mod_ids[i],
            format('moderador%s@bingo.local', i),
            crypt('bingo2026', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            json_build_object('nombre', v_mod_nombres[i])
        )
        ON CONFLICT (id) DO NOTHING;

        -- Perfil público
        INSERT INTO public.perfiles (id, nombre, rol, activo)
        VALUES (v_mod_ids[i], v_mod_nombres[i], 'moderador', true)
        ON CONFLICT (id) DO UPDATE SET nombre = v_mod_nombres[i], rol = 'moderador', activo = true;

        -- Talonario físico: 100 cartones por cada moderador
        -- Mesa 1: 1 al 100
        -- Mesa 2: 101 al 200
        INSERT INTO public.lotes_talonarios (
            moderador_id,
            bloque_nombre,
            numero_inicial,
            numero_final,
            siguiente_disponible,
            activo
        )
        VALUES (
            v_mod_ids[i],
            format('Talonario Mesa %s (%s - %s)', i, LPAD((((i - 1) * 100) + 1)::TEXT, 3, '0'), LPAD((i * 100)::TEXT, 3, '0')),
            ((i - 1) * 100) + 1,
            i * 100,
            ((i - 1) * 100) + 1,
            true
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

