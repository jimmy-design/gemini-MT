import { Component, StrictMode, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  CheckCheck,
  CircleDotDashed,
  FileText,
  Globe2,
  Heart,
  KeyRound,
  Lock,
  Menu,
  MessageCircleMore,
  Mic,
  Phone,
  PhoneOff,
  Pin,
  Plus,
  Search,
  Send,
  Store,
  WandSparkles,
  Sparkles,
  ShieldCheck,
  Smartphone,
  UserRoundCog,
  UserRound,
  Users,
  Video,
  VideoOff,
  VolumeX,
} from 'lucide-react'
import { endCallSession, findRegisteredContactByPhone, getAppData, getMessages, requestPhoneOtp, saveRegistrationProfile, sendMessage, setTypingStatus, startCallSession, startDirectConversation, subscribeToCallSession, subscribeToMessages, subscribeToTyping, syncContactsToWave, updateCallParticipant, updateUserSettings, verifyPhoneOtp } from './api'
import { hideKeyboard, lightTap, pickChatPhoto, readDeviceContacts, shareWaveInvite } from './native'
import './styles.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}

if ('serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations?.().then((registrations) => {
    registrations.forEach((registration) => registration.unregister())
  })
}

const navItems = ['Chats', 'Status', 'Calls', 'Communities', 'Marketplace', 'Settings']
const mobileNavItems = ['Contacts', 'Calls', 'Chats', 'Marketplace', 'Settings']
const filters = ['All', 'Unread', 'Favorites', 'Groups', 'Channels']
const quickReplies = ['Looks beautiful', 'Call in 10?', 'Send location', 'I can help with that']
const tools = ['Camera', 'Gallery', 'Document', 'Audio', 'Location', 'Contact', 'Poll', 'Payment']
const emojis = ['😀', '😂', '😍', '🔥', '❤️', '🙏', '👍', '🎉', '😎', '🥹', '💯', '✨']
const whispers = ['Comfort', 'Urgent', 'No reply needed', 'Celebrate']
const countries = [
  { name: 'Kenya', code: '+254', example: '712 345 678' },
  { name: 'United States', code: '+1', example: '415 555 0134' },
  { name: 'United Kingdom', code: '+44', example: '7400 123456' },
  { name: 'Nigeria', code: '+234', example: '801 234 5678' },
  { name: 'South Africa', code: '+27', example: '82 123 4567' },
  { name: 'India', code: '+91', example: '98765 43210' },
]
const pendingPhoneVerificationKey = 'wave.pendingPhoneVerification'

function readPendingPhoneVerification() {
  try {
    const saved = window.localStorage.getItem(pendingPhoneVerificationKey)
    if (!saved) return null
    const pending = JSON.parse(saved)
    if (!pending?.countryCode || !pending?.localNumber) return null
    return pending
  } catch (_error) {
    return null
  }
}

function savePendingPhoneVerification(pending) {
  try {
    window.localStorage.setItem(pendingPhoneVerificationKey, JSON.stringify(pending))
  } catch (_error) {
    // Local persistence is only a convenience for returning from the SMS app.
  }
}

function clearPendingPhoneVerification() {
  try {
    window.localStorage.removeItem(pendingPhoneVerificationKey)
  } catch (_error) {
    // Ignore storage cleanup failures.
  }
}

const navIcons = {
  Contacts: UserRound,
  Chats: MessageCircleMore,
  Status: CircleDotDashed,
  Calls: Phone,
  Communities: Users,
  Marketplace: Store,
  Settings: UserRoundCog,
}
const routeByView = {
  Contacts: '/contacts',
  Chats: '/chats',
  Status: '/status',
  Calls: '/calls',
  Communities: '/communities',
  Marketplace: '/marketplace',
  Settings: '/settings',
}
const viewByPath = {
  contacts: 'Contacts',
  chats: 'Chats',
  status: 'Status',
  calls: 'Calls',
  communities: 'Communities',
  marketplace: 'Marketplace',
  settings: 'Settings',
}

function mergeMessageList(current, incoming) {
  const withoutDuplicate = current.filter((message) => {
    if (message.id === incoming.id) return false
    return !(message.pending && message.from === incoming.from && message.text === incoming.text)
  })

  return [...withoutDuplicate, incoming]
}

function Icon({ name }) {
  const icons = {
    menu: Menu,
    search: Search,
    plus: Plus,
    camera: Camera,
    mic: Mic,
    send: Send,
    phone: Phone,
    phoneOff: PhoneOff,
    video: Video,
    videoOff: VideoOff,
    lock: Lock,
    pin: Pin,
    mute: VolumeX,
    spark: Sparkles,
    whisper: WandSparkles,
    heart: Heart,
    file: FileText,
    check: CheckCheck,
    back: ArrowLeft,
    globe: Globe2,
    key: KeyRound,
    shield: ShieldCheck,
    smartphone: Smartphone,
  }
  const IconComponent = icons[name]
  return IconComponent ? <IconComponent aria-hidden="true" strokeWidth={2.2} /> : <span aria-hidden="true">{name}</span>
}

function Avatar({ person, size = '' }) {
  return (
    <div className={`avatar ${person.color} ${size}`}>
      {person.initials || person.name.slice(0, 2)}
      {person.status === 'online' && <span className="presence" />}
    </div>
  )
}

