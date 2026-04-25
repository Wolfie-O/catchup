'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AuthenticatedLayout } from '@/app/layout-authenticated'
import Nav from '@/components/Nav'

// ── Constants ──────────────────────────────────────────────────────────────────

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

const LEVELS = [
  'Pro / MiLB',
  'College',
  'High School',
  'Rec League',
  'Never played organized ball',
]

// ── Types ──────────────────────────────────────────────────────────────────────

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
  zip_code: string | null
  positions: string[] | null
  highest_level: string | null
  status: string | null
  bio: string | null
  avatar_url: string | null
  vouches: number | null
  role: string | null
  coaching_specialties: string[] | null
  coaching_experience: string | null
  coaching_offerings: string[] | null
  age_groups_coached: string[] | null
  child_position: string | null
  child_age_group: string | null
  child_skill_level: string | null
  parent_looking_for: string[] | null
}

type PlayingHistory = {
  id: string
  user_id: string
  team_name: string
  level: string | null
  position: string | null
  year_start: number | null
  year_end: number | null
  is_current: boolean
  notes: string | null
}

type FollowPerson = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  highest_level: string | null
}

type PendingRequest = {
  follow_id: string
  person: FollowPerson
}

type Post = {
  id: string
  content: string
  image_url: string | null
  created_at: string
}

// ── Style tokens ───────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '12px',
  fontWeight: 700,
  fontFamily: "'Barlow Condensed', sans-serif",
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(245,237,214,0.65)',
}

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  borderRadius: '8px',
  fontSize: '14px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(245,237,214,0.15)',
  color: '#f5edd6',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'Barlow', sans-serif",
}

const SELECT: React.CSSProperties = {
  ...INPUT,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(245,237,214,0.4)' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 13px center',
  paddingRight: '34px',
}

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(196,130,42,0.6)'
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(245,237,214,0.15)'
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(first: string | null, last: string | null): string {
  return [(first || '')[0], (last || '')[0]].filter(Boolean).join('').toUpperCase() || '?'
}

function formatTimeAgo(ts: string): string {
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

async function fetchCity(zip: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) return null
    const data = await res.json()
    const place = data.places?.[0]
    if (!place) return null
    return `${place['place name']}, ${place['state abbreviation']}`
  } catch {
    return null
  }
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ url, first, last, size = 120 }: {
  url: string | null; first: string | null; last: string | null; size?: number
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={[first, last].filter(Boolean).join(' ')}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#c4822a', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: Math.round(size * 0.36),
      color: '#0d1f3c', letterSpacing: '0.04em',
    }}>
      {getInitials(first, last)}
    </div>
  )
}

// ── Follow person row (shared by Following + Followers sections) ───────────────

