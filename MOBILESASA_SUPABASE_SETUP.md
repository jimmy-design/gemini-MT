# MobileSasa Supabase SMS Setup

Wave uses Supabase Phone Auth, but Supabase should send the OTP through our custom MobileSasa Edge Function.

Important: the MobileSasa API token was pasted into chat, so rotate it in MobileSasa before going live. Do not put the real token in `.env.local`, frontend code, Codemagic logs, or GitHub.

## 1. Deploy the Edge Function

Install and log in to the Supabase CLI on any machine or CI that can deploy:

```sh
supabase functions deploy mobile-sasa-send-sms --no-verify-jwt
```

The function URL for this project will be:

```txt
https://bbnnkrijpvkicwsmxthf.supabase.co/functions/v1/mobile-sasa-send-sms
```

## 2. Add Function Secrets

Use a rotated MobileSasa token:

```sh
supabase secrets set MOBILESASA_API_TOKEN=your-rotated-mobilesasa-token
supabase secrets set MOBILESASA_BASE_URL=https://api.mobilesasa.com/v1/send/message
supabase secrets set MOBILESASA_SENDER_ID=EASTMATTOTP
supabase secrets set SEND_SMS_HOOK_SECRET=your-random-hook-signing-secret
```

`SEND_SMS_HOOK_SECRET` should match the signing secret configured for the Supabase Auth hook.

## 3. Enable Phone Auth

In Supabase Dashboard:

1. Go to Authentication > Sign In / Providers.
2. Enable Phone provider.
3. Go to Authentication > Hooks.
4. Enable the Send SMS hook.
5. Choose HTTP endpoint.
6. Set the endpoint URL to the Edge Function URL above.
7. Set the same hook signing secret used in `SEND_SMS_HOOK_SECRET`.

After this, `signInWithOtp({ phone })` will trigger the hook and MobileSasa will send the SMS code.

## 4. Production App Setting

For Codemagic and production builds, keep:

```txt
VITE_ENABLE_DEV_PHONE_LOGIN=false
```

The dev phone login fallback is only for local testing when a real SMS provider is not connected.
