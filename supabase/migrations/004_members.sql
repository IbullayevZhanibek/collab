-- Function: find a user by email for the invite flow.
-- Runs as security definer to access auth.users without service role key.
create or replace function find_user_by_email(search_email text)
returns table (
  user_id uuid,
  full_name text,
  email text
) language sql security definer as $$
  select
    u.id                                        as user_id,
    coalesce(p.full_name, u.email)              as full_name,
    u.email
  from auth.users u
  left join profiles p on p.user_id = u.id
  where lower(u.email) = lower(search_email)
  limit 1;
$$;

-- Function: get all board members with profile info and email.
-- Checks board access before returning data.
create or replace function get_board_members_with_info(bid uuid)
returns table (
  user_id uuid,
  role    text,
  full_name text,
  email   text
) language sql security definer as $$
  select
    bm.user_id,
    bm.role,
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
