import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const devPhoneLoginEnabled = import.meta.env.VITE_ENABLE_DEV_PHONE_LOGIN === 'true'

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

function normalizePhone(value) {
  if (!value) return ''
  const cleaned = String(value).replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) return `+${cleaned.slice(1).replace(/\D/g, '')}`
  return cleaned.replace(/\D/g, '')
}

function initialsFor(name, fallback = 'WU') {
  const initials = String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return initials || fallback
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
    subscriberCount: row.subscriber_count || 0,
  }
}

function mapMessage(row, currentProfileId) {
  const from = row.sender_profile_id
    ? row.sender_profile_id === currentProfileId ? 'me' : 'them'
    : row.sender

  return {
    id: row.id,
    from,
    type: row.type,
    text: row.body,
    caption: row.caption,
    length: row.duration,
    mediaUrl: row.media_url,
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

function mapCallSession(row, currentProfileId) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    startedByProfileId: row.started_by_profile_id,
    mode: row.mode,
    status: row.status,
    startedAt: row.started_at,
    answeredAt: row.answered_at,
    endedAt: row.ended_at,
    isMine: row.started_by_profile_id === currentProfileId,
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

function mapMatchedContact(row) {
  const profile = row.profile || row
  return {
    ...mapProfile(profile),
    deviceName: row.device_name,
    devicePhoneNumber: row.device_phone_number,
    phoneNumber: profile.phone_number,
  }
}

function mapTypingIndicator(row) {
  const profile = row.profile || {}
  return {
    conversationId: row.conversation_id,
    profileId: row.profile_id,
    name: profile.name || 'Someone',
    initials: profile.initials || 'W',
    color: profile.color || 'mint',
    updatedAt: row.updated_at,
  }
}

function isRecentlyOnline(presence) {
  if (!presence?.last_seen_at) return false
  return Date.now() - new Date(presence.last_seen_at).getTime() < 45000
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

function isMissingAuthSession(error) {
  return error?.name === 'AuthSessionMissingError' || error?.message?.toLowerCase().includes('auth session missing')
}

function readableError(error, fallback = 'Something went wrong. Try again.') {
  if (!error) return fallback
  if (typeof error === 'string') return error

  const message = error.message || error.error_description || error.error
  if (message && message !== '{}') return message

  try {
    const serialized = JSON.stringify(error)
    if (serialized && serialized !== '{}') return serialized
  } catch (_error) {
    // Ignore serialization errors and use the fallback below.
  }

  return fallback
}

function phoneOtpError(error) {
  const message = readableError(error, '')
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('unsupported phone provider')) {
    return 'Phone login is not ready yet. Enable Phone Auth and connect the MobileSasa Send SMS hook in Supabase Authentication > Hooks.'
  }

  if (!message || message === '{}') {
    return 'Supabase could not send the OTP. Check the Send SMS hook endpoint, hook secret, Edge Function deployment, and MobileSasa secrets.'
  }

  return message
}

function otpVerificationError(error) {
  const message = readableError(error, '')
  const lowerMessage = message.toLowerCase()

  if (
    lowerMessage.includes('token has expired') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('otp') ||
    lowerMessage.includes('code')
  ) {
    return 'Incorrect OTP. Check the SMS code and try again.'
  }

  return message || 'Could not verify the OTP. Try again.'
}

async function getSignedInUser(client) {
  const { data, error } = await client.auth.getUser()
  if (isMissingAuthSession(error)) return null
  if (error) throw error
  return data.user || null
}

function devEmailForPhone(phone) {
  const digits = normalizePhone(phone).replace(/\D/g, '')
  return `phone-${digits}@dev.wave.local`
}

function devPasswordForPhone(phone) {
  const digits = normalizePhone(phone).replace(/\D/g, '')
  return `Wave-dev-${digits}-2026!`
}

async function signInWithDevPhone(client, phone) {
  const normalizedPhone = normalizePhone(phone)
  const email = devEmailForPhone(normalizedPhone)
  const password = devPasswordForPhone(normalizedPhone)

  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.data?.user) {
    return { devUserId: signIn.data.user.id, phone: normalizedPhone }
  }

  const signUp = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone: normalizedPhone,
        wave_dev_phone_login: true,
      },
    },
  })

  if (signUp.error) throw signUp.error
  if (!signUp.data?.session) {
    throw new Error('Dev phone login created the auth user, but Supabase email confirmation is blocking the session. Disable email confirmations in Auth settings for local testing, or configure a real SMS provider.')
  }

  return { devUserId: signUp.data.user.id, phone: normalizedPhone }
}

