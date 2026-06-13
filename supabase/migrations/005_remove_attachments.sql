-- ============================================================
-- Удаление функции вложений к карточкам.
-- Причина: загрузка файлов в Supabase Storage может превысить
-- бесплатный лимит хранилища. Убираем таблицу, её политики,
-- приватный бакет и связанные с ним storage-политики/хелперы.
-- ============================================================

-- Таблица attachments и её RLS-политики (CASCADE снимает зависимости).
drop table if exists attachments cascade;

-- Storage-политики для бакета card-attachments.
drop policy if exists "Board members can read attachments" on storage.objects;
drop policy if exists "Board members can upload attachments" on storage.objects;
drop policy if exists "Uploaders can update attachment objects" on storage.objects;
drop policy if exists "Uploaders can delete attachment objects" on storage.objects;

-- Содержимое бакета и сам бакет.
delete from storage.objects where bucket_id = 'card-attachments';
delete from storage.buckets where id = 'card-attachments';

-- Хелпер, использовавшийся только storage-политиками вложений.
drop function if exists get_board_id_for_path(text);
