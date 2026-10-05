-- Run as the Supabase migration owner after the secret-safe provisioning command.
-- This file never creates or stores credentials. Re-run it after migrations add
-- application tables, or use `npm run provision:runtime-role` to apply both role
-- attributes and these grants atomically.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bus_tracker_runtime') THEN
    RAISE EXCEPTION 'Create the bus_tracker_runtime login role before applying runtime policies';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE postgres TO bus_tracker_runtime;
GRANT USAGE ON SCHEMA public TO bus_tracker_runtime;
REVOKE CREATE ON SCHEMA public FROM bus_tracker_runtime;

DO $$
DECLARE
  table_name text;
  sequence_name text;
BEGIN
  FOR table_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO bus_tracker_runtime',
      table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS bus_tracker_runtime_all ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS bus_tracker_runtime_select ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS bus_tracker_runtime_insert ON public.%I', table_name);
    IF table_name = 'AdminAuditLog' THEN
      EXECUTE format(
        'CREATE POLICY bus_tracker_runtime_select ON public.%I FOR SELECT TO bus_tracker_runtime USING (true)',
        table_name
      );
      EXECUTE format(
        'CREATE POLICY bus_tracker_runtime_insert ON public.%I FOR INSERT TO bus_tracker_runtime WITH CHECK (true)',
        table_name
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY bus_tracker_runtime_all ON public.%I FOR ALL TO bus_tracker_runtime USING (true) WITH CHECK (true)',
        table_name
      );
    END IF;
  END LOOP;

  FOR sequence_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE public.%I TO bus_tracker_runtime',
      sequence_name
    );
  END LOOP;
END
$$;

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public."AdminAuditLog" FROM bus_tracker_runtime;
REVOKE ALL ON TABLE public."_prisma_migrations" FROM bus_tracker_runtime;
