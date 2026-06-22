-- ============================================================
-- 019: Allow board members to update stage status.
--
-- Previously only the board owner could update project_stages.
-- Students who are board members can now toggle stage status
-- (pending → in_progress → done). The application layer
-- (actions/stages.ts updateStageStatus) only ever writes the
-- `status` field, so this is safe without column-level security.
-- ============================================================

set search_path = public;

drop policy if exists "Members can update stage status" on project_stages;
create policy "Members can update stage status" on project_stages
  for update
  using  (user_can_access_board(board_id))
  with check (user_can_access_board(board_id));
