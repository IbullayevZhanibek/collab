-- ============================================================
-- Лог активности доски: кто что делал.
-- Каждое значимое действие (создание/перемещение/удаление карточек
-- и колонок, присоединение участника) пишется отдельной строкой.
-- ============================================================

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null, -- 'card_created' | 'card_moved' | 'card_deleted' | 'column_created' | 'column_deleted' | 'member_joined'
  details jsonb,        -- доп. данные: название карточки, откуда/куда перемещена и т.д.
  created_at timestamptz default now() not null
);

-- Быстрая выборка последних действий доски.
create index activity_log_board_created_idx
  on activity_log (board_id, created_at desc);

alter table activity_log enable row level security;

-- ── RLS политики ──

-- Любой участник доски может читать её лог.
create policy "Board members can read activity" on activity_log
  for select using (user_can_access_board(board_id));

-- Любой участник доски может писать в лог (через свои действия).
create policy "Board members can insert activity" on activity_log
  for insert with check (user_can_access_board(board_id));

-- ── Чтение лога с именем пользователя ──
-- profiles/auth.users скрыты RLS, поэтому имя автора достаём через
-- security-definer функцию (как get_board_members_with_info).
create or replace function get_activity_log(bid uuid, lmt int default 50)
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  action text,
  details jsonb,
  created_at timestamptz
) language sql security definer as $$
  select
    a.id,
    a.user_id,
    coalesce(p.full_name, u.email) as full_name,
    u.email,
    a.action,
    a.details,
    a.created_at
  from activity_log a
  left join auth.users u  on u.id = a.user_id
  left join profiles p    on p.user_id = a.user_id
  where a.board_id = bid
    and user_can_access_board(bid)
  order by a.created_at desc
  limit lmt;
$$;

-- ── Логирование присоединения участника ──
-- accept_invitation (см. 006) выполняется как security definer и сам
-- добавляет участника, поэтому запись в лог делаем прямо в ней —
-- надёжнее, чем из Server Action.
create or replace function accept_invitation(inv_id uuid)
returns void language plpgsql security definer as $$
declare
  inv board_invitations%rowtype;
begin
  select * into inv
  from board_invitations
  where id = inv_id and invitee_id = auth.uid() and status = 'pending';

  if not found then
    raise exception 'Приглашение не найдено';
  end if;

  update board_invitations set status = 'accepted' where id = inv_id;

  insert into board_members (board_id, user_id, role)
  values (inv.board_id, inv.invitee_id, 'member')
  on conflict (board_id, user_id) do nothing;

  insert into activity_log (board_id, user_id, action)
  values (inv.board_id, inv.invitee_id, 'member_joined');
end;
$$;
