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
const mobileSasaGetUrl = Deno.env.get('MOBILESASA_GET_URL') || 'https://api.mobilesasa.com/v1/send/messageget'
const mobileSasaSenderId = Deno.env.get('MOBILESASA_SENDER_ID') || 'EASTMATTOTP'
const rawHookSecret = Deno.env.get('SEND_SMS_HOOK_SECRET')

function messageFromError(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  try {
    return JSON.stringify(error)
  } catch (_error) {
    return 'Unknown error'
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function hookError(message: string, httpCode = 400) {
  console.error(message)
  return jsonResponse({ error: { http_code: httpCode, message } }, httpCode)
}

function formatPhoneForMobileSasa(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, '')

  if (normalized.startsWith('+254')) {
    return `0${normalized.slice(4)}`
  }

  if (normalized.startsWith('254')) {
    return `0${normalized.slice(3)}`
  }

  return normalized
}

async function verifyHookRequest(request: Request, body: string) {
  if (!rawHookSecret) return

  const hasWebhookHeaders = request.headers.has('webhook-id') &&
    request.headers.has('webhook-timestamp') &&
    request.headers.has('webhook-signature')

  if (!hasWebhookHeaders) {
    console.warn('Supabase auth hook request did not include Standard Webhooks headers; continuing because Auth Hooks may omit them.')
    return
  }

  const normalizedSecret = rawHookSecret.trim().startsWith('v1,')
    ? rawHookSecret.trim().slice(3)
    : rawHookSecret.trim()

  const headers = {
    'webhook-id': request.headers.get('webhook-id') || '',
    'webhook-timestamp': request.headers.get('webhook-timestamp') || '',
    'webhook-signature': request.headers.get('webhook-signature') || '',
  }

  try {
    await new Webhook(normalizedSecret).verify(body, headers)
  } catch (error) {
    if (normalizedSecret === rawHookSecret.trim()) throw error
    await new Webhook(rawHookSecret.trim()).verify(body, headers)
  }
}

async function sendMobileSasaOtp(phone: string, otp: string) {
  if (!mobileSasaToken) {
    throw new Error('MobileSasa API token is not configured in Edge Function secrets.')
  }

  const message = `Your Wave verification code is ${otp}. Do not share this code.`
  const mobileSasaPhone = formatPhoneForMobileSasa(phone)

  const mobileSasaResponse = await fetch(mobileSasaBaseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mobileSasaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      senderID: mobileSasaSenderId,
      phone: mobileSasaPhone,
      message,
    }),
  })

  const responseText = await mobileSasaResponse.text()

  if (mobileSasaResponse.status === 401) {
    console.warn('MobileSasa Bearer POST returned 401; retrying legacy GET endpoint.')

    const fallbackUrl = new URL(mobileSasaGetUrl)
    fallbackUrl.searchParams.set('api_token', mobileSasaToken)
    fallbackUrl.searchParams.set('senderID', mobileSasaSenderId)
    fallbackUrl.searchParams.set('phone', mobileSasaPhone)
    fallbackUrl.searchParams.set('message', message)

    const fallbackResponse = await fetch(fallbackUrl)
    const fallbackText = await fallbackResponse.text()

    if (!fallbackResponse.ok) {
      throw new Error(`MobileSasa fallback GET failed with status ${fallbackResponse.status}: ${fallbackText || fallbackResponse.statusText}`)
    }

    console.log(`MobileSasa OTP sent to ${mobileSasaPhone} through fallback GET endpoint.`)
    return
  }

  if (!mobileSasaResponse.ok) {
    throw new Error(`MobileSasa SMS failed with status ${mobileSasaResponse.status}: ${responseText || mobileSasaResponse.statusText}`)
  }

  console.log(`MobileSasa OTP sent to ${mobileSasaPhone}`)
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'GET') {
      return jsonResponse({
        ok: true,
        function: 'mobile-sasa-send-sms',
        hasMobileSasaToken: Boolean(mobileSasaToken),
        hasHookSecret: Boolean(rawHookSecret),
        senderId: mobileSasaSenderId,
      })
    }

    if (request.method !== 'POST') {
      return hookError('Method not allowed.', 405)
    }

    if (!mobileSasaToken) {
      return hookError('MobileSasa API token is not configured in Edge Function secrets.', 500)
    }

    const body = await request.text()

    try {
      await verifyHookRequest(request, body)
    } catch (error) {
      return hookError(`Invalid Supabase auth hook signature: ${messageFromError(error)}`, 401)
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

    await sendMobileSasaOtp(phone, otp)
    return new Response(null, { status: 200 })
  } catch (error) {
    return hookError(`Unhandled MobileSasa hook error: ${messageFromError(error)}`, 500)
  }
})