export async function getAppData() {
  const client = requireSupabase()

  const user = await getSignedInUser(client)

  if (!user) {
    return {
      needsRegistration: true,
      currentProfile: null,
      conversations: [],
      statuses: [],
      calls: [],
      communities: [],
      contacts: [],
      channels: [],
      marketplace: [],
      settings: null,
    }
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (profileError) throw profileError

  if (!profile) {
    return {
      needsRegistration: true,
      currentProfile: null,
      conversations: [],
      statuses: [],
      calls: [],
      communities: [],
      contacts: [],
      channels: [],
      marketplace: [],
      settings: null,
    }
  }

  const memberships = await client
    .from('conversation_members')
    .select('conversation_id')
    .eq('profile_id', profile.id)

  const conversationIds = optionalResult(memberships).map((item) => item.conversation_id)
  const conversationsQuery = conversationIds.length
    ? client.from('conversations').select('*').in('id', conversationIds).order('pinned', { ascending: false }).order('last_message_at', { ascending: false })
    : Promise.resolve({ data: [], error: null })

  const [conversations, publicChannels, members, statuses, calls, communities, contacts, marketplace, settings] = await Promise.all([
    conversationsQuery,
    client.from('conversations').select('*').eq('type', 'channel').order('last_message_at', { ascending: false }),
    conversationIds.length
      ? client.from('conversation_members').select('conversation_id, profile:profile_id(id, name, initials, color, status, last_seen)').in('conversation_id', conversationIds)
      : Promise.resolve({ data: [], error: null }),
    client.from('status_updates').select('*').order('created_at', { ascending: false }),
    client.from('calls').select('*').order('created_at', { ascending: false }),
    client.from('communities').select('*').order('created_at', { ascending: false }),
    client.from('user_contacts').select('device_name, device_phone_number, profile:contact_profile_id(*)').eq('owner_profile_id', profile.id).order('matched_at', { ascending: false }),
    client.from('marketplace_items').select('*').order('created_at', { ascending: false }),
    client.from('user_settings').select('*').eq('auth_user_id', user.id).limit(1).maybeSingle(),
  ])

  const membershipsError = tableIsMissing(memberships.error) ? null : memberships.error
  const contactsError = tableIsMissing(contacts.error) ? null : contacts.error
  const membersError = tableIsMissing(members.error) ? null : members.error
  const marketplaceError = tableIsMissing(marketplace.error) ? null : marketplace.error
  const settingsError = tableIsMissing(settings.error) ? null : settings.error
  const error = membershipsError || conversations.error || publicChannels.error || membersError || statuses.error || calls.error || communities.error || contactsError || marketplaceError || settingsError
  if (error) throw error

  const settingsRow = optionalSingleResult(settings)
  const membersByConversation = optionalResult(members).reduce((grouped, item) => {
    const list = grouped.get(item.conversation_id) || []
    list.push(item.profile)
    grouped.set(item.conversation_id, list)
    return grouped
  }, new Map())
  const memberProfileIds = [...new Set(optionalResult(members).map((item) => item.profile?.id).filter(Boolean))]
  const channelIds = requireResult(publicChannels).map((channel) => channel.id)
  const [presences, subscriptions] = await Promise.all([
    memberProfileIds.length
      ? client.from('profile_presence').select('*').in('profile_id', memberProfileIds)
      : Promise.resolve({ data: [], error: null }),
    channelIds.length
      ? client.from('channel_subscriptions').select('conversation_id').in('conversation_id', channelIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  const presenceError = tableIsMissing(presences.error) ? null : presences.error
  const subscriptionsError = tableIsMissing(subscriptions.error) ? null : subscriptions.error
  if (presenceError || subscriptionsError) throw presenceError || subscriptionsError

  const presenceByProfile = new Map(optionalResult(presences).map((item) => [item.profile_id, item]))
  const subscriberCounts = optionalResult(subscriptions).reduce((counts, item) => {
    counts.set(item.conversation_id, (counts.get(item.conversation_id) || 0) + 1)
    return counts
  }, new Map())
  const mappedConversations = requireResult(conversations).map((conversation) => {
    const mapped = mapConversation(conversation)
    const otherMembers = (membersByConversation.get(conversation.id) || []).filter((member) => member?.id !== profile.id)
    const onlineMember = otherMembers.find((member) => isRecentlyOnline(presenceByProfile.get(member.id)))
    const latestSeen = otherMembers
      .map((member) => presenceByProfile.get(member.id)?.last_seen_at)
      .filter(Boolean)
      .sort()
      .at(-1)

    return {
      ...mapped,
      members: otherMembers.map(mapProfile),
      status: onlineMember ? 'online' : mapped.status,
      lastSeen: onlineMember ? 'online now' : latestSeen ? `last seen ${formatTime(latestSeen)}` : mapped.lastSeen,
      subscriberCount: subscriberCounts.get(conversation.id) || mapped.subscriberCount,
    }
  })
  const mappedChannels = requireResult(publicChannels).map((conversation) => ({
    ...mapConversation(conversation),
    subscriberCount: subscriberCounts.get(conversation.id) || 0,
    subscribed: conversationIds.includes(conversation.id),
  }))

  return {
    needsRegistration: false,
    currentProfile: mapProfile(profile),
    conversations: mappedConversations,
    channels: mappedChannels,
    statuses: requireResult(statuses).map(mapStatus),
    calls: requireResult(calls).map(mapCall),
    communities: requireResult(communities),
    contacts: optionalResult(contacts).map(mapMatchedContact),
    marketplace: optionalResult(marketplace).map(mapMarketplaceItem),
    settings: mapSettings(settingsRow),
  }
}

export async function getCurrentProfile() {
  const client = requireSupabase()
  const user = await getSignedInUser(client)
  if (!user) return null

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getMessages(conversationId) {
  const client = requireSupabase()
  if (!conversationId) return []
  const profile = await getCurrentProfile()

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data.map((message) => mapMessage(message, profile?.id))
}

export async function markOnline(status = 'online') {
  const client = requireSupabase()
  const profile = await getCurrentProfile()
  if (!profile) return

  const now = new Date().toISOString()
  const { error } = await client
    .from('profile_presence')
    .upsert({
      profile_id: profile.id,
      status,
      last_seen_at: now,
      updated_at: now,
    }, { onConflict: 'profile_id' })

  if (error) throw error
}

export async function subscribeToPresence(profileIds, onChange, onError) {
  const client = requireSupabase()
  const ids = [...new Set(profileIds || [])].filter(Boolean)
  if (ids.length === 0) return () => {}

  let channel = client.channel(`profile-presence:${ids.sort().join(':')}`)
  ids.forEach((id) => {
    channel = channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'profile_presence',
      filter: `profile_id=eq.${id}`,
    }, () => onChange?.())
  })

  channel
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.(new Error('Live presence connection dropped.'))
      }
    })

  return () => {
    client.removeChannel(channel)
  }
}

