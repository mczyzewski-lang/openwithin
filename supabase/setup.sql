-- Run once in the Supabase SQL editor after `npm run db:migrate`.
-- The app talks to Postgres through a server-side connection (DATABASE_URL) and never
-- exposes tables through PostgREST. Enabling RLS without policies denies all access via
-- the anon/authenticated API roles, so a leaked anon key cannot read user data.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- Private audio bucket (no public URLs; the app issues short-lived signed URLs).
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do update set public = false;
