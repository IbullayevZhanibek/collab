-- ============================================================
-- Стартовые колонки новой доски.
-- При создании доски автоматически добавляем три обычные колонки:
-- «К работе» (0), «В процессе» (1), «Готово» (2).
-- Колонки ничем не отличаются от созданных вручную — их можно
-- удалять, переименовывать и добавлять свои.
--
-- Делаем отдельным триггером, чтобы не пересекаться с существующим
-- on_board_created (handle_new_board), который добавляет владельца
-- в board_members. Оба триггера AFTER INSERT независимы друг от друга.
-- ============================================================

create or replace function handle_new_board_columns()
returns trigger language plpgsql security definer as $$
begin
  insert into columns (board_id, title, position) values
    (new.id, 'К работе', 0),
    (new.id, 'В процессе', 1),
    (new.id, 'Готово', 2);
  return new;
end;
$$;

create trigger on_board_created_columns
  after insert on boards
  for each row execute procedure handle_new_board_columns();