export async function subscribeToMessages(conversationId, onMessage, onError) {
  const client = requireSupabase()
  if (!conversationId) return () => {}

  const profile = await getCurrentProfile()
  const channel = client
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload) => {
      onMessage(mapMessage(payload.new, profile?.id))
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.(new Error('Live messages connection dropped. Pull to refresh or reopen the chat.'))
      }
    })

  return () => {
    client.removeChannel(channel)
  }
}

async function fetchTypingIndicators(client, conversationId, currentProfileId) {
  const since = new Date(Date.now() - 7000).toISOString()
  const { data, error } = await client
    .from('typing_indicators')
    .select('conversation_id, profile_id, is_typing, updated_at, profile:profile_id(name, initials, color)')
    .eq('conversation_id', conversationId)
    .eq('is_typing', true)
    .gt('updated_at', since)

  if (error) throw error

  return data
    .filter((item) => item.profile_id !== currentProfileId)
    .map(mapTypingIndicator)
}

export async function subscribeToTyping(conversationId, onTyping, onError) {
  const client = requireSupabase()
  if (!conversationId) return () => {}

  const profile = await getCurrentProfile()
  if (!profile) return () => {}

  let refreshTimer = null

  async function emitTyping() {
    try {
      const typingUsers = await fetchTypingIndicators(client, conversationId, profile.id)
      onTyping(typingUsers)
    } catch (error) {
      onError?.(error)
    }
  }

  const channel = client
    .channel(`typing:${conversationId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'typing_indicators',
      filter: `conversation_id=eq.${conversationId}`,
    }, () => {
      emitTyping()
      window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(emitTyping, 7500)
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.(new Error('Live typing connection dropped. Reopen the chat to reconnect.'))
      }
    })

  emitTyping()

  return () => {
    window.clearTimeout(refreshTimer)
    client.removeChannel(channel)
  }
}

export async function setTypingStatus(conversationId, isTyping) {
  const client = requireSupabase()
  if (!conversationId) return
  const profile = await getCurrentProfile()
  if (!profile) return

  const { error } = await client
    .from('typing_indicators')
    .upsert({
      conversation_id: conversationId,
      profile_id: profile.id,
      is_typing: isTyping,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'conversation_id,profile_id',
    })

  if (error) throw error
}

export async function startCallSession(conversation, mode = 'voice') {
  const client = requireSupabase()
  if (!conversation?.id) throw new Error('Choose a conversation before starting a call.')
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Register your phone before starting calls.')

  const { data: session, error } = await client
    .from('call_sessions')
    .insert({
      conversation_id: conversation.id,
      started_by_profile_id: profile.id,
      mode,
      status: 'active',
      answered_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error

  const participant = await client
    .from('call_participants')
    .upsert({
      call_session_id: session.id,
      profile_id: profile.id,
      joined_at: new Date().toISOString(),
      left_at: null,
    }, { onConflict: 'call_session_id,profile_id' })

  if (participant.error) throw participant.error

  const history = await client
    .from('calls')
    .insert({
      name: conversation.name,
      type: mode === 'video' ? 'Video call' : 'Voice call',
      missed: false,
    })

  if (history.error) throw history.error

  return mapCallSession(session, profile.id)
}

export async function answerCallSession(callSessionId) {
  const client = requireSupabase()
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Register your phone before joining calls.')

  const now = new Date().toISOString()
  const [{ data: session, error }, participant] = await Promise.all([
    client
      .from('call_sessions')
      .update({ status: 'active', answered_at: now })
      .eq('id', callSessionId)
      .select()
      .single(),
    client
      .from('call_participants')
      .upsert({
        call_session_id: callSessionId,
        profile_id: profile.id,
        joined_at: now,
        left_at: null,
      }, { onConflict: 'call_session_id,profile_id' }),
  ])

  if (error) throw error
  if (participant.error) throw participant.error
  return mapCallSession(session, profile.id)
}

export async function updateCallParticipant(callSessionId, changes) {
  const client = requireSupabase()
  const profile = await getCurrentProfile()
  if (!profile) return

  const { error } = await client
    .from('call_participants')
    .update({
      muted: Boolean(changes.muted),
      camera_off: Boolean(changes.cameraOff),
    })
    .eq('call_session_id', callSessionId)
    .eq('profile_id', profile.id)

  if (error) throw error
}

export async function endCallSession(callSessionId) {
  const client = requireSupabase()
  const profile = await getCurrentProfile()
  if (!profile) return

  const now = new Date().toISOString()
  const [{ error }, participant] = await Promise.all([
    client
      .from('call_sessions')
      .update({ status: 'ended', ended_at: now })
      .eq('id', callSessionId),
    client
      .from('call_participants')
      .update({ left_at: now })
      .eq('call_session_id', callSessionId)
      .eq('profile_id', profile.id),
  ])

  if (error) throw error
  if (participant.error) throw participant.error
}

export async function subscribeToCallSession(callSessionId, onChange, onError) {
  const client = requireSupabase()
  if (!callSessionId) return () => {}
  const profile = await getCurrentProfile()

  const channel = client
    .channel(`call-session:${callSessionId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'call_sessions',
      filter: `id=eq.${callSessionId}`,
    }, (payload) => {
      onChange(mapCallSession(payload.new, profile?.id))
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.(new Error('Live call connection dropped.'))
      }
    })

  return () => {
    client.removeChannel(channel)
  }
}

