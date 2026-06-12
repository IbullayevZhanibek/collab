-- ============================================================
-- Bucket: card-attachments  (private)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('card-attachments', 'card-attachments', false)
on conflict (id) do nothing;

-- ============================================================
-- attachments table
-- ============================================================
create table attachments (
  id           uuid primary key default gen_random_uuid(),
  card_id      uuid references cards(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  file_name    text not null,
  file_size    integer,
  file_type    text,
  storage_path text not null,
  created_at   timestamptz default now()
);

alter table attachments enable row level security;

-- ============================================================
-- Helper: board_id for a card (bypasses RLS via SECURITY DEFINER)
-- ============================================================
create or replace function get_board_id_for_card(cid uuid)
returns uuid language plpgsql security definer as $$
declare
  bid uuid;
begin
  select c.board_id into bid
  from columns c
  join cards ca on ca.column_id = c.id
  where ca.id = cid
  limit 1;
  return bid;
exception when others then
  return null;
end;
$$;

-- Helper used by Storage RLS: extract card_id uuid from object path safely.
-- Path format: {card_id}/{timestamp}_{filename}
create or replace function get_board_id_for_path(obj_path text)
returns uuid language plpgsql security definer as $$
declare
  card_id_text text;
  card_id_val  uuid;
begin
  card_id_text := split_part(obj_path, '/', 1);
  card_id_val  := card_id_text::uuid;
  return get_board_id_for_card(card_id_val);
exception when invalid_text_representation then
  return null;
end;
$$;

-- ============================================================
-- RLS: attachments table
-- ============================================================
create policy "Members can view attachments" on attachments
  for select using (
    user_can_access_board(get_board_id_for_card(card_id))
  );

create policy "Members can insert attachments" on attachments
  for insert with check (
    auth.uid() = user_id
    and user_can_access_board(get_board_id_for_card(card_id))
  );

create policy "Users can delete own attachments" on attachments
  for delete using (auth.uid() = user_id);

-- ============================================================
-- RLS: storage.objects (card-attachments bucket)
-- ============================================================

-- SELECT: board members can read files
create policy "Board members can read attachments" on storage.objects
  for select using (
    bucket_id = 'card-attachments'
    and user_can_access_board(get_board_id_for_path(name))
  );

-- INSERT: board members can upload to their boards
create policy "Board members can upload attachments" on storage.objects
  for insert with check (
    bucket_id = 'card-attachments'
    and auth.uid() is not null
    and user_can_access_board(get_board_id_for_path(name))
  );

-- UPDATE: only the uploader can update metadata
create policy "Uploaders can update attachment objects" on storage.objects
  for update using (
    bucket_id = 'card-attachments'
    and owner = auth.uid()
  );

-- DELETE: only the uploader can remove the file
create policy "Uploaders can delete attachment objects" on storage.objects
  for delete using (
    bucket_id = 'card-attachments'
    and owner = auth.uid()
  );
