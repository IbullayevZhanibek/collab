-- ============================================================
-- Приглашения на доску.
-- Раньше владелец сразу добавлял пользователя в board_members.
-- Теперь это двухшаговый флоу: владелец отправляет приглашение →
-- приглашённый принимает или отклоняет его. В участники доски
-- пользователь попадает только после принятия приглашения.
-- ============================================================

-- Хелпер: проверка владельца доски без обращения к RLS.
-- Уже создаётся в 001/002, но дублируем здесь через create or replace,
-- чтобы 006 можно было применить независимо (RLS-политики ниже её используют).
create or replace function is_board_owner(bid uuid)
returns boolean language sql security definer as $$
  select exists (select 1 from boards where id = bid and owner_id = auth.uid());
$$;

create table board_invitations (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade not null,
  inviter_id uuid references auth.users(id) on delete cascade not null,
  invitee_id uuid references auth.users(id) on delete cascade not null,
  status text not null check (status in ('pending', 'accepted', 'declined')) default 'pending',
  created_at timestamptz default now() not null,
  unique(board_id, invitee_id) -- нельзя пригласить одного пользователя дважды
);

alter table board_invitations enable row level security;

-- ── RLS политики ──

-- Приглашённый видит свои приглашения...
create policy "Invitees can view their invitations" on board_invitations
  for select using (invitee_id = auth.uid());

-- ...и может менять их статус (принять / отклонить).
create policy "Invitees can update their invitations" on board_invitations
  for update using (invitee_id = auth.uid())
  with check (invitee_id = auth.uid());

-- Владелец доски видит приглашения своей доски.
create policy "Owners can view board invitations" on board_invitations
  for select using (is_board_owner(board_id));

-- Владелец доски может создавать приглашения...
create policy "Owners can create invitations" on board_invitations
  for insert with check (is_board_owner(board_id) and inviter_id = auth.uid());

-- ...и удалять (отозвать приглашение).
create policy "Owners can delete invitations" on board_invitations
  for delete using (is_board_owner(board_id));

-- ── Функции (security definer, чтобы читать auth.users / чужие profiles) ──

-- Входящие pending-приглашения текущего пользователя
-- с названием доски и именем пригласившего.
create or replace function get_my_invitations()
returns table (
  id uuid,
  board_id uuid,
  board_title text,
  inviter_name text,
  created_at timestamptz
) language sql security definer as $$
  select
    i.id,
    i.board_id,
    b.title                                  as board_title,
    coalesce(p.full_name, u.email)           as inviter_name,
    i.created_at
  from board_invitations i
  join boards b      on b.id = i.board_id
  join auth.users u  on u.id = i.inviter_id
  left join profiles p on p.user_id = i.inviter_id
  where i.invitee_id = auth.uid()
    and i.status = 'pending'
  order by i.created_at desc;
$$;

-- Приглашения конкретной доски (для владельца) с инфо о приглашённом.
create or replace function get_board_invitations(bid uuid)
returns table (
  id uuid,
  invitee_id uuid,
  full_name text,
  email text,
  status text,
  created_at timestamptz
) language sql security definer as $$
  select
    i.id,
    i.invitee_id,
    coalesce(p.full_name, u.email) as full_name,
    u.email,
    i.status,
    i.created_at
  from board_invitations i
  join auth.users u  on u.id = i.invitee_id
  left join profiles p on p.user_id = i.invitee_id
  where i.board_id = bid
    and is_board_owner(bid)
  order by i.created_at desc;
$$;

-- Принятие приглашения: помечает accepted и добавляет пользователя
-- в board_members с ролью member. Делается одной security-definer
-- функцией, т.к. RLS на board_members разрешает вставку только владельцу,
-- а здесь участника добавляет сам приглашённый.
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
end;
$$;