export async function sendMessage(conversationId, text) {
  const client = requireSupabase()
  if (!conversationId) throw new Error('Choose a conversation before sending a message.')
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Register your phone before sending messages.')

  const { data, error } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_profile_id: profile.id,
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

  return mapMessage(data, profile.id)
}

export async function sendVoiceMessage(conversationId, blob, durationSeconds) {
  const client = requireSupabase()
  if (!conversationId) throw new Error('Choose a conversation before sending a voice note.')
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Register your phone before sending voice notes.')

  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const path = `${profile.id}/${conversationId}/${id}.${extension}`
  const { error: uploadError } = await client.storage
    .from('voice-notes')
    .upload(path, blob, {
      contentType: blob.type || 'audio/webm',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { data: publicUrl } = client.storage.from('voice-notes').getPublicUrl(path)
  const duration = `${Math.max(1, Math.round(durationSeconds || 1))}s`

  const { data, error } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_profile_id: profile.id,
      sender: 'me',
      type: 'voice',
      body: 'Voice note',
      duration,
      media_url: publicUrl.publicUrl,
      seen: true,
    })
    .select()
    .single()

  if (error) throw error

  const { error: updateError } = await client
    .from('conversations')
    .update({ preview: `Voice note - ${duration}`, last_message_at: new Date().toISOString() })
    .eq('id', conversationId)

  if (updateError) throw updateError
  return mapMessage(data, profile.id)
}

