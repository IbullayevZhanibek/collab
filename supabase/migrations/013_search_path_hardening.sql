-- ============================================================
-- Защита всех SECURITY DEFINER функций от подмены search_path.
--
-- Контекст: SECURITY DEFINER функция выполняется с правами владельца,
-- но НАСЛЕДУЕТ search_path вызывающего. Если такая функция вызвана из
-- контекста другой схемы (классика — триггеры на auth.users) или
-- вызывающий подменил search_path, неквалифицированные имена таблиц
-- (`profiles`, `boards`, …) резолвятся не в ту схему → ошибки уровня
-- "relation does not exist" (как падала регистрация, фикс в 012) или,
-- хуже, потенциальный вектор привилегий.
--
-- Решение (рекомендация Supabase linter «Function Search Path Mutable»):
-- зафиксировать `search_path = public` у каждой SECURITY DEFINER функции.
--
-- Делаем это циклом по pg_proc, а не списком ALTER'ов, чтобы:
--   • покрыть все такие функции разом (find_user_by_email, accept_invitation,
--     get_board_members_with_info, is_teacher, is_board_owner,
--     user_can_access_board, get_activity_log, get_my_invitations,
--     get_board_invitations, handle_new_user, handle_new_board* и т.д.);
--   • не падать, если какой-то функции в конкретной БД нет;
--   • автоматически охватывать функции, добавленные в будущем;
--   • быть идемпотентным — повторный прогон просто переустановит то же значение.
-- ============================================================

do $$
declare
  fn record;
begin
  for fn in
    select p.proname                                  as func_name,
           pg_get_function_identity_arguments(p.oid)  as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef          -- только SECURITY DEFINER
      and not exists (         -- пропускаем уже зафиксированные
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg like 'search_path=%'
      )
  loop
    execute format(
      'alter function public.%I(%s) set search_path = public',
      fn.func_name, fn.args
    );
    raise notice 'search_path=public set on public.%(%)', fn.func_name, fn.args;
  end loop;
end;
$$;
