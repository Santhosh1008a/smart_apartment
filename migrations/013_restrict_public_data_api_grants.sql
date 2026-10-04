-- The application uses its trusted Node/PostgreSQL API for business data.
-- Browser clients use Supabase Storage only, so the Supabase Data API roles
-- must not receive table, sequence, or RPC privileges by default.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

-- Pin helper-function lookup paths to prevent object-shadowing attacks.
DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.update_updated_at() SET search_path = pg_catalog, public, pg_temp;
  END IF;
  IF to_regprocedure('public.jwt_user_id()') IS NOT NULL THEN
    ALTER FUNCTION public.jwt_user_id() SET search_path = pg_catalog, public, pg_temp;
  END IF;
  IF to_regprocedure('public.jwt_role()') IS NOT NULL THEN
    ALTER FUNCTION public.jwt_role() SET search_path = pg_catalog, public, pg_temp;
  END IF;
  IF to_regprocedure('public.jwt_complex_id()') IS NOT NULL THEN
    ALTER FUNCTION public.jwt_complex_id() SET search_path = pg_catalog, public, pg_temp;
  END IF;
END $$;