export async function syncContactsToWave(deviceContacts) {
  const client = requireSupabase()
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Register your phone before syncing contacts.')

  const normalized = deviceContacts
    .flatMap((contact) => (contact.phoneNumbers || contact.phones || []).map((phone) => ({
      name: contact.displayName || contact.name?.display || [contact.name?.given, contact.name?.family].filter(Boolean).join(' ') || 'Phone contact',
      phone: normalizePhone(phone.number || phone.value || phone),
    })))
    .filter((contact) => contact.phone.length >= 7)

  const uniquePhones = [...new Set(normalized.map((contact) => contact.phone))]
  if (uniquePhones.length === 0) return []

  const { data: matchedProfiles, error } = await client
    .from('profiles')
    .select('*')
    .in('phone_number', uniquePhones)
    .neq('id', profile.id)

  if (error) throw error

  const rows = matchedProfiles.map((matchedProfile) => {
    const deviceContact = normalized.find((contact) => contact.phone === matchedProfile.phone_number)
    return {
      owner_profile_id: profile.id,
      contact_profile_id: matchedProfile.id,
      device_name: deviceContact?.name || matchedProfile.name,
      device_phone_number: matchedProfile.phone_number,
      matched_at: new Date().toISOString(),
    }
  })

  if (rows.length > 0) {
    const { error: upsertError } = await client
      .from('user_contacts')
      .upsert(rows, { onConflict: 'owner_profile_id,contact_profile_id' })

    if (upsertError) throw upsertError
  }

  return matchedProfiles.map(mapProfile)
}

