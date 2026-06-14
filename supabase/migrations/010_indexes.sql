-- Индексы для ускорения частых выборок.
-- Без них Postgres делает seq-scan по cards/columns/board_members на каждый
-- фильтр по внешнему ключу — заметно тормозит открытие доски, дашборд и календарь.

-- Карточки фильтруются по колонке (board view, reorder, join'ы дашборда/календаря).
create index if not exists cards_column_id_idx on cards (column_id);

-- Выборки «мои задачи» по исполнителю.
create index if not exists cards_assignee_id_idx on cards (assignee_id);

-- Фильтр/сортировка по дедлайну (календарь, уведомления дашборда).
create index if not exists cards_due_date_idx on cards (due_date);

-- Колонки доски (board view, columnTitles, join'ы).
create index if not exists columns_board_id_idx on columns (board_id);

-- Участники доски: проверки доступа (RLS user_can_access_board), подсчёт участников.
create index if not exists board_members_user_id_idx on board_members (user_id);
create index if not exists board_members_board_id_idx on board_members (board_id);

-- activity_log(board_id, created_at desc) уже создан в 008_activity_log.sql —
-- добавляем idempotent-страховку на случай чистой БД без той миграции.
create index if not exists activity_log_board_created_idx
  on activity_log (board_id, created_at desc);
