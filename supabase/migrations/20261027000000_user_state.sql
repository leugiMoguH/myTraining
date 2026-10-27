create table if not exists public.user_state (
  user_id uuid primary key, rev bigint not null check (rev > 0),
  schema_v integer not null check (schema_v > 0), state text not null check (octet_length(state) < 8388608),
  state_hash text not null, push_id uuid not null, device_id text not null, updated_at timestamptz not null default now()
);
create table if not exists public.user_state_history (
  user_id uuid not null, rev bigint not null, schema_v integer not null,
  state text not null check (octet_length(state) < 8388608), state_hash text not null,
  push_id uuid not null, device_id text not null, updated_at timestamptz not null,
  primary key (user_id, rev)
);
alter table public.user_state enable row level security;
alter table public.user_state_history enable row level security;
revoke all on public.user_state, public.user_state_history from public, anon, authenticated;
grant select, insert, update, delete on public.user_state to authenticated;
grant select on public.user_state_history to authenticated;
drop policy if exists state_select on public.user_state;
create policy state_select on public.user_state for select to authenticated using (auth.uid() = user_id);
drop policy if exists state_insert on public.user_state;
create policy state_insert on public.user_state for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists state_update on public.user_state;
create policy state_update on public.user_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists state_delete on public.user_state;
create policy state_delete on public.user_state for delete to authenticated using (auth.uid() = user_id);
drop policy if exists history_select on public.user_state_history;
create policy history_select on public.user_state_history for select to authenticated using (auth.uid() = user_id);
create or replace function public.sync_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    if new.rev <> 1 then raise exception 'initial rev must be 1'; end if;
  else
    if new.user_id <> old.user_id then raise exception 'immutable user_id'; end if;
    if new.rev < old.rev then raise exception 'revision cannot decrease'; end if;
    new.rev := old.rev + 1;
  end if;
  new.updated_at := now();
  return new;
end $$;
create or replace function public.sync_archive() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    delete from public.user_state_history where user_id = old.user_id;
    return old;
  end if;
  insert into public.user_state_history (user_id,rev,schema_v,state,state_hash,push_id,device_id,updated_at)
    values (old.user_id,old.rev,old.schema_v,old.state,old.state_hash,old.push_id,old.device_id,old.updated_at);
  return new;
end $$;
revoke all on function public.sync_guard(), public.sync_archive() from public, anon, authenticated;
drop trigger if exists sync_guard on public.user_state;
create trigger sync_guard before insert or update on public.user_state for each row execute function public.sync_guard();
drop trigger if exists sync_archive on public.user_state;
create trigger sync_archive after update or delete on public.user_state for each row execute function public.sync_archive();