export async function findRegisteredContactByPhone(phone) {
  const client = requireSupabase()
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Register your phone before adding contacts.')

  const normalizedPhone = normalizePhone(phone)
  const { data: contact, error } = await client
    .from('profiles')
    .select('*')
    .eq('phone_number', normalizedPhone)
    .neq('id', profile.id)
    .maybeSingle()

  if (error) throw error
  if (!contact) throw new Error('No Wave user found with that phone number.')

  const { error: upsertError } = await client
    .from('user_contacts')
    .upsert({
      owner_profile_id: profile.id,
      contact_profile_id: contact.id,
      device_name: contact.name,
      device_phone_number: normalizedPhone,
      matched_at: new Date().toISOString(),
    }, { onConflict: 'owner_profile_id,contact_profile_id' })

  if (upsertError) throw upsertError
  return mapProfile(contact)
}

export async function startDirectConversation(contactProfileId) {
  const client = requireSupabase()
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Register your phone before starting a chat.')

  const { data: contact, error: contactError } = await client
    .from('profiles')
    .select('*')
    .eq('id', contactProfileId)
    .single()

  if (contactError) throw contactError

  const memberships = await client
    .from('conversation_members')
    .select('conversation_id')
    .eq('profile_id', profile.id)

  const myConversationIds = optionalResult(memberships).map((item) => item.conversation_id)
  if (myConversationIds.length > 0) {
    const { data: existingMembers, error: existingError } = await client
      .from('conversation_members')
      .select('conversation_id')
      .eq('profile_id', contactProfileId)
      .in('conversation_id', myConversationIds)

    if (existingError && !tableIsMissing(existingError)) throw existingError
    if (existingMembers?.[0]?.conversation_id) return existingMembers[0].conversation_id
  }

  const { data: conversation, error: conversationError } = await client
    .from('conversations')
    .insert({
      name: contact.name,
      handle: contact.handle || contact.phone_number,
      initials: contact.initials || initialsFor(contact.name),
      color: contact.color || 'mint',
      type: 'direct',
      status: contact.status || 'offline',
      last_seen: contact.last_seen || 'last seen recently',
      preview: 'Say hi on Wave',
      labels: ['Contact'],
    })
    .select()
    .single()

  if (conversationError) throw conversationError

  const { error: membersError } = await client
    .from('conversation_members')
    .insert([
      { conversation_id: conversation.id, profile_id: profile.id, role: 'owner' },
      { conversation_id: conversation.id, profile_id: contactProfileId, role: 'member' },
    ])

  if (membersError) throw membersError
  return conversation.id
}

export async function createChannel({ name, description }) {
  const client = requireSupabase()
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Register your phone before creating channels.')

  const cleanName = name.trim()
  if (!cleanName) throw new Error('Enter a channel name.')
  const handle = `@${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'channel'}`

  const { data: conversation, error } = await client
    .from('conversations')
    .insert({
      name: cleanName,
      handle,
      initials: initialsFor(cleanName, 'CH'),
      color: 'teal',
      type: 'channel',
      status: 'channel',
      last_seen: 'broadcast channel',
      preview: description?.trim() || 'New Wave channel',
      labels: ['Channel'],
      verified: false,
    })
    .select()
    .single()

  if (error) throw error

  const [{ error: memberError }, { error: subscriptionError }] = await Promise.all([
    client.from('conversation_members').insert({
      conversation_id: conversation.id,
      profile_id: profile.id,
      role: 'owner',
    }),
    client.from('channel_subscriptions').insert({
      conversation_id: conversation.id,
      profile_id: profile.id,
      notifications: 'all',
    }),
  ])

  if (memberError) throw memberError
  if (subscriptionError) throw subscriptionError
  return mapConversation(conversation)
}

