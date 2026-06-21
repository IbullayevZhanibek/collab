-- Таблица рефлексий студентов.
create table if not exists reflections (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references boards(id) on delete cascade,
  stage_id     uuid references project_stages(id) on delete cascade,
  student_id   uuid not null references auth.users(id) on delete cascade,
  what_done    text,
  difficulties text,
  improvements text,
  contribution text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Одна рефлексия на пару (студент, этап) — для ненулевых stage_id.
create unique index if not exists reflections_student_stage_uq
  on reflections (student_id, stage_id)
  where stage_id is not null;

-- Одна общая рефлексия по проекту на студента.
create unique index if not exists reflections_student_project_uq
  on reflections (student_id, board_id)
  where stage_id is null;

create index if not exists reflections_board_student_idx
  on reflections (board_id, student_id);

alter table reflections enable row level security;

-- Студент создаёт, редактирует и видит только свои рефлексии.
create policy "Students manage own reflections" on reflections
  for all
  using   (student_id = auth.uid())
  with check (student_id = auth.uid());

-- Владелец доски (преподаватель) читает все рефлексии своего проекта.
create policy "Owner reads project reflections" on reflections
  for select
  using (is_board_owner(board_id));

-- Функция для преподавателя: все рефлексии проекта с именем студента и названием этапа.
create or replace function get_project_reflections(p_board_id uuid)
returns table (
  id           uuid,
  board_id     uuid,
  stage_id     uuid,
  student_id   uuid,
  what_done    text,
  difficulties text,
  improvements text,
  contribution text,
  created_at   timestamptz,
  updated_at   timestamptz,
  full_name    text,
  stage_title  text
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    r.board_id,
    r.stage_id,
    r.student_id,
    r.what_done,
    r.difficulties,
    r.improvements,
    r.contribution,
    r.created_at,
    r.updated_at,
    coalesce(p.full_name, u.email)::text as full_name,
    ps.title                              as stage_title
  from reflections r
  join auth.users u  on u.id  = r.student_id
  left join profiles p            on p.user_id = r.student_id
  left join project_stages ps     on ps.id     = r.stage_id
  where r.board_id = p_board_id
    and is_board_owner(p_board_id)
  order by coalesce(p.full_name, u.email), r.stage_id nulls last;
$$;
