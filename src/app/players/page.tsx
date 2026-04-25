'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AuthenticatedLayout } from '@/app/layout-authenticated'
import Nav from '@/components/Nav'

// ── Types ─────────────────────────────────────────────────────────────────────

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
  child_age_group: string | null
  child_position: string | null
  child_skill_level: string | null
  parent_looking_for: string[] | null
}

type PlayingHistory = {
  id: string
  team_name: string
  level: string | null
  position: string | null
  year_start: number | null
  year_end: number | null
  is_current: boolean
  notes: string | null
}

type ModalPost = {
  id: string
  content: string
  image_url: string | null
  created_at: string
  likeCount: number
  userLiked: boolean
}

type PartnerStatus = 'none' | 'pending' | 'accepted'
type Toast = { id: number; message: string; type: 'success' | 'info' }
type RoleTab = 'all' | 'players' | 'coaches' | 'parents'

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVELS = [
  'Pro / MiLB',
  'College (D1)',
  'College (D2 / D3 / JUCO)',
  'High School',
  'Rec League',
  'Never played organized ball',
]

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

// ── Helpers ───────────────────────────────────────────────────────────────────

function calculateAge(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

async function fetchZipCoords(zip: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) return null
    const data = await res.json()
    return { lat: parseFloat(data.places[0].latitude), lon: parseFloat(data.places[0].longitude) }
  } catch {
    return null
  }
}

const zipCache: Record<string, { lat: number; lon: number } | null> = {}

async function getZipCoords(zip: string) {
  if (zip in zipCache) return zipCache[zip]
  const coords = await fetchZipCoords(zip)
  zipCache[zip] = coords
  return coords
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getInitials(first: string | null, last: string | null): string {
  return [(first || '')[0], (last || '')[0]].filter(Boolean).join('').toUpperCase() || '?'
}

function ageInRange(age: number | null, range: string): boolean {
  if (!age) return false
  if (range === '18-25') return age >= 18 && age <= 25
  if (range === '26-35') return age >= 26 && age <= 35
  if (range === '36-45') return age >= 36 && age <= 45
  if (range === '45+')   return age > 45
  return true
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

// ── Style tokens ──────────────────────────────────────────────────────────────

const FILTER_INPUT: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(245,237,214,0.15)',
  color: '#f5edd6', outline: 'none', fontFamily: "'Barlow', sans-serif",
  boxSizing: 'border-box',
}

const FILTER_SELECT: React.CSSProperties = {
  ...FILTER_INPUT,
  cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 600, letterSpacing: '0.04em', appearance: 'none',
  paddingRight: '32px',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(245,237,214,0.4)' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
}

function onFocusBorder(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(196,130,42,0.6)'
}
function onBlurBorder(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(245,237,214,0.15)'
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const base: React.CSSProperties = { fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.06em', borderRadius: '99px', padding: '2px 8px' }
  if (role === 'player') return (
    <span style={{ ...base, background: '#1e3a5f', color: '#f5edd6' }}>Player</span>
  )
  if (role === 'coach') return (
    <span style={{ ...base, background: '#c4822a', color: '#0d1f3c' }}>Coach</span>
  )
  if (role === 'parent') return (
    <span style={{ ...base, background: '#1a5c3a', color: '#f5edd6' }}>Parent</span>
  )
  if (role === 'both') return (
    <span style={{ display: 'inline-flex', gap: '4px' }}>
      <span style={{ ...base, background: '#1e3a5f', color: '#f5edd6' }}>Player</span>
      <span style={{ ...base, background: '#c4822a', color: '#0d1f3c' }}>Coach</span>
    </span>
  )
  return null
}

// ── Toast container ───────────────────────────────────────────────────────────

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 300,
      display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '12px 16px', borderRadius: '8px', fontSize: '14px',
          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em',
          color: '#f5edd6', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          background: t.type === 'success' ? 'rgba(45,90,27,0.97)' : 'rgba(30,55,90,0.97)',
          border: t.type === 'success' ? '1px solid rgba(45,90,27,0.6)' : '1px solid rgba(196,130,42,0.4)',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  const bar = (w: string, h = '12px', mb = '0') => (
    <div style={{ height: h, width: w, background: 'rgba(255,255,255,0.08)', borderRadius: '4px', marginBottom: mb }} />
  )
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)',
      borderRadius: '12px', padding: '20px', animation: 'pulse 1.5s ease-in-out infinite',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {bar('60%', '14px')}
          {bar('38%')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {bar('28px', '20px')} {bar('28px', '20px')} {bar('28px', '20px')}
      </div>
      {bar('100%', '12px', '6px')}
      {bar('75%', '12px', '16px')}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, height: '36px', background: 'rgba(196,130,42,0.15)', borderRadius: '8px' }} />
        <div style={{ flex: 1, height: '36px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px' }} />
      </div>
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ url, first, last, size = 56 }: {
  url: string | null; first: string | null; last: string | null; size?: number
}) {
  if (url) {
    return (
      <img
        src={url} alt={[first, last].filter(Boolean).join(' ')}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: '#c4822a', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: Math.round(size * 0.36), color: '#0d1f3c', letterSpacing: '0.05em',
    }}>
      {getInitials(first, last)}
    </div>
  )
}

