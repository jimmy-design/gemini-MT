create extension if not exists pg_net with schema extensions;

drop function if exists public.send_sms(jsonb);

create or replace function public.send_sms(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, net
as $$
begin
  perform net.http_post(
    url := 'https://bbnnkrijpvkicwsmxthf.supabase.co/functions/v1/mobile-sasa-send-sms',
    body := event,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 1000
  );

  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.send_sms(jsonb) to supabase_auth_admin;

revoke execute on function public.send_sms(jsonb) from anon, authenticated, public;
