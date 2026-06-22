-- Add project completion status to boards.
-- Existing boards default to 'active'.
set search_path = public;

alter table boards
  add column if not exists status text not null default 'active'
    check (status in ('active', 'completed')),
  add column if not exists completed_at timestamptz null,
  add column if not exists completed_by uuid null references auth.users;

-- RLS notes:
-- SELECT: existing "Members can view board" policy already lets participants
--         read all board columns, including the new ones.
-- UPDATE: existing owner-update policy covers status/completed_at/completed_by.
--         The completeBoard / reopenBoard server actions also filter by
--         owner_id = auth.uid() at the query level for defence-in-depth.
-- No new policies are needed.