// ── Partner Up button ─────────────────────────────────────────────────────────

function PartnerButton({
  status, loading, onClick, small = false,
}: {
  status: PartnerStatus
  loading: boolean
  onClick: (e: React.MouseEvent) => void
  small?: boolean
}) {
  const label = status === 'accepted' ? 'Partners ✓' : status === 'pending' ? 'Requested' : 'Partner Up'
  const isFilled = status === 'accepted'
  const isMuted  = status === 'pending'
  const isActive = status === 'none'

  return (
    <button
      onClick={onClick}
      disabled={!isActive || loading}
      style={{
        padding: small ? '3px 9px' : '7px 22px',
        borderRadius: '99px',
        fontSize: small ? '10px' : '12px',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        cursor: isActive && !loading ? 'pointer' : 'default',
        border: isFilled ? 'none' : `1px solid ${isMuted ? 'rgba(196,130,42,0.35)' : '#c4822a'}`,
        background: isFilled ? '#c4822a' : 'transparent',
        color: isFilled ? '#0d1f3c' : isMuted ? 'rgba(196,130,42,0.5)' : '#c4822a',
        transition: 'all 0.15s',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  )
}

// ── Modal post card ───────────────────────────────────────────────────────────

function ModalPostCard({ post, currentUserId }: { post: ModalPost; currentUserId: string }) {
  const [liked, setLiked] = useState(post.userLiked)
  const [likeCount, setLikeCount] = useState(post.likeCount)

  async function toggleLike() {
    if (liked) {
      setLiked(false); setLikeCount(c => c - 1)
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUserId)
    } else {
      setLiked(true); setLikeCount(c => c + 1)
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUserId })
    }
  }

  return (
    <div style={{ border: '1px solid rgba(196,130,42,0.15)', borderRadius: '10px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
      {post.content && (
        <p style={{ margin: 0, padding: '14px 16px', fontSize: '14px', lineHeight: '1.6', color: '#f5edd6', fontFamily: "'Barlow', sans-serif", whiteSpace: 'pre-wrap' }}>
          {post.content}
        </p>
      )}
      {post.image_url && (
        <img src={post.image_url} alt="Post" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ flex: 1, fontSize: '11px', color: 'rgba(245,237,214,0.3)', fontFamily: "'Barlow', sans-serif" }}>
          {formatTimeAgo(post.created_at)}
        </span>
        <button
          onClick={toggleLike}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '5px 9px', borderRadius: '6px',
            color: liked ? '#c4822a' : 'rgba(245,237,214,0.45)',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: '13px',
            transition: 'color 0.12s',
          }}
        >
          {liked ? '♥' : '♡'}{likeCount > 0 ? ` ${likeCount}` : ''}
        </button>
      </div>
    </div>
  )
}

// ── Player modal ──────────────────────────────────────────────────────────────

