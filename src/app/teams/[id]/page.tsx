'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AuthenticatedLayout } from '@/app/layout-authenticated'
import Nav from '@/components/Nav'

// ── Types ─────────────────────────────────────────────────────────────────────

type Team = {
  id: string
  name: string
  level: string | null
  zip_code: string | null
  join_type: 'request' | 'invite'
  bio: string | null
  logo_url: string | null
  created_by: string
}

type MyMembership = {
  id: string
  role: 'admin' | 'coach' | 'player'
  status: 'active' | 'pending'
}

type Member = {
  id: string
  user_id: string
  role: 'admin' | 'coach' | 'player'
  status: 'active' | 'pending'
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  positions: string[] | null
  highest_level: string | null
}

type TeamPost = {
  id: string
  user_id: string
  content: string
  image_url: string | null
  is_public: boolean
  created_at: string
  likeCount: number
  userLiked: boolean
  authorName: string
  authorAvatar: string | null
}

type ScheduleEvent = {
  id: string
  title: string
  event_type: 'Game' | 'Practice' | 'Tryout' | 'Other'
  event_date: string
  location: string | null
  opponent: string | null
  notes: string | null
}

type Tab = 'feed' | 'schedule' | 'roster' | 'settings'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}

function personInitials(first: string | null, last: string | null): string {
  return [(first || '')[0], (last || '')[0]].filter(Boolean).join('').toUpperCase() || '?'
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.toLocaleDateString('en-US', { weekday: 'short' })
  const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} ${monthDay} · ${time}`
}

async function fetchCity(zip: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) return null
    const d = await res.json()
    const p = d.places?.[0]
    return p ? `${p['place name']}, ${p['state abbreviation']}` : null
  } catch { return null }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TeamLogo({ url, name, size = 80 }: { url: string | null; name: string; size?: number }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#c4822a', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: Math.round(size * 0.36),
      color: '#0d1f3c', letterSpacing: '0.05em',
    }}>
      {getInitials(name)}
    </div>
  )
}

function PersonAvatar({ url, first, last, size = 36 }: { url: string | null; first: string | null; last: string | null; size?: number }) {
  if (url) return <img src={url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#c4822a', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: Math.round(size * 0.38), color: '#0d1f3c',
    }}>
      {personInitials(first, last)}
    </div>
  )
}

const EVENT_COLORS: Record<string, string> = {
  Game: '#48bb78', Practice: '#63b3ed', Tryout: '#c4822a', Other: 'rgba(245,237,214,0.3)',
}

const INPUT: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(245,237,214,0.15)',
  color: '#f5edd6', outline: 'none', boxSizing: 'border-box', fontFamily: "'Barlow', sans-serif",
}
const SELECT_STYLE: React.CSSProperties = {
  ...INPUT, cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(245,237,214,0.4)' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: '30px',
}
const LABEL: React.CSSProperties = {
  display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: 700,
  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'rgba(245,237,214,0.55)',
}

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) { e.currentTarget.style.borderColor = 'rgba(196,130,42,0.6)' }
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) { e.currentTarget.style.borderColor = 'rgba(245,237,214,0.15)' }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamDetailPage() {
  const router = useRouter()
  const params = useParams()
  const teamId = params.id as string

  // ── Core state ─────────────────────────────────────────────────────────────
  const [userId, setUserId]         = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [team, setTeam]             = useState<Team | null>(null)
  const [teamLoading, setTeamLoading] = useState(true)
  const [cityName, setCityName]     = useState<string | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [myMembership, setMyMembership] = useState<MyMembership | null>(null)
  const [joinStatus, setJoinStatus] = useState<'none' | 'pending' | 'active'>('none')

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('feed')

  // ── Feed state ─────────────────────────────────────────────────────────────
  const [feedPosts, setFeedPosts]       = useState<TeamPost[]>([])
  const [feedLoading, setFeedLoading]   = useState(false)
  const [feedLoaded, setFeedLoaded]     = useState(false)
  const [newPostText, setNewPostText]   = useState('')
  const [newPostPublic, setNewPostPublic] = useState(false)
  const [newPostImageFile, setNewPostImageFile] = useState<File | null>(null)
  const [newPostImagePreview, setNewPostImagePreview] = useState<string | null>(null)
  const [postSubmitting, setPostSubmitting] = useState(false)
  const feedImageRef = useRef<HTMLInputElement>(null)

  // ── Schedule state ─────────────────────────────────────────────────────────
  const [events, setEvents]             = useState<ScheduleEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsLoaded, setEventsLoaded] = useState(false)
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [showPastEvents, setShowPastEvents] = useState(false)
  const [evTitle, setEvTitle]   = useState('')
  const [evType, setEvType]     = useState<'Game' | 'Practice' | 'Tryout' | 'Other'>('Practice')
  const [evDate, setEvDate]     = useState('')
  const [evLocation, setEvLocation] = useState('')
  const [evOpponent, setEvOpponent] = useState('')
  const [evNotes, setEvNotes]   = useState('')
  const [evSaving, setEvSaving] = useState(false)

  // ── Roster state ───────────────────────────────────────────────────────────
  const [members, setMembers]             = useState<Member[]>([])
  const [pendingMembers, setPendingMembers] = useState<Member[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterLoaded, setRosterLoaded]   = useState(false)
  const [inviteToken, setInviteToken]     = useState<string | null>(null)
  const [inviteTokenLoading, setInviteTokenLoading] = useState(false)
  const [copied, setCopied]               = useState(false)

  // ── Settings state ─────────────────────────────────────────────────────────
  const [setName, setSetName]     = useState('')
  const [setLevel, setSetLevel]   = useState('')
  const [setZip, setSetZip]       = useState('')
  const [setJoinType, setSetJoinType] = useState<'request' | 'invite'>('request')
  const [setBio, setSetBio]       = useState('')
  const [setLogoFile, setSetLogoFile] = useState<File | null>(null)
  const [setLogoPreview, setSetLogoPreview] = useState<string | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [disbanding, setDisbanding] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const settingsLogoRef = useRef<HTMLInputElement>(null)

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth?tab=login'); return }
      setUserId(session.user.id)
      setSessionLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/auth?tab=login')
    })
    return () => subscription.unsubscribe()
  }, [router])

  // ── Fetch team + membership ────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !teamId) return
    async function load() {
      const [teamRes, membershipRes, countRes] = await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase.from('team_members').select('id, role, status').eq('team_id', teamId).eq('user_id', userId).maybeSingle(),
        supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'active'),
      ])

      if (!teamRes.data) { router.push('/teams'); return }
      const t = teamRes.data as Team
      setTeam(t)
      setMemberCount(countRes.count ?? 0)
      if (t.zip_code) fetchCity(t.zip_code).then(c => setCityName(c))

      if (membershipRes.data) {
        const m = membershipRes.data as MyMembership
        setMyMembership(m)
        setJoinStatus(m.status === 'active' ? 'active' : 'pending')
        // Pre-fill settings
        setSetName(t.name)
        setSetLevel(t.level ?? '')
        setSetZip(t.zip_code ?? '')
        setSetJoinType(t.join_type)
        setSetBio(t.bio ?? '')
      }

      setTeamLoading(false)
    }
    load()
  }, [userId, teamId, router])

  // ── Join request ───────────────────────────────────────────────────────────
  async function handleJoinRequest() {
    if (!userId || !team) return
    const { error } = await supabase.from('team_members').insert({
      team_id: team.id, user_id: userId, role: 'player', status: 'pending',
    })
    if (!error) setJoinStatus('pending')
  }

  // ── Feed ───────────────────────────────────────────────────────────────────
  const loadFeed = useCallback(async () => {
    if (!userId || !teamId || feedLoaded) return
    setFeedLoading(true)
    const { data: posts } = await supabase
      .from('team_posts')
      .select('id, user_id, content, image_url, is_public, created_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })

    const rawPosts = (posts ?? []) as { id: string; user_id: string; content: string; image_url: string | null; is_public: boolean; created_at: string }[]
    if (rawPosts.length === 0) { setFeedPosts([]); setFeedLoading(false); setFeedLoaded(true); return }

    const authorIds = [...new Set(rawPosts.map(p => p.user_id))]
    const postIds = rawPosts.map(p => p.id)

    const [profilesRes, likesRes] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', authorIds),
      supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
    ])

    const profileMap: Record<string, { first_name: string | null; last_name: string | null; avatar_url: string | null }> = {}
    for (const p of (profilesRes.data ?? []) as { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[]) {
      profileMap[p.id] = p
    }
    const likeCountMap: Record<string, number> = {}
    const userLikedSet = new Set<string>()
    for (const l of (likesRes.data ?? []) as { post_id: string; user_id: string }[]) {
      likeCountMap[l.post_id] = (likeCountMap[l.post_id] ?? 0) + 1
      if (l.user_id === userId) userLikedSet.add(l.post_id)
    }

    setFeedPosts(rawPosts.map(p => {
      const author = profileMap[p.user_id]
      return {
        ...p,
        likeCount: likeCountMap[p.id] ?? 0,
        userLiked: userLikedSet.has(p.id),
        authorName: author ? [author.first_name, author.last_name].filter(Boolean).join(' ') || 'Player' : 'Player',
        authorAvatar: author?.avatar_url ?? null,
      }
    }))
    setFeedLoading(false)
    setFeedLoaded(true)
  }, [userId, teamId, feedLoaded])

  useEffect(() => {
    if (activeTab === 'feed' && myMembership?.status === 'active') loadFeed()
  }, [activeTab, myMembership, loadFeed])

  async function submitPost() {
    if (!userId || !team || !newPostText.trim()) return
    setPostSubmitting(true)

    let image_url: string | null = null
    if (newPostImageFile) {
      const ext = newPostImageFile.name.split('.').pop()
      const path = `team-posts/${teamId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('posts').upload(path, newPostImageFile, { upsert: true })
      if (!upErr) {
        const { data } = supabase.storage.from('posts').getPublicUrl(path)
        image_url = data.publicUrl
      }
    }

    const { data: post, error } = await supabase
      .from('team_posts')
      .insert({ team_id: teamId, user_id: userId, content: newPostText.trim(), image_url, is_public: newPostPublic })
      .select('id, user_id, content, image_url, is_public, created_at')
      .single()

    if (error || !post) { showToast('Failed to post.', false); setPostSubmitting(false); return }

    if (newPostPublic) {
      await supabase.from('posts').insert({ user_id: userId, content: newPostText.trim(), image_url })
    }

    const tp = post as { id: string; user_id: string; content: string; image_url: string | null; is_public: boolean; created_at: string }
    const newPost: TeamPost = {
      ...tp, likeCount: 0, userLiked: false,
      authorName: 'You', authorAvatar: null,
    }
    setFeedPosts(prev => [newPost, ...prev])
    setNewPostText('')
    setNewPostPublic(false)
    setNewPostImageFile(null)
    setNewPostImagePreview(null)
    setPostSubmitting(false)
  }

  async function toggleLike(post: TeamPost) {
    if (!userId) return
    if (post.userLiked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', userId)
      setFeedPosts(prev => prev.map(p => p.id === post.id ? { ...p, userLiked: false, likeCount: p.likeCount - 1 } : p))
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: userId })
      setFeedPosts(prev => prev.map(p => p.id === post.id ? { ...p, userLiked: true, likeCount: p.likeCount + 1 } : p))
    }
  }

  // ── Schedule ───────────────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    if (!teamId || eventsLoaded) return
    setEventsLoading(true)
    const { data } = await supabase
      .from('schedule_events')
      .select('id, title, event_type, event_date, location, opponent, notes')
      .eq('team_id', teamId)
      .order('event_date', { ascending: true })
    setEvents((data ?? []) as ScheduleEvent[])
    setEventsLoading(false)
    setEventsLoaded(true)
  }, [teamId, eventsLoaded])

  useEffect(() => {
    if (activeTab === 'schedule' && myMembership?.status === 'active') loadEvents()
  }, [activeTab, myMembership, loadEvents])

  async function saveEvent() {
    if (!evTitle.trim() || !evDate) return
    setEvSaving(true)
    const { data, error } = await supabase
      .from('schedule_events')
      .insert({
        team_id: teamId, title: evTitle.trim(), event_type: evType,
        event_date: new Date(evDate).toISOString(),
        location: evLocation.trim() || null,
        opponent: evOpponent.trim() || null,
        notes: evNotes.trim() || null,
      })
      .select('id, title, event_type, event_date, location, opponent, notes')
      .single()
    if (!error && data) {
      setEvents(prev => [...prev, data as ScheduleEvent].sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()))
      setEvTitle(''); setEvType('Practice'); setEvDate(''); setEvLocation(''); setEvOpponent(''); setEvNotes('')
      setShowAddEvent(false)
      showToast('Event added!')
    } else {
      showToast('Failed to add event.', false)
    }
    setEvSaving(false)
  }

  async function deleteEvent(id: string) {
    await supabase.from('schedule_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
    showToast('Event removed.')
  }

  // ── Roster ─────────────────────────────────────────────────────────────────
  const loadRoster = useCallback(async () => {
    if (!teamId || rosterLoaded) return
    setRosterLoading(true)
    const { data: membersData } = await supabase
      .from('team_members')
      .select('id, user_id, role, status')
      .eq('team_id', teamId)

    const rows = (membersData ?? []) as { id: string; user_id: string; role: string; status: string }[]
    if (rows.length === 0) { setRosterLoading(false); setRosterLoaded(true); return }

    const userIds = rows.map(r => r.user_id)
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, positions, highest_level')
      .in('id', userIds)

    const profileMap: Record<string, { first_name: string | null; last_name: string | null; avatar_url: string | null; positions: string[] | null; highest_level: string | null }> = {}
    for (const p of (profilesData ?? []) as { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; positions: string[] | null; highest_level: string | null }[]) {
      profileMap[p.id] = p
    }

    const built: Member[] = rows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      role: r.role as 'admin' | 'coach' | 'player',
      status: r.status as 'active' | 'pending',
      ...(profileMap[r.user_id] ?? { first_name: null, last_name: null, avatar_url: null, positions: null, highest_level: null }),
    }))

    setMembers(built.filter(m => m.status === 'active'))
    setPendingMembers(built.filter(m => m.status === 'pending'))

    // Load existing invite token if one exists
    const { data: inviteData } = await supabase
      .from('team_invites')
      .select('token')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (inviteData?.token) setInviteToken(inviteData.token)

    setRosterLoading(false)
    setRosterLoaded(true)
  }, [teamId, rosterLoaded])

  useEffect(() => {
    if (activeTab === 'roster' && myMembership?.status === 'active') loadRoster()
  }, [activeTab, myMembership, loadRoster])

  async function updateMemberRole(memberId: string, newRole: 'admin' | 'coach' | 'player') {
    await supabase.from('team_members').update({ role: newRole }).eq('id', memberId)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
  }

  async function removeMember(memberId: string) {
    await supabase.from('team_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
    setMemberCount(c => c - 1)
    showToast('Member removed.')
  }

  async function acceptPending(memberId: string) {
    await supabase.from('team_members').update({ status: 'active' }).eq('id', memberId)
    const member = pendingMembers.find(m => m.id === memberId)
    if (member) {
      setPendingMembers(prev => prev.filter(m => m.id !== memberId))
      setMembers(prev => [...prev, { ...member, status: 'active' }])
      setMemberCount(c => c + 1)
    }
    showToast('Request accepted!')
  }

  async function declinePending(memberId: string) {
    await supabase.from('team_members').update({ status: 'declined' } as never).eq('id', memberId)
    setPendingMembers(prev => prev.filter(m => m.id !== memberId))
    showToast('Request declined.')
  }

  async function generateInviteLink() {
    if (!userId || !teamId) return
    setInviteTokenLoading(true)
    const token = crypto.randomUUID()
    const { error } = await supabase.from('team_invites').insert({
      team_id: teamId, token, invited_by: userId, status: 'pending',
    })
    if (!error) setInviteToken(token)
    else showToast('Failed to generate link.', false)
    setInviteTokenLoading(false)
  }

  async function copyInviteLink() {
    if (!inviteToken) return
    const url = `${window.location.origin}/teams/${teamId}/join?token=${inviteToken}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    showToast('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  async function saveSettings() {
    if (!team || !setName.trim()) return
    setSettingsSaving(true)
    let logo_url = team.logo_url
    if (setLogoFile) {
      const ext = setLogoFile.name.split('.').pop()
      const path = `${teamId}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('teams').upload(path, setLogoFile, { upsert: true })
      if (!upErr) {
        const { data } = supabase.storage.from('teams').getPublicUrl(path)
        logo_url = data.publicUrl
      }
    }
    const { error } = await supabase.from('teams').update({
      name: setName.trim(), level: setLevel || null, zip_code: setZip || null,
      join_type: setJoinType, bio: setBio.trim() || null, logo_url,
    }).eq('id', teamId)
    if (!error) {
      setTeam(prev => prev ? { ...prev, name: setName, level: setLevel || null, zip_code: setZip || null, join_type: setJoinType, bio: setBio || null, logo_url } : prev)
      showToast('Team updated!')
    } else {
      showToast('Failed to save.', false)
    }
    setSettingsSaving(false)
  }

  async function disbandTeam() {
    if (!window.confirm('Are you sure? This will permanently delete the team and all its data.')) return
    setDisbanding(true)
    await supabase.from('team_members').delete().eq('team_id', teamId)
    await supabase.from('teams').delete().eq('id', teamId)
    router.push('/teams')
  }

  async function transferAdmin() {
    if (!transferTo || !myMembership) return
    await supabase.from('team_members').update({ role: 'admin' }).eq('id', transferTo)
    await supabase.from('team_members').update({ role: 'player' }).eq('id', myMembership.id)
    showToast('Admin transferred.')
    setMyMembership(prev => prev ? { ...prev, role: 'player' } : prev)
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (sessionLoading || teamLoading) {
    return (
      <AuthenticatedLayout>
        <div style={{ minHeight: '100vh', background: '#0d1f3c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
        </div>
      </AuthenticatedLayout>
    )
  }

  if (!team) return null

  const isAdmin  = myMembership?.role === 'admin'
  const isCoach  = myMembership?.role === 'coach'
  const isMember = myMembership?.status === 'active'
  const canManage = isAdmin || isCoach
  const now = new Date()

  // ── NON-MEMBER VIEW ────────────────────────────────────────────────────────
  if (!isMember) {
    return (
      <AuthenticatedLayout>
        <div style={{ minHeight: '100vh', background: '#0d1f3c', color: '#f5edd6', fontFamily: "'Barlow', sans-serif" }}>
          <Nav />
          <main style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 16px 80px' }}>

            {/* Team header */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap' }}>
              <TeamLogo url={team.logo_url} name={team.name} size={100} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '38px', letterSpacing: '0.05em', margin: '0 0 6px', lineHeight: 1 }}>
                  {team.name}
                </h1>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {team.level && (
                    <span style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.06em', color: '#c4822a', background: 'rgba(196,130,42,0.1)', border: '1px solid rgba(196,130,42,0.3)', borderRadius: '4px', padding: '2px 7px' }}>
                      {team.level}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif" }}>
                  {[cityName ?? team.zip_code, `${memberCount} member${memberCount !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                </div>
                {team.bio && (
                  <p style={{ margin: '10px 0 0', fontSize: '14px', lineHeight: '1.6', color: 'rgba(245,237,214,0.7)', fontFamily: "'Barlow', sans-serif" }}>
                    {team.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Join section */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
              {joinStatus === 'active' ? (
                <p style={{ margin: 0, color: '#48bb78', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '15px' }}>✓ You are a member</p>
              ) : joinStatus === 'pending' ? (
                <p style={{ margin: 0, color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px' }}>
                  Your request to join is pending admin approval.
                </p>
              ) : team.join_type === 'invite' ? (
                <p style={{ margin: 0, color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px' }}>
                  This team is invite only. You need an invite link to join.
                </p>
              ) : (
                <div>
                  <p style={{ margin: '0 0 14px', fontSize: '14px', color: 'rgba(245,237,214,0.6)', fontFamily: "'Barlow', sans-serif" }}>
                    This team accepts join requests. Send a request and wait for an admin to approve.
                  </p>
                  <button
                    onClick={handleJoinRequest}
                    style={{
                      padding: '11px 28px', borderRadius: '8px', border: '1px solid #c4822a',
                      background: 'transparent', color: '#c4822a',
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                      letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '14px',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,130,42,0.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    Request to Join
                  </button>
                </div>
              )}
            </div>

          </main>
        </div>
      </AuthenticatedLayout>
    )
  }

  // ── MEMBER VIEW ────────────────────────────────────────────────────────────

  const upcomingEvents = events.filter(e => new Date(e.event_date) >= now)
  const pastEvents     = events.filter(e => new Date(e.event_date) < now)

  return (
    <AuthenticatedLayout>
      <div style={{ minHeight: '100vh', background: '#0d1f3c', color: '#f5edd6', fontFamily: "'Barlow', sans-serif" }}>
        <Nav />
        <main style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 16px 80px' }}>

          {/* Team header */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap' }}>
            <TeamLogo url={team.logo_url} name={team.name} size={100} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '38px', letterSpacing: '0.05em', margin: '0 0 6px', lineHeight: 1 }}>
                  {team.name}
                </h1>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(isAdmin || isCoach) && (
                    <span style={{ fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.06em', color: isAdmin ? '#f0b429' : '#63b3ed', background: isAdmin ? 'rgba(240,180,41,0.1)' : 'rgba(99,179,237,0.1)', border: `1px solid ${isAdmin ? 'rgba(240,180,41,0.3)' : 'rgba(99,179,237,0.3)'}`, borderRadius: '4px', padding: '2px 7px' }}>
                      {isAdmin ? 'Admin' : 'Coach'}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                {team.level && (
                  <span style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.06em', color: '#c4822a', background: 'rgba(196,130,42,0.1)', border: '1px solid rgba(196,130,42,0.3)', borderRadius: '4px', padding: '2px 7px' }}>
                    {team.level}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif" }}>
                {[cityName ?? team.zip_code, `${memberCount} member${memberCount !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
              </div>
              {team.bio && (
                <p style={{ margin: '8px 0 0', fontSize: '13px', lineHeight: '1.55', color: 'rgba(245,237,214,0.6)', fontFamily: "'Barlow', sans-serif" }}>
                  {team.bio}
                </p>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '2px', marginBottom: '24px', borderBottom: '1px solid rgba(196,130,42,0.2)', overflowX: 'auto' }}>
            {(['feed', 'schedule', 'roster', ...(isAdmin ? ['settings'] : [])] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px',
                  letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                  borderBottom: activeTab === tab ? '2px solid #c4822a' : '2px solid transparent',
                  color: activeTab === tab ? '#c4822a' : 'rgba(245,237,214,0.5)',
                  transition: 'color 0.15s',
                  marginBottom: '-1px',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* ── FEED TAB ── */}
          {activeTab === 'feed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Create post */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '12px', padding: '16px' }}>
                <textarea
                  value={newPostText}
                  onChange={e => setNewPostText(e.target.value)}
                  placeholder={`Post to ${team.name}…`}
                  rows={3}
                  style={{ ...INPUT, resize: 'none', lineHeight: '1.5' } as React.CSSProperties}
                  onFocus={onFocus} onBlur={onBlur}
                />
                {newPostImagePreview && (
                  <div style={{ marginTop: '10px', position: 'relative', display: 'inline-block' }}>
                    <img src={newPostImagePreview} alt="" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', objectFit: 'cover' }} />
                    <button onClick={() => { setNewPostImageFile(null); setNewPostImagePreview(null) }} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <button onClick={() => feedImageRef.current?.click()} style={{ background: 'none', border: '1px solid rgba(245,237,214,0.2)', borderRadius: '6px', color: 'rgba(245,237,214,0.5)', cursor: 'pointer', padding: '5px 10px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', fontWeight: 700 }}>
                    📷 Photo
                  </button>
                  <input ref={feedImageRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (!f) return; setNewPostImageFile(f); setNewPostImagePreview(URL.createObjectURL(f)) }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif", color: 'rgba(245,237,214,0.5)' }}>
                    <input type="checkbox" checked={newPostPublic} onChange={e => setNewPostPublic(e.target.checked)} style={{ accentColor: '#c4822a' }} />
                    Post publicly to The Dugout
                  </label>
                  <button
                    onClick={submitPost}
                    disabled={postSubmitting || !newPostText.trim()}
                    style={{
                      marginLeft: 'auto', padding: '7px 18px', borderRadius: '7px', border: 'none',
                      background: postSubmitting || !newPostText.trim() ? 'rgba(196,130,42,0.4)' : '#c4822a',
                      color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                      fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase',
                      cursor: postSubmitting || !newPostText.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {postSubmitting ? '…' : 'Post'}
                  </button>
                </div>
              </div>

              {/* Posts list */}
              {feedLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
                </div>
              ) : feedPosts.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'rgba(245,237,214,0.35)', fontSize: '14px', padding: '32px 0' }}>
                  No posts yet — be the first to post!
                </p>
              ) : feedPosts.map(post => (
                <div key={post.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px 8px' }}>
                    <PersonAvatar url={post.authorAvatar} first={post.authorName.split(' ')[0] ?? null} last={post.authorName.split(' ')[1] ?? null} size={34} />
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px', color: '#f5edd6' }}>{post.authorName}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif" }}>{timeAgo(post.created_at)}</div>
                    </div>
                    {post.is_public && <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow Condensed', sans-serif" }}>PUBLIC</span>}
                  </div>
                  {post.content && <p style={{ margin: 0, padding: '0 14px 12px', fontSize: '14px', lineHeight: '1.6', color: '#f5edd6', fontFamily: "'Barlow', sans-serif", whiteSpace: 'pre-wrap' }}>{post.content}</p>}
                  {post.image_url && <img src={post.image_url} alt="Post" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <button
                      onClick={() => toggleLike(post)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: post.userLiked ? '#c4822a' : 'rgba(245,237,214,0.45)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: '13px', padding: '4px 8px', borderRadius: '6px' }}
                    >
                      {post.userLiked ? '♥' : '♡'}{post.likeCount > 0 ? ` ${post.likeCount}` : ''}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SCHEDULE TAB ── */}
          {activeTab === 'schedule' && (
            <div>
              {/* Add event */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', letterSpacing: '0.05em', margin: 0, color: '#f5edd6' }}>
                  Upcoming <span style={{ color: '#c4822a' }}>Events</span>
                </h2>
                {canManage && (
                  <button onClick={() => setShowAddEvent(v => !v)} style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid rgba(196,130,42,0.4)', background: 'transparent', color: '#c4822a', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '12px', letterSpacing: '0.06em', cursor: 'pointer' }}>
                    {showAddEvent ? 'Cancel' : '+ Add Event'}
                  </button>
                )}
              </div>

              {showAddEvent && canManage && (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '12px', padding: '18px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={LABEL}>Title *</label>
                      <input type="text" value={evTitle} onChange={e => setEvTitle(e.target.value)} placeholder="Weekend Game" style={INPUT} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                    <div>
                      <label style={LABEL}>Type</label>
                      <select value={evType} onChange={e => setEvType(e.target.value as 'Game' | 'Practice' | 'Tryout' | 'Other')} style={{ ...SELECT_STYLE, width: '100%' }} onFocus={onFocus} onBlur={onBlur}>
                        {['Game', 'Practice', 'Tryout', 'Other'].map(t => <option key={t} value={t} style={{ background: '#0d1f3c' }}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={LABEL}>Date & Time *</label>
                      <input type="datetime-local" value={evDate} onChange={e => setEvDate(e.target.value)} style={{ ...INPUT, colorScheme: 'dark' } as React.CSSProperties} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                    <div>
                      <label style={LABEL}>Location</label>
                      <input type="text" value={evLocation} onChange={e => setEvLocation(e.target.value)} placeholder="Riverfront Park" style={INPUT} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                  </div>
                  {evType === 'Game' && (
                    <div>
                      <label style={LABEL}>Opponent</label>
                      <input type="text" value={evOpponent} onChange={e => setEvOpponent(e.target.value)} placeholder="Detroit Tigers RC" style={INPUT} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                  )}
                  <div>
                    <label style={LABEL}>Notes</label>
                    <textarea value={evNotes} onChange={e => setEvNotes(e.target.value)} placeholder="Bring your own equipment…" rows={2} style={{ ...INPUT, resize: 'vertical' } as React.CSSProperties} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                  <button onClick={saveEvent} disabled={evSaving || !evTitle.trim() || !evDate} style={{ padding: '9px', borderRadius: '8px', border: 'none', background: evSaving || !evTitle.trim() || !evDate ? 'rgba(196,130,42,0.4)' : '#c4822a', color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px', letterSpacing: '0.08em', cursor: evSaving || !evTitle.trim() || !evDate ? 'not-allowed' : 'pointer' }}>
                    {evSaving ? 'Saving…' : 'Save Event'}
                  </button>
                </div>
              )}

              {eventsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(196,130,42,0.1)' }}>
                  <p style={{ color: 'rgba(245,237,214,0.35)', fontSize: '14px', margin: 0 }}>No upcoming events — add your first one!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {upcomingEvents.map(ev => (
                    <div key={ev.id} style={{ display: 'flex', gap: '0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.15)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ width: '4px', flexShrink: 0, background: EVENT_COLORS[ev.event_type] }} />
                      <div style={{ flex: 1, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.06em', color: EVENT_COLORS[ev.event_type], background: `${EVENT_COLORS[ev.event_type]}20`, border: `1px solid ${EVENT_COLORS[ev.event_type]}50`, borderRadius: '4px', padding: '1px 6px' }}>
                                {ev.event_type}
                              </span>
                              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '15px', color: '#f5edd6' }}>{ev.title}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif" }}>
                              {formatEventDate(ev.event_date)}
                              {ev.location && ` · ${ev.location}`}
                              {ev.opponent && ` · vs. ${ev.opponent}`}
                            </div>
                            {ev.notes && <div style={{ fontSize: '12px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif", marginTop: '4px' }}>{ev.notes}</div>}
                          </div>
                          {canManage && (
                            <button onClick={() => deleteEvent(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,237,214,0.3)', fontSize: '16px', lineHeight: 1, padding: '2px 4px', flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.color = '#fc8181' }} onMouseLeave={e => { e.currentTarget.style.color = 'rgba(245,237,214,0.3)' }}>×</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Past events */}
              {pastEvents.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <button onClick={() => setShowPastEvents(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,237,214,0.4)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px', padding: 0 }}>
                    {showPastEvents ? '▾' : '▸'} Past Events ({pastEvents.length})
                  </button>
                  {showPastEvents && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', opacity: 0.55 }}>
                      {[...pastEvents].reverse().map(ev => (
                        <div key={ev.id} style={{ display: 'flex', gap: '0', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,237,214,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
                          <div style={{ width: '3px', flexShrink: 0, background: EVENT_COLORS[ev.event_type] }} />
                          <div style={{ padding: '10px 14px' }}>
                            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px', color: '#f5edd6' }}>{ev.title}</div>
                            <div style={{ fontSize: '11px', color: 'rgba(245,237,214,0.4)', fontFamily: "'Barlow', sans-serif" }}>{formatEventDate(ev.event_date)}{ev.location ? ` · ${ev.location}` : ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ROSTER TAB ── */}
          {activeTab === 'roster' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Active members */}
              <div>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', letterSpacing: '0.05em', margin: '0 0 14px', color: '#f5edd6' }}>
                  Roster <span style={{ color: '#c4822a' }}>({members.length})</span>
                </h2>
                {rosterLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {members.map(m => {
                      const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Player'
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(245,237,214,0.06)' }}>
                          <PersonAvatar url={m.avatar_url} first={m.first_name} last={m.last_name} size={38} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '14px', color: '#f5edd6' }}>{name}</div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                              {(m.positions ?? []).map(pos => (
                                <span key={pos} style={{ fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: '#c4822a', background: 'rgba(196,130,42,0.1)', border: '1px solid rgba(196,130,42,0.3)', borderRadius: '3px', padding: '0 5px' }}>{pos}</span>
                              ))}
                              {m.highest_level && <span style={{ fontSize: '11px', color: 'rgba(245,237,214,0.4)', fontFamily: "'Barlow', sans-serif" }}>{m.highest_level}</span>}
                            </div>
                          </div>
                          {/* Role badge */}
                          {isAdmin ? (
                            <select
                              value={m.role}
                              onChange={e => updateMemberRole(m.id, e.target.value as 'admin' | 'coach' | 'player')}
                              style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(245,237,214,0.15)', borderRadius: '5px', color: m.role === 'admin' ? '#f0b429' : m.role === 'coach' ? '#63b3ed' : 'rgba(245,237,214,0.5)', padding: '3px 6px', cursor: 'pointer' }}
                            >
                              <option value="player" style={{ background: '#0d1f3c' }}>Player</option>
                              <option value="coach"  style={{ background: '#0d1f3c' }}>Coach</option>
                              <option value="admin"  style={{ background: '#0d1f3c' }}>Admin</option>
                            </select>
                          ) : (
                            <span style={{ fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.05em', color: m.role === 'admin' ? '#f0b429' : m.role === 'coach' ? '#63b3ed' : 'rgba(245,237,214,0.4)', background: m.role === 'admin' ? 'rgba(240,180,41,0.1)' : m.role === 'coach' ? 'rgba(99,179,237,0.1)' : 'transparent', borderRadius: '4px', padding: '1px 6px' }}>
                              {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                            </span>
                          )}
                          {isAdmin && m.user_id !== userId && (
                            <button onClick={() => removeMember(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,237,214,0.25)', fontSize: '16px', padding: '2px', flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.color = '#fc8181' }} onMouseLeave={e => { e.currentTarget.style.color = 'rgba(245,237,214,0.25)' }}>×</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Pending requests (admin only) */}
              {isAdmin && pendingMembers.length > 0 && (
                <div>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', letterSpacing: '0.05em', margin: '0 0 12px', color: '#f5edd6' }}>
                    Pending <span style={{ color: '#c4822a' }}>Requests ({pendingMembers.length})</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pendingMembers.map(m => {
                      const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Player'
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(196,130,42,0.15)' }}>
                          <PersonAvatar url={m.avatar_url} first={m.first_name} last={m.last_name} size={36} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '14px', color: '#f5edd6' }}>{name}</div>
                            {m.highest_level && <div style={{ fontSize: '11px', color: 'rgba(245,237,214,0.4)' }}>{m.highest_level}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => acceptPending(m.id)} style={{ padding: '5px 11px', borderRadius: '6px', background: 'rgba(45,90,27,0.7)', color: '#48bb78', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '11px', letterSpacing: '0.05em', cursor: 'pointer', border: '1px solid rgba(72,187,120,0.4)', transition: 'background 0.15s' }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(45,90,27,0.95)' }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(45,90,27,0.7)' }}>Accept ✓</button>
                            <button onClick={() => declinePending(m.id)} style={{ padding: '5px 11px', borderRadius: '6px', background: 'transparent', color: 'rgba(245,237,214,0.55)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(245,237,214,0.18)', transition: 'all 0.15s' }} onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = 'rgba(229,62,62,0.5)'; el.style.color = '#fc8181' }} onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = 'rgba(245,237,214,0.18)'; el.style.color = 'rgba(245,237,214,0.55)' }}>Decline</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Invite link (admin + coach) */}
              {canManage && (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '12px', padding: '18px' }}>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', letterSpacing: '0.05em', margin: '0 0 10px', color: '#f5edd6' }}>
                    Invite <span style={{ color: '#c4822a' }}>Players</span>
                  </h3>
                  <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif" }}>
                    Share this link to invite players directly — they'll be added as active members.
                  </p>
                  {inviteToken ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        readOnly
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/teams/${teamId}/join?token=${inviteToken}`}
                        style={{ ...INPUT, flex: 1, fontSize: '12px', color: 'rgba(245,237,214,0.6)', cursor: 'text' }}
                      />
                      <button onClick={copyInviteLink} style={{ padding: '9px 14px', borderRadius: '7px', border: '1px solid rgba(196,130,42,0.4)', background: copied ? 'rgba(45,90,27,0.5)' : 'transparent', color: copied ? '#48bb78' : '#c4822a', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {copied ? 'Copied ✓' : 'Copy Link'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={generateInviteLink} disabled={inviteTokenLoading} style={{ padding: '9px 18px', borderRadius: '7px', border: '1px solid rgba(196,130,42,0.4)', background: 'transparent', color: '#c4822a', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '12px', letterSpacing: '0.06em', cursor: inviteTokenLoading ? 'not-allowed' : 'pointer' }}>
                      {inviteTokenLoading ? 'Generating…' : 'Generate Invite Link'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {activeTab === 'settings' && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

              {/* Edit form */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '12px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', letterSpacing: '0.05em', margin: 0, color: '#f5edd6' }}>
                  Edit <span style={{ color: '#c4822a' }}>Team</span>
                </h2>

                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <button type="button" onClick={() => settingsLogoRef.current?.click()} style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '2px dashed rgba(196,130,42,0.4)', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                    {setLogoPreview || team.logo_url ? (
                      <img src={setLogoPreview ?? team.logo_url!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#c4822a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: '#0d1f3c' }}>{getInitials(team.name)}</div>
                    )}
                  </button>
                  <span style={{ fontSize: '12px', color: 'rgba(245,237,214,0.4)', fontFamily: "'Barlow Condensed', sans-serif' " }}>Click to change logo</span>
                  <input ref={settingsLogoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; setSetLogoFile(f); setSetLogoPreview(URL.createObjectURL(f)) }} />
                </div>

                <div>
                  <label style={LABEL}>Team Name</label>
                  <input type="text" value={setName} onChange={e => setSetName(e.target.value)} style={INPUT} onFocus={onFocus} onBlur={onBlur} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={LABEL}>Level</label>
                    <select value={setLevel} onChange={e => setSetLevel(e.target.value)} style={{ ...SELECT_STYLE, width: '100%' }} onFocus={onFocus} onBlur={onBlur}>
                      <option value="" style={{ background: '#0d1f3c' }}>Select…</option>
                      {['Pro / MiLB', 'College', 'High School', 'Rec League', 'Adult Amateur', 'Youth'].map(l => <option key={l} value={l} style={{ background: '#0d1f3c' }}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LABEL}>Zip Code</label>
                    <input type="text" value={setZip} onChange={e => setSetZip(e.target.value.replace(/\D/g, '').slice(0, 5))} maxLength={5} style={INPUT} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                </div>

                <div>
                  <label style={LABEL}>Who Can Join</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['request', 'invite'] as const).map(type => (
                      <button key={type} type="button" onClick={() => setSetJoinType(type)} style={{ flex: 1, padding: '8px', borderRadius: '7px', cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '12px', letterSpacing: '0.06em', border: setJoinType === type ? '1px solid #c4822a' : '1px solid rgba(245,237,214,0.18)', background: setJoinType === type ? 'rgba(196,130,42,0.15)' : 'transparent', color: setJoinType === type ? '#c4822a' : 'rgba(245,237,214,0.5)' }}>
                        {type === 'request' ? 'Open to Requests' : 'Invite Only'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={LABEL}>About the Team</label>
                  <textarea value={setBio} onChange={e => setSetBio(e.target.value)} rows={4} style={{ ...INPUT, resize: 'vertical', lineHeight: '1.5' } as React.CSSProperties} onFocus={onFocus} onBlur={onBlur} />
                </div>

                <button onClick={saveSettings} disabled={settingsSaving || !setName.trim()} style={{ padding: '11px', borderRadius: '8px', border: 'none', background: settingsSaving || !setName.trim() ? 'rgba(196,130,42,0.4)' : '#c4822a', color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '13px', cursor: settingsSaving || !setName.trim() ? 'not-allowed' : 'pointer' }}>
                  {settingsSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>

              {/* Transfer admin */}
              {members.filter(m => m.user_id !== userId).length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.15)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', letterSpacing: '0.05em', margin: '0 0 10px', color: '#f5edd6' }}>Transfer Admin</h3>
                  <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif" }}>Transfer admin rights to another member. You will become a regular player.</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <select value={transferTo} onChange={e => setTransferTo(e.target.value)} style={{ ...SELECT_STYLE, flex: 1 }} onFocus={onFocus} onBlur={onBlur}>
                      <option value="" style={{ background: '#0d1f3c' }}>Select member…</option>
                      {members.filter(m => m.user_id !== userId).map(m => (
                        <option key={m.id} value={m.id} style={{ background: '#0d1f3c' }}>
                          {[m.first_name, m.last_name].filter(Boolean).join(' ') || 'Player'}
                        </option>
                      ))}
                    </select>
                    <button onClick={transferAdmin} disabled={!transferTo} style={{ padding: '9px 16px', borderRadius: '7px', border: '1px solid rgba(196,130,42,0.4)', background: 'transparent', color: !transferTo ? 'rgba(245,237,214,0.3)' : '#c4822a', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '12px', cursor: !transferTo ? 'not-allowed' : 'pointer' }}>
                      Transfer
                    </button>
                  </div>
                </div>
              )}

              {/* Danger zone */}
              <div style={{ border: '1px solid rgba(229,62,62,0.3)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', letterSpacing: '0.05em', margin: '0 0 6px', color: '#fc8181' }}>Danger Zone</h3>
                <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif" }}>Disbanding will permanently delete this team and all its data.</p>
                <button onClick={disbandTeam} disabled={disbanding} style={{ padding: '9px 18px', borderRadius: '7px', border: '1px solid rgba(229,62,62,0.5)', background: 'transparent', color: '#fc8181', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px', letterSpacing: '0.06em', cursor: disbanding ? 'not-allowed' : 'pointer' }}>
                  {disbanding ? 'Disbanding…' : 'Disband Team'}
                </button>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '90px', right: '24px', zIndex: 300,
          padding: '12px 18px', borderRadius: '8px', fontSize: '14px',
          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em',
          color: '#f5edd6', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          background: toast.ok ? 'rgba(45,90,27,0.97)' : 'rgba(180,30,30,0.97)',
          border: toast.ok ? '1px solid rgba(72,187,120,0.4)' : '1px solid rgba(220,60,60,0.4)',
        }}>
          {toast.msg}
        </div>
      )}
    </AuthenticatedLayout>
  )
}
