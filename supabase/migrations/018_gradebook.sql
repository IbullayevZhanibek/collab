-- ============================================================
-- Журнал оценок (Этап 3): итоговые оценки преподавателя.
--
-- final_grades: преподаватель ставит общую оценку студенту
-- (student_id = UUID) или всему проекту (student_id IS NULL),
-- независимо от детальной рубрики.
-- ============================================================

create table if not exists final_grades (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards(id) on delete cascade,
  -- NULL = оценка всему проекту, иначе конкретный студент
  student_id  uuid references auth.users(id) on delete cascade,
  final_score numeric not null check (final_score >= 0),
  max_score   numeric not null default 100 check (max_score > 0),
  comment     text,
  graded_by   uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  unique (board_id, student_id)
);

-- Unique constraint допускает несколько NULL-значений в student_id,
-- поэтому добавляем частичный индекс для проектных оценок.
create unique index if not exists final_grades_project_uq
  on final_grades (board_id)
  where student_id is null;

create index if not exists final_grades_board_idx
  on final_grades (board_id);
create index if not exists final_grades_student_idx
  on final_grades (board_id, student_id);

-- ── RLS ──

alter table final_grades enable row level security;

drop policy if exists "Owners manage final grades" on final_grades;
create policy "Owners manage final grades" on final_grades
  for all
  using   (is_board_owner(board_id))
  with check (is_board_owner(board_id));

-- Студент видит свою итоговую оценку и общую по проекту.
drop policy if exists "Students view own final grade" on final_grades;
create policy "Students view own final grade" on final_grades
  for select
  using (
    user_can_access_board(board_id)
    and (student_id = auth.uid() or student_id is null)
  );

-- ── Security-definer функция ──
-- Сводный журнал для преподавателя: одна строка на пару (проект, студент).
-- Включает баллы по рубрике и итоговую оценку (если выставлена).

create or replace function get_gradebook(p_teacher_id uuid)
returns table (
  board_id      uuid,
  board_title   text,
  student_id    uuid,
  student_name  text,
  student_email text,
  rubric_score  numeric,
  rubric_max    numeric,
  final_score   numeric,
  final_max     numeric,
  is_graded     boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.id                        as board_id,
    b.title                     as board_title,
    bm.user_id                  as student_id,
    p.full_name                 as student_name,
    au.email                    as student_email,
    coalesce(rs.total,    0)    as rubric_score,
    coalesce(rm.max_total, 0)   as rubric_max,
    fg.final_score              as final_score,
    coalesce(fg.max_score, 100) as final_max,
    (fg.id is not null)         as is_graded
  from boards b
  join board_members bm on bm.board_id = b.id and bm.role = 'member'
  join auth.users au    on au.id = bm.user_id
  left join profiles p  on p.user_id = bm.user_id
  left join lateral (
    select sum(g.score) as total
    from grades g
    where g.board_id = b.id and g.student_id = bm.user_id
  ) rs on true
  left join lateral (
    select sum(rc.max_score) as max_total
    from rubric_criteria rc
    where rc.board_id = b.id
  ) rm on true
  left join final_grades fg
    on fg.board_id = b.id and fg.student_id = bm.user_id
  where b.owner_id = p_teacher_id
  order by b.created_at desc, coalesce(p.full_name, au.email);
$$;
