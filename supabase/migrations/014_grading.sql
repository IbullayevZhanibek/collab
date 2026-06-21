-- ============================================================
-- Этап 2: оценивание проекта по критериям (рубрике).
--
-- Преподаватель (владелец доски) задаёт критерии (rubric_criteria) и
-- выставляет по ним баллы (grades). Оценка может относиться ко всему
-- проекту (student_id IS NULL) либо к конкретному студенту.
-- Итоговый балл = сумма score, максимум = сумма max_score — считается
-- на стороне приложения (actions/grading.ts).
--
-- Идемпотентно: безопасно перезапускать целиком.
-- ============================================================

-- ── Критерии оценивания ──
create table if not exists rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade not null,
  title text not null,
  max_score integer not null default 0 check (max_score >= 0),
  order_index integer not null default 0,
  created_at timestamptz default now() not null
);

create index if not exists rubric_criteria_board_order_idx
  on rubric_criteria (board_id, order_index);

-- ── Оценки ──
create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade not null,
  criterion_id uuid references rubric_criteria(id) on delete cascade not null,
  -- кого оцениваем: NULL = проект целиком, иначе конкретный студент
  student_id uuid references auth.users(id) on delete cascade,
  score numeric not null default 0 check (score >= 0),
  comment text,
  graded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  -- одна оценка на пару (критерий, студент). ВНИМАНИЕ: для NULL student_id
  -- этот constraint не работает (NULL != NULL), поэтому ниже отдельный
  -- частичный уникальный индекс на оценки уровня всего проекта.
  unique (criterion_id, student_id)
);

create unique index if not exists grades_criterion_project_unique
  on grades (criterion_id) where student_id is null;

create index if not exists grades_board_idx on grades (board_id);
create index if not exists grades_student_idx on grades (board_id, student_id);

-- ── RLS ──
alter table rubric_criteria enable row level security;
alter table grades enable row level security;

-- Критерии: видят все участники проекта, управляет только преподаватель.
drop policy if exists "Members view criteria" on rubric_criteria;
create policy "Members view criteria" on rubric_criteria
  for select using (user_can_access_board(board_id));

drop policy if exists "Owners manage criteria" on rubric_criteria;
create policy "Owners manage criteria" on rubric_criteria
  for all using (is_board_owner(board_id))
  with check (is_board_owner(board_id));

-- Оценки: преподаватель видит все; студент — только свои и общие по проекту.
drop policy if exists "View grades" on grades;
create policy "View grades" on grades
  for select using (
    is_board_owner(board_id)
    or (
      user_can_access_board(board_id)
      and (student_id = auth.uid() or student_id is null)
    )
  );

-- Ставить/менять/удалять оценки может только преподаватель.
drop policy if exists "Owners manage grades" on grades;
create policy "Owners manage grades" on grades
  for all using (is_board_owner(board_id))
  with check (is_board_owner(board_id));
