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

type OtherPlayer = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  highest_level: string | null
}

type Connection = {
  request_id: string
  other: OtherPlayer
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

  // ── Connections ─────────────────────────────────────────────────────────────
  const [connections, setConnections] = useState<Connection[]>([])

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
      .select('id, first_name, last_name, date_of_birth, zip_code, positions, highest_level, status, bio, avatar_url, vouches')
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

  // ── Fetch connections ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    async function fetchConnections() {
      const { data: requests } = await supabase
        .from('catch_requests')
        .select('id, sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)

      if (!requests || requests.length === 0) return

      const otherIds = requests.map((r: { sender_id: string; receiver_id: string }) =>
        r.sender_id === userId ? r.receiver_id : r.sender_id
      )

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, highest_level')
        .in('id', otherIds)

      const profileMap: Record<string, OtherPlayer> = {}
      for (const p of (profiles ?? []) as OtherPlayer[]) profileMap[p.id] = p

      const conns: Connection[] = requests.map((r: { id: string; sender_id: string; receiver_id: string }) => {
        const otherId = r.sender_id === userId ? r.receiver_id : r.sender_id
        return {
          request_id: r.id,
          other: profileMap[otherId] ?? { id: otherId, first_name: null, last_name: null, avatar_url: null, highest_level: null },
        }
      })
      setConnections(conns)
    }
    fetchConnections()
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

          {/* ── Two-column layout ── */}
          <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

            {/* ════════════════════ LEFT COLUMN ════════════════════ */}
            <div style={{ flex: '0 0 340px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* ── Profile card ── */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '16px', padding: '28px 24px' }}>

                {editMode ? (
                  /* ── Edit form ── */
                  <div>
                    {/* Avatar upload */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '22px' }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          width: 96, height: 96, borderRadius: '50%', padding: 0, overflow: 'hidden',
                          border: '2px dashed rgba(196,130,42,0.5)', background: 'transparent',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {editAvatarPreview || profile.avatar_url ? (
                          <img src={editAvatarPreview ?? profile.avatar_url!} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: '#c4822a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: '#0d1f3c' }}>
                            {getInitials(editFirstName, editLastName)}
                          </div>
                        )}
                      </button>
                      <span style={{ marginTop: '8px', fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", color: 'rgba(245,237,214,0.4)', letterSpacing: '0.06em' }}>
                        Click to change photo
                      </span>
                      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => {
                          const f = e.target.files?.[0]; if (!f) return
                          setEditAvatarFile(f)
                          setEditAvatarPreview(URL.createObjectURL(f))
                        }}
                      />
                    </div>

                    {/* Name */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={LABEL}>First Name</label>
                        <input type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} style={INPUT} onFocus={focusBorder} onBlur={blurBorder} />
                      </div>
                      <div>
                        <label style={LABEL}>Last Name</label>
                        <input type="text" value={editLastName} onChange={e => setEditLastName(e.target.value)} style={INPUT} onFocus={focusBorder} onBlur={blurBorder} />
                      </div>
                    </div>

                    {/* DOB + Zip */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={LABEL}>Date of Birth</label>
                        <input type="date" value={editDob} onChange={e => setEditDob(e.target.value)} style={{ ...INPUT, colorScheme: 'dark' } as React.CSSProperties} onFocus={focusBorder} onBlur={blurBorder} />
                      </div>
                      <div>
                        <label style={LABEL}>Zip Code</label>
                        <input type="text" value={editZip} onChange={e => setEditZip(e.target.value.replace(/\D/g, '').slice(0, 5))} maxLength={5} placeholder="12345" style={INPUT} onFocus={focusBorder} onBlur={blurBorder} />
                      </div>
                    </div>

                    {/* Positions */}
                    <div style={{ marginBottom: '12px' }}>
                      <label style={LABEL}>Positions</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {POSITIONS.map(pos => {
                          const active = editPositions.includes(pos)
                          return (
                            <button key={pos} type="button" onClick={() => toggleEditPosition(pos)} style={{
                              padding: '5px 12px', borderRadius: '99px', fontSize: '12px', cursor: 'pointer',
                              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em',
                              border: active ? '1px solid #c4822a' : '1px solid rgba(245,237,214,0.2)',
                              background: active ? '#c4822a' : 'rgba(255,255,255,0.04)',
                              color: active ? '#0d1f3c' : 'rgba(245,237,214,0.65)',
                              transition: 'all 0.12s',
                            }}>
                              {pos}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Level + Status */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={LABEL}>Highest Level</label>
                        <select value={editLevel} onChange={e => setEditLevel(e.target.value)} style={{ ...SELECT, width: '100%' }} onFocus={focusBorder} onBlur={blurBorder}>
                          <option value="" style={{ background: '#0d1f3c' }}>Select…</option>
                          {LEVELS.map(l => <option key={l} value={l} style={{ background: '#0d1f3c' }}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={LABEL}>Status</label>
                        <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ ...SELECT, width: '100%' }} onFocus={focusBorder} onBlur={blurBorder}>
                          <option value="" style={{ background: '#0d1f3c' }}>Select…</option>
                          <option value="Current" style={{ background: '#0d1f3c' }}>Current</option>
                          <option value="Washed Up" style={{ background: '#0d1f3c' }}>Washed Up</option>
                        </select>
                      </div>
                    </div>

                    {/* Bio */}
                    <div style={{ marginBottom: '18px' }}>
                      <label style={LABEL}>Bio</label>
                      <textarea
                        value={editBio}
                        onChange={e => setEditBio(e.target.value)}
                        rows={4}
                        placeholder="Tell the community about yourself..."
                        style={{ ...INPUT, resize: 'vertical', minHeight: '90px', lineHeight: '1.5' } as React.CSSProperties}
                        onFocus={focusBorder}
                        onBlur={blurBorder}
                      />
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={saveProfile}
                        disabled={saving}
                        style={{
                          flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                          background: saving ? 'rgba(196,130,42,0.5)' : '#c4822a',
                          color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                          fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer',
                          transition: 'background 0.15s',
                        }}
                      >
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => setEditMode(false)}
                        style={{
                          padding: '10px 16px', borderRadius: '8px',
                          background: 'transparent', border: '1px solid rgba(245,237,214,0.2)',
                          color: 'rgba(245,237,214,0.6)', fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 700, letterSpacing: '0.08em', fontSize: '13px', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                ) : (
                  /* ── Profile view ── */
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

                        {(profile.highest_level || profile.status) && (
                          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif" }}>
                            {[profile.highest_level, profile.status].filter(Boolean).join(' · ')}
                          </p>
                        )}

                        {cityName && (
                          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(245,237,214,0.4)', fontFamily: "'Barlow', sans-serif" }}>
                            📍 {cityName}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Position pills */}
                    {profile.positions && profile.positions.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginBottom: '16px' }}>
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

                    {/* Bio */}
                    {profile.bio && (
                      <p style={{ fontSize: '14px', lineHeight: '1.65', color: 'rgba(245,237,214,0.7)', fontFamily: "'Barlow', sans-serif", margin: '0 0 20px', textAlign: 'center' }}>
                        {profile.bio}
                      </p>
                    )}

                    <button
                      onClick={enterEditMode}
                      style={{
                        width: '100%', padding: '9px', borderRadius: '8px',
                        background: 'transparent', border: '1px solid rgba(196,130,42,0.5)',
                        color: '#c4822a', fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                        fontSize: '13px', cursor: 'pointer', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,130,42,0.1)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      Edit Profile
                    </button>
                  </div>
                )}
              </div>

              {/* ── Where I've Played ── */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '16px', padding: '24px' }}>
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
              </div>

              {/* ── Connections ── */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '16px', padding: '24px' }}>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', letterSpacing: '0.05em', margin: '0 0 16px', color: '#f5edd6' }}>
                  {connections.length} <span style={{ color: '#c4822a' }}>Connection{connections.length !== 1 ? 's' : ''}</span>
                </h2>

                {connections.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif", margin: 0 }}>
                    No connections yet — send a catch request to get started.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {connections.map(conn => (
                      <div key={conn.request_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(245,237,214,0.06)' }}>
                        {conn.other.avatar_url ? (
                          <img src={conn.other.avatar_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#c4822a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: '#0d1f3c' }}>
                            {getInitials(conn.other.first_name, conn.other.last_name)}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '14px', color: '#f5edd6', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {[conn.other.first_name, conn.other.last_name].filter(Boolean).join(' ') || 'Player'}
                          </div>
                          {conn.other.highest_level && (
                            <div style={{ fontSize: '11px', color: 'rgba(245,237,214,0.4)', fontFamily: "'Barlow', sans-serif" }}>
                              {conn.other.highest_level}
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
                    ))}
                  </div>
                )}
              </div>

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