function FollowRow({ person }: { person: FollowPerson }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(245,237,214,0.06)' }}>
      {person.avatar_url ? (
        <img src={person.avatar_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#c4822a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: '#0d1f3c' }}>
          {getInitials(person.first_name, person.last_name)}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '14px', color: '#f5edd6', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {[person.first_name, person.last_name].filter(Boolean).join(' ') || 'Player'}
        </div>
        {person.highest_level && (
          <div style={{ fontSize: '11px', color: 'rgba(245,237,214,0.4)', fontFamily: "'Barlow', sans-serif" }}>
            {person.highest_level}
          </div>
        )}
      </div>
      <button
        onClick={() => {
          const btn = document.querySelector('button[aria-label="Open messages"]') as HTMLButtonElement | null
          btn?.click()
        }}
        style={{
          padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(196,130,42,0.35)',
          background: 'transparent', color: '#c4822a',
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
          fontSize: '11px', letterSpacing: '0.05em', cursor: 'pointer',
          flexShrink: 0, transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,130,42,0.1)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        Message
      </button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Auth ────────────────────────────────────────────────────────────────────
  const [sessionLoading, setSessionLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // ── Profile ─────────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [cityName, setCityName] = useState<string | null>(null)

  // ── Edit mode ───────────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editDob, setEditDob] = useState('')
  const [editZip, setEditZip] = useState('')
  const [editPositions, setEditPositions] = useState<string[]>([])
  const [editLevel, setEditLevel] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null)
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Playing history ─────────────────────────────────────────────────────────
  const [history, setHistory] = useState<PlayingHistory[]>([])
  const [showHistoryForm, setShowHistoryForm] = useState(false)
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null)
  const [hTeam, setHTeam] = useState('')
  const [hLevel, setHLevel] = useState('')
  const [hPosition, setHPosition] = useState('')
  const [hYearStart, setHYearStart] = useState('')
  const [hYearEnd, setHYearEnd] = useState('')
  const [hIsCurrent, setHIsCurrent] = useState(false)
  const [hNotes, setHNotes] = useState('')
  const [hSaving, setHSaving] = useState(false)

  // ── Partners ─────────────────────────────────────────────────────────────────
  const [partnersList, setPartnersList] = useState<FollowPerson[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [partnerCount, setPartnerCount] = useState(0)

  // ── Posts ───────────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)

  // ── Toast ───────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Auth init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth?tab=login'); return }
      setUserId(session.user.id)
      setSessionLoading(false)
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/auth?tab=login')
    })
    return () => subscription.unsubscribe()
  }, [router])

  // ── Fetch profile ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    supabase
      .from('profiles')
      .select('id, first_name, last_name, date_of_birth, zip_code, positions, highest_level, status, bio, avatar_url, vouches, role, coaching_specialties, coaching_experience, coaching_offerings, age_groups_coached, child_position, child_age_group, child_skill_level, parent_looking_for')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data as Profile)
          if (data.zip_code) fetchCity(data.zip_code).then(c => setCityName(c))
        } else {
          router.push('/profile/setup')
        }
        setProfileLoading(false)
      })
  }, [userId, router])

  // ── Fetch playing history ────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    supabase
      .from('playing_history')
      .select('*')
      .eq('user_id', userId)
      .order('year_start', { ascending: false })
      .then(({ data }) => setHistory((data ?? []) as PlayingHistory[]))
  }, [userId])

  // ── Fetch partners + pending requests ────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    async function fetchPartners() {
      // Accepted: user sent request and it was accepted
      const { data: sentAccepted } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
        .eq('status', 'accepted')

      // Accepted: someone sent user a request and user accepted
      const { data: receivedAccepted } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId)
        .eq('status', 'accepted')

      const partnerIds = [
        ...(sentAccepted ?? []).map((f: { following_id: string }) => f.following_id),
        ...(receivedAccepted ?? []).map((f: { follower_id: string }) => f.follower_id),
      ]
      const uniquePartnerIds = [...new Set(partnerIds)]
      setPartnerCount(uniquePartnerIds.length)

      if (uniquePartnerIds.length > 0) {
        const { data: partnerProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, highest_level')
          .in('id', uniquePartnerIds)
        setPartnersList((partnerProfiles ?? []) as FollowPerson[])
      } else {
        setPartnersList([])
      }

      // Pending: people who sent this user a partner request
      const { data: pendingData } = await supabase
        .from('follows')
        .select('id, follower_id')
        .eq('following_id', userId)
        .eq('status', 'pending')

      const pendingRows = (pendingData ?? []) as { id: string; follower_id: string }[]
      if (pendingRows.length > 0) {
        const pendingIds = pendingRows.map(r => r.follower_id)
        const { data: pendingProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, highest_level')
          .in('id', pendingIds)

        const profileMap: Record<string, FollowPerson> = {}
        for (const p of (pendingProfiles ?? []) as FollowPerson[]) {
          profileMap[p.id] = p
        }
        setPendingRequests(pendingRows.map(r => ({
          follow_id: r.id,
          person: profileMap[r.follower_id] ?? { id: r.follower_id, first_name: null, last_name: null, avatar_url: null, highest_level: null },
        })))
      } else {
        setPendingRequests([])
      }
    }
    fetchPartners()
  }, [userId])

  // ── Fetch own posts ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    supabase
      .from('posts')
      .select('id, content, image_url, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPosts((data ?? []) as Post[])
        setPostsLoading(false)
      })
  }, [userId])

  // ── Edit profile helpers ──────────────────────────────────────────────────────
  function enterEditMode() {
    if (!profile) return
    setEditFirstName(profile.first_name ?? '')
    setEditLastName(profile.last_name ?? '')
    setEditDob(profile.date_of_birth ?? '')
    setEditZip(profile.zip_code ?? '')
    setEditPositions(profile.positions ?? [])
    setEditLevel(profile.highest_level ?? '')
    setEditStatus(profile.status ?? '')
    setEditBio(profile.bio ?? '')
    setEditAvatarFile(null)
    setEditAvatarPreview(null)
    setEditMode(true)
  }

  async function saveProfile() {
    if (!userId || !profile) return
    setSaving(true)

    let avatarUrl = profile.avatar_url

    if (editAvatarFile) {
      const ext = editAvatarFile.name.split('.').pop()
      const path = `${userId}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, editAvatarFile, { upsert: true })
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = urlData.publicUrl
      }
    }

    const updates = {
      id: userId,
      first_name: editFirstName || null,
      last_name: editLastName || null,
      date_of_birth: editDob || null,
      zip_code: editZip || null,
      positions: editPositions,
      highest_level: editLevel || null,
      status: editStatus || null,
      bio: editBio || null,
      avatar_url: avatarUrl,
    }

    const { error } = await supabase.from('profiles').upsert(updates)

    if (error) {
      showToast('Failed to save — please try again.', 'error')
    } else {
      const updated: Profile = { ...profile, ...updates }
      setProfile(updated)
      if (editZip && editZip !== profile.zip_code) {
        fetchCity(editZip).then(c => setCityName(c))
      }
      setEditMode(false)
      showToast('Profile updated!')
    }
    setSaving(false)
  }

  function toggleEditPosition(pos: string) {
    setEditPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos])
  }

  // ── Playing history helpers ───────────────────────────────────────────────────
  function resetHistoryForm() {
    setHTeam(''); setHLevel(''); setHPosition('')
    setHYearStart(''); setHYearEnd(''); setHIsCurrent(false); setHNotes('')
  }

  function openAddHistory() {
    resetHistoryForm()
    setEditingHistoryId(null)
    setShowHistoryForm(true)
  }

  function openEditHistory(entry: PlayingHistory) {
    setHTeam(entry.team_name)
    setHLevel(entry.level ?? '')
    setHPosition(entry.position ?? '')
    setHYearStart(entry.year_start?.toString() ?? '')
    setHYearEnd(entry.year_end?.toString() ?? '')
    setHIsCurrent(entry.is_current)
    setHNotes(entry.notes ?? '')
    setEditingHistoryId(entry.id)
    setShowHistoryForm(true)
  }

  async function saveHistory() {
    if (!userId || !hTeam.trim()) return
    setHSaving(true)

    const payload = {
      user_id: userId,
      team_name: hTeam.trim(),
      level: hLevel || null,
      position: hPosition || null,
      year_start: hYearStart ? parseInt(hYearStart) : null,
      year_end: hIsCurrent ? null : (hYearEnd ? parseInt(hYearEnd) : null),
      is_current: hIsCurrent,
      notes: hNotes.trim() || null,
    }

    if (editingHistoryId) {
      const { error } = await supabase.from('playing_history').update(payload).eq('id', editingHistoryId)
      if (!error) {
        setHistory(prev => prev.map(h => h.id === editingHistoryId ? { ...h, ...payload, id: editingHistoryId } : h))
        showToast('Entry updated!')
      } else {
        showToast('Failed to save.', 'error')
      }
    } else {
      const { data, error } = await supabase.from('playing_history').insert(payload).select('*').single()
      if (!error && data) {
        setHistory(prev => [data as PlayingHistory, ...prev])
        showToast('Entry added!')
      } else {
        showToast('Failed to save.', 'error')
      }
    }

    setHSaving(false)
    setShowHistoryForm(false)
    setEditingHistoryId(null)
    resetHistoryForm()
  }

  async function deleteHistory(id: string) {
    const { error } = await supabase.from('playing_history').delete().eq('id', id)
    if (!error) {
      setHistory(prev => prev.filter(h => h.id !== id))
      showToast('Entry removed.')
    }
  }

  // ── Accept / Decline partner requests ────────────────────────────────────────
  async function acceptPendingRequest(followId: string, person: FollowPerson) {
    const { error } = await supabase.from('follows').update({ status: 'accepted' }).eq('id', followId)
    if (!error) {
      setPendingRequests(prev => prev.filter(r => r.follow_id !== followId))
      setPartnersList(prev => [...prev, person])
      setPartnerCount(c => c + 1)
      showToast('Partner request accepted!')
    }
  }

  async function declinePendingRequest(followId: string) {
    const { error } = await supabase.from('follows').update({ status: 'declined' }).eq('id', followId)
    if (!error) {
      setPendingRequests(prev => prev.filter(r => r.follow_id !== followId))
      showToast('Request declined.')
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (sessionLoading || profileLoading) {
    return (
      <AuthenticatedLayout>
        <div style={{ minHeight: '100vh', background: '#0d1f3c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
        </div>
      </AuthenticatedLayout>
    )
  }

  if (!profile) return null

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Your Profile'
  const isVerified = (profile.vouches ?? 0) >= 3

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <AuthenticatedLayout>
      <div style={{ minHeight: '100vh', background: '#0d1f3c', color: '#f5edd6', fontFamily: "'Barlow', sans-serif" }}>
        <Nav />

        <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 16px 80px' }}>

          {/* ── Profile card — full width ── */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '16px', padding: '28px 24px', marginBottom: '28px' }}>

                {/* ── Profile view ── */}
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
                    <Avatar url={profile.avatar_url} first={profile.first_name} last={profile.last_name} size={120} />

                    <div style={{ marginTop: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '30px', letterSpacing: '0.05em', margin: 0, lineHeight: 1, color: '#f5edd6' }}>
                          {fullName}
                        </h1>
                        {isVerified && (
                          <span style={{
                            fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                            letterSpacing: '0.06em', color: '#f0b429',
                            background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.3)',
                            borderRadius: '4px', padding: '2px 6px',
                          }}>
                            ★ Verified
                          </span>
                        )}
                      </div>

                      {/* Role badges */}
                      {profile.role && (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                          {(profile.role === 'player' || profile.role === 'both') && (
                            <span style={{ padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase', background: '#1e3a5f', color: '#f5edd6' }}>
                              Player
                            </span>
                          )}
                          {(profile.role === 'coach' || profile.role === 'both') && (
                            <span style={{ padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase', background: '#c4822a', color: '#0d1f3c' }}>
                              Coach
                            </span>
                          )}
                          {profile.role === 'parent' && (
                            <span style={{ padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase', background: '#1a5c3a', color: '#f5edd6' }}>
                              Parent
                            </span>
                          )}
                        </div>
                      )}

                      {/* Friends count */}
                      <div style={{ marginTop: '10px' }}>
                        <span style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
                          letterSpacing: '0.04em', color: 'rgba(245,237,214,0.55)',
                        }}>
                          <strong style={{ fontWeight: 700, color: '#f5edd6' }}>{partnerCount}</strong>{' '}
                          Friend{partnerCount !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {cityName && (
                        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(245,237,214,0.4)', fontFamily: "'Barlow', sans-serif" }}>
                          📍 {cityName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Player / Both fields ── */}
                  {(profile.role === 'player' || profile.role === 'both') && (
                    <div style={{ marginBottom: '12px' }}>
                      {profile.positions && profile.positions.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginBottom: '8px' }}>
                          {profile.positions.map(pos => (
                            <span key={pos} style={{
                              padding: '3px 12px', borderRadius: '99px', fontSize: '12px',
                              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em',
                              border: '1px solid rgba(196,130,42,0.45)', color: '#c4822a',
                              background: 'rgba(196,130,42,0.1)',
                            }}>
                              {pos}
                            </span>
                          ))}
                        </div>
                      )}
                      {(profile.highest_level || profile.status) && (
                        <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif", textAlign: 'center' }}>
                          {[profile.highest_level, profile.status].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── Coach / Both fields ── */}
                  {(profile.role === 'coach' || profile.role === 'both') && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(245,237,214,0.35)', textTransform: 'uppercase', textAlign: 'center', marginBottom: '8px' }}>
                        Coaching
                      </div>
                      {profile.coaching_specialties && profile.coaching_specialties.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center', marginBottom: '8px' }}>
                          {profile.coaching_specialties.map(s => (
                            <span key={s} style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.06em', border: '1px solid rgba(196,130,42,0.35)', color: '#c4822a', background: 'rgba(196,130,42,0.08)' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {profile.coaching_experience && (
                        <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif", textAlign: 'center' }}>
                          {profile.coaching_experience} experience
                        </p>
                      )}
                      {profile.coaching_offerings && profile.coaching_offerings.length > 0 && (
                        <div style={{ marginBottom: '6px' }}>
                          <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(245,237,214,0.3)', textTransform: 'uppercase', textAlign: 'center', marginBottom: '4px' }}>Offers</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center' }}>
                            {profile.coaching_offerings.map(o => (
                              <span key={o} style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.06em', border: '1px solid rgba(245,237,214,0.15)', color: 'rgba(245,237,214,0.6)', background: 'rgba(255,255,255,0.04)' }}>
                                {o}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {profile.age_groups_coached && profile.age_groups_coached.length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(245,237,214,0.3)', textTransform: 'uppercase', textAlign: 'center', marginBottom: '4px' }}>Age Groups</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center' }}>
                            {profile.age_groups_coached.map(a => (
                              <span key={a} style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.06em', border: '1px solid rgba(245,237,214,0.15)', color: 'rgba(245,237,214,0.6)', background: 'rgba(255,255,255,0.04)' }}>
                                {a}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Parent fields ── */}
                  {profile.role === 'parent' && (
                    <div style={{ marginBottom: '12px', textAlign: 'center' }}>
                      {(profile.child_position || profile.child_age_group || profile.child_skill_level) && (
                        <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif" }}>
                          {[profile.child_position, profile.child_age_group, profile.child_skill_level].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {profile.parent_looking_for && profile.parent_looking_for.length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(245,237,214,0.3)', textTransform: 'uppercase', marginBottom: '4px' }}>Looking For</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center' }}>
                            {profile.parent_looking_for.map(l => (
                              <span key={l} style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.06em', border: '1px solid rgba(245,237,214,0.15)', color: 'rgba(245,237,214,0.6)', background: 'rgba(255,255,255,0.04)' }}>
                                {l}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bio — all roles */}
                  {profile.bio && (
                    <p style={{ fontSize: '14px', lineHeight: '1.65', color: 'rgba(245,237,214,0.7)', fontFamily: "'Barlow', sans-serif", margin: '0 0 20px', textAlign: 'center' }}>
                      {profile.bio}
                    </p>
                  )}

                  <a
                    href="/profile/edit"
                    style={{
                      display: 'block', textAlign: 'center', padding: '10px 24px', borderRadius: '8px',
                      background: '#c4822a', color: '#0d1f3c',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                      fontSize: '14px', textDecoration: 'none',
                    }}
                  >
                    Edit Profile
                  </a>
                </div>
          </div>

          {/* ── Two-column layout (secondary sections) ── */}
          <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

            {/* ════════════════════ LEFT COLUMN ════════════════════ */}
            <div style={{ flex: '0 0 340px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* ── Where I've Played (players and both only) ── */}
              {(profile.role === 'player' || profile.role === 'both' || !profile.role) && <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '16px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', letterSpacing: '0.05em', margin: 0, color: '#f5edd6' }}>
                    Where I've <span style={{ color: '#c4822a' }}>Played</span>
                  </h2>
                  <button
                    onClick={openAddHistory}
                    style={{
                      background: 'transparent', border: '1px solid rgba(196,130,42,0.4)',
                      borderRadius: '7px', padding: '5px 11px', cursor: 'pointer',
                      color: '#c4822a', fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700, fontSize: '12px', letterSpacing: '0.06em',
                    }}
                  >
                    + Add
                  </button>
                </div>

                {history.length === 0 && !showHistoryForm && (
                  <p style={{ fontSize: '13px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                    No entries yet — add a team you've played for.
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {history.map(entry => (
                    <div key={entry.id} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(245,237,214,0.07)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '14px', color: '#f5edd6' }}>
                            {entry.team_name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif", marginTop: '2px' }}>
                            {[entry.position, entry.level].filter(Boolean).join(' · ')}
                            {entry.year_start && (
                              <span> · {entry.year_start}{entry.is_current ? '–Present' : entry.year_end ? `–${entry.year_end}` : ''}</span>
                            )}
                          </div>
                          {entry.notes && (
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif" }}>
                              {entry.notes}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                          <button
                            onClick={() => openEditHistory(entry)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 7px', borderRadius: '5px', color: 'rgba(245,237,214,0.4)', fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif", transition: 'color 0.12s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#c4822a' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(245,237,214,0.4)' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteHistory(entry.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 7px', borderRadius: '5px', color: 'rgba(245,237,214,0.3)', fontSize: '14px', lineHeight: 1, transition: 'color 0.12s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#fc8181' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(245,237,214,0.3)' }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* History form */}
                {showHistoryForm && (
                  <div style={{ marginTop: '14px', padding: '16px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(196,130,42,0.2)' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={LABEL}>Team / Org Name</label>
                      <input type="text" value={hTeam} onChange={e => setHTeam(e.target.value)} placeholder="Eastside Tigers" style={INPUT} onFocus={focusBorder} onBlur={blurBorder} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      <div>
                        <label style={LABEL}>Level</label>
                        <select value={hLevel} onChange={e => setHLevel(e.target.value)} style={{ ...SELECT, width: '100%' }} onFocus={focusBorder} onBlur={blurBorder}>
                          <option value="" style={{ background: '#0d1f3c' }}>Select…</option>
                          {LEVELS.map(l => <option key={l} value={l} style={{ background: '#0d1f3c' }}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={LABEL}>Position</label>
                        <select value={hPosition} onChange={e => setHPosition(e.target.value)} style={{ ...SELECT, width: '100%' }} onFocus={focusBorder} onBlur={blurBorder}>
                          <option value="" style={{ background: '#0d1f3c' }}>Select…</option>
                          {POSITIONS.map(p => <option key={p} value={p} style={{ background: '#0d1f3c' }}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      <div>
                        <label style={LABEL}>Year Start</label>
                        <input type="number" value={hYearStart} onChange={e => setHYearStart(e.target.value)} placeholder="2018" min="1900" max="2099" style={INPUT} onFocus={focusBorder} onBlur={blurBorder} />
                      </div>
                      <div>
                        <label style={LABEL}>Year End</label>
                        <input type="number" value={hYearEnd} onChange={e => setHYearEnd(e.target.value)} placeholder="2022" min="1900" max="2099" disabled={hIsCurrent} style={{ ...INPUT, opacity: hIsCurrent ? 0.4 : 1 }} onFocus={focusBorder} onBlur={blurBorder} />
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={hIsCurrent} onChange={e => setHIsCurrent(e.target.checked)} style={{ accentColor: '#c4822a', width: 14, height: 14 }} />
                      <span style={{ fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif", color: 'rgba(245,237,214,0.65)', letterSpacing: '0.04em' }}>Current team</span>
                    </label>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={LABEL}>Notes (optional)</label>
                      <textarea value={hNotes} onChange={e => setHNotes(e.target.value)} placeholder="Team captain, starting pitcher, etc." rows={2} style={{ ...INPUT, resize: 'vertical' } as React.CSSProperties} onFocus={focusBorder} onBlur={blurBorder} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={saveHistory}
                        disabled={hSaving || !hTeam.trim()}
                        style={{
                          flex: 1, padding: '9px', borderRadius: '7px', border: 'none',
                          background: hSaving || !hTeam.trim() ? 'rgba(196,130,42,0.35)' : '#c4822a',
                          color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 700, letterSpacing: '0.08em', fontSize: '13px',
                          cursor: hSaving || !hTeam.trim() ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {hSaving ? 'Saving…' : editingHistoryId ? 'Update Entry' : 'Save Entry'}
                      </button>
                      <button
                        onClick={() => { setShowHistoryForm(false); setEditingHistoryId(null); resetHistoryForm() }}
                        style={{
                          padding: '9px 14px', borderRadius: '7px',
                          background: 'transparent', border: '1px solid rgba(245,237,214,0.18)',
                          color: 'rgba(245,237,214,0.55)', fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>}

            </div>
            {/* ════════════════════ END LEFT COLUMN ════════════════════ */}

            {/* ════════════════════ RIGHT COLUMN (Posts) ════════════════════ */}
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '26px', letterSpacing: '0.05em', margin: '0 0 20px', color: '#f5edd6' }}>
                Your <span style={{ color: '#c4822a' }}>Posts</span>
              </h2>

              {postsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
                </div>
              ) : posts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '56px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(196,130,42,0.15)', borderRadius: '16px' }}>
                  <div style={{ fontSize: '46px', marginBottom: '14px' }}>⚾</div>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', letterSpacing: '0.05em', color: '#f5edd6', margin: '0 0 8px' }}>
                    No Posts Yet
                  </h3>
                  <p style={{ color: 'rgba(245,237,214,0.45)', fontSize: '14px', margin: '0 0 20px', fontFamily: "'Barlow', sans-serif" }}>
                    Share a thought with the community
                  </p>
                  <Link
                    href="/feed"
                    style={{
                      display: 'inline-block', padding: '9px 22px', borderRadius: '8px',
                      background: '#c4822a', color: '#0d1f3c',
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '13px',
                      textDecoration: 'none',
                    }}
                  >
                    Go to The Dugout
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {posts.map(post => (
                    <div key={post.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '12px', overflow: 'hidden' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px 10px' }}>
                        <Avatar url={profile.avatar_url} first={profile.first_name} last={profile.last_name} size={38} />
                        <div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '14px', color: '#f5edd6' }}>
                            {fullName}
                          </div>
                          <div style={{ fontSize: '11px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif", marginTop: '1px' }}>
                            {formatTimeAgo(post.created_at)}
                          </div>
                        </div>
                      </div>
                      {/* Content */}
                      {post.content && (
                        <p style={{ margin: 0, padding: '0 16px 14px', fontSize: '14px', lineHeight: '1.6', color: '#f5edd6', fontFamily: "'Barlow', sans-serif", whiteSpace: 'pre-wrap' }}>
                          {post.content}
                        </p>
                      )}
                      {/* Image */}
                      {post.image_url && (
                        <img src={post.image_url} alt="Post" style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block' }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* ════════════════════ END RIGHT COLUMN ════════════════════ */}

          </div>

          {/* ── Friends — full width ── */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '16px', padding: '24px', marginTop: '28px' }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', letterSpacing: '0.05em', margin: '0 0 16px', color: '#f5edd6' }}>
              {partnerCount} <span style={{ color: '#c4822a' }}>Friend{partnerCount !== 1 ? 's' : ''}</span>
            </h2>

            {partnersList.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                No friends yet — send a Partner Up request to connect.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {partnersList.map(person => (
                  <FollowRow key={person.id} person={person} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '90px', right: '24px', zIndex: 200,
          padding: '12px 18px', borderRadius: '8px', fontSize: '14px',
          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em',
          color: '#f5edd6', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          background: toast.type === 'success' ? 'rgba(45,90,27,0.97)' : 'rgba(180,30,30,0.97)',
          border: toast.type === 'success' ? '1px solid rgba(72,187,120,0.4)' : '1px solid rgba(220,60,60,0.4)',
        }}>
          {toast.message}
        </div>
      )}
    </AuthenticatedLayout>
  )
}
