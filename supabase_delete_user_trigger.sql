-- ====================================================================
-- SQL Script: Trigger para borrar usuario de auth.users al borrar perfil
-- Ejecuta este script en el editor SQL de tu panel de Supabase.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_delete_user()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar el trigger si ya existe
DROP TRIGGER IF EXISTS on_delete_profile ON public.profiles;

-- Crear el trigger
CREATE TRIGGER on_delete_profile
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_delete_user();
