-- ============================================================
-- Этап 4: прикрепление ссылок на материалы к задачам.
--
-- Таблица card_links хранит только URL — никаких файлов, никакого
-- Storage. link_type определяется на сервере по домену (github /
-- figma / gdrive / video / other) и используется для иконок в UI.
-- board_id денормализован для простого RLS без цепочки join'ов.
--
-- Идемпотентно: безопасно перезапускать.
-- ============================================================

-- ── 1. Таблица ──
create table if not exists card_links (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid references cards(id)       on delete cascade not null,
  board_id   uuid references boards(id)      on delete cascade not null,
  user_id    uuid references auth.users(id)  on delete cascade not null,
  url        text not null,
  title      text,
  link_type  text not null default 'other'
               check (link_type in ('github', 'figma', 'gdrive', 'video', 'other')),
  created_at timestamptz default now() not null
);

-- ── 2. Индекс ──
create index if not exists card_links_card_idx on card_links (card_id);

-- ── 3. RLS ──
alter table card_links enable row level security;

-- Просмотр: любой участник доски.
drop policy if exists "Members can view card links" on card_links;
create policy "Members can view card links" on card_links
  for select using (user_can_access_board(board_id));

-- Добавление: участник доски, user_id = auth.uid().
drop policy if exists "Members can insert own card links" on card_links;
create policy "Members can insert own card links" on card_links
  for insert with check (
    user_id = auth.uid()
    and user_can_access_board(board_id)
  );

-- Удаление: только автор.
drop policy if exists "Authors can delete own card links" on card_links;
create policy "Authors can delete own card links" on card_links
  for delete using (
    user_id = auth.uid()
    and user_can_access_board(board_id)
  );

-- ── 4. Security-definer функция ──
-- Возвращает ссылки с именем добавившего.
-- SECURITY DEFINER нужен для join с profiles (видна только своя строка).
drop function if exists get_card_links(uuid);
create or replace function get_card_links(p_card_id uuid)
returns table (
  id         uuid,
  card_id    uuid,
  board_id   uuid,
  user_id    uuid,
  url        text,
  title      text,
  link_type  text,
  created_at timestamptz,
  full_name  text
)
language sql
security definer
set search_path = public
as $$
  select
    cl.id,
    cl.card_id,
    cl.board_id,
    cl.user_id,
    cl.url,
    cl.title,
    cl.link_type,
    cl.created_at,
    coalesce(p.full_name, u.email) as full_name
  from card_links cl
  join auth.users u  on u.id = cl.user_id
  left join profiles p on p.user_id = cl.user_id
  where cl.card_id = p_card_id
    and user_can_access_board(cl.board_id)
  order by cl.created_at asc;
$$;
