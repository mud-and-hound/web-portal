create schema if not exists private;

create table private.portal_admins (
  email text primary key check (email = lower(email))
);
revoke all on private.portal_admins from public, anon, authenticated;

create function public.is_portal_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    join private.portal_admins a on a.email = lower(u.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_portal_admin() from public, anon;
grant execute on function public.is_portal_admin() to authenticated;

create table public.portal_links (
  id bigint generated always as identity primary key,
  title text not null check (length(trim(title)) between 1 and 100),
  description text not null default '' check (length(description) <= 240),
  url text check (length(url) <= 2000 and url ~* '^https?://[^/ ]'),
  hidden boolean not null default false,
  position integer not null default 100,
  check (hidden or url is not null)
);
alter table public.portal_links enable row level security;
revoke all on public.portal_links from public, anon, authenticated;
grant select on public.portal_links to anon, authenticated;
grant insert (title, description, url), update (title, description, url, hidden)
  on public.portal_links to authenticated;
grant usage on sequence public.portal_links_id_seq to authenticated;

create policy public_links on public.portal_links for select to anon, authenticated using (not hidden);
create policy admin_links on public.portal_links for select to authenticated using ((select public.is_portal_admin()));
create policy admin_insert on public.portal_links for insert to authenticated with check ((select public.is_portal_admin()));
create policy admin_update on public.portal_links for update to authenticated
  using ((select public.is_portal_admin())) with check ((select public.is_portal_admin()));
