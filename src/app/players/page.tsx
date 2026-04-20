'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
}

type Toast = { id: number; message: string; type: 'success' | 'info' }

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

// ── Shared input/select style tokens ─────────────────────────────────────────

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

// ── Toast container ───────────────────────────────────────────────────────────

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 200,
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

function Avatar({ url, first, last }: { url: string | null; first: string | null; last: string | null }) {
  if (url) {
    return (
      <img
        src={url} alt={[first, last].filter(Boolean).join(' ')}
        style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
      background: '#c4822a', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', color: '#0d1f3c', letterSpacing: '0.05em',
    }}>
      {getInitials(first, last)}
    </div>
  )
}

// ── Player card ───────────────────────────────────────────────────────────────

function PlayerCard({
  player, currentUserId, userZip, distanceMi, onToast,
}: {
  player: Profile
  currentUserId: string
  userZip: string
  distanceMi: number | null
  onToast: (msg: string, type?: 'success' | 'info') => void
}) {
  const [requesting, setRequesting] = useState(false)
  const age = calculateAge(player.date_of_birth)
  const isVerified = (player.vouches ?? 0) >= 3
  const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ') || 'Unknown Player'
  const locationLabel = distanceMi !== null
    ? `📍 ${distanceMi.toFixed(1)} mi away`
    : player.zip_code ? `📍 ${player.zip_code}` : null
  const meta = [age ? `${age} yrs` : null, locationLabel].filter(Boolean).join(' · ')

  async function handlePlayCatch() {
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

      if (checkError) {
        console.error('[PlayCatch] existing-check error:', checkError)
        onToast('Something went wrong. Try again.', 'info')
        return
      }

      if (existing && existing.length > 0) {
        onToast(`You already have an active request with ${player.first_name || 'this player'}!`, 'info')
        return
      }

      const { error } = await supabase.from('catch_requests').insert({
        sender_id: currentUserId,
        receiver_id: player.id,
        status: 'pending',
      })

      if (error) {
        console.error('[PlayCatch] insert error:', error)
        onToast('Something went wrong. Try again.', 'info')
      } else {
        onToast(`Catch request sent to ${player.first_name || 'player'}!`)
      }
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)',
      borderRadius: '12px', padding: '20px',
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      {/* Header: avatar + name + verified badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <Avatar url={player.avatar_url} first={player.first_name} last={player.last_name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: '16px', color: '#f5edd6', lineHeight: 1.2,
            }}>
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
          </div>
          {meta && (
            <div style={{ fontSize: '12px', color: 'rgba(245,237,214,0.45)', marginTop: '3px', fontFamily: "'Barlow', sans-serif" }}>
              {meta}
            </div>
          )}
        </div>
      </div>

      {/* Position pills */}
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

      {/* Level + status */}
      {(player.highest_level || player.status) && (
        <div style={{ fontSize: '12px', color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif" }}>
          {[player.highest_level, player.status].filter(Boolean).join(' · ')}
        </div>
      )}

      {/* Bio — clamped to 2 lines */}
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
          onClick={() => onToast('Vouch feature coming soon!', 'info')}
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

export default function PlayersPage() {
  const router = useRouter()

  const [sessionLoading, setSessionLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userZip, setUserZip] = useState('')

  const [players, setPlayers] = useState<Profile[]>([])
  const [playersLoading, setPlayersLoading] = useState(true)

  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [zipCoordsReady, setZipCoordsReady] = useState(false)

  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [ageFilter, setAgeFilter] = useState('')
  const [distanceFilter, setDistanceFilter] = useState('everywhere')

  const [toasts, setToasts] = useState<Toast[]>([])

  function showToast(message: string, type: 'success' | 'info' = 'success') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  // ── Pre-fetch all zip coords, then mark filter as ready ──────────────────
  const prefetchAllZips = useCallback(async (fetchedPlayers: Profile[], currentUserZip: string) => {
    console.log('[Players] prefetching zips for players:', fetchedPlayers.map(p => p.zip_code))
    const allZips = [...new Set([
      ...fetchedPlayers.map(p => p.zip_code).filter(Boolean) as string[],
      ...(currentUserZip ? [currentUserZip] : []),
    ])]
    await Promise.all(allZips.map(async zip => {
      const coords = await getZipCoords(zip)
      console.log('[Players] prefetched zip:', zip, coords)
    }))
    setZipCoordsReady(true)
  }, [])

  // ── Auth check + fetch own profile ────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth?tab=login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, zip_code')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setUserName(profile.first_name ?? null)
        setUserZip(profile.zip_code ?? '')
        if (profile.zip_code) {
          const coords = await getZipCoords(profile.zip_code)
          setUserCoords(coords)
        }
      }

      setSessionLoading(false)
      setUserId(session.user.id) // set last — fetchPlayers fires after profile is ready
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/auth?tab=login')
    })
    return () => subscription.unsubscribe()
  }, [router])

  // ── Fetch all other players ───────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    setZipCoordsReady(false)
    async function fetchPlayers() {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, date_of_birth, zip_code, positions, highest_level, status, bio, avatar_url, vouches')
        .neq('id', userId)
      const playerList: Profile[] = (data ?? []) as Profile[]

      if (playerList.length === 0) {
        setPlayers([])
        setPlayersLoading(false)
        setZipCoordsReady(true)
        return
      }

      setPlayers(playerList)
      setPlayersLoading(false)

      prefetchAllZips(playerList, userZip) // non-blocking — sets zipCoordsReady when done
    }
    fetchPlayers()
  }, [userId, prefetchAllZips, userZip])

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    console.log('[Players] filtering with cache size:', Object.keys(zipCache).length, '| zipCoordsReady:', zipCoordsReady, '| distanceFilter:', distanceFilter, '| userCoords:', userCoords)

    let list = [...players]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ').toLowerCase()
        const pos = (p.positions ?? []).join(' ').toLowerCase()
        return name.includes(q) || pos.includes(q)
      })
    }
    if (levelFilter)    list = list.filter(p => p.highest_level === levelFilter)
    if (statusFilter)   list = list.filter(p => p.status === statusFilter)
    if (positionFilter) list = list.filter(p => (p.positions ?? []).includes(positionFilter))
    if (ageFilter)      list = list.filter(p => ageInRange(calculateAge(p.date_of_birth), ageFilter))

    if (distanceFilter !== 'everywhere' && zipCoordsReady && userCoords) {
      if (distanceFilter === 'area') {
        list = list.filter(p => {
          if (!p.zip_code) return true
          const c = zipCache[p.zip_code]
          if (c === undefined || c === null) return true
          const d = getDistance(userCoords.lat, userCoords.lon, c.lat, c.lon)
          console.log('[Players] player', p.id, '| zip:', p.zip_code, '| distance:', d.toFixed(1), 'mi | limit: 10 mi | pass:', d <= 10)
          return d <= 10
        })
      } else {
        const maxMi = parseInt(distanceFilter)
        list = list.filter(p => {
          if (!p.zip_code) return true
          const c = zipCache[p.zip_code]
          if (c === undefined || c === null) return true
          const d = getDistance(userCoords.lat, userCoords.lon, c.lat, c.lon)
          console.log('[Players] player', p.id, '| zip:', p.zip_code, '| distance:', d.toFixed(1), 'mi | limit:', maxMi, 'mi | pass:', d <= maxMi)
          return d <= maxMi
        })
      }
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
  }, [players, search, levelFilter, statusFilter, positionFilter, ageFilter, distanceFilter, userCoords, zipCoordsReady])

  // ── Loading screen ────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <AuthenticatedLayout>
        <div style={{ minHeight: '100vh', background: '#0d1f3c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
        </div>
      </AuthenticatedLayout>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AuthenticatedLayout>
    <div style={{ minHeight: '100vh', background: '#0d1f3c', color: '#f5edd6', fontFamily: "'Barlow', sans-serif" }}>

      <Nav />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px 80px' }}>

        {/* Page header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(36px, 6vw, 56px)',
            letterSpacing: '0.05em', margin: 0, lineHeight: 1,
          }}>
            Find <span style={{ color: '#c4822a' }}>Players</span>
          </h1>
          <p style={{ marginTop: '6px', fontSize: '15px', color: 'rgba(245,237,214,0.5)' }}>
            Connect with players near you
          </p>
        </div>

        {/* Filter bar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '28px',
          padding: '14px 16px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(196,130,42,0.15)',
        }}>
          {/* Search — grows to fill remaining space */}
          <div style={{ flex: '1 1 160px' }}>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or position..."
              style={FILTER_INPUT}
              onFocus={onFocusBorder} onBlur={onBlurBorder}
            />
          </div>

          {/* Level */}
          <div style={{ flex: '1 1 150px' }}>
            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
              style={{ ...FILTER_SELECT, width: '100%' }} onFocus={onFocusBorder} onBlur={onBlurBorder}>
              <option value="" style={{ background: '#0d1f3c' }}>All Levels</option>
              {LEVELS.map(l => <option key={l} value={l} style={{ background: '#0d1f3c' }}>{l}</option>)}
            </select>
          </div>

          {/* Status */}
          <div style={{ flex: '0 1 130px' }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ ...FILTER_SELECT, width: '100%' }} onFocus={onFocusBorder} onBlur={onBlurBorder}>
              <option value="" style={{ background: '#0d1f3c' }}>All Statuses</option>
              <option value="Current" style={{ background: '#0d1f3c' }}>Current</option>
              <option value="Washed Up" style={{ background: '#0d1f3c' }}>Washed Up</option>
            </select>
          </div>

          {/* Position */}
          <div style={{ flex: '0 1 130px' }}>
            <select value={positionFilter} onChange={e => setPositionFilter(e.target.value)}
              style={{ ...FILTER_SELECT, width: '100%' }} onFocus={onFocusBorder} onBlur={onBlurBorder}>
              <option value="" style={{ background: '#0d1f3c' }}>All Positions</option>
              {POSITIONS.map(p => <option key={p} value={p} style={{ background: '#0d1f3c' }}>{p}</option>)}
            </select>
          </div>

          {/* Age range */}
          <div style={{ flex: '0 1 110px' }}>
            <select value={ageFilter} onChange={e => setAgeFilter(e.target.value)}
              style={{ ...FILTER_SELECT, width: '100%' }} onFocus={onFocusBorder} onBlur={onBlurBorder}>
              <option value="" style={{ background: '#0d1f3c' }}>All Ages</option>
              {['18-25', '26-35', '36-45', '45+'].map(r =>
                <option key={r} value={r} style={{ background: '#0d1f3c' }}>{r}</option>
              )}
            </select>
          </div>

          {/* Distance */}
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

        {/* Location unavailable notice */}
        {zipCoordsReady && userCoords === null && distanceFilter !== 'everywhere' && (
          <p style={{ fontSize: '12px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif", margin: '-14px 0 20px' }}>
            Location not available — showing all players
          </p>
        )}

        {/* Player grid / empty states */}
        {playersLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>

        ) : !zipCoordsReady && distanceFilter !== 'everywhere' ? (
          <p style={{ fontSize: '13px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif", textAlign: 'center', padding: '48px 0' }}>
            Loading nearby players…
          </p>

        ) : players.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>⚾</div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px', letterSpacing: '0.05em', color: '#f5edd6', margin: '0 0 8px' }}>
              No Players Yet
            </h2>
            <p style={{ color: 'rgba(245,237,214,0.5)', fontSize: '15px', margin: 0 }}>
              Be the first player in your area!
            </p>
          </div>

        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>🔍</div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px', letterSpacing: '0.05em', color: '#f5edd6', margin: '0 0 8px' }}>
              No Matches
            </h2>
            <p style={{ color: 'rgba(245,237,214,0.5)', fontSize: '15px', margin: 0 }}>
              No players found matching your filters.
            </p>
          </div>

        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {filtered.map(player => {
              const playerCoords = player.zip_code ? zipCache[player.zip_code] ?? null : null
              const distanceMi = userCoords && playerCoords
                ? getDistance(userCoords.lat, userCoords.lon, playerCoords.lat, playerCoords.lon)
                : null
              return (
                <PlayerCard
                  key={player.id}
                  player={player}
                  currentUserId={userId!}
                  userZip={userZip}
                  distanceMi={distanceMi}
                  onToast={showToast}
                />
              )
            })}
          </div>
        )}

      </main>

      <ToastContainer toasts={toasts} />
    </div>
    </AuthenticatedLayout>
  )
}
