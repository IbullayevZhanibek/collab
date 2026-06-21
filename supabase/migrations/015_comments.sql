-- ============================================================
-- Этап 3: комментарии к задачам и обратная связь преподавателя.
--
-- Таблица comments уже существует (001_init.sql). Здесь:
--   1. Добавляем поле is_feedback.
--   2. Заменяем широкую политику "Members can manage comments"
--      на точечные: insert (свой user_id) + update/delete (автор).
--   3. Индекс по (card_id, created_at).
--   4. Security-definer функция get_card_comments — возвращает
--      комментарии с именем/аватаром/ролью автора.
--
-- Идемпотентно: безопасно перезапускать.
-- ============================================================

-- ── 1. Поле is_feedback ──
alter table comments
  add column if not exists is_feedback boolean not null default false;

-- ── 2. RLS-политики ──
-- Удаляем старую широкую политику (любой участник мог менять/удалять
-- чужие комментарии).
drop policy if exists "Members can manage comments" on comments;

-- Вставка: только участник доски, user_id должен совпадать с auth.uid().
drop policy if exists "Members can insert own comments" on comments;
create policy "Members can insert own comments" on comments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from cards ca
      join columns col on col.id = ca.column_id
      where ca.id = card_id
        and user_can_access_board(col.board_id)
    )
  );

-- Изменение: только автор комментария (и участник доски).
drop policy if exists "Authors can update own comments" on comments;
create policy "Authors can update own comments" on comments
  for update using (
    user_id = auth.uid()
    and exists (
      select 1 from cards ca
      join columns col on col.id = ca.column_id
      where ca.id = card_id
        and user_can_access_board(col.board_id)
    )
  );

-- Удаление: только автор комментария (и участник доски).
drop policy if exists "Authors can delete own comments" on comments;
create policy "Authors can delete own comments" on comments
  for delete using (
    user_id = auth.uid()
    and exists (
      select 1 from cards ca
      join columns col on col.id = ca.column_id
      where ca.id = card_id
        and user_can_access_board(col.board_id)
    )
  );

-- ── 3. Индекс ──
create index if not exists comments_card_created_idx
  on comments (card_id, created_at);

-- ── 4. Security-definer функция ──
-- Возвращает комментарии к карточке вместе с данными авторов.
-- SECURITY DEFINER чтобы обойти RLS при join с profiles и board_members
-- (profiles visible только владельцу). Доступ проверяется вручную
-- через user_can_access_board.
drop function if exists get_card_comments(uuid);
create or replace function get_card_comments(p_card_id uuid)
returns table (
  id          uuid,
  card_id     uuid,
  user_id     uuid,
  body        text,
  is_feedback boolean,
  created_at  timestamptz,
  full_name   text,
  avatar_url  text,
  global_role text,
  team_role   text
)
language sql
security definer
set search_path = public
as $$
  select
    cm.id,
    cm.card_id,
    cm.user_id,
    cm.body,
    cm.is_feedback,
    cm.created_at,
    coalesce(p.full_name, u.email)    as full_name,
    p.avatar_url,
    coalesce(p.global_role, 'student') as global_role,
    bm.team_role
  from comments cm
  join cards   ca  on ca.id  = cm.card_id
  join columns col on col.id = ca.column_id
  join auth.users u  on u.id  = cm.user_id
  left join profiles     p  on p.user_id  = cm.user_id
  left join board_members bm on bm.board_id = col.board_id
                             and bm.user_id  = cm.user_id
  where cm.card_id = p_card_id
    and user_can_access_board(col.board_id)
  order by cm.created_at asc;
$$;