function PlayerModal({
  player, currentUserId, distanceMi, onClose, onToast,
}: {
  player: Profile
  currentUserId: string
  distanceMi: number | null
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'info') => void
}) {
  const [visible, setVisible] = useState(false)
  const [cityName, setCityName] = useState<string | null>(null)
  const [history, setHistory] = useState<PlayingHistory[]>([])
  const [posts, setPosts] = useState<ModalPost[]>([])
  const [totalPosts, setTotalPosts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [existingRequest, setExistingRequest] = useState<'pending' | 'accepted' | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus>('none')
  const [partnerLoading, setPartnerLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ') || 'Unknown Player'
  const isVerified = (player.vouches ?? 0) >= 3
  const isCoach = player.role === 'coach' || player.role === 'both'
  const isPlayer = player.role === 'player' || player.role === 'both' || !player.role
  const isParent = player.role === 'parent'

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    async function fetchData() {
      if (player.zip_code) fetchCity(player.zip_code).then(c => setCityName(c))

      const { data: histData } = await supabase
        .from('playing_history').select('*')
        .eq('user_id', player.id).order('year_start', { ascending: false })
      setHistory((histData ?? []) as PlayingHistory[])

      const [postsRes, countRes] = await Promise.all([
        supabase.from('posts')
          .select('id, content, image_url, created_at')
          .eq('user_id', player.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', player.id),
      ])

      setTotalPosts(countRes.count ?? 0)

      const rawPosts = (postsRes.data ?? []) as { id: string; content: string; image_url: string | null; created_at: string }[]

      if (rawPosts.length > 0) {
        const postIds = rawPosts.map(p => p.id)
        const { data: likesData } = await supabase
          .from('post_likes').select('post_id, user_id').in('post_id', postIds)

        const likeCountMap: Record<string, number> = {}
        const userLikedSet = new Set<string>()
        for (const like of likesData ?? []) {
          likeCountMap[like.post_id] = (likeCountMap[like.post_id] ?? 0) + 1
          if (like.user_id === currentUserId) userLikedSet.add(like.post_id)
        }

        setPosts(rawPosts.map(p => ({
          id: p.id, content: p.content, image_url: p.image_url,
          created_at: p.created_at,
          likeCount: likeCountMap[p.id] ?? 0,
          userLiked: userLikedSet.has(p.id),
        })))
      }

      const { data: existing } = await supabase
        .from('catch_requests').select('status')
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${player.id}),` +
          `and(sender_id.eq.${player.id},receiver_id.eq.${currentUserId})`
        )
        .in('status', ['pending', 'accepted'])
        .limit(1)

      if (existing && existing.length > 0) {
        setExistingRequest(existing[0].status as 'pending' | 'accepted')
      }

      const { data: followData } = await supabase
        .from('follows')
        .select('status')
        .eq('follower_id', currentUserId)
        .eq('following_id', player.id)
        .maybeSingle()
      if (followData) {
        setPartnerStatus(followData.status as PartnerStatus)
      }

      setLoading(false)
    }
    fetchData()
  }, [player.id, currentUserId, player.zip_code])

  async function handlePlayCatch() {
    setRequesting(true)
    const { error } = await supabase.from('catch_requests').insert({
      sender_id: currentUserId, receiver_id: player.id, status: 'pending',
    })
    if (error) {
      onToast('Something went wrong. Try again.', 'info')
    } else {
      setExistingRequest('pending')
      onToast(`Catch request sent to ${player.first_name || 'player'}!`)
    }
    setRequesting(false)
  }

  async function handlePartnerUp() {
    if (partnerStatus !== 'none' || partnerLoading) return
    setPartnerLoading(true)
    const { error } = await supabase.from('follows').insert({
      follower_id: currentUserId, following_id: player.id, status: 'pending',
    })
    if (error) {
      onToast('Something went wrong. Try again.', 'info')
    } else {
      setPartnerStatus('pending')
      onToast(`Partner request sent to ${player.first_name || 'player'}!`)
    }
    setPartnerLoading(false)
  }

  const isPending  = existingRequest === 'pending'
  const isAccepted = existingRequest === 'accepted'

  const chip = (label: string, key: string) => (
    <span key={key} style={{
      padding: '4px 12px', borderRadius: '99px', fontSize: '12px',
      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.06em',
      border: '1px solid rgba(245,237,214,0.2)', color: 'rgba(245,237,214,0.7)',
      background: 'rgba(255,255,255,0.05)',
    }}>
      {label}
    </span>
  )

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%', maxWidth: '600px', maxHeight: '90vh',
          background: '#162840', border: '1px solid rgba(196,130,42,0.3)',
          borderRadius: '14px', display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'transform 0.22s ease',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: '14px', right: '14px', zIndex: 10,
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
            color: 'rgba(245,237,214,0.6)', fontSize: '18px', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; e.currentTarget.style.color = '#f5edd6' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(245,237,214,0.6)' }}
        >
          ×
        </button>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '28px 28px 0' }}>

          {/* ── Profile header ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px', paddingRight: '24px' }}>
            <Avatar url={player.avatar_url} first={player.first_name} last={player.last_name} size={100} />

            <div style={{ marginTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '34px', letterSpacing: '0.05em', margin: 0, lineHeight: 1, color: '#f5edd6' }}>
                  {fullName}
                </h2>
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
                {player.role && <RoleBadge role={player.role} />}
              </div>

              {isPlayer && (player.highest_level || player.status) && (
                <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'rgba(245,237,214,0.55)', fontFamily: "'Barlow', sans-serif" }}>
                  {[player.highest_level, player.status].filter(Boolean).join(' · ')}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                {cityName && (
                  <span style={{ fontSize: '13px', color: 'rgba(245,237,214,0.45)', fontFamily: "'Barlow', sans-serif" }}>
                    📍 {cityName}
                  </span>
                )}
                {distanceMi !== null && (
                  <>
                    {cityName && <span style={{ fontSize: '13px', color: 'rgba(245,237,214,0.25)' }}>·</span>}
                    <span style={{ fontSize: '13px', color: 'rgba(245,237,214,0.45)', fontFamily: "'Barlow', sans-serif" }}>
                      {distanceMi.toFixed(1)} mi away
                    </span>
                  </>
                )}
              </div>

              <div style={{ marginTop: '14px' }}>
                <PartnerButton
                  status={partnerStatus}
                  loading={partnerLoading}
                  onClick={e => { e.stopPropagation(); handlePartnerUp() }}
                />
              </div>
            </div>
          </div>

          {/* Position pills (player/both) */}
          {isPlayer && player.positions && player.positions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginBottom: '18px' }}>
              {player.positions.map(pos => (
                <span key={pos} style={{
                  padding: '4px 13px', borderRadius: '99px', fontSize: '12px',
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
          {player.bio && (
            <p style={{ fontSize: '14px', lineHeight: '1.65', color: 'rgba(245,237,214,0.7)', fontFamily: "'Barlow', sans-serif", margin: '0 0 24px', textAlign: 'center' }}>
              {player.bio}
            </p>
          )}

          <div style={{ height: '1px', background: 'rgba(196,130,42,0.15)', marginBottom: '24px' }} />

          {/* ── Coach section ── */}
          {isCoach && (player.coaching_specialties?.length || player.coaching_experience || player.coaching_offerings?.length || player.age_groups_coached?.length) && (
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', letterSpacing: '0.05em', margin: '0 0 14px', color: '#f5edd6' }}>
                <span style={{ color: '#c4822a' }}>Coaching</span> Info
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {player.coaching_specialties && player.coaching_specialties.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,237,214,0.4)', marginBottom: '6px' }}>Specialties</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {player.coaching_specialties.map(s => chip(s, s))}
                    </div>
                  </div>
                )}
                {player.coaching_experience && (
                  <div style={{ fontSize: '13px', color: 'rgba(245,237,214,0.6)', fontFamily: "'Barlow', sans-serif" }}>
                    <span style={{ color: 'rgba(245,237,214,0.4)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '11px', marginRight: '8px' }}>Experience</span>
                    {player.coaching_experience}
                  </div>
                )}
                {player.coaching_offerings && player.coaching_offerings.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,237,214,0.4)', marginBottom: '6px' }}>What I Offer</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {player.coaching_offerings.map(o => chip(o, o))}
                    </div>
                  </div>
                )}
                {player.age_groups_coached && player.age_groups_coached.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,237,214,0.4)', marginBottom: '6px' }}>Age Groups</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {player.age_groups_coached.map(g => chip(g, g))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Parent section ── */}
          {isParent && (player.child_position || player.child_age_group || player.child_skill_level || player.parent_looking_for?.length) && (
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', letterSpacing: '0.05em', margin: '0 0 14px', color: '#f5edd6' }}>
                <span style={{ color: '#c4822a' }}>Looking</span> For
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(player.child_position || player.child_age_group || player.child_skill_level) && (
                  <div style={{ fontSize: '13px', color: 'rgba(245,237,214,0.65)', fontFamily: "'Barlow', sans-serif" }}>
                    Child: {[player.child_position, player.child_age_group, player.child_skill_level].filter(Boolean).join(' · ')}
                  </div>
                )}
                {player.parent_looking_for && player.parent_looking_for.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {player.parent_looking_for.map(l => chip(l, l))}
                  </div>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : (
            <>
              {isPlayer && history.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', letterSpacing: '0.05em', margin: '0 0 12px', color: '#f5edd6' }}>
                    Where They&apos;ve <span style={{ color: '#c4822a' }}>Played</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {history.map(entry => (
                      <div key={entry.id} style={{ padding: '11px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(245,237,214,0.07)' }}>
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
                    ))}
                  </div>
                </div>
              )}

              {posts.length > 0 && (
                <div>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', letterSpacing: '0.05em', margin: '0 0 12px', color: '#f5edd6' }}>
                    Posts
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {posts.map(post => (
                      <ModalPostCard key={post.id} post={post} currentUserId={currentUserId} />
                    ))}
                  </div>
                  {totalPosts > 5 && (
                    <p style={{ marginTop: '10px', fontSize: '12px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif", textAlign: 'center' }}>
                      Showing 5 of {totalPosts} posts
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <div style={{ height: '140px' }} />
        </div>

        {/* ── Sticky action buttons ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '16px 28px 24px',
          background: 'linear-gradient(to bottom, transparent 0%, #162840 30%)',
          borderRadius: '0 0 14px 14px',
          pointerEvents: 'none',
        }}>
          <div style={{ pointerEvents: 'all', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {isAccepted ? (
              <button disabled style={{
                width: '100%', padding: '13px', borderRadius: '9px', border: 'none',
                background: 'rgba(72,187,120,0.2)', color: '#48bb78',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '14px',
                cursor: 'default',
              }}>
                ✓ Connected
              </button>
            ) : isPending ? (
              <button disabled style={{
                width: '100%', padding: '13px', borderRadius: '9px', border: 'none',
                background: 'rgba(196,130,42,0.25)', color: 'rgba(245,237,214,0.4)',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '14px',
                cursor: 'not-allowed',
              }}>
                Request Pending
              </button>
            ) : (
              <button
                onClick={handlePlayCatch}
                disabled={requesting}
                style={{
                  width: '100%', padding: '13px', borderRadius: '9px', border: 'none',
                  background: requesting ? 'rgba(196,130,42,0.5)' : '#c4822a',
                  color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  fontSize: '14px', cursor: requesting ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {requesting ? '…' : '⚾ Play Catch'}
              </button>
            )}

            <button
              onClick={() => onToast('Vouch feature coming soon!', 'info')}
              style={{
                width: '100%', padding: '11px', borderRadius: '9px',
                background: 'transparent', border: '1px solid rgba(245,237,214,0.18)',
                color: 'rgba(245,237,214,0.6)', fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(196,130,42,0.4)'; e.currentTarget.style.color = '#c4822a' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,237,214,0.18)'; e.currentTarget.style.color = 'rgba(245,237,214,0.6)' }}
            >
              Vouch
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Community card ────────────────────────────────────────────────────────────

function CommunityCard({
  player, currentUserId, userZip, distanceMi, onToast, onOpenModal, initialPartnerStatus,
}: {
  player: Profile
  currentUserId: string
  userZip: string
  distanceMi: number | null
  onToast: (msg: string, type?: 'success' | 'info') => void
  onOpenModal: () => void
  initialPartnerStatus: PartnerStatus
}) {
  const [requesting, setRequesting] = useState(false)
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus>(initialPartnerStatus)
  const [partnerLoading, setPartnerLoading] = useState(false)
  const age = calculateAge(player.date_of_birth)
  const isVerified = (player.vouches ?? 0) >= 3
  const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ') || 'Unknown'
  const locationLabel = distanceMi !== null
    ? `📍 ${distanceMi.toFixed(1)} mi away`
    : player.zip_code ? `📍 ${player.zip_code}` : null
  const meta = [age ? `${age} yrs` : null, locationLabel].filter(Boolean).join(' · ')

  const role = player.role
  const isPlayer = role === 'player' || role === 'both' || !role
  const isCoach = role === 'coach' || role === 'both'
  const isParent = role === 'parent'

  async function handlePlayCatch(e: React.MouseEvent) {
    e.stopPropagation()
    setRequesting(true)
    try {
      const { data: existing, error: checkError } = await supabase
        .from('catch_requests')
        .select('id, sender_id, receiver_id, status')
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${player.id}),` +
          `and(sender_id.eq.${player.id},receiver_id.eq.${currentUserId})`
        )
        .in('status', ['pending', 'accepted'])

      if (checkError) { onToast('Something went wrong. Try again.', 'info'); return }
      if (existing && existing.length > 0) {
        onToast(`You already have an active request with ${player.first_name || 'this person'}!`, 'info')
        return
      }
      const { error } = await supabase.from('catch_requests').insert({
        sender_id: currentUserId, receiver_id: player.id, status: 'pending',
      })
      if (error) {
        onToast('Something went wrong. Try again.', 'info')
      } else {
        onToast(`Catch request sent to ${player.first_name || 'player'}!`)
      }
    } finally {
      setRequesting(false)
    }
  }

  async function handlePartnerUp(e: React.MouseEvent) {
    e.stopPropagation()
    if (partnerStatus !== 'none' || partnerLoading) return
    setPartnerLoading(true)
    const { error } = await supabase.from('follows').insert({
      follower_id: currentUserId, following_id: player.id, status: 'pending',
    })
    if (!error) {
      setPartnerStatus('pending')
      onToast(`Partner request sent to ${player.first_name || 'player'}!`)
    } else {
      onToast('Something went wrong. Try again.', 'info')
    }
    setPartnerLoading(false)
  }

  const miniChip = (label: string) => (
    <span key={label} style={{
      padding: '3px 9px', borderRadius: '99px', fontSize: '11px',
      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.06em',
      border: '1px solid rgba(245,237,214,0.18)', color: 'rgba(245,237,214,0.6)',
      background: 'rgba(255,255,255,0.05)',
    }}>
      {label}
    </span>
  )

  return (
    <div
      onClick={onOpenModal}
      style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)',
        borderRadius: '12px', padding: '20px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(196,130,42,0.45)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(196,130,42,0.2)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
    >
      {/* Header: avatar + name + Partner Up pill */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <Avatar url={player.avatar_url} first={player.first_name} last={player.last_name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '16px', color: '#f5edd6', lineHeight: 1.2 }}>
                  {fullName}
                </span>
                {isVerified && (
                  <span style={{
                    fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    letterSpacing: '0.06em', color: '#f0b429',
                    background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.3)',
                    borderRadius: '4px', padding: '1px 5px',
                  }}>
                    ★ Verified
                  </span>
                )}
                {role && <RoleBadge role={role} />}
              </div>
              {meta && (
                <div style={{ fontSize: '12px', color: 'rgba(245,237,214,0.45)', marginTop: '3px', fontFamily: "'Barlow', sans-serif" }}>
                  {meta}
                </div>
              )}
            </div>
            <PartnerButton status={partnerStatus} loading={partnerLoading} onClick={handlePartnerUp} small />
          </div>
        </div>
      </div>

      {/* ── Player content ── */}
      {isPlayer && !isCoach && (
        <>
          {player.positions && player.positions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {player.positions.map(pos => (
                <span key={pos} style={{
                  padding: '3px 10px', borderRadius: '99px', fontSize: '12px',
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em',
                  border: '1px solid rgba(196,130,42,0.45)', color: '#c4822a',
                  background: 'rgba(196,130,42,0.1)',
                }}>
                  {pos}
                </span>
              ))}
            </div>
          )}
          {(player.highest_level || player.status) && (
            <div style={{ fontSize: '12px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif" }}>
              {[player.highest_level, player.status].filter(Boolean).join(' · ')}
            </div>
          )}
        </>
      )}

      {/* ── Both content (player + coach) ── */}
      {isPlayer && isCoach && (
        <>
          {player.positions && player.positions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {player.positions.map(pos => (
                <span key={pos} style={{
                  padding: '3px 10px', borderRadius: '99px', fontSize: '12px',
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em',
                  border: '1px solid rgba(196,130,42,0.45)', color: '#c4822a',
                  background: 'rgba(196,130,42,0.1)',
                }}>
                  {pos}
                </span>
              ))}
            </div>
          )}
          {player.coaching_specialties && player.coaching_specialties.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {player.coaching_specialties.slice(0, 2).map(miniChip)}
            </div>
          )}
        </>
      )}

      {/* ── Coach-only content ── */}
      {isCoach && !isPlayer && (
        <>
          {player.coaching_specialties && player.coaching_specialties.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {player.coaching_specialties.slice(0, 3).map(miniChip)}
            </div>
          )}
          {(player.coaching_experience || (player.coaching_offerings && player.coaching_offerings.length > 0)) && (
            <div style={{ fontSize: '12px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif" }}>
              {[player.coaching_experience, ...(player.coaching_offerings?.slice(0, 2) ?? [])].filter(Boolean).join(' · ')}
            </div>
          )}
        </>
      )}

      {/* ── Parent content ── */}
      {isParent && (
        <>
          {(player.child_position || player.child_age_group) && (
            <div style={{ fontSize: '12px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif" }}>
              Child: {[player.child_position, player.child_age_group].filter(Boolean).join(' · ')}
            </div>
          )}
          {player.parent_looking_for && player.parent_looking_for.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {player.parent_looking_for.slice(0, 3).map(miniChip)}
            </div>
          )}
        </>
      )}

      {/* Bio (all roles) */}
      {player.bio && (
        <p style={{
          margin: 0, fontSize: '13px', lineHeight: '1.5',
          color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif",
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        } as React.CSSProperties}>
          {player.bio}
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '4px' }}>
        <button
          onClick={handlePlayCatch}
          disabled={requesting}
          style={{
            flex: 1, padding: '9px 8px', borderRadius: '8px', border: 'none',
            cursor: requesting ? 'not-allowed' : 'pointer',
            background: requesting ? 'rgba(196,130,42,0.5)' : '#c4822a',
            color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '12px',
            transition: 'background 0.15s',
          }}
        >
          {requesting ? '…' : 'Play Catch'}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onToast('Vouch feature coming soon!', 'info') }}
          style={{
            flex: 1, padding: '9px 8px', borderRadius: '8px',
            cursor: 'pointer', background: 'transparent',
            border: '1px solid rgba(245,237,214,0.2)', color: 'rgba(245,237,214,0.7)',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '12px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(196,130,42,0.5)'; e.currentTarget.style.color = '#c4822a' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,237,214,0.2)'; e.currentTarget.style.color = 'rgba(245,237,214,0.7)' }}
        >
          Vouch
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const router = useRouter()

  const [sessionLoading, setSessionLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userZip, setUserZip] = useState('')

  const [players, setPlayers] = useState<Profile[]>([])
  const [playersLoading, setPlayersLoading] = useState(true)

  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [zipCoordsReady, setZipCoordsReady] = useState(false)

  const [search, setSearch] = useState('')
  const [roleTab, setRoleTab] = useState<RoleTab>('all')
  const [levelFilter, setLevelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [ageFilter, setAgeFilter] = useState('')
  const [distanceFilter, setDistanceFilter] = useState('everywhere')

  const [toasts, setToasts] = useState<Toast[]>([])
  const [modalPlayer, setModalPlayer] = useState<Profile | null>(null)
  const [partnerStatusMap, setPartnerStatusMap] = useState<Record<string, PartnerStatus>>({})

  function showToast(message: string, type: 'success' | 'info' = 'success') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  const prefetchAllZips = useCallback(async (fetchedPlayers: Profile[], currentUserZip: string) => {
    const allZips = [...new Set([
      ...fetchedPlayers.map(p => p.zip_code).filter(Boolean) as string[],
      ...(currentUserZip ? [currentUserZip] : []),
    ])]
    await Promise.all(allZips.map(zip => getZipCoords(zip)))
    setZipCoordsReady(true)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth?tab=login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('first_name, zip_code').eq('id', session.user.id).single()

      if (profile) {
        setUserZip(profile.zip_code ?? '')
        if (profile.zip_code) {
          const coords = await getZipCoords(profile.zip_code)
          setUserCoords(coords)
        }
      }

      setSessionLoading(false)
      setUserId(session.user.id)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/auth?tab=login')
    })
    return () => subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    if (!userId) return
    setZipCoordsReady(false)
    async function fetchProfiles() {
      const [profilesRes, followsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, date_of_birth, zip_code, positions, highest_level, status, bio, avatar_url, vouches, role, coaching_specialties, coaching_experience, coaching_offerings, age_groups_coached, child_age_group, child_position, child_skill_level, parent_looking_for')
          .neq('id', userId),
        supabase
          .from('follows')
          .select('following_id, status')
          .eq('follower_id', userId)
          .in('status', ['pending', 'accepted']),
      ])

      const profileList: Profile[] = (profilesRes.data ?? []) as Profile[]

      const statusMap: Record<string, PartnerStatus> = {}
      for (const f of (followsRes.data ?? []) as { following_id: string; status: string }[]) {
        statusMap[f.following_id] = f.status as PartnerStatus
      }
      setPartnerStatusMap(statusMap)

      if (profileList.length === 0) {
        setPlayers([]); setPlayersLoading(false); setZipCoordsReady(true); return
      }

      setPlayers(profileList)
      setPlayersLoading(false)
      prefetchAllZips(profileList, userZip)
    }
    fetchProfiles()
  }, [userId, prefetchAllZips, userZip])

  const filtered = useMemo(() => {
    let list = [...players]

    // Role tab filter
    if (roleTab === 'players') {
      list = list.filter(p => p.role === 'player' || p.role === 'both' || !p.role)
    } else if (roleTab === 'coaches') {
      list = list.filter(p => p.role === 'coach' || p.role === 'both')
    } else if (roleTab === 'parents') {
      list = list.filter(p => p.role === 'parent')
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ').toLowerCase()
        const pos = (p.positions ?? []).join(' ').toLowerCase()
        const specialties = (p.coaching_specialties ?? []).join(' ').toLowerCase()
        return name.includes(q) || pos.includes(q) || specialties.includes(q)
      })
    }
    if (levelFilter)    list = list.filter(p => p.highest_level === levelFilter)
    if (statusFilter)   list = list.filter(p => p.status === statusFilter)
    if (positionFilter) list = list.filter(p => (p.positions ?? []).includes(positionFilter))
    if (ageFilter)      list = list.filter(p => ageInRange(calculateAge(p.date_of_birth), ageFilter))

    if (distanceFilter !== 'everywhere' && zipCoordsReady && userCoords) {
      const maxMi = distanceFilter === 'area' ? 10 : parseInt(distanceFilter)
      list = list.filter(p => {
        if (!p.zip_code) return true
        const c = zipCache[p.zip_code]
        if (c === undefined || c === null) return true
        return getDistance(userCoords.lat, userCoords.lon, c.lat, c.lon) <= maxMi
      })
    }

    list.sort((a, b) => {
      const ca = a.zip_code ? zipCache[a.zip_code] ?? null : null
      const cb = b.zip_code ? zipCache[b.zip_code] ?? null : null
      const da = userCoords && ca ? getDistance(userCoords.lat, userCoords.lon, ca.lat, ca.lon) : null
      const db = userCoords && cb ? getDistance(userCoords.lat, userCoords.lon, cb.lat, cb.lon) : null
      if (da === null && db === null) return 0
      if (da === null) return 1
      if (db === null) return -1
      return da - db
    })

    return list
  }, [players, search, roleTab, levelFilter, statusFilter, positionFilter, ageFilter, distanceFilter, userCoords, zipCoordsReady])

  if (sessionLoading) {
    return (
      <AuthenticatedLayout>
        <div style={{ minHeight: '100vh', background: '#0d1f3c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
        </div>
      </AuthenticatedLayout>
    )
  }

  const modalDistanceMi = modalPlayer && userCoords && modalPlayer.zip_code
    ? (() => {
        const c = zipCache[modalPlayer.zip_code!]
        return c ? getDistance(userCoords.lat, userCoords.lon, c.lat, c.lon) : null
      })()
    : null

  const ROLE_TABS: { value: RoleTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'players', label: 'Players' },
    { value: 'coaches', label: 'Coaches' },
    { value: 'parents', label: 'Parents' },
  ]

  return (
    <AuthenticatedLayout>
    <div style={{ minHeight: '100vh', background: '#0d1f3c', color: '#f5edd6', fontFamily: "'Barlow', sans-serif" }}>

      <Nav />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px 80px' }}>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px, 6vw, 56px)', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>
            <span style={{ color: '#c4822a' }}>Community</span>
          </h1>
          <p style={{ marginTop: '6px', fontSize: '15px', color: 'rgba(245,237,214,0.5)' }}>
            Find players, coaches, and more in your area
          </p>
        </div>

        {/* Role tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {ROLE_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setRoleTab(tab.value)}
              style={{
                padding: '7px 18px', borderRadius: '99px', fontSize: '13px', cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em',
                border: roleTab === tab.value ? '1px solid #c4822a' : '1px solid rgba(245,237,214,0.2)',
                background: roleTab === tab.value ? '#c4822a' : 'transparent',
                color: roleTab === tab.value ? '#0d1f3c' : 'rgba(245,237,214,0.6)',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '28px',
          padding: '14px 16px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(196,130,42,0.15)',
        }}>
          <div style={{ flex: '1 1 160px' }}>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, position, specialty..." style={FILTER_INPUT}
              onFocus={onFocusBorder} onBlur={onBlurBorder} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
              style={{ ...FILTER_SELECT, width: '100%' }} onFocus={onFocusBorder} onBlur={onBlurBorder}>
              <option value="" style={{ background: '#0d1f3c' }}>All Levels</option>
              {LEVELS.map(l => <option key={l} value={l} style={{ background: '#0d1f3c' }}>{l}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 130px' }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ ...FILTER_SELECT, width: '100%' }} onFocus={onFocusBorder} onBlur={onBlurBorder}>
              <option value="" style={{ background: '#0d1f3c' }}>All Statuses</option>
              <option value="Current" style={{ background: '#0d1f3c' }}>Current</option>
              <option value="Washed Up" style={{ background: '#0d1f3c' }}>Washed Up</option>
            </select>
          </div>
          <div style={{ flex: '0 1 130px' }}>
            <select value={positionFilter} onChange={e => setPositionFilter(e.target.value)}
              style={{ ...FILTER_SELECT, width: '100%' }} onFocus={onFocusBorder} onBlur={onBlurBorder}>
              <option value="" style={{ background: '#0d1f3c' }}>All Positions</option>
              {POSITIONS.map(p => <option key={p} value={p} style={{ background: '#0d1f3c' }}>{p}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 110px' }}>
            <select value={ageFilter} onChange={e => setAgeFilter(e.target.value)}
              style={{ ...FILTER_SELECT, width: '100%' }} onFocus={onFocusBorder} onBlur={onBlurBorder}>
              <option value="" style={{ background: '#0d1f3c' }}>All Ages</option>
              {['18-25', '26-35', '36-45', '45+'].map(r =>
                <option key={r} value={r} style={{ background: '#0d1f3c' }}>{r}</option>
              )}
            </select>
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <select value={distanceFilter} onChange={e => setDistanceFilter(e.target.value)}
              style={{ ...FILTER_SELECT, width: '100%' }} onFocus={onFocusBorder} onBlur={onBlurBorder}>
              <option value="everywhere" style={{ background: '#0d1f3c' }}>Everywhere</option>
              <option value="area" style={{ background: '#0d1f3c' }}>My Area</option>
              <option value="5" style={{ background: '#0d1f3c' }}>Within 5 mi</option>
              <option value="10" style={{ background: '#0d1f3c' }}>Within 10 mi</option>
              <option value="20" style={{ background: '#0d1f3c' }}>Within 20 mi</option>
              <option value="50" style={{ background: '#0d1f3c' }}>Within 50 mi</option>
            </select>
          </div>
        </div>

        {zipCoordsReady && userCoords === null && distanceFilter !== 'everywhere' && (
          <p style={{ fontSize: '12px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif", margin: '-14px 0 20px' }}>
            Location not available — showing all members
          </p>
        )}

        {playersLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !zipCoordsReady && distanceFilter !== 'everywhere' ? (
          <p style={{ fontSize: '13px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif", textAlign: 'center', padding: '48px 0' }}>
            Loading nearby members…
          </p>
        ) : players.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>⚾</div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px', letterSpacing: '0.05em', color: '#f5edd6', margin: '0 0 8px' }}>No Members Yet</h2>
            <p style={{ color: 'rgba(245,237,214,0.5)', fontSize: '15px', margin: 0 }}>Be the first to join your area!</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>🔍</div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px', letterSpacing: '0.05em', color: '#f5edd6', margin: '0 0 8px' }}>No Matches</h2>
            <p style={{ color: 'rgba(245,237,214,0.5)', fontSize: '15px', margin: 0 }}>No members found matching your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {filtered.map(player => {
              const playerCoords = player.zip_code ? zipCache[player.zip_code] ?? null : null
              const distanceMi = userCoords && playerCoords
                ? getDistance(userCoords.lat, userCoords.lon, playerCoords.lat, playerCoords.lon)
                : null
              return (
                <CommunityCard
                  key={player.id}
                  player={player}
                  currentUserId={userId!}
                  userZip={userZip}
                  distanceMi={distanceMi}
                  onToast={showToast}
                  onOpenModal={() => setModalPlayer(player)}
                  initialPartnerStatus={partnerStatusMap[player.id] ?? 'none'}
                />
              )
            })}
          </div>
        )}

      </main>

      <ToastContainer toasts={toasts} />
    </div>

    {modalPlayer && (
      <PlayerModal
        player={modalPlayer}
        currentUserId={userId!}
        distanceMi={modalDistanceMi}
        onClose={() => setModalPlayer(null)}
        onToast={showToast}
      />
    )}

    </AuthenticatedLayout>
  )
}
