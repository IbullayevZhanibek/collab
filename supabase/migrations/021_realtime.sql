-- Enable Supabase Realtime for all tables used by the board live-update feature.
-- Using a DO block so the statement is idempotent (safe to run more than once).
set search_path = public;

do $$
declare
  t text;
begin
  foreach t in array array['cards', 'columns', 'project_stages', 'comments', 'card_links']
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
