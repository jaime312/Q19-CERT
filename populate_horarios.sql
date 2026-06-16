-- ====================================================================
-- SQL Script: Creación Masiva de Horarios y Profesores en Supabase
-- Ejecuta este script en el editor SQL de tu panel de Supabase.
-- ====================================================================

DO $$
DECLARE
    v_angel_id BIGINT;
    v_yanira_id BIGINT;
    v_silvia_id BIGINT;
    w INT;
    v_monday DATE := '2026-06-15'::DATE;
BEGIN
    -- 1. Crear los profesores si no existen
    INSERT INTO public.profesionales (nombre, email, especialidad, color, descripcion)
    SELECT 'Ángel', 'angel@genyoga.es', 'Yoga para hombres & Yoga terapéutico', '#3B82F6', 'Profesor de Yoga especializado en Yoga para hombres y Yoga terapéutico.'
    WHERE NOT EXISTS (SELECT 1 FROM public.profesionales WHERE email = 'angel@genyoga.es');

    INSERT INTO public.profesionales (nombre, email, especialidad, color, descripcion)
    SELECT 'Yanira', 'yanira@genyoga.es', 'Vinyasa & Restaurativa', '#DB2777', 'Profesora de Yoga especializada en Vinyasa, Power Vinyasa y Yoga Restaurativo.'
    WHERE NOT EXISTS (SELECT 1 FROM public.profesionales WHERE email = 'yanira@genyoga.es');

    -- Obtener los IDs de los profesores
    SELECT id INTO v_angel_id FROM public.profesionales WHERE email = 'angel@genyoga.es';
    SELECT id INTO v_yanira_id FROM public.profesionales WHERE email = 'yanira@genyoga.es';
    SELECT id INTO v_silvia_id FROM public.profesionales WHERE nombre ILIKE '%Silvia%';
    
    -- Fallback por si Silvia no se encontrase por nombre
    IF v_silvia_id IS NULL THEN
        v_silvia_id := 1;
    END IF;

    -- 2. Crear los tipos de clases si no existen
    INSERT INTO public.tipos_clases (nombre, duracion_predeterminada, color, icono, orden, activo)
    VALUES
    ('Power Vinyasa', 60, '#E07A5F', 'ph-person-simple-tai-chi', 0, true),
    ('Vinyasa', 60, '#EC4899', 'ph-person-simple-tai-chi', 0, true),
    ('Yoga Restaurativa o Suave', 60, '#8B5CF6', 'ph-person-simple-tai-chi', 0, true),
    ('Yoga para Hombres', 90, '#3B82F6', 'ph-person-simple-tai-chi', 0, true),
    ('Yoga Terapéutico', 90, '#2563EB', 'ph-person-simple-tai-chi', 0, true),
    ('Clase Especial (Taller)', 60, '#F97316', 'ph-chalkboard-teacher', 0, true),
    ('Yoga (Silvia) Consultas', 120, '#D27D60', 'ph-person-simple-tai-chi', 0, true)
    ON CONFLICT (nombre) DO NOTHING;

    -- 3. Crear las clases recurrentes para 12 semanas (de la semana del 15 de junio al 6 de septiembre de 2026)
    FOR w IN 0..11 LOOP
        -- LUNES
        -- 18:00 - 19:30: Yoga para hombres (Angel)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Yoga para Hombres', 'yoga', (v_monday + (w * 7) + '18:00:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + '19:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', 90, 10, v_angel_id, true, 0);
        
        -- 19:30 - 21:00: Yoga terapéutico (Angel)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Yoga Terapéutico', 'yoga', (v_monday + (w * 7) + '19:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + '21:00:00'::TIME) AT TIME ZONE 'Europe/Madrid', 90, 10, v_angel_id, true, 0);

        -- MARTES
        -- 07:00 - 08:00: Power Vinyasa (Yanira)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Power Vinyasa', 'yoga', (v_monday + (w * 7) + 1 + '07:00:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 1 + '08:00:00'::TIME) AT TIME ZONE 'Europe/Madrid', 60, 10, v_yanira_id, true, 0);

        -- 09:15 - 10:15: Vinyasa (Yanira)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Vinyasa', 'yoga', (v_monday + (w * 7) + 1 + '09:15:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 1 + '10:15:00'::TIME) AT TIME ZONE 'Europe/Madrid', 60, 10, v_yanira_id, true, 0);

        -- 19:30 - 21:00: Vinyasa (Yanira)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Vinyasa', 'yoga', (v_monday + (w * 7) + 1 + '19:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 1 + '21:00:00'::TIME) AT TIME ZONE 'Europe/Madrid', 90, 10, v_yanira_id, true, 0);

        -- MIÉRCOLES
        -- 09:15 - 10:15: Vinyasa (Yanira)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Vinyasa', 'yoga', (v_monday + (w * 7) + 2 + '09:15:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 2 + '10:15:00'::TIME) AT TIME ZONE 'Europe/Madrid', 60, 10, v_yanira_id, true, 0);

        -- 10:30 - 11:30: Yoga restaurativa o suave (Yanira)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Yoga Restaurativa o Suave', 'yoga', (v_monday + (w * 7) + 2 + '10:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 2 + '11:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', 60, 10, v_yanira_id, true, 0);

        -- 18:00 - 19:30: Yoga para hombres (Angel)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Yoga para Hombres', 'yoga', (v_monday + (w * 7) + 2 + '18:00:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 2 + '19:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', 90, 10, v_angel_id, true, 0);

        -- 19:30 - 21:00: Yoga terapéutico (Angel)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Yoga Terapéutico', 'yoga', (v_monday + (w * 7) + 2 + '19:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 2 + '21:00:00'::TIME) AT TIME ZONE 'Europe/Madrid', 90, 10, v_angel_id, true, 0);

        -- JUEVES
        -- 07:00 - 08:00: Vinyasa (Yanira)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Vinyasa', 'yoga', (v_monday + (w * 7) + 3 + '07:00:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 3 + '08:00:00'::TIME) AT TIME ZONE 'Europe/Madrid', 60, 10, v_yanira_id, true, 0);

        -- 09:15 - 10:15: Vinyasa (Yanira)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Vinyasa', 'yoga', (v_monday + (w * 7) + 3 + '09:15:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 3 + '10:15:00'::TIME) AT TIME ZONE 'Europe/Madrid', 60, 10, v_yanira_id, true, 0);

        -- 19:30 - 21:00: Vinyasa (Yanira)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Vinyasa', 'yoga', (v_monday + (w * 7) + 3 + '19:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 3 + '21:00:00'::TIME) AT TIME ZONE 'Europe/Madrid', 90, 10, v_yanira_id, true, 0);

        -- VIERNES
        -- 09:15 - 10:15: Vinyasa (Yanira)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Vinyasa', 'yoga', (v_monday + (w * 7) + 4 + '09:15:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 4 + '10:15:00'::TIME) AT TIME ZONE 'Europe/Madrid', 60, 10, v_yanira_id, true, 0);

        -- 10:30 - 11:30: Yoga restaurativa o suave (Yanira)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Yoga Restaurativa o Suave', 'yoga', (v_monday + (w * 7) + 4 + '10:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 4 + '11:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', 60, 10, v_yanira_id, true, 0);

        -- 18:00 - 19:30: Yoga terapéutico (Angel)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Yoga Terapéutico', 'yoga', (v_monday + (w * 7) + 4 + '18:00:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 4 + '19:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', 90, 10, v_angel_id, true, 0);

        -- 19:30 - 21:00: Yoga terapéutico (Angel)
        INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
        VALUES ('Yoga Terapéutico', 'yoga', (v_monday + (w * 7) + 4 + '19:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 4 + '21:00:00'::TIME) AT TIME ZONE 'Europe/Madrid', 90, 10, v_angel_id, true, 0);

        -- Clases quincenales (Viernes alternos) - Semanas 1, 3, 5, 7, 9, 11
        IF w % 2 = 0 THEN
            -- 11:30 - 13:30: Yoga (Silvia) Consultas (2 horas)
            INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
            VALUES ('Yoga (Silvia) Consultas', 'yoga', (v_monday + (w * 7) + 4 + '11:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 4 + '13:30:00'::TIME) AT TIME ZONE 'Europe/Madrid', 120, 10, v_silvia_id, true, 0);

            -- 16:45 - 18:00: Clase Especial (Taller) (Yanira)
            INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
            VALUES ('Clase Especial (Taller)', 'taller', (v_monday + (w * 7) + 4 + '16:45:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 4 + '18:00:00'::TIME) AT TIME ZONE 'Europe/Madrid', 75, 10, v_yanira_id, true, 0);
        ELSE
            -- Clases quincenales (Sábados alternos) - Semanas 2, 4, 6, 8, 10, 12
            -- 09:15 - 10:15: Clase Especial (Taller) (Yanira)
            INSERT INTO public.clases (nombre, tipo_clase, fecha_inicio, fecha_fin, duracion_minutos, capacidad_max, profesor_id, activa, plazas_reservadas)
            VALUES ('Clase Especial (Taller)', 'taller', (v_monday + (w * 7) + 5 + '09:15:00'::TIME) AT TIME ZONE 'Europe/Madrid', (v_monday + (w * 7) + 5 + '10:15:00'::TIME) AT TIME ZONE 'Europe/Madrid', 60, 10, v_yanira_id, true, 0);
        END IF;

    END LOOP;
END $$;
