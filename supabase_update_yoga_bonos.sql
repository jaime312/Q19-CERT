-- ====================================================================
-- SQL Script: Configuración del Bono Mensual de Yoga e Invalidez de Saldos de Consultas
-- Ejecuta este script en el editor SQL de tu panel de Supabase.
-- ====================================================================

-- 1. Crear columnas para el bono mensual en la tabla profiles (si no existen)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bono_mensual_activo BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bono_mensual_inicio TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS bono_mensual_fin TIMESTAMP WITH TIME ZONE NULL;

-- 2. Crear columna para identificar reservas de bono mensual en reservas_yoga (si no existe)
ALTER TABLE public.reservas_yoga 
ADD COLUMN IF NOT EXISTS usado_bono_mensual BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Redefinir la función para reservar clases con bonos
CREATE OR REPLACE FUNCTION public.reservar_con_bono(p_clase_id BIGINT, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_tipo_clase TEXT;
    v_capacidad_max INT;
    v_ocupadas INT;
    v_bono_activo BOOLEAN;
    v_bono_inicio TIMESTAMP WITH TIME ZONE;
    v_bono_fin TIMESTAMP WITH TIME ZONE;
    v_clase_fecha TIMESTAMP WITH TIME ZONE;
    v_week_start TIMESTAMP WITH TIME ZONE;
    v_week_end TIMESTAMP WITH TIME ZONE;
    v_week_reservas INT;
    v_month_reservas INT;
    v_user_bonos INT;
    v_reserva_id BIGINT;
    v_horas_limite INT;
BEGIN
    -- 1. Obtener información de la clase
    SELECT tipo_clase, capacidad_max, fecha_inicio 
    INTO v_tipo_clase, v_capacidad_max, v_clase_fecha
    FROM public.clases 
    WHERE id = p_clase_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La clase especificada no existe.';
    END IF;

    -- Verificar horas límite de antelación para la reserva (si no es taller)
    IF v_tipo_clase != 'taller' THEN
        SELECT (valor::INTEGER) INTO v_horas_limite FROM public.configuracion WHERE clave = 'horas_limite_cancelacion';
        IF v_horas_limite IS NOT NULL AND (now() + (v_horas_limite * INTERVAL '1 hour') > v_clase_fecha) THEN
            RAISE EXCEPTION 'No se puede reservar la clase: el límite es de % horas antes del inicio.', v_horas_limite;
        END IF;
    END IF;

    -- 2. Si es un taller (workshop), NO requiere ni descuenta bonos
    IF v_tipo_clase = 'taller' THEN
        -- Verificar aforo
        SELECT COUNT(*) INTO v_ocupadas 
        FROM public.reservas_yoga 
        WHERE clase_id = p_clase_id AND estado = 'confirmada';

        IF v_ocupadas >= v_capacidad_max THEN
            RAISE EXCEPTION 'El aforo de este taller ya está completo.';
        END IF;

        -- Insertar la reserva sin usar bono
        INSERT INTO public.reservas_yoga (clase_id, user_id, estado, usado_bono_mensual)
        VALUES (p_clase_id, p_user_id, 'confirmada', FALSE);
        
        RETURN;
    END IF;

    -- 3. Para clases de yoga normales (yoga)
    -- Verificar si ya tiene una reserva confirmada para esta clase
    SELECT id INTO v_reserva_id 
    FROM public.reservas_yoga 
    WHERE clase_id = p_clase_id AND user_id = p_user_id AND estado = 'confirmada';

    IF FOUND THEN
        RAISE EXCEPTION 'Ya estás inscrito en esta clase.';
    END IF;

    -- Verificar aforo de la clase
    SELECT COUNT(*) INTO v_ocupadas 
    FROM public.reservas_yoga 
    WHERE clase_id = p_clase_id AND estado = 'confirmada';

    IF v_ocupadas >= v_capacidad_max THEN
        RAISE EXCEPTION 'Esta clase está completa.';
    END IF;

    -- Obtener estado de bonos del usuario
    SELECT bono_mensual_activo, bono_mensual_inicio, bono_mensual_fin, bonos 
    INTO v_bono_activo, v_bono_inicio, v_bono_fin, v_user_bonos
    FROM public.profiles 
    WHERE id = p_user_id;

    -- Verificar si tiene bono mensual activo y la clase está dentro del periodo
    IF v_bono_activo = TRUE AND v_clase_fecha >= v_bono_inicio AND v_clase_fecha <= v_bono_fin THEN
        -- Calcular límites semanal y mensual del bono mensual
        -- Semana calendario (Lunes a Domingo) de la fecha de la clase
        v_week_start := date_trunc('week', v_clase_fecha);
        v_week_end := v_week_start + interval '7 days';

        -- Contar reservas hechas con bono mensual en esa semana
        SELECT COUNT(*) INTO v_week_reservas 
        FROM public.reservas_yoga r
        JOIN public.clases c ON r.clase_id = c.id
        WHERE r.user_id = p_user_id 
          AND r.estado = 'confirmada' 
          AND r.usado_bono_mensual = TRUE 
          AND c.fecha_inicio >= v_week_start 
          AND c.fecha_inicio < v_week_end;

        -- Contar reservas hechas con bono mensual en el periodo de validez del bono mensual
        SELECT COUNT(*) INTO v_month_reservas 
        FROM public.reservas_yoga r
        JOIN public.clases c ON r.clase_id = c.id
        WHERE r.user_id = p_user_id 
          AND r.estado = 'confirmada' 
          AND r.usado_bono_mensual = TRUE 
          AND c.fecha_inicio >= v_bono_inicio 
          AND c.fecha_inicio <= v_bono_fin;

        -- Si no excede los límites (max 2 semanales, max 8 mensuales)
        IF v_week_reservas < 2 AND v_month_reservas < 8 THEN
            -- Reservar usando el bono mensual (sin restar saldo individual)
            INSERT INTO public.reservas_yoga (clase_id, user_id, estado, usado_bono_mensual)
            VALUES (p_clase_id, p_user_id, 'confirmada', TRUE);
            RETURN;
        END IF;
    END IF;

    -- Si no tiene bono mensual activo o ha excedido los límites, usar bono individual
    IF v_user_bonos < 1 THEN
        RAISE EXCEPTION 'No tienes saldo suficiente (bonos individuales agotados y límites de bono mensual excedidos o inactivo).';
    END IF;

    -- Restar 1 bono individual
    UPDATE public.profiles 
    SET bonos = v_user_bonos - 1 
    WHERE id = p_user_id;

    -- Insertar reserva con bono individual
    INSERT INTO public.reservas_yoga (clase_id, user_id, estado, usado_bono_mensual)
    VALUES (p_clase_id, p_user_id, 'confirmada', FALSE);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Redefinir la función para cancelar reservas con devolución de bonos
CREATE OR REPLACE FUNCTION public.cancelar_con_bono(p_reserva_id BIGINT)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_clase_id BIGINT;
    v_tipo_clase TEXT;
    v_usado_bono_mensual BOOLEAN;
    v_estado TEXT;
    v_clase_fecha TIMESTAMP WITH TIME ZONE;
    v_horas_limite INT;
BEGIN
    -- 1. Obtener la reserva, su estado y la fecha de inicio de la clase
    SELECT r.user_id, r.clase_id, r.usado_bono_mensual, r.estado, c.fecha_inicio, c.tipo_clase
    INTO v_user_id, v_clase_id, v_usado_bono_mensual, v_estado, v_clase_fecha, v_tipo_clase
    FROM public.reservas_yoga r
    JOIN public.clases c ON r.clase_id = c.id
    WHERE r.id = p_reserva_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La reserva especificada no existe.';
    END IF;

    -- Si la reserva ya estaba cancelada, no hacer nada
    IF v_estado = 'cancelada' THEN
        RETURN;
    END IF;

    -- Verificar horas límite de cancelación (si no es taller)
    IF v_tipo_clase != 'taller' THEN
        SELECT (valor::INTEGER) INTO v_horas_limite FROM public.configuracion WHERE clave = 'horas_limite_cancelacion';
        IF v_horas_limite IS NOT NULL AND (now() + (v_horas_limite * INTERVAL '1 hour') > v_clase_fecha) THEN
            RAISE EXCEPTION 'No se puede cancelar la reserva: el límite es de % horas antes del inicio de la clase.', v_horas_limite;
        END IF;
    END IF;

    -- 3. Devolución de saldos
    -- Si es un taller (workshop), no requiere ni consume bonos, por lo tanto no devuelve nada
    IF v_tipo_clase != 'taller' THEN
        -- Si se usó bono mensual, no se devuelve nada al saldo individual
        -- Si se usó bono individual, devolverlo al saldo individual
        IF v_usado_bono_mensual = FALSE THEN
            UPDATE public.profiles 
            SET bonos = bonos + 1 
            WHERE id = v_user_id;
        END IF;
    END IF;

    -- 4. Borrar la reserva
    DELETE FROM public.reservas_yoga WHERE id = p_reserva_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Eliminar cualquier trigger antiguo en reservas_yoga o profiles que pueda estar buscando la tabla 'reservas' antigua
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN (
        SELECT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'public' 
          AND event_object_table IN ('reservas_yoga', 'profiles')
    ) LOOP
        -- Omitir el trigger legítimo de eliminación de usuario para no romper la funcionalidad de auth
        IF t.trigger_name != 'on_delete_profile' THEN
            EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(t.trigger_name) || ' ON public.' || quote_ident(t.event_object_table) || ';';
        END IF;
    END LOOP;
END $$;
