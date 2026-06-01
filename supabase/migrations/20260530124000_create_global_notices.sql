-- ============================================================================
-- Bolao Suprema - H4 remediation follow-up: global_notices em DBs existentes
-- ----------------------------------------------------------------------------
-- A tabela tambem foi adicionada em 20260522034500 para permitir replay limpo,
-- mas bancos que ja aplicaram aquela migration nao executam edicoes retroativas.
-- Esta migration nova garante que staging/producao recebam o objeto no db push.
-- ============================================================================

create table if not exists public.global_notices (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.global_notices enable row level security;

drop policy if exists notices_select_all on public.global_notices;
create policy notices_select_all on public.global_notices
  for select to authenticated using (true);

drop policy if exists notices_admin_insert on public.global_notices;
create policy notices_admin_insert on public.global_notices
  for insert to authenticated
  with check (public.is_admin((select auth.uid())));

drop policy if exists notices_admin_update on public.global_notices;
create policy notices_admin_update on public.global_notices
  for update to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

drop policy if exists notices_admin_delete on public.global_notices;
create policy notices_admin_delete on public.global_notices
  for delete to authenticated
  using (public.is_admin((select auth.uid())));

create index if not exists idx_global_notices_created_by
  on public.global_notices(created_by);

create index if not exists idx_global_notices_created_at
  on public.global_notices(created_at desc);
