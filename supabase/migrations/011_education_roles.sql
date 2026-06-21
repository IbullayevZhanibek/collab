-- ============================================================
-- Образовательный слой поверх досок.
--
-- «Доска» превращается в «учебный проект»: у неё появляется
-- описание, цель, ожидаемый результат, сроки и формат защиты.
-- Владелец доски трактуется как преподаватель, участники — как
-- студенты с командной ролью (project manager / researcher / ...).
--
-- Реализовано РАСШИРЕНИЕМ существующих таблиц (boards / board_members),
-- а не отдельной таблицей projects — так весь существующий функционал
-- (колонки, карточки, приглашения, лог активности) продолжает работать
-- без изменений, а проект и доска остаются одной сущностью.
-- ============================================================

-- ── 1. Глобальная роль пользователя ──
-- Выбирается при регистрации. По умолчанию 'student', чтобы старые
-- профили (созданные до миграции) не нарушали NOT NULL / CHECK.
alter table profiles
  add column if not exists global_role text not null default 'student'
    check (global_role in ('teacher', 'student'));

-- ── 2. Учебные поля проекта на boards ──
alter table boards
  add column if not exists description     text,
  add column if not exists goal            text,
  add column if not exists expected_result text,
  add column if not exists start_date      date,
  add column if not exists end_date        date,
  add column if not exists defense_format  text;

-- ── 3. Командная роль студента в проекте ──
-- Оставляем board_members.role ('owner'/'member') для совместимости со
-- всем существующим кодом и RLS. team_role — отдельное nullable поле,
-- которое преподаватель назначает каждому студенту.
alter table board_members
  add column if not exists team_role text
    check (team_role in ('project_manager', 'researcher', 'developer', 'analyst', 'presenter'));

-- ── 4. Этапы проекта ──
create table if not exists project_stages (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade not null,
  title text not null,
  description text,
  order_index integer not null default 0,
  due_date date,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done')),
  created_at timestamptz default now() not null
);

create index if not exists project_stages_board_order_idx
  on project_stages (board_id, order_index);

alter table project_stages enable row level security;

-- Студенты (участники) видят этапы своего проекта…
drop policy if exists "Members can view stages" on project_stages;
create policy "Members can view stages" on project_stages
  for select using (user_can_access_board(board_id));

-- …преподаватель (владелец) полностью ими управляет.
drop policy if exists "Owners can manage stages" on project_stages;
create policy "Owners can manage stages" on project_stages
  for all using (is_board_owner(board_id))
  with check (is_board_owner(board_id));

-- ── 5. Создавать проекты может только преподаватель ──
-- Хелпер security definer, чтобы прочитать profiles.global_role в обход RLS
-- (своя строка профиля и так видна, но функция не зависит от политики).
create or replace function is_teacher()
returns boolean language sql security definer as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and global_role = 'teacher'
  );
$$;

-- Заменяем старую политику «Users can create boards»: теперь вставка
-- доски разрешена только владельцу-преподавателю.
drop policy if exists "Users can create boards" on boards;
drop policy if exists "Teachers can create boards" on boards;
create policy "Teachers can create boards" on boards
  for insert with check (auth.uid() = owner_id and is_teacher());

-- ── 6. Сохранение global_role при регистрации ──
-- Триггер handle_new_user теперь берёт роль из user_metadata.
--
-- ВАЖНО: колонка profiles.global_role добавляется выше (шаг 1) ДО этой
-- функции, поэтому к моменту срабатывания триггера поле уже существует.
--
-- Защита от падения триггера (а значит и всего signUp):
--   • coalesce + nullif — на случай отсутствующего / пустого global_role;
--   • явная проверка на множество значений из CHECK-constraint — любое
--     постороннее значение приводится к 'student', чтобы не нарушить
--     check (global_role in ('teacher','student')).
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  role_value text;
begin
  role_value := coalesce(nullif(new.raw_user_meta_data->>'global_role', ''), 'student');
  if role_value not in ('teacher', 'student') then
    role_value := 'student';
  end if;

  insert into profiles (user_id, full_name, global_role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    role_value
  );
  return new;
end;
$$;

-- ── 7. Список участников теперь возвращает командную роль ──
-- Расширяем get_board_members_with_info (из 004) полем team_role.
-- Postgres не разрешает менять возвращаемый тип через create or replace,
-- поэтому сначала удаляем старую версию функции (из 004), затем создаём заново.
drop function if exists get_board_members_with_info(uuid);
create or replace function get_board_members_with_info(bid uuid)
returns table (
  user_id uuid,
  role      text,
  team_role text,
  full_name text,
  email     text
) language sql security definer as $$
  select
    bm.user_id,
    bm.role,
    bm.team_role,
    coalesce(p.full_name, u.email) as full_name,
    u.email
  from board_members bm
  join auth.users u  on u.id  = bm.user_id
  left join profiles p on p.user_id = bm.user_id
  where bm.board_id = bid
    and user_can_access_board(bid)
  order by
    case when bm.role = 'owner' then 0 else 1 end,
    coalesce(p.full_name, u.email) asc;
$$;
