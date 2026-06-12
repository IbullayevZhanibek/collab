-- Fix: infinite recursion in board_members policy "Owners can manage members"
--
-- Root cause:
--   boards SELECT policy  → queries board_members (plain subquery)
--   board_members FOR ALL → queries boards (plain subquery, NOT security definer)
--   boards SELECT policy  → queries board_members → ... (loop)
--
-- Fix: wrap the boards ownership check in a SECURITY DEFINER function so
-- Postgres evaluates it as the function owner (superuser), bypassing RLS
-- on both tables and breaking the cycle.

-- 1. Helper: check ownership without going through RLS
create or replace function is_board_owner(bid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from boards where id = bid and owner_id = auth.uid()
  );
$$;

-- 2. Drop the recursive policy
drop policy if exists "Owners can manage members" on board_members;

-- 3. Re-create it using the SECURITY DEFINER function
create policy "Owners can manage members" on board_members
  for all using (is_board_owner(board_id))
  with check (is_board_owner(board_id));
