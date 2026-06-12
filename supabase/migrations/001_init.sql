-- profiles
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- boards
create table boards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

-- board_members
create table board_members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('owner', 'member')),
  unique(board_id, user_id)
);

-- columns
create table columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade not null,
  title text not null,
  position integer not null default 0
);

-- cards
create table cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid references columns(id) on delete cascade not null,
  title text not null,
  description text,
  assignee_id uuid references auth.users(id) on delete set null,
  due_date date,
  priority text check (priority in ('low', 'medium', 'high', 'critical')),
  position integer not null default 0,
  created_at timestamptz default now() not null
);

-- comments
create table comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now() not null
);

-- RLS
alter table profiles enable row level security;
alter table boards enable row level security;
alter table board_members enable row level security;
alter table columns enable row level security;
alter table cards enable row level security;
alter table comments enable row level security;

-- SECURITY DEFINER helpers: run as superuser, bypassing RLS on both tables.
-- This prevents circular policy evaluation between boards ↔ board_members.

create or replace function user_can_access_board(bid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from boards
    where id = bid
    and (owner_id = auth.uid() or
         exists (select 1 from board_members where board_id = bid and user_id = auth.uid()))
  );
$$;

create or replace function is_board_owner(bid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from boards where id = bid and owner_id = auth.uid()
  );
$$;

-- profiles policies
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = user_id);

create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = user_id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = user_id);

-- boards policies
create policy "Users can view accessible boards" on boards
  for select using (
    owner_id = auth.uid() or
    exists (select 1 from board_members where board_id = id and user_id = auth.uid())
  );

create policy "Users can create boards" on boards
  for insert with check (auth.uid() = owner_id);

create policy "Board owners can update" on boards
  for update using (auth.uid() = owner_id);

create policy "Board owners can delete" on boards
  for delete using (auth.uid() = owner_id);

-- board_members policies
create policy "Members can view membership" on board_members
  for select using (user_can_access_board(board_id));

create policy "Owners can manage members" on board_members
  for all using (is_board_owner(board_id))
  with check (is_board_owner(board_id));

-- columns policies
create policy "Members can view columns" on columns
  for select using (user_can_access_board(board_id));

create policy "Members can manage columns" on columns
  for all using (user_can_access_board(board_id));

-- cards policies
create policy "Members can view cards" on cards
  for select using (
    exists (
      select 1 from columns where id = column_id and user_can_access_board(board_id)
    )
  );

create policy "Members can manage cards" on cards
  for all using (
    exists (
      select 1 from columns where id = column_id and user_can_access_board(board_id)
    )
  );

-- comments policies
create policy "Members can view comments" on comments
  for select using (
    exists (
      select 1 from cards ca
      join columns c on c.id = ca.column_id
      where ca.id = card_id and user_can_access_board(c.board_id)
    )
  );

create policy "Members can manage comments" on comments
  for all using (
    exists (
      select 1 from cards ca
      join columns c on c.id = ca.column_id
      where ca.id = card_id and user_can_access_board(c.board_id)
    )
  );

-- auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (user_id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- auto-add owner to board_members on board creation
create or replace function handle_new_board()
returns trigger language plpgsql security definer as $$
begin
  insert into board_members (board_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_board_created
  after insert on boards
  for each row execute procedure handle_new_board();
