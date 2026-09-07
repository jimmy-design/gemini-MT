drop index if exists public.profiles_auth_user_id_key;
drop index if exists public.user_settings_auth_user_id_key;

alter table public.profiles
drop constraint if exists profiles_auth_user_id_unique;

alter table public.user_settings
drop constraint if exists user_settings_auth_user_id_unique;

alter table public.profiles
add constraint profiles_auth_user_id_unique unique (auth_user_id);

alter table public.user_settings
add constraint user_settings_auth_user_id_unique unique (auth_user_id);
