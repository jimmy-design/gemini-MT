import { Webhook } from 'npm:standardwebhooks@1.0.0'

type SmsHookEvent = {
  user?: {
    phone?: string
  }
  sms?: {
    otp?: string
  }
}

const mobileSasaToken = Deno.env.get('MOBILESASA_API_TOKEN')
const mobileSasaBaseUrl = Deno.env.get('MOBILESASA_BASE_URL') || 'https://api.mobilesasa.com/v1/send/message'
const mobileSasaSenderId = Deno.env.get('MOBILESASA_SENDER_ID') || 'EASTMATTOTP'
const hookSecret = Deno.env.get('SUPABASE_AUTH_HOOK_SECRET')

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function hookError(message: string, httpCode = 400) {
  return jsonResponse({ error: { http_code: httpCode, message } }, httpCode)
}

async function verifyHookRequest(request: Request, body: string) {
  if (!hookSecret) return

  const webhook = new Webhook(hookSecret)
  await webhook.verify(body, {
    'webhook-id': request.headers.get('webhook-id') || '',
    'webhook-timestamp': request.headers.get('webhook-timestamp') || '',
    'webhook-signature': request.headers.get('webhook-signature') || '',
  })
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return hookError('Method not allowed.', 405)
  }

  if (!mobileSasaToken) {
    return hookError('MobileSasa API token is not configured.', 500)
  }

  const body = await request.text()

  try {
    await verifyHookRequest(request, body)
  } catch (_error) {
    return hookError('Invalid Supabase auth hook signature.', 401)
  }

  let event: SmsHookEvent
  try {
    event = JSON.parse(body)
  } catch (_error) {
    return hookError('Invalid JSON payload.')
  }

  const phone = event.user?.phone
  const otp = event.sms?.otp

  if (!phone || !otp) {
    return hookError('Missing phone number or OTP in Supabase SMS hook payload.')
  }

  const message = `Your Wave verification code is ${otp}. Do not share this code.`

  const mobileSasaResponse = await fetch(mobileSasaBaseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mobileSasaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      senderID: mobileSasaSenderId,
      phone,
      message,
    }),
  })

  const responseText = await mobileSasaResponse.text()

  if (!mobileSasaResponse.ok) {
    return hookError(`MobileSasa SMS failed: ${responseText || mobileSasaResponse.statusText}`, 502)
  }

  return new Response(null, { status: 200 })
})
