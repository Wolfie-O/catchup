'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
}

type MemberStatus = 'none' | 'pending' | 'active'

// ── Zip / distance helpers ────────────────────────────────────────────────────

async function fetchZipCoords(zip: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) return null
    const data = await res.json()
    return { lat: parseFloat(data.places[0].latitude), lon: parseFloat(data.places[0].longitude) }
  } catch { return null }
}

const zipCache: Record<string, { lat: number; lon: number } | null> = {}

async function getZipCoords(zip: string) {
  if (zip in zipCache) return zipCache[zip]
  const c = await fetchZipCoords(zip)
  zipCache[zip] = c
  return c
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

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}

// ── Team logo ─────────────────────────────────────────────────────────────────

function TeamLogo({ url, name, size = 56 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
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

// ── Team card ─────────────────────────────────────────────────────────────────

function TeamCard({
  team, memberStatus, distanceMi, cityName, memberCount, onJoin, onNavigate,
}: {
  team: Team
  memberStatus: MemberStatus
  distanceMi: number | null
  cityName: string | null
  memberCount: number
  onJoin: (e: React.MouseEvent) => void
  onNavigate: () => void
}) {
  const isMember  = memberStatus === 'active'
  const isPending = memberStatus === 'pending'
  const isInvite  = team.join_type === 'invite' && memberStatus === 'none'
  const canJoin   = !isMember && !isPending && !isInvite

  const btnLabel = isMember ? 'Member ✓' : isPending ? 'Requested' : isInvite ? 'Invite Only' : 'Request to Join'
  const btnFilled = isMember
  const btnMuted  = isPending || isInvite

  return (
    <div
      onClick={onNavigate}
      style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)',
        borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column',
        gap: '10px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(196,130,42,0.45)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(196,130,42,0.2)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <TeamLogo url={team.logo_url} name={team.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '16px', color: '#f5edd6', lineHeight: 1.2 }}>
            {team.name}
          </div>
          {team.level && (
            <span style={{
              display: 'inline-block', marginTop: '4px', fontSize: '10px',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.06em',
              color: '#c4822a', background: 'rgba(196,130,42,0.1)', border: '1px solid rgba(196,130,42,0.3)',
              borderRadius: '4px', padding: '1px 6px',
            }}>
              {team.level}
            </span>
          )}
          <div style={{ fontSize: '12px', color: 'rgba(245,237,214,0.45)', marginTop: '4px', fontFamily: "'Barlow', sans-serif" }}>
            {[
              cityName ?? team.zip_code,
              distanceMi !== null ? `${distanceMi.toFixed(1)} mi away` : null,
            ].filter(Boolean).join(' · ')}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(245,237,214,0.4)', fontFamily: "'Barlow', sans-serif" }}>
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Bio */}
      {team.bio && (
        <p style={{
          margin: 0, fontSize: '13px', lineHeight: '1.5',
          color: 'rgba(245,237,214,0.5)', fontFamily: "'Barlow', sans-serif",
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        } as React.CSSProperties}>
          {team.bio}
        </p>
      )}

      {/* Join button */}
      <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
        <button
          onClick={canJoin ? e => { e.stopPropagation(); onJoin(e) } : e => e.stopPropagation()}
          disabled={!canJoin}
          style={{
            width: '100%', padding: '9px', borderRadius: '8px',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '12px',
            cursor: canJoin ? 'pointer' : 'default', transition: 'all 0.15s',
            border: btnFilled ? 'none' : `1px solid ${btnMuted ? 'rgba(196,130,42,0.3)' : '#c4822a'}`,
            background: btnFilled ? '#c4822a' : 'transparent',
            color: btnFilled ? '#0d1f3c' : btnMuted ? 'rgba(245,237,214,0.3)' : '#c4822a',
          }}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const router = useRouter()
  const [sessionLoading, setSessionLoading] = useState(true)
  const [userId, setUserId]   = useState<string | null>(null)
  const [userZip, setUserZip] = useState('')
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null)

  const [teams, setTeams]             = useState<Team[]>([])
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [memberStatusMap, setMemberStatusMap] = useState<Record<string, MemberStatus>>({})
  const [memberCountMap, setMemberCountMap]   = useState<Record<string, number>>({})
  const [cityNameMap, setCityNameMap]         = useState<Record<string, string>>({})
  const [zipCoordsReady, setZipCoordsReady]   = useState(false)

  const [search, setSearch]               = useState('')
  const [distanceFilter, setDistanceFilter] = useState('everywhere')

  // ── Auth + user zip ────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth?tab=login'); return }
      setUserId(session.user.id)
      const { data: profile } = await supabase
        .from('profiles').select('zip_code').eq('id', session.user.id).single()
      if (profile?.zip_code) {
        setUserZip(profile.zip_code)
        const coords = await getZipCoords(profile.zip_code)
        setUserCoords(coords)
      }
      setSessionLoading(false)
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/auth?tab=login')
    })
    return () => subscription.unsubscribe()
  }, [router])

  // ── Fetch teams + membership ───────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    async function load() {
      const [teamsRes, membersRes] = await Promise.all([
        supabase.from('teams').select('id, name, level, zip_code, join_type, bio, logo_url'),
        supabase.from('team_members').select('team_id, status').eq('user_id', userId),
      ])

      const teamList: Team[] = (teamsRes.data ?? []) as Team[]
      setTeams(teamList)

      const statusMap: Record<string, MemberStatus> = {}
      for (const m of (membersRes.data ?? []) as { team_id: string; status: string }[]) {
        statusMap[m.team_id] = m.status === 'active' ? 'active' : 'pending'
      }
      setMemberStatusMap(statusMap)

      if (teamList.length > 0) {
        const teamIds = teamList.map(t => t.id)
        const { data: allMembers } = await supabase
          .from('team_members').select('team_id').in('team_id', teamIds).eq('status', 'active')
        const countMap: Record<string, number> = {}
        for (const m of (allMembers ?? []) as { team_id: string }[]) {
          countMap[m.team_id] = (countMap[m.team_id] ?? 0) + 1
        }
        setMemberCountMap(countMap)

        // Zip lookups
        const allZips = [...new Set([
          ...teamList.map(t => t.zip_code).filter(Boolean) as string[],
          ...(userZip ? [userZip] : []),
        ])]
        await Promise.all(allZips.map(z => getZipCoords(z)))
        const cityResults = await Promise.all(allZips.map(z => fetchCity(z)))
        const cityMap: Record<string, string> = {}
        allZips.forEach((z, i) => { if (cityResults[i]) cityMap[z] = cityResults[i]! })
        setCityNameMap(cityMap)
      }

      setTeamsLoading(false)
      setZipCoordsReady(true)
    }
    load()
  }, [userId, userZip])

  async function handleJoinRequest(team: Team) {
    if (!userId) return
    const { error } = await supabase.from('team_members').insert({
      team_id: team.id, user_id: userId, role: 'player', status: 'pending',
    })
    if (!error) setMemberStatusMap(prev => ({ ...prev, [team.id]: 'pending' }))
  }

  const filtered = useMemo(() => {
    let list = [...teams]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t => t.name.toLowerCase().includes(q))
    }
    if (distanceFilter !== 'everywhere' && zipCoordsReady && userCoords) {
      const maxMi = distanceFilter === 'area' ? 10 : parseInt(distanceFilter)
      list = list.filter(t => {
        if (!t.zip_code) return true
        const c = zipCache[t.zip_code]
        if (!c) return true
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
  }, [teams, search, distanceFilter, userCoords, zipCoordsReady])

  const FILTER_INPUT: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(245,237,214,0.15)',
    color: '#f5edd6', outline: 'none', fontFamily: "'Barlow', sans-serif", boxSizing: 'border-box',
  }
  const FILTER_SELECT: React.CSSProperties = {
    ...FILTER_INPUT, cursor: 'pointer',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, letterSpacing: '0.04em',
    appearance: 'none', paddingRight: '32px',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(245,237,214,0.4)' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
  }

  if (sessionLoading) {
    return (
      <AuthenticatedLayout>
        <div style={{ minHeight: '100vh', background: '#0d1f3c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div style={{ minHeight: '100vh', background: '#0d1f3c', color: '#f5edd6', fontFamily: "'Barlow', sans-serif" }}>
        <Nav />
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px 80px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px, 6vw, 56px)', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>
                Find a <span style={{ color: '#c4822a' }}>Team</span>
              </h1>
              <p style={{ marginTop: '6px', fontSize: '15px', color: 'rgba(245,237,214,0.5)', margin: '6px 0 0' }}>
                Join a team or create your own
              </p>
            </div>
            <Link href="/teams/create" style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', fontSize: '13px', padding: '10px 20px',
              borderRadius: '8px', background: '#c4822a', color: '#0d1f3c',
              textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block',
            }}>
              + Create a Team
            </Link>
          </div>

          {/* Filters */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '28px',
            padding: '14px 16px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(196,130,42,0.15)',
          }}>
            <div style={{ flex: '1 1 200px' }}>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search teams..." style={FILTER_INPUT}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(196,130,42,0.6)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(245,237,214,0.15)'}
              />
            </div>
            <div style={{ flex: '0 1 160px' }}>
              <select value={distanceFilter} onChange={e => setDistanceFilter(e.target.value)}
                style={{ ...FILTER_SELECT, width: '100%' }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(196,130,42,0.6)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(245,237,214,0.15)'}
              >
                <option value="everywhere" style={{ background: '#0d1f3c' }}>Everywhere</option>
                <option value="area"       style={{ background: '#0d1f3c' }}>My Area</option>
                <option value="5"          style={{ background: '#0d1f3c' }}>Within 5 mi</option>
                <option value="10"         style={{ background: '#0d1f3c' }}>Within 10 mi</option>
                <option value="20"         style={{ background: '#0d1f3c' }}>Within 20 mi</option>
                <option value="50"         style={{ background: '#0d1f3c' }}>Within 50 mi</option>
              </select>
            </div>
          </div>

          {/* Grid */}
          {teamsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : teams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: '52px', marginBottom: '16px' }}>⚾</div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px', letterSpacing: '0.05em', color: '#f5edd6', margin: '0 0 8px' }}>No Teams Yet</h2>
              <p style={{ color: 'rgba(245,237,214,0.5)', fontSize: '15px', margin: '0 0 20px' }}>No teams in your area yet — create one!</p>
              <Link href="/teams/create" style={{
                display: 'inline-block', padding: '10px 24px', borderRadius: '8px',
                background: '#c4822a', color: '#0d1f3c', textDecoration: 'none',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>Create a Team</Link>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: '52px', marginBottom: '16px' }}>🔍</div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px', letterSpacing: '0.05em', color: '#f5edd6', margin: '0 0 8px' }}>No Matches</h2>
              <p style={{ color: 'rgba(245,237,214,0.5)', fontSize: '15px', margin: 0 }}>No teams match your filters.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {filtered.map(team => {
                const coords = team.zip_code ? zipCache[team.zip_code] ?? null : null
                const distanceMi = userCoords && coords
                  ? getDistance(userCoords.lat, userCoords.lon, coords.lat, coords.lon)
                  : null
                return (
                  <TeamCard
                    key={team.id}
                    team={team}
                    memberStatus={memberStatusMap[team.id] ?? 'none'}
                    distanceMi={distanceMi}
                    cityName={team.zip_code ? cityNameMap[team.zip_code] ?? null : null}
                    memberCount={memberCountMap[team.id] ?? 0}
                    onJoin={() => handleJoinRequest(team)}
                    onNavigate={() => router.push(`/teams/${team.id}`)}
                  />
                )
              })}
            </div>
          )}
        </main>
      </div>
    </AuthenticatedLayout>
  )
}
