'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

type CatchRequest = {
  id: string
  sender_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  sender: Profile
  receiver: Profile
}

type Message = {
  id: string
  request_id: string
  sender_id: string
  content: string
  created_at: string
}

type PartnerRequest = {
  id: string
  follower_id: string
  follower: Profile
}

type View = 'list' | 'chat' | 'accept-decline'

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(first: string | null, last: string | null): string {
  return [(first || '')[0], (last || '')[0]].filter(Boolean).join('').toUpperCase() || '?'
}

function formatRelTime(ts: string | null | undefined): string {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / 86_400_000)}d`
}

// ── MiniAvatar ─────────────────────────────────────────────────────────────────

function MiniAvatar({ profile, size = 36 }: { profile: Profile; size?: number }) {
  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={[profile.first_name, profile.last_name].filter(Boolean).join(' ')}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#c4822a', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: Math.round(size * 0.38),
      color: '#0d1f3c', letterSpacing: '0.04em',
    }}>
      {getInitials(profile.first_name, profile.last_name)}
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconChat() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        fill="#0d1f3c"
      />
    </svg>
  )
}

function IconChevronDown({ color = 'rgba(245,237,214,0.5)' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 6L8 11L13 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8L10 13" stroke="#c4822a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSend({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M14.5 1.5L7 9M14.5 1.5L10 14.5L7 9M14.5 1.5L1.5 5.5L7 9"
        stroke={active ? '#0d1f3c' : 'rgba(13,31,60,0.5)'}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MessagingPanel() {
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('list')

  const [conversations, setConversations] = useState<CatchRequest[]>([])
  const [loadingConvs, setLoadingConvs] = useState(false)
  const [activeConv, setActiveConv] = useState<CatchRequest | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([])
  const [badgeCount, setBadgeCount] = useState(0)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const realtimeRef = useRef<RealtimeChannel | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Auth ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Fetch conversations ────────────────────────────────────────────────────

  const fetchConversations = useCallback(async (uid: string) => {
    setLoadingConvs(true)

    // Step 1: fetch catch_requests
    const { data, error } = await supabase
      .from('catch_requests')
      .select('*')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .neq('status', 'declined')
      .order('created_at', { ascending: false })

    console.log('[MessagingPanel] conversations query result:', data, error)

    if (error) {
      console.error('[MessagingPanel] fetch conversations error:', error)
      setLoadingConvs(false)
      return
    }

    const requests = data ?? []

    if (requests.length === 0) {
      setConversations([])
      setLoadingConvs(false)
      return
    }

    // Step 2: fetch profiles for all other players
    const otherPlayerIds = requests.map((r: { sender_id: string; receiver_id: string }) =>
      r.sender_id === uid ? r.receiver_id : r.sender_id
    )

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .in('id', otherPlayerIds)

    if (profilesError) {
      console.error('[MessagingPanel] fetch profiles error:', profilesError)
    }

    const profileMap: Record<string, Profile> = {}
    for (const p of (profilesData ?? [])) {
      profileMap[p.id] = p as Profile
    }

    // Step 3: combine into CatchRequest shape
    const combined: CatchRequest[] = requests.map((r: {
      id: string; sender_id: string; receiver_id: string;
      status: 'pending' | 'accepted' | 'declined'; created_at: string
    }) => {
      const otherPlayerId = r.sender_id === uid ? r.receiver_id : r.sender_id
      const otherProfile = profileMap[otherPlayerId] ?? {
        id: otherPlayerId, first_name: null, last_name: null, avatar_url: null,
      }
      return {
        id: r.id,
        sender_id: r.sender_id,
        receiver_id: r.receiver_id,
        status: r.status,
        created_at: r.created_at,
        sender: r.sender_id === uid
          ? { id: uid, first_name: null, last_name: null, avatar_url: null }
          : otherProfile,
        receiver: r.receiver_id === uid
          ? { id: uid, first_name: null, last_name: null, avatar_url: null }
          : otherProfile,
      }
    })

    setConversations(combined)
    setLoadingConvs(false)
  }, [])

  // ── Fetch partner requests ─────────────────────────────────────────────────

  const fetchPartnerRequests = useCallback(async (uid: string) => {
    const { data: followsData } = await supabase
      .from('follows')
      .select('id, follower_id')
      .eq('following_id', uid)
      .eq('status', 'pending')

    const rows = (followsData ?? []) as { id: string; follower_id: string }[]
    if (rows.length === 0) { setPartnerRequests([]); return }

    const followerIds = rows.map(r => r.follower_id)
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .in('id', followerIds)

    const profileMap: Record<string, Profile> = {}
    for (const p of (profilesData ?? []) as Profile[]) {
      profileMap[p.id] = p
    }

    setPartnerRequests(rows.map(r => ({
      id: r.id,
      follower_id: r.follower_id,
      follower: profileMap[r.follower_id] ?? { id: r.follower_id, first_name: null, last_name: null, avatar_url: null },
    })))
  }, [])

  useEffect(() => {
    if (userId) {
      fetchConversations(userId)
      fetchPartnerRequests(userId)
    }
  }, [userId, fetchConversations, fetchPartnerRequests])

  // ── Badge count: pending catch requests + pending partner requests ─────────

  useEffect(() => {
    if (!userId) { setBadgeCount(0); return }
    const catchCount = conversations.filter(
      c => c.status === 'pending' && c.receiver_id === userId
    ).length
    setBadgeCount(catchCount + partnerRequests.length)
  }, [conversations, partnerRequests, userId])

  // ── Fetch messages for active conversation ─────────────────────────────────

  useEffect(() => {
    if (!activeConv) { setMessages([]); return }
    setLoadingMsgs(true)
    supabase
      .from('messages')
      .select('id, request_id, sender_id, content, created_at')
      .eq('request_id', activeConv.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[MessagingPanel] fetch messages error:', error)
        setMessages((data as Message[]) ?? [])
        setLoadingMsgs(false)
      })
  }, [activeConv])

  // ── Realtime subscription for new messages ─────────────────────────────────

  useEffect(() => {
    // Clean up previous subscription
    if (realtimeRef.current) {
      realtimeRef.current.unsubscribe()
      realtimeRef.current = null
    }
    if (!activeConv) return

    const channel = supabase
      .channel(`messages-panel:${activeConv.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `request_id=eq.${activeConv.id}`,
        },
        (payload) => {
          const incoming = payload.new as Message
          // Skip messages from the current user — already added optimistically
          if (incoming.sender_id === userId) return
          setMessages(prev => [...prev, incoming])
        }
      )
      .subscribe()

    realtimeRef.current = channel
    return () => {
      channel.unsubscribe()
      realtimeRef.current = null
    }
  }, [activeConv?.id])

  // ── Auto-scroll to bottom when messages update ─────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Auto-resize textarea ───────────────────────────────────────────────────

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 80)}px`
  }, [input])

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function sendMessage() {
    if (!input.trim() || !activeConv || !userId || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)

    console.log('[MessagingPanel] attempting insert:', {
      request_id: activeConv.id,
      sender_id: userId,
      content,
    })

    const { error } = await supabase.from('messages').insert({
      request_id: activeConv.id,
      sender_id: userId,
      content,
    })

    if (error) {
      console.error('[MessagingPanel] send message error:', error)
      console.error('[MessagingPanel] send error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      setInput(content)
    } else {
      // Optimistically add the sent message immediately so the sender sees it
      const optimistic: Message = {
        id: Date.now().toString(),
        request_id: activeConv.id,
        sender_id: userId,
        content,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, optimistic])
    }
    setSending(false)
  }

  async function acceptRequest(conv: CatchRequest) {
    const { error } = await supabase
      .from('catch_requests')
      .update({ status: 'accepted' })
      .eq('id', conv.id)

    if (error) {
      console.error('[MessagingPanel] accept request error:', error)
      return
    }
    const updated: CatchRequest = { ...conv, status: 'accepted' }
    setConversations(prev => prev.map(c => c.id === conv.id ? updated : c))
    setActiveConv(updated)
    setView('chat')
  }

  async function declineRequest(conv: CatchRequest) {
    const { error } = await supabase
      .from('catch_requests')
      .update({ status: 'declined' })
      .eq('id', conv.id)

    if (error) {
      console.error('[MessagingPanel] decline request error:', error)
      return
    }
    setConversations(prev => prev.filter(c => c.id !== conv.id))
    setActiveConv(null)
    setView('list')
  }

  function getOtherPlayer(conv: CatchRequest): Profile {
    return conv.sender_id === userId ? conv.receiver : conv.sender
  }

  function goBack() {
    setView('list')
    setActiveConv(null)
    setMessages([])
  }

  async function acceptPartnerRequest(req: PartnerRequest) {
    await supabase.from('follows').update({ status: 'accepted' }).eq('id', req.id)
    setPartnerRequests(prev => prev.filter(r => r.id !== req.id))
  }

  async function declinePartnerRequest(req: PartnerRequest) {
    await supabase.from('follows').update({ status: 'declined' }).eq('id', req.id)
    setPartnerRequests(prev => prev.filter(r => r.id !== req.id))
  }

  function handleOpen() {
    setOpen(o => {
      const next = !o
      if (next && userId) {
        fetchConversations(userId)
        fetchPartnerRequests(userId)
      }
      return next
    })
  }

  // ── Don't render if not logged in ─────────────────────────────────────────

  if (!userId) return null

  // ── Inner render helpers ───────────────────────────────────────────────────

  function renderConversationList() {
    if (loadingConvs) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            border: '2px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a',
            animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      )
    }

    if (conversations.length === 0 && partnerRequests.length === 0) {
      return (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '10px', padding: '32px 24px', textAlign: 'center',
        }}>
          <span style={{ fontSize: '38px' }}>⚾</span>
          <p style={{
            color: 'rgba(245,237,214,0.4)', fontSize: '13px',
            fontFamily: "'Barlow', sans-serif", margin: 0, lineHeight: 1.5,
          }}>
            No catch requests yet.<br />Head to Players to send one!
          </p>
        </div>
      )
    }

    return (
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Partner Requests section ── */}
        {partnerRequests.length > 0 && (
          <div>
            <div style={{
              padding: '8px 16px 4px',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, fontSize: '10px', letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#c4822a',
            }}>
              Partner Requests
            </div>
            {partnerRequests.map(req => {
              const name = [req.follower.first_name, req.follower.last_name].filter(Boolean).join(' ') || 'Unknown Player'
              return (
                <div key={req.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <MiniAvatar profile={req.follower} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                      fontSize: '13px', color: '#f5edd6',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>
                      {name}
                    </div>
                    <div style={{
                      fontSize: '11px', color: 'rgba(245,237,214,0.4)',
                      fontFamily: "'Barlow', sans-serif", marginTop: '1px',
                    }}>
                      wants to be your catch partner
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <button
                        onClick={() => acceptPartnerRequest(req)}
                        style={{
                          flex: 1, padding: '5px 8px', borderRadius: '6px',
                          background: 'rgba(45,90,27,0.7)', color: '#48bb78',
                          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                          fontSize: '11px', letterSpacing: '0.05em', cursor: 'pointer',
                          border: '1px solid rgba(72,187,120,0.4)', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(45,90,27,0.95)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(45,90,27,0.7)' }}
                      >
                        Accept ✓
                      </button>
                      <button
                        onClick={() => declinePartnerRequest(req)}
                        style={{
                          flex: 1, padding: '5px 8px', borderRadius: '6px',
                          background: 'transparent', color: 'rgba(245,237,214,0.55)',
                          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                          fontSize: '11px', letterSpacing: '0.05em', cursor: 'pointer',
                          border: '1px solid rgba(245,237,214,0.18)', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          const el = e.currentTarget as HTMLButtonElement
                          el.style.borderColor = 'rgba(229,62,62,0.5)'
                          el.style.color = '#fc8181'
                        }}
                        onMouseLeave={e => {
                          const el = e.currentTarget as HTMLButtonElement
                          el.style.borderColor = 'rgba(245,237,214,0.18)'
                          el.style.color = 'rgba(245,237,214,0.55)'
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {conversations.length > 0 && (
              <div style={{ height: '1px', background: 'rgba(196,130,42,0.15)', margin: '4px 0' }} />
            )}
          </div>
        )}

        {conversations.map(conv => {
          const other = getOtherPlayer(conv)
          const isReceived = conv.receiver_id === userId
          const isPendingReceived = conv.status === 'pending' && isReceived
          const isPendingSent = conv.status === 'pending' && !isReceived
          const isAccepted = conv.status === 'accepted'
          const clickable = isPendingReceived || isAccepted

          const pill = isPendingReceived
            ? { label: 'Pending', bg: 'rgba(196,130,42,0.18)', color: '#c4822a', border: '1px solid rgba(196,130,42,0.4)' }
            : isPendingSent
            ? { label: 'Awaiting', bg: 'rgba(255,255,255,0.05)', color: 'rgba(245,237,214,0.4)', border: '1px solid rgba(245,237,214,0.12)' }
            : { label: 'Active', bg: 'rgba(45,90,27,0.3)', color: '#48bb78', border: '1px solid rgba(72,187,120,0.3)' }

          const timeStamp = conv.created_at

          return (
            <div
              key={conv.id}
              onClick={() => {
                if (isPendingReceived) { setActiveConv(conv); setView('accept-decline') }
                else if (isAccepted) { setActiveConv(conv); setView('chat') }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px',
                cursor: clickable ? 'pointer' : 'default',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              <MiniAvatar profile={other} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    fontSize: '14px', color: '#f5edd6',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>
                    {[other.first_name, other.last_name].filter(Boolean).join(' ') || 'Unknown Player'}
                  </span>
                  <span style={{
                    fontSize: '11px', color: 'rgba(245,237,214,0.35)',
                    fontFamily: "'Barlow', sans-serif", flexShrink: 0,
                  }}>
                    {formatRelTime(timeStamp)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{
                    fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    letterSpacing: '0.05em', padding: '1px 6px', borderRadius: '4px', flexShrink: 0,
                    background: pill.bg, color: pill.color, border: pill.border,
                  }}>
                    {pill.label}
                  </span>
                </div>
              </div>
              {clickable && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M5 3L9 7L5 11" stroke="rgba(245,237,214,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  function renderAcceptDecline() {
    if (!activeConv) return null
    const other = getOtherPlayer(activeConv)
    const name = [other.first_name, other.last_name].filter(Boolean).join(' ') || 'this player'

    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px', gap: '20px',
      }}>
        <MiniAvatar profile={other} size={64} />
        <div style={{ textAlign: 'center' }}>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            fontSize: '18px', color: '#f5edd6', margin: '0 0 6px',
          }}>
            {name}
          </p>
          <p style={{
            fontFamily: "'Barlow', sans-serif", fontSize: '13px',
            color: 'rgba(245,237,214,0.45)', margin: 0,
          }}>
            wants to play catch with you
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          <button
            onClick={() => acceptRequest(activeConv)}
            style={{
              flex: 1, padding: '11px 8px', borderRadius: '8px',
              background: 'rgba(45,90,27,0.7)', color: '#48bb78',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: '14px', letterSpacing: '0.06em', cursor: 'pointer',
              border: '1px solid rgba(72,187,120,0.4)', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(45,90,27,0.95)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(45,90,27,0.7)' }}
          >
            Accept ✓
          </button>
          <button
            onClick={() => declineRequest(activeConv)}
            style={{
              flex: 1, padding: '11px 8px', borderRadius: '8px',
              background: 'transparent', color: 'rgba(245,237,214,0.55)',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: '14px', letterSpacing: '0.06em', cursor: 'pointer',
              border: '1px solid rgba(245,237,214,0.18)', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.borderColor = 'rgba(229,62,62,0.5)'
              el.style.color = '#fc8181'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.borderColor = 'rgba(245,237,214,0.18)'
              el.style.color = 'rgba(245,237,214,0.55)'
            }}
          >
            Decline
          </button>
        </div>
      </div>
    )
  }

  function renderChat() {
    if (!activeConv) return null

    return (
      <>
        {/* Message list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {loadingMsgs ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: '2px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a',
                animation: 'spin 0.7s linear infinite',
              }} />
            </div>
          ) : messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{
                color: 'rgba(245,237,214,0.3)', fontSize: '13px',
                fontFamily: "'Barlow', sans-serif", textAlign: 'center', margin: 0,
              }}>
                No messages yet — say hi!
              </p>
            </div>
          ) : (
            messages.map(msg => {
              const isMine = msg.sender_id === userId
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '76%', padding: '8px 12px', lineHeight: 1.45,
                    borderRadius: isMine ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                    background: isMine ? '#c4822a' : 'rgba(255,255,255,0.09)',
                    color: isMine ? '#0d1f3c' : '#f5edd6',
                    fontSize: '13px', fontFamily: "'Barlow', sans-serif",
                    wordBreak: 'break-word',
                  }}>
                    {msg.content}
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div style={{
          padding: '10px 12px', borderTop: '1px solid rgba(196,130,42,0.15)',
          display: 'flex', gap: '8px', alignItems: 'flex-end', flexShrink: 0,
          background: 'rgba(0,0,0,0.18)',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Message…"
            rows={1}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(245,237,214,0.12)',
              borderRadius: '8px', color: '#f5edd6',
              fontSize: '13px', fontFamily: "'Barlow', sans-serif",
              padding: '8px 12px', resize: 'none', outline: 'none',
              lineHeight: 1.45, overflowY: 'auto',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            style={{
              width: 36, height: 36, borderRadius: '8px', border: 'none', flexShrink: 0,
              background: input.trim() && !sending ? '#c4822a' : 'rgba(196,130,42,0.28)',
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <IconSend active={!!input.trim() && !sending} />
          </button>
        </div>
      </>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const panelTitle = view === 'chat' && activeConv
    ? [getOtherPlayer(activeConv).first_name, getOtherPlayer(activeConv).last_name].filter(Boolean).join(' ') || 'Player'
    : view === 'accept-decline' && activeConv
    ? 'Catch Request'
    : 'Messages'

  return (
    <>
      {/* ── Floating panel ── */}
      <div
        role="dialog"
        aria-label="Messaging panel"
        style={{
          position: 'fixed', bottom: 88, right: 24, width: 340, height: 480,
          background: '#162840', border: '1px solid rgba(196,130,42,0.3)',
          borderRadius: '12px 12px 0 0',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          zIndex: 120,
          transform: open ? 'translateY(0)' : 'translateY(18px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition: 'transform 0.22s ease, opacity 0.18s ease',
          boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '13px 14px', borderBottom: '1px solid rgba(196,130,42,0.18)',
          flexShrink: 0, background: 'rgba(0,0,0,0.12)',
        }}>
          {view !== 'list' && (
            <button
              onClick={goBack}
              aria-label="Back"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '2px 6px 2px 0', display: 'flex', alignItems: 'center',
              }}
            >
              <IconChevronLeft />
            </button>
          )}
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px',
            letterSpacing: '0.06em', color: '#f5edd6', flex: 1,
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>
            {panelTitle}
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close messaging panel"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, display: 'flex', alignItems: 'center',
              color: 'rgba(245,237,214,0.45)',
            }}
          >
            <IconChevronDown />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {view === 'list' && renderConversationList()}
          {view === 'accept-decline' && renderAcceptDecline()}
          {view === 'chat' && renderChat()}
        </div>
      </div>

      {/* ── Trigger button ── */}
      <button
        onClick={handleOpen}
        aria-label={open ? 'Close messages' : 'Open messages'}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 121,
          width: 52, height: 52, borderRadius: '50%',
          background: '#c4822a', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 18px rgba(196,130,42,0.45)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.transform = 'scale(1.08)'
          el.style.boxShadow = '0 6px 22px rgba(196,130,42,0.6)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.transform = 'scale(1)'
          el.style.boxShadow = '0 4px 18px rgba(196,130,42,0.45)'
        }}
      >
        <IconChat />
        {badgeCount > 0 && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            minWidth: 18, height: 18, borderRadius: '9px',
            background: '#e53e3e', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 700, fontFamily: "'Barlow', sans-serif",
            padding: '0 4px', border: '2px solid #0d1f3c',
            lineHeight: 1,
          }}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </div>
        )}
      </button>
    </>
  )
}