function AppHeader({ view, setView, searchOpen, setSearchOpen, conversations, openRegister }) {
  const title = view === 'Contacts' ? 'Contacts' : view
  const unreadProfiles = conversations
    .filter((person) => person.unread > 0)
    .concat(conversations.filter((person) => !person.unread))
    .slice(0, 6)

  return (
    <header className="brand-row">
      <div className="brand-mark">W</div>
      <div>
        <strong>{title}</strong>
        <small>Wave messenger</small>
      </div>
      {view === 'Chats' && unreadProfiles.length > 0 && (
        <button className="message-stack" type="button" aria-label={`${unreadProfiles.length} chats with new messages`}>
          {unreadProfiles.map((person) => <Avatar person={person} key={person.id} size="tiny" />)}
        </button>
      )}
      <button className={`icon-button ${searchOpen ? 'active' : ''}`} aria-label="Search chats" onClick={() => setSearchOpen((value) => !value)}>
        <Icon name="search" />
      </button>
      <button className={`icon-button ${view === 'Calls' ? 'active' : ''}`} aria-label="Open calls" onClick={() => setView('Calls')}>
        <Icon name="phone" />
      </button>
      <button className="icon-button" aria-label="Register phone number" onClick={openRegister}><Icon name="menu" /></button>
    </header>
  )
}

function BottomNav({ view, setView }) {
  const viewForItem = (item) => item === 'Contacts' ? 'Contacts' : item

  return (
    <nav className="bottom-nav" aria-label="Mobile menu">
      {mobileNavItems.map((item) => (
        <button className={view === viewForItem(item) ? 'active' : ''} key={item} onClick={() => setView(viewForItem(item))}>
          <span className={`nav-icon nav-${item.toLowerCase()}`}>{ReactNavIcon(item)}</span>
          {item === 'Chats' && <b>192</b>}
          {item}
        </button>
      ))}
    </nav>
  )
}

function ReactNavIcon(item) {
  const IconComponent = navIcons[item]
  return <IconComponent aria-hidden="true" strokeWidth={2.25} />
}

function Sidebar({ appData, activeId, setActiveId, view, setView, query, setQuery, filter, setFilter, openChat, openRegister }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const currentProfile = appData.currentProfile

  return (
    <aside className="sidebar">
      <AppHeader view={view} setView={setView} searchOpen={searchOpen} setSearchOpen={setSearchOpen} conversations={appData.conversations} openRegister={openRegister} />

      <nav className="primary-nav" aria-label="Primary">
        {navItems.map((item) => (
          <button className={view === item ? 'active' : ''} key={item} onClick={() => setView(item)}>
            {item}
          </button>
        ))}
      </nav>

      <div className="profile-row">
        <div className="profile-avatar">{currentProfile?.initials || 'W'}</div>
        <div>
          <strong>{currentProfile?.name || 'Wave'}</strong>
          <small>{currentProfile?.lastSeen || 'Register your phone to create a profile'}</small>
        </div>
        <button className="icon-button" aria-label="Open camera"><Icon name="camera" /></button>
      </div>

      <div className={`search-box ${searchOpen ? 'open' : ''}`}>
        <Icon name="search" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search conversations" placeholder="Search or start a new chat" />
      </div>

      <div className="filter-row" aria-label="Chat filters">
        {filters.map((item) => <button className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}>{item}</button>)}
      </div>

      {view === 'Chats' && <ConversationList conversations={appData.conversations} activeId={activeId} setActiveId={setActiveId} query={query} filter={filter} openChat={openChat} />}
    </aside>
  )
}

function ConversationList({ conversations, activeId, setActiveId, query, filter, openChat }) {
  const visible = conversations.filter((person) => {
    const matchesSearch = `${person.name} ${person.preview} ${(person.labels || []).join(' ')}`.toLowerCase().includes(query.toLowerCase())
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Unread' && person.unread > 0) ||
      (filter === 'Favorites' && person.pinned) ||
      (filter === 'Groups' && person.group) ||
      (filter === 'Channels' && person.channel)
    return matchesSearch && matchesFilter
  })

  return (
    <section className="conversation-list" aria-label="Conversations">
      {visible.length === 0 && <EmptyState title="No chats yet" text="Your real conversations from Supabase will appear here." />}
      {visible.map((person) => (
        <button className={`conversation ${person.id === activeId ? 'selected' : ''}`} key={person.id} onClick={() => { setActiveId(person.id); openChat(person.id) }}>
          <Avatar person={person} />
          <span className="conversation-copy">
            <span className="conversation-title">
              <strong>{person.name}</strong>
              {person.verified && <Icon name="check" />}
              {person.pinned && <Icon name="pin" />}
              {person.muted && <Icon name="mute" />}
            </span>
            <small>{person.preview}</small>
            <span className="label-row">{(person.labels || []).map((label) => <b key={label}>{label}</b>)}</span>
          </span>
          <span className="conversation-meta">
            <small>{person.time}</small>
            {person.unread > 0 && <b>{person.unreadText || person.unread}</b>}
          </span>
        </button>
      ))}
    </section>
  )
}

function MessageBubble({ message }) {
  return (
    <div className={`message-row ${message.from} ${message.pending ? 'pending' : ''} ${message.failed ? 'failed' : ''}`}>
      <div className={`message-bubble ${message.type}`}>
        {message.type === 'media' && <div className="media-grid"><span /><span /><span /></div>}
        {message.type === 'voice' && <div className="voice-note"><button type="button"><Icon name="mic" /></button><div><i /><i /><i /><i /><i /><i /></div><strong>{message.length}</strong></div>}
        {message.type === 'text' && <p>{message.text}</p>}
        {message.type === 'media' && <p>{message.caption}</p>}
        <small className="message-meta">{message.time}{message.from === 'me' && message.seen && <span className="seen"> <Icon name="check" /></span>}</small>
        {message.reactions?.length > 0 && <span className="reaction">{message.reactions.map((reaction) => <Icon key={reaction} name={reaction} />)}</span>}
      </div>
    </div>
  )
}

