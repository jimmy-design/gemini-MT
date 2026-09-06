import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.')
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.')
  }

  return supabase
}

function formatTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatUnread(count) {
  if (!count) return undefined
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return String(count)
}

function mapConversation(row) {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    initials: row.initials,
    color: row.color,
    status: row.status,
    lastSeen: row.last_seen,
    preview: row.preview,
    time: formatTime(row.last_message_at),
    unread: row.unread_count,
    unreadText: formatUnread(row.unread_count),
    pinned: row.pinned,
    muted: row.muted,
    verified: row.verified,
    group: row.type === 'group',
    channel: row.type === 'channel',
    labels: row.labels || [],
  }
}

function mapMessage(row) {
  return {
    id: row.id,
    from: row.sender,
    type: row.type,
    text: row.body,
    caption: row.caption,
    length: row.duration,
    time: formatTime(row.created_at),
    seen: row.seen,
    reactions: row.reactions || [],
  }
}

function mapStatus(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    label: formatTime(row.created_at),
    seen: row.seen,
  }
}

function mapCall(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    time: formatTime(row.created_at),
    missed: row.missed,
  }
}

function mapProfile(row) {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle || row.phone_number || '',
    initials: row.initials,
    color: row.color,
    status: row.status,
    lastSeen: row.last_seen,
    verified: row.verified,
  }
}

function mapMarketplaceItem(row) {
  return {
    id: row.id,
    name: row.name,
    meta: row.meta,
    icon: row.icon,
    color: row.color,
  }
}

function mapSettings(row) {
  if (!row) return null
  return {
    screenLock: row.screen_lock,
    readReceipts: row.read_receipts,
    liveLocation: row.live_location,
    chatLock: row.chat_lock,
  }
}

function tableIsMissing(error) {
  return error?.code === 'PGRST205' || error?.message?.includes('schema cache')
}

function requireResult(result) {
  if (result.error) throw result.error
  return result.data || []
}

function optionalResult(result) {
  if (tableIsMissing(result.error)) return []
  if (result.error) throw result.error
  return result.data || []
}

function optionalSingleResult(result) {
  if (tableIsMissing(result.error)) return null
  if (result.error) throw result.error
  return result.data || null
}

export async function getAppData() {
  const client = requireSupabase()
  const [conversations, statuses, calls, communities, profiles, marketplace, settings] = await Promise.all([
    client.from('conversations').select('*').order('pinned', { ascending: false }).order('last_message_at', { ascending: false }),
    client.from('status_updates').select('*').order('created_at', { ascending: false }),
    client.from('calls').select('*').order('created_at', { ascending: false }),
    client.from('communities').select('*').order('created_at', { ascending: false }),
    client.from('profiles').select('*').order('created_at', { ascending: false }),
    client.from('marketplace_items').select('*').order('created_at', { ascending: false }),
    client.from('user_settings').select('*').limit(1).maybeSingle(),
  ])

  const marketplaceError = tableIsMissing(marketplace.error) ? null : marketplace.error
  const settingsError = tableIsMissing(settings.error) ? null : settings.error
  const error = conversations.error || statuses.error || calls.error || communities.error || profiles.error || marketplaceError || settingsError
  if (error) throw error

  const settingsRow = optionalSingleResult(settings)

  return {
    conversations: requireResult(conversations).map(mapConversation),
    statuses: requireResult(statuses).map(mapStatus),
    calls: requireResult(calls).map(mapCall),
    communities: requireResult(communities),
    contacts: requireResult(profiles).map(mapProfile),
    marketplace: optionalResult(marketplace).map(mapMarketplaceItem),
    settings: mapSettings(settingsRow),
  }
}

export async function getMessages(conversationId) {
  const client = requireSupabase()
  if (!conversationId) return []

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data.map(mapMessage)
}

export async function sendMessage(conversationId, text) {
  const client = requireSupabase()
  if (!conversationId) throw new Error('Choose a conversation before sending a message.')

  const { data, error } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender: 'me',
      type: 'text',
      body: text,
      seen: true,
    })
    .select()
    .single()

  if (error) throw error

  const { error: updateError } = await client
    .from('conversations')
    .update({ preview: text, last_message_at: new Date().toISOString() })
    .eq('id', conversationId)

  if (updateError) throw updateError

  return mapMessage(data)
}

export async function updateUserSettings(values) {
  const client = requireSupabase()
  const { data: sessionData, error: sessionError } = await client.auth.getUser()
  if (sessionError) throw sessionError
  if (!sessionData.user?.id) throw new Error('Register your phone before changing settings.')

  const { error } = await client
    .from('user_settings')
    .upsert({
      auth_user_id: sessionData.user.id,
      screen_lock: values.screenLock,
      read_receipts: values.readReceipts,
      live_location: values.liveLocation,
      chat_lock: values.chatLock,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'auth_user_id' })

  if (error) throw error
  return { ok: true }
}

export async function requestPhoneOtp(phone) {
  const client = requireSupabase()
  const { error } = await client.auth.signInWithOtp({
    phone,
    options: { channel: 'sms' },
  })

  if (error) throw error
  return { ok: true }
}

export async function verifyPhoneOtp(phone, token) {
  const client = requireSupabase()
  const { data, error } = await client.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  })

  if (error) throw error
  return data
}

export async function saveRegistrationProfile({ userId, phone, countryName, countryCode }) {
  const client = requireSupabase()
  const initials = phone.slice(-2)
  const { error } = await client
    .from('profiles')
    .upsert({
      auth_user_id: userId,
      phone_number: phone,
      country_name: countryName,
      country_code: countryCode,
      name: 'New Wave User',
      handle: phone,
      initials,
      color: 'mint',
      status: 'online',
      last_seen: 'online now',
    }, { onConflict: 'auth_user_id' })

  if (error) throw error

  const { error: settingsError } = await client
    .from('user_settings')
    .upsert({ auth_user_id: userId }, { onConflict: 'auth_user_id' })

  if (settingsError) throw settingsError
  return { ok: true }
}
