-- ============================================================
-- Фикс: регистрация падала с "relation \"profiles\" does not exist".
--
-- Причина: триггер on_auth_user_created висит на auth.users, а функция
-- handle_new_user() — SECURITY DEFINER без зафиксированного search_path.
-- При срабатывании в контексте схемы auth неквалифицированное имя
-- `profiles` резолвится как auth.profiles (которой нет), а не public.profiles.
-- Дальше транзакция вставки пользователя обрывается
-- ("current transaction is aborted") и весь signUp завершается ошибкой.
--
-- Решение: пересоздать функцию с `set search_path = public` и явно
-- указать схему во вставке (public.profiles). Триггер пересоздаём, чтобы
-- он гарантированно указывал на public.handle_new_user.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_value text;
begin
  role_value := coalesce(new.raw_user_meta_data->>'global_role', 'student');
  if role_value not in ('teacher', 'student') then
    role_value := 'student';
  end if;

  insert into public.profiles (user_id, full_name, global_role)
  values (new.id, new.raw_user_meta_data->>'full_name', role_value);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