function ChatPage({ active, messages, setMessages, closeChat, routeMode = false, typingUsers = [], backUnread = 0, onStartCall }) {
  const [draft, setDraft] = useState('')
  const [showTools, setShowTools] = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)
  const [showWhisper, setShowWhisper] = useState(false)
  const [whisper, setWhisper] = useState('')
  const [privacyMode, setPrivacyMode] = useState('Standard')
  const [sending, setSending] = useState(false)
  const typingTimer = useRef(null)
  const lastTypingState = useRef(false)
  const isTyping = typingUsers.length > 0
  const typingLabel = typingUsers.length > 1
    ? `${typingUsers.length} people are typing...`
    : `${typingUsers[0]?.name?.split(' ')[0] || active.name.split(' ')[0]} is typing...`
  const messageEndRef = useRef(null)
  const backUnreadLabel = backUnread > 999 ? `${(backUnread / 1000).toFixed(1)}K` : String(backUnread)

  function publishTyping(nextState) {
    if (!active?.id) return
    if (lastTypingState.current === nextState) return
    lastTypingState.current = nextState
    setTypingStatus(active.id, nextState).catch((error) => console.warn(error.message))
  }

  function handleDraftChange(event) {
    const value = event.target.value
    setDraft(value)

    window.clearTimeout(typingTimer.current)
    if (!value.trim()) {
      publishTyping(false)
      return
    }

    publishTyping(true)
    typingTimer.current = window.setTimeout(() => publishTyping(false), 1800)
  }

  useEffect(() => {
    lastTypingState.current = false
    window.clearTimeout(typingTimer.current)

    return () => {
      window.clearTimeout(typingTimer.current)
      if (lastTypingState.current && active?.id) {
        setTypingStatus(active.id, false).catch((error) => console.warn(error.message))
      }
    }
  }, [active?.id])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'end' })
  }, [active?.id, messages.length, typingUsers.length])

  async function submitMessage(event) {
    event.preventDefault()
    if (!draft.trim() || sending) return
    if (!active?.id) return
    const text = draft.trim()
    const outgoingText = whisper ? `[${whisper}] ${text}` : text
    const optimisticId = `pending-${Date.now()}`
    const optimisticMessage = {
      id: optimisticId,
      from: 'me',
      type: 'text',
      text: outgoingText,
      time: 'now',
      seen: false,
      reactions: [],
      pending: true,
    }

    setDraft('')
    publishTyping(false)
    window.clearTimeout(typingTimer.current)
    setShowEmojis(false)
    setShowWhisper(false)
    setWhisper('')
    setMessages((current) => [...current, optimisticMessage])
    setSending(true)
    try {
      await lightTap()
      await hideKeyboard()
      const saved = await sendMessage(active.id, outgoingText)
      setMessages((current) => current.map((message) => message.id === optimisticId ? saved : message))
    } catch (_error) {
      setMessages((current) => current.map((message) => message.id === optimisticId ? { ...message, pending: false, failed: true, time: 'not sent' } : message))
    } finally {
      setSending(false)
    }
  }

  async function openAttachmentTools() {
    await lightTap()
    const photo = await pickChatPhoto()
    if (photo) {
      setDraft((value) => value || 'Photo')
      return
    }
    setShowTools((value) => !value)
  }

  async function toggleEmojis() {
    await lightTap()
    setShowEmojis((value) => !value)
  }

  return (
    <section className="chat-panel page-panel">
      <header className="chat-header">
        <button className="back-button" type="button" onClick={closeChat} aria-label="Back to chats"><Icon name="back" />{backUnread > 0 && <span>{backUnreadLabel}</span>}</button>
        <div className="chat-person">
          <Avatar person={active} size="large" />
          <div>
            <strong>{active.name}</strong>
            <small>{active.lastSeen}</small>
          </div>
        </div>
        <button className="whisper-button" type="button" aria-label="Open whisper intent" onClick={() => setShowWhisper((value) => !value)}>
          <Icon name="whisper" />
        </button>
        <div className="chat-actions">
          <button className="icon-button" aria-label="Start voice call" onClick={() => onStartCall?.(active, 'voice')}><Icon name="phone" /></button>
          <button className="icon-button" aria-label="Start video call" onClick={() => onStartCall?.(active, 'video')}><Icon name="video" /></button>
          <button className="icon-button" aria-label="Search in conversation"><Icon name="search" /></button>
          <button className="icon-button" aria-label="Chat details"><Icon name="menu" /></button>
        </div>
        <button className="header-avatar" type="button" aria-label="Open contact info"><Avatar person={active} /></button>
      </header>

      <div className="notice-row">
        <Icon name="lock" />
        <span>Messages and calls are end-to-end encrypted. Disappearing messages: 24 hours.</span>
        <button type="button" onClick={() => setPrivacyMode(privacyMode === 'Standard' ? 'Ghost mode' : 'Standard')}>{privacyMode}</button>
      </div>

      <div className="message-area">
        <div className="date-divider"><span>Today</span></div>
        {messages.map((message) => <MessageBubble message={message} key={message.id} />)}
        {isTyping && (
          <div className="typing">
            <span className={`typing-avatar ${typingUsers[0]?.color || active.color}`}>{typingUsers[0]?.initials || active.initials}</span>
            <span className="typing-dots"><i /><i /><i /></span>
            <small>{typingLabel}</small>
          </div>
        )}
        <div ref={messageEndRef} className="message-end" />
      </div>

      <div className="smart-replies">
        <span><Icon name="spark" /> Smart replies</span>
        {quickReplies.map((reply) => <button type="button" key={reply} onClick={() => setDraft(reply)}>{reply}</button>)}
      </div>

      {showTools && (
        <div className="tool-drawer">
          {tools.map((tool) => <button type="button" key={tool}><span>{tool.slice(0, 1)}</span>{tool}</button>)}
        </div>
      )}

      {showEmojis && (
        <div className="emoji-drawer" aria-label="Emoji picker">
          {emojis.map((emoji) => (
            <button type="button" key={emoji} onClick={() => setDraft((value) => `${value}${emoji}`)}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {showWhisper && (
        <div className="whisper-drawer" aria-label="Whisper intent">
          <strong>Whisper intent</strong>
          <div>
            {whispers.map((item) => (
              <button className={whisper === item ? 'active' : ''} type="button" key={item} onClick={() => setWhisper(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="composer" onSubmit={submitMessage}>
        <button className="attach-button" type="button" aria-label="Attach" onClick={openAttachmentTools}><Icon name="plus" /></button>
        <div className="message-capsule">
          <input value={draft} onFocus={() => setShowEmojis(false)} onChange={handleDraftChange} placeholder={whisper ? `${whisper} message` : 'Message'} aria-label="Message" />
          <button className="emoji-button" type="button" aria-label="Open emojis" onClick={toggleEmojis}>:)</button>
        </div>
        {draft.trim() ? (
          <button className="send-button" aria-label="Send message" disabled={sending}>{sending ? '...' : <Icon name="send" />}</button>
        ) : (
          <button className="mic-button" type="button" aria-label="Record voice note"><Icon name="mic" /></button>
        )}
      </form>
    </section>
  )
}

function CallOverlay({ call, contact, onEnd }) {
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(call?.mode !== 'video')
  const [status, setStatus] = useState('Connecting...')
  const [elapsed, setElapsed] = useState(0)
  const localVideoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    if (!call) return undefined

    let mounted = true

    async function openMedia() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus('Open the installed app or HTTPS preview to use calls.')
          return
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: call.mode === 'video',
        })

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        setStatus(call.mode === 'video' ? 'Video call active' : 'Voice call active')
      } catch (error) {
        setStatus(error?.message || 'Allow microphone access to start calling.')
      }
    }

    openMedia()

    return () => {
      mounted = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [call?.id, call?.mode])

  useEffect(() => {
    if (!call) return undefined
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [call])

  useEffect(() => {
    if (!call?.id || call.id === 'starting') return undefined

    let active = true
    let unsubscribe = () => {}
    subscribeToCallSession(call.id, (nextCall) => {
      if (active && nextCall.status === 'ended') onEnd?.()
    }, (error) => console.warn(error.message)).then((cleanup) => {
      if (active) unsubscribe = cleanup
      else cleanup()
    }).catch((error) => console.warn(error.message))

    return () => {
      active = false
      unsubscribe()
    }
  }, [call?.id, onEnd])

  if (!call) return null

  function toggleMute() {
    const nextMuted = !muted
    setMuted(nextMuted)
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
    if (call.id !== 'starting') updateCallParticipant(call.id, { muted: nextMuted, cameraOff }).catch((error) => console.warn(error.message))
  }

  function toggleCamera() {
    const nextCameraOff = !cameraOff
    setCameraOff(nextCameraOff)
    streamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff
    })
    if (call.id !== 'starting') updateCallParticipant(call.id, { muted, cameraOff: nextCameraOff }).catch((error) => console.warn(error.message))
  }

  async function hangUp() {
    if (call.id === 'starting') {
      onEnd?.()
      return
    }
    await endCallSession(call.id).catch((error) => console.warn(error.message))
    onEnd?.()
  }

  const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const seconds = String(elapsed % 60).padStart(2, '0')

  return (
    <section className={`call-overlay ${call.mode}`}>
      <div className="call-stage">
        {call.mode === 'video' && !cameraOff ? (
          <video ref={localVideoRef} autoPlay muted playsInline />
        ) : (
          <Avatar person={contact} size="hero" />
        )}
        <div className="call-rings"><i /><i /><i /></div>
      </div>
      <div className="call-copy">
        <span>{call.mode === 'video' ? 'Wave video' : 'Wave voice'}</span>
        <h2>{contact?.name || 'Wave call'}</h2>
        <p>{status} - {minutes}:{seconds}</p>
      </div>
      <div className="call-controls">
        <button className={muted ? 'active' : ''} type="button" onClick={toggleMute} aria-label="Mute microphone"><Icon name={muted ? 'mute' : 'mic'} /></button>
        <button className={cameraOff ? 'active' : ''} type="button" onClick={toggleCamera} aria-label="Toggle camera" disabled={call.mode !== 'video'}><Icon name={cameraOff ? 'videoOff' : 'video'} /></button>
        <button className="hangup" type="button" onClick={hangUp} aria-label="End call"><Icon name="phoneOff" /></button>
      </div>
    </section>
  )
}

function StatusPage({ statuses }) {
  return (
    <section className="content-page">
      <PageTitle title="Status" text="Camera updates, voice statuses, and encrypted close-friends moments." />
      <div className="status-grid">
        <button className="status-card mine"><span>+</span><strong>My status</strong><small>Add photo, video, or voice update</small></button>
        {statuses.length === 0 && <EmptyState title="No status updates" text="Live status updates from Supabase will show here." />}
        {statuses.map((item) => <button className={`status-card ${item.seen ? 'seen-status' : ''}`} key={item.id}><div className={`status-ring ${item.color}`}>{item.name.slice(0, 1)}</div><strong>{item.name}</strong><small>{item.label}</small></button>)}
      </div>
    </section>
  )
}

function CallsPage({ calls, conversations, onStartCall }) {
  const featuredCalls = calls.slice(0, 3)
  const firstConversation = conversations[0]

  return (
    <section className="content-page calls-page">
      <header className="calls-hero">
        <div>
          <h1>Calls</h1>
          <p>Private voice and video calls, call links, and quiet group rooms.</p>
        </div>
        <button className="hero-call-button" type="button" disabled={!firstConversation} onClick={() => onStartCall?.(firstConversation, 'video')}><Icon name="video" />Start</button>
      </header>

      <div className="call-actions">
        <button type="button" disabled={!firstConversation} onClick={() => onStartCall?.(firstConversation, 'voice')}>
          <span><Icon name="phone" /></span>
          <strong>Call link</strong>
          <small>Create a private link</small>
        </button>
        <button type="button" disabled={!firstConversation} onClick={() => onStartCall?.(firstConversation, 'video')}>
          <span><Icon name="video" /></span>
          <strong>Video room</strong>
          <small>Start with friends</small>
        </button>
        <button type="button" disabled={!firstConversation} onClick={() => onStartCall?.(firstConversation, 'voice')}>
          <span><Icon name="spark" /></span>
          <strong>Focus call</strong>
          <small>No rings, just invite</small>
        </button>
      </div>

      <section className="recent-calls">
        <div className="section-heading">
          <strong>Recent</strong>
          <button type="button">Edit</button>
        </div>
      <div className="page-list">
          {featuredCalls.length === 0 && <EmptyState title="No recent calls" text="Your live call history from Supabase will show here." />}
          {featuredCalls.map((call) => (
            <button className={`call-card ${call.missed ? 'missed' : ''}`} key={call.id}>
              <span><Icon name={call.type.includes('Video') ? 'video' : 'phone'} /></span>
              <div>
                <strong>{call.name}</strong>
                <small>{call.type} - {call.time}</small>
              </div>
              <Icon name="phone" />
            </button>
          ))}
        </div>
      </section>

      <div className="calls-note">
        <Icon name="lock" />
        <p>Calls are end-to-end encrypted and never stored by Wave.</p>
      </div>
    </section>
  )
}

function CommunitiesPage({ communities }) {
  return (
    <section className="content-page">
      <PageTitle title="Communities" text="Organize groups under one umbrella with announcement channels." />
      <div className="community-grid">
        {communities.length === 0 && <EmptyState title="No communities yet" text="Create communities in Supabase and they will appear here." />}
        {communities.map((community) => (
          <button className="community-card" key={community.id}>
            <span>{community.name.slice(0, 2)}</span>
            <strong>{community.name}</strong>
            <small>{community.members} members - {community.groups} groups</small>
          </button>
        ))}
      </div>
    </section>
  )
}

function ContactsPage({ contacts, refreshAppData, openChat }) {
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('')
  const [syncing, setSyncing] = useState(false)

  async function syncContacts() {
    setSyncing(true)
    setStatus('')
    try {
      const deviceContacts = await readDeviceContacts()
      if (deviceContacts.length === 0) {
        setStatus('Open Wave as the iOS app to read your phone contacts, or add a number below while testing.')
        return
      }

      const matched = await syncContactsToWave(deviceContacts)
      await refreshAppData()
      setStatus(matched.length ? `${matched.length} Wave contact${matched.length === 1 ? '' : 's'} found.` : 'No registered Wave users found in your contacts yet.')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setSyncing(false)
    }
  }

  async function addPhoneContact(event) {
    event.preventDefault()
    if (!phone.trim()) return
    setSyncing(true)
    setStatus('')
    try {
      const contact = await findRegisteredContactByPhone(phone)
      await refreshAppData()
      setStatus(`${contact.name} is on Wave.`)
      setPhone('')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setSyncing(false)
    }
  }

  async function messageContact(contactId) {
    setSyncing(true)
    setStatus('')
    try {
      const conversationId = await startDirectConversation(contactId)
      await refreshAppData()
      openChat(conversationId)
    } catch (error) {
      setStatus(error.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="content-page contacts-page">
      <PageTitle title="Contacts" text="People and groups you can message, call, or invite into communities." />
      <div className="contact-tools">
        <button type="button" onClick={syncContacts} disabled={syncing}>
          <Icon name="phone" />
          {syncing ? 'Checking...' : 'Sync phone contacts'}
        </button>
        <form onSubmit={addPhoneContact}>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="+254..." aria-label="Wave phone number" />
          <button type="submit" disabled={syncing}>Find</button>
        </form>
      </div>
      {status && <div className="register-status">{status}</div>}
      <div className="page-list">
        {contacts.length === 0 && <EmptyState title="No contacts yet" text="Profiles and conversations from Supabase will appear here." />}
        <button className="contact-card" type="button" onClick={shareWaveInvite}>
          <div className="profile-avatar">W</div>
          <div>
            <strong>Invite to Wave</strong>
            <small>Share with iOS share sheet</small>
          </div>
          <Icon name="send" />
        </button>
        {contacts.map((person) => (
          <button className="contact-card" key={person.id} onClick={() => messageContact(person.id)} disabled={syncing}>
            <Avatar person={person} />
            <div>
              <strong>{person.name}</strong>
              <small>{person.deviceName || person.handle}</small>
            </div>
            <Icon name="send" />
          </button>
        ))}
      </div>
    </section>
  )
}

function MarketplacePage({ items }) {
  return (
    <section className="content-page marketplace-page">
      <PageTitle title="Marketplace" text="Discover chat themes, sticker packs, business chats, bots, and paid channels." />
      <div className="market-grid">
        {items.length === 0 && <EmptyState title="No marketplace items" text="Live marketplace records from Supabase will appear here." />}
        {items.map((item, index) => (
          <button className={`market-card market-${index}`} key={item.id}>
            <span><Icon name={item.icon || 'spark'} /></span>
            <strong>{item.name}</strong>
            <small>{item.meta}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

function SettingsPage({ settings }) {
  const navigate = useNavigate()
  const [values, setValues] = useState(settings || {})
  const [status, setStatus] = useState('')
  const rows = [
    ['screenLock', 'Screen lock'],
    ['readReceipts', 'Read receipts'],
    ['liveLocation', 'Live location sharing'],
    ['chatLock', 'Chat lock'],
  ]

  useEffect(() => {
    setValues(settings || {})
  }, [settings])

  async function changeSetting(key, checked) {
    const nextValues = { ...values, [key]: checked }
    setValues(nextValues)
    setStatus('')
    try {
      await updateUserSettings(nextValues)
    } catch (error) {
      setStatus(error.message)
    }
  }

  return (
    <section className="content-page">
      <PageTitle title="Settings" text="Privacy, profile, notifications, storage, and linked devices." />
      <div className="settings-grid">
        <button className="setting-row register-row" type="button" onClick={() => navigate('/register')}>
          <span>Register phone number</span>
          <Icon name="phone" />
        </button>
        {!settings && <EmptyState title="No settings profile" text="Register your phone to create live settings in Supabase." />}
        {rows.map(([key, label]) => (
          <label className="setting-row" key={key}>
            <span>{label}</span>
            <input type="checkbox" checked={Boolean(values[key])} disabled={!settings} onChange={(event) => changeSetting(key, event.target.checked)} />
          </label>
        ))}
        {status && <div className="register-status">{status}</div>}
      </div>
    </section>
  )
}

function RegisterPage() {
  const navigate = useNavigate()
  const pendingVerification = useMemo(() => readPendingPhoneVerification(), [])
  const initialCountry = countries.find((item) => item.code === pendingVerification?.countryCode) || countries[0]
  const [country, setCountry] = useState(initialCountry)
  const [localNumber, setLocalNumber] = useState(pendingVerification?.localNumber || '')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState(pendingVerification ? 'otp' : 'phone')
  const [status, setStatus] = useState(pendingVerification ? 'Code sent. Enter the SMS verification code.' : '')
  const [loading, setLoading] = useState(false)
  const otpInputs = useRef([])
  const fullPhone = `${country.code}${localNumber.replace(/\D/g, '')}`
  const otpDigits = otp.padEnd(6, ' ').slice(0, 6).split('')

  useEffect(() => {
    if (step !== 'otp') return undefined
    window.setTimeout(() => otpInputs.current[0]?.focus(), 120)

    if (!('OTPCredential' in window) || !navigator.credentials) return undefined

    const controller = new AbortController()
    navigator.credentials.get({
      otp: { transport: ['sms'] },
      signal: controller.signal,
    }).then((credential) => {
      const code = credential?.code?.replace(/\D/g, '').slice(0, 6)
      if (code) setOtp(code)
    }).catch(() => {})

    return () => controller.abort()
  }, [step])

  function fillOtp(value, startIndex = 0) {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    if (!digits) return

    const next = otpDigits.map((digit) => digit.trim())
    digits.split('').forEach((digit, offset) => {
      const target = startIndex + offset
      if (target < 6) next[target] = digit
    })

    setOtp(next.join('').slice(0, 6))
    window.setTimeout(() => {
      const focusIndex = Math.min(startIndex + digits.length, 5)
      otpInputs.current[focusIndex]?.focus()
    }, 0)
  }

  function changeOtpDigit(index, value) {
    if (value.length > 1) {
      fillOtp(value, index)
      return
    }

    const digit = value.replace(/\D/g, '')
    const next = otpDigits.map((item) => item.trim())
    next[index] = digit
    setOtp(next.join('').slice(0, 6))

    if (digit && index < 5) {
      otpInputs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index, event) {
    if (event.key !== 'Backspace') return
    if (otpDigits[index].trim()) return

    event.preventDefault()
    const next = otpDigits.map((item) => item.trim())
    if (index > 0) {
      next[index - 1] = ''
      setOtp(next.join('').slice(0, 6))
      otpInputs.current[index - 1]?.focus()
    }
  }

  async function submitPhone(event) {
    event.preventDefault()
    if (localNumber.replace(/\D/g, '').length < 7) {
      setStatus('Enter a valid phone number.')
      return
    }

    setLoading(true)
    setStatus('')
    try {
      await requestPhoneOtp(fullPhone)
      savePendingPhoneVerification({
        countryCode: country.code,
        countryName: country.name,
        localNumber,
        phone: fullPhone,
        sentAt: Date.now(),
      })
      setStep('otp')
      setStatus('Code sent. Check your phone for the SMS verification code.')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitOtp(event) {
    event.preventDefault()
    if (otp.replace(/\D/g, '').length < 6) {
      setStatus('Enter the 6 digit code.')
      return
    }

    setLoading(true)
    setStatus('')
    try {
      const data = await verifyPhoneOtp(fullPhone, otp)
      setStatus('Code confirmed. Opening Wave...')
      await saveRegistrationProfile({
        userId: data.user?.id,
        phone: fullPhone,
        countryName: country.name,
        countryCode: country.code,
      })
      clearPendingPhoneVerification()
      navigate('/chats')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function resendOtp() {
    setLoading(true)
    setStatus('')
    try {
      await requestPhoneOtp(fullPhone)
      savePendingPhoneVerification({
        countryCode: country.code,
        countryName: country.name,
        localNumber,
        phone: fullPhone,
        sentAt: Date.now(),
      })
      setOtp('')
      setStatus('New code sent. Check your SMS messages.')
      window.setTimeout(() => otpInputs.current[0]?.focus(), 120)
    } catch (error) {
      setStatus(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="register-page">
      <section className="register-panel">
        <div className="register-brand">
          <div className="brand-mark">W</div>
          <span>Wave</span>
        </div>
        <div className="register-icon"><Icon name={step === 'phone' ? 'smartphone' : 'key'} /></div>
        <h1>{step === 'phone' ? 'Enter your phone number' : 'Verify your number'}</h1>
        <p>{step === 'phone' ? 'Choose your country and confirm your phone number to start messaging.' : `We sent a 6 digit code to ${fullPhone}.`}</p>

        {step === 'phone' ? (
          <form className="register-form" onSubmit={submitPhone}>
            <label>
              <span>Country</span>
              <select value={country.code} onChange={(event) => setCountry(countries.find((item) => item.code === event.target.value))}>
                {countries.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}
              </select>
            </label>
            <label>
              <span>Phone number</span>
              <div className="phone-input">
                <strong>{country.code}</strong>
                <input value={localNumber} onChange={(event) => setLocalNumber(event.target.value)} inputMode="tel" placeholder={country.example} />
              </div>
            </label>
            <button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Continue'}</button>
          </form>
        ) : (
          <form className="register-form" onSubmit={submitOtp}>
            <label>
              <span>Verification code</span>
              <div className="otp-grid" onPaste={(event) => {
                event.preventDefault()
                fillOtp(event.clipboardData.getData('text'))
              }}>
                {otpDigits.map((digit, index) => (
                  <input
                    aria-label={`Code digit ${index + 1}`}
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    className="otp-box"
                    enterKeyHint={index === 5 ? 'done' : 'next'}
                    inputMode="numeric"
                    key={index}
                    maxLength={index === 0 ? '6' : '1'}
                    name={index === 0 ? 'one-time-code' : undefined}
                    onChange={(event) => changeOtpDigit(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    pattern="[0-9]*"
                    ref={(element) => { otpInputs.current[index] = element }}
                    type="text"
                    value={digit.trim()}
                  />
                ))}
              </div>
            </label>
            <button type="submit" disabled={loading}>{loading ? 'Verifying...' : 'Verify and continue'}</button>
            <button className="text-button" type="button" disabled={loading} onClick={resendOtp}>Resend code</button>
            <button className="text-button" type="button" onClick={() => {
              clearPendingPhoneVerification()
              setOtp('')
              setStep('phone')
              setStatus('')
            }}>Change number</button>
          </form>
        )}

        {status && <div className="register-status">{status}</div>}
        <div className="register-trust"><Icon name="shield" /> End-to-end encryption starts after registration.</div>
      </section>
    </main>
  )
}

function PageTitle({ title, text }) {
  return (
    <header className="page-title">
      <span>Wave</span>
      <h1>{title}</h1>
      <p>{text}</p>
    </header>
  )
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <small>{text}</small>
    </div>
  )
}

function DetailPanel({ active }) {
  const media = useMemo(() => ['Photo', 'Video', 'Doc', 'Link', 'Audio', 'Poll'], [])

  return (
    <aside className="detail-panel">
      <section className="profile-card">
        <Avatar person={active} size="hero" />
        <h2>{active.name}</h2>
        <p>{active.handle}</p>
        <div className="profile-actions">
          <button><Icon name="phone" />Audio</button>
          <button><Icon name="video" />Video</button>
          <button><Icon name="search" />Search</button>
        </div>
      </section>

      <section className="feature-card">
        <div className="card-title"><Icon name="spark" /><span>Wave-only features</span></div>
        <button><strong>Vibe lens</strong><small>Summarizes chat tone before you reply.</small></button>
        <button><strong>Quiet arrival</strong><small>Deliver silently during focus hours.</small></button>
        <button><strong>Memory capsule</strong><small>Bundle photos, voice notes, and locations.</small></button>
      </section>

      <section className="feature-card">
        <div className="card-title"><Icon name="file" /><span>Media, links, docs</span></div>
        <div className="media-library">
          {media.map((item, index) => <button className={`media-tile tile-${index}`} key={item}>{item}</button>)}
        </div>
      </section>
    </aside>
  )
}

function AppFrame() {
  const [appData, setAppData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [messages, setMessages] = useState([])
  const [typingUsers, setTypingUsers] = useState([])
  const [activeCall, setActiveCall] = useState(null)
  const [callContact, setCallContact] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()
  const routeKey = location.pathname.split('/')[1] || 'chats'
  const view = viewByPath[routeKey] || 'Chats'
  const activeId = params.chatId || appData?.conversations?.[0]?.id || ''
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const mobileChatOpen = Boolean(params.chatId)

  function setView(nextView) {
    navigate(routeByView[nextView] || '/chats')
  }

  function setActiveId(nextId) {
    if (params.chatId) navigate(`/chats/${nextId}`)
  }

  async function loadAppData() {
    const data = await getAppData()
    setAppData(data)
    return data
  }

  async function beginCall(conversation, mode) {
    if (!conversation?.id) return
    setCallContact(conversation)
    setActiveCall({
      id: 'starting',
      conversationId: conversation.id,
      mode,
      status: 'starting',
      isMine: true,
    })

    try {
      await lightTap()
      const call = await startCallSession(conversation, mode)
      setActiveCall(call)
    } catch (error) {
      setLoadError(error.message)
      setActiveCall(null)
    }
  }

  useEffect(() => {
    loadAppData().catch((error) => setLoadError(error.message))
  }, [])

  useEffect(() => {
    if (!appData) return
    getMessages(activeId).then(setMessages).catch((error) => setLoadError(error.message))
  }, [activeId, Boolean(appData)])

  useEffect(() => {
    if (!appData || !activeId) return undefined

    let active = true
    let unsubscribe = () => {}

    subscribeToMessages(activeId, (message) => {
      if (!active) return

      setMessages((current) => mergeMessageList(current, message))
      setAppData((currentData) => {
        if (!currentData) return currentData

        return {
          ...currentData,
          conversations: currentData.conversations.map((conversation) => (
            conversation.id === activeId
              ? { ...conversation, preview: message.text || message.caption || conversation.preview, time: message.time }
              : conversation
          )),
        }
      })
    }, (error) => console.warn(error.message)).then((cleanup) => {
      if (active) {
        unsubscribe = cleanup
      } else {
        cleanup()
      }
    }).catch((error) => setLoadError(error.message))

    return () => {
      active = false
      unsubscribe()
    }
  }, [activeId, appData?.currentProfile?.id])

  useEffect(() => {
    if (!appData || !activeId) return undefined

    let active = true
    let unsubscribe = () => {}
    setTypingUsers([])

    subscribeToTyping(activeId, (users) => {
      if (active) setTypingUsers(users)
    }, (error) => console.warn(error.message)).then((cleanup) => {
      if (active) {
        unsubscribe = cleanup
      } else {
        cleanup()
      }
    }).catch((error) => console.warn(error.message))

    return () => {
      active = false
      setTypingUsers([])
      unsubscribe()
    }
  }, [activeId, appData?.currentProfile?.id])

  if (loadError) return <main className="loading-screen error-screen"><div className="brand-mark">W</div><strong>Database error</strong><small>{loadError}</small></main>
  if (!appData) return <main className="loading-screen"><div className="brand-mark">W</div><strong>Loading Wave...</strong></main>
  if (appData.needsRegistration) return <AuthRequired openRegister={() => navigate('/register')} />

  const active = appData.conversations.find((item) => item.id === activeId) || appData.conversations[0] || {
    id: '',
    name: 'No chat selected',
    handle: '',
    initials: 'W',
    color: 'mint',
    status: 'offline',
    lastSeen: 'Create a conversation in Supabase',
    labels: [],
  }

  return (
    <main className={`app-shell ${mobileChatOpen ? 'mobile-chat-open' : ''} ${view !== 'Chats' ? 'section-page-open' : ''} page-${view.toLowerCase()}`}>
      <Sidebar
        appData={appData}
        activeId={activeId}
        setActiveId={setActiveId}
        view={view}
        setView={setView}
        query={query}
        setQuery={setQuery}
        filter={filter}
        setFilter={setFilter}
        openChat={(chatId) => navigate(`/chats/${chatId}`)}
        openRegister={() => navigate('/register')}
      />
      {view === 'Chats' && <ChatPage active={active} messages={messages} setMessages={setMessages} typingUsers={typingUsers} backUnread={appData.conversations.reduce((total, item) => total + (item.id === active.id ? 0 : item.unread || 0), 0)} routeMode={Boolean(params.chatId)} closeChat={() => navigate('/chats')} onStartCall={beginCall} />}
      {view === 'Status' && <StatusPage statuses={appData.statuses} />}
      {view === 'Calls' && <CallsPage calls={appData.calls} conversations={appData.conversations} onStartCall={beginCall} />}
      {view === 'Communities' && <CommunitiesPage communities={appData.communities} />}
      {view === 'Contacts' && <ContactsPage contacts={appData.contacts} refreshAppData={loadAppData} openChat={(chatId) => navigate(`/chats/${chatId}`)} />}
      {view === 'Marketplace' && <MarketplacePage items={appData.marketplace} />}
      {view === 'Settings' && <SettingsPage settings={appData.settings} />}
      <DetailPanel active={active} />
      <BottomNav view={view} setView={setView} />
      <CallOverlay call={activeCall} contact={callContact || active} onEnd={() => setActiveCall(null)} />
    </main>
  )
}

function AuthRequired({ openRegister }) {
  return (
    <main className="loading-screen auth-required">
      <div className="brand-mark">W</div>
      <strong>Sign in with your phone number</strong>
      <small>Wave only lets registered phone-number users chat with matched contacts.</small>
      <button type="button" onClick={openRegister}>Register phone</button>
    </main>
  )
}

function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/chats" replace />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/chats" element={<AppFrame />} />
          <Route path="/chats/:chatId" element={<AppFrame />} />
          <Route path="/status" element={<AppFrame />} />
          <Route path="/calls" element={<AppFrame />} />
          <Route path="/communities" element={<AppFrame />} />
          <Route path="/contacts" element={<AppFrame />} />
          <Route path="/marketplace" element={<AppFrame />} />
          <Route path="/settings" element={<AppFrame />} />
          <Route path="*" element={<Navigate to="/chats" replace />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  )
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="loading-screen error-screen">
          <div className="brand-mark">W</div>
          <strong>App error</strong>
          <small>{this.state.error.message}</small>
        </main>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