export async function subscribeToChannel(conversationId) {
  const client = requireSupabase()
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Register your phone before joining channels.')

  const [{ error: memberError }, { error: subscriptionError }] = await Promise.all([
    client.from('conversation_members').upsert({
      conversation_id: conversationId,
      profile_id: profile.id,
      role: 'member',
      joined_at: new Date().toISOString(),
    }, { onConflict: 'conversation_id,profile_id' }),
    client.from('channel_subscriptions').upsert({
      conversation_id: conversationId,
      profile_id: profile.id,
      notifications: 'all',
      subscribed_at: new Date().toISOString(),
    }, { onConflict: 'conversation_id,profile_id' }),
  ])

  if (memberError) throw memberError
  if (subscriptionError) throw subscriptionError
}

export async function updateUserSettings(values) {
  const client = requireSupabase()
  const user = await getSignedInUser(client)
  if (!user?.id) throw new Error('Register your phone before changing settings.')

  const { data: existingSettings, error: existingError } = await client
    .from('user_settings')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (existingError) throw new Error(readableError(existingError, 'Could not check your Wave settings.'))

  const settingsValues = {
    auth_user_id: user.id,
    screen_lock: values.screenLock,
    read_receipts: values.readReceipts,
    live_location: values.liveLocation,
    chat_lock: values.chatLock,
    updated_at: new Date().toISOString(),
  }

  const result = existingSettings
    ? await client.from('user_settings').update(settingsValues).eq('id', existingSettings.id)
    : await client.from('user_settings').insert(settingsValues)

  const { error } = result

  if (error) throw new Error(readableError(error, 'Could not save your Wave settings.'))
  return { ok: true }
}

async function ensureUserSettings(client, userId) {
  const { data: existingSettings, error: existingError } = await client
    .from('user_settings')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (existingError) throw new Error(readableError(existingError, 'Could not check your Wave settings.'))
  if (existingSettings) return { ok: true }

  const { error } = await client
    .from('user_settings')
    .insert({ auth_user_id: userId })

  if (error) throw new Error(readableError(error, 'Could not create your Wave settings.'))
  return { ok: true }
}

export async function requestPhoneOtp(phone) {
  const client = requireSupabase()
  const { error } = await client.auth.signInWithOtp({
    phone,
  })

  if (error) {
    throw new Error(phoneOtpError(error))
  }

  return { ok: true }
}

export async function verifyPhoneOtp(phone, token) {
  const client = requireSupabase()
  const { data, error } = await client.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  })

  if (error) throw new Error(otpVerificationError(error))
  if (!data.user?.id) throw new Error('OTP verified, but Supabase did not return a signed-in user. Try requesting a new code.')
  return data
}

export async function saveRegistrationProfile({ userId, phone, countryName, countryCode }) {
  const client = requireSupabase()
  if (!userId) throw new Error('Could not confirm your signed-in user. Try verifying the code again.')

  const normalizedPhone = normalizePhone(phone)
  const initials = normalizedPhone.slice(-2)

  const profileValues = {
    auth_user_id: userId,
    phone_number: normalizedPhone,
    country_name: countryName,
    country_code: countryCode,
    name: 'New Wave User',
    handle: normalizedPhone,
    initials,
    color: 'mint',
    status: 'online',
    last_seen: 'online now',
  }

  const { data: existingProfile, error: existingError } = await client
    .from('profiles')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (existingError) throw new Error(readableError(existingError, 'Could not check your Wave profile.'))

  const result = existingProfile
    ? await client.from('profiles').update(profileValues).eq('id', existingProfile.id)
    : await client.from('profiles').insert(profileValues)

  const { error } = result

  if (error) throw new Error(readableError(error, 'Could not save your Wave profile.'))

  await ensureUserSettings(client, userId)
  return { ok: true }
}
