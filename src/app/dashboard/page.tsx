'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AuthenticatedLayout } from '@/app/layout-authenticated'
import Nav from '@/components/Nav'

// ── Types ──────────────────────────────────────────────────────────────────────

type UserProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  role: string | null
  zip_code: string | null
  positions: string[] | null
  highest_level: string | null
  status: string | null
  coaching_experience: string | null
  coaching_specialties: string[] | null
}

type TeamWithEvent = {
  teamId: string
  teamName: string
  logoUrl: string | null
  myRole: string
  nextEvent: { title: string; event_date: string } | null
  primaryColor: string
}

type RecentPost = {
  id: string
  content: string
  tag: string | null
  created_at: string
  authorName: string
  authorAvatar: string | null
  like_count: number
  comment_count: number
}

type DiscoverProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  zip_code: string | null
  positions: string[] | null
  coaching_specialties: string[] | null
  distanceMi: number | null
}

type PendingJoin = {
  teamId: string
  teamName: string
  count: number
}

// ── Tag lookup ─────────────────────────────────────────────────────────────────

const TAG_MAP: Record<string, { emoji: string; label: string }> = {
  looking_for_players:       { emoji: '🔍', label: 'Looking for Players' },
  looking_for_team:          { emoji: '🙋', label: 'Looking for a Team' },
  looking_for_catch_partner: { emoji: '🤝', label: 'Catch Partner' },
  lessons_available:         { emoji: '🎓', label: 'Lessons Available' },
  tryouts:                   { emoji: '📋', label: 'Tryouts' },
  camps_clinics:             { emoji: '⛺', label: 'Camps & Clinics' },
  game_recap:                { emoji: '🏆', label: 'Game Recap' },
  media:                     { emoji: '📸', label: 'Media' },
  announcement:              { emoji: '📢', label: 'Announcement' },
  discussion:                { emoji: '💬', label: 'Discussion' },
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

function formatLastVisit(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (hours < 1) return 'less than an hour ago'
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return 'more than a month ago'
}

function formatEventDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

async function fetchCity(zip: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) return null
    const data = await res.json()
    const place = data.places?.[0]
    return place ? `${place['place name']}, ${place['state abbreviation']}` : null
  } catch { return null }
}

async function fetchZipCoords(zip: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) return null
    const data = await res.json()
    return { lat: parseFloat(data.places[0].latitude), lon: parseFloat(data.places[0].longitude) }
  } catch { return null }
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Avatar({ url, first, last, size = 40 }: {
  url: string | null; first: string | null; last: string | null; size?: number
}) {
  if (url) return <img src={url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
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

function RoleBadge({ role }: { role: string | null }) {
  const base: React.CSSProperties = {
    fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700, letterSpacing: '0.06em', borderRadius: '99px',
    padding: '3px 12px', textTransform: 'uppercase' as const,
  }
  if (role === 'player') return <span style={{ ...base, background: '#1e3a5f', color: '#f5edd6' }}>Player</span>
  if (role === 'coach') return <span style={{ ...base, background: '#c4822a', color: '#0d1f3c' }}>Coach</span>
  if (role === 'parent') return <span style={{ ...base, background: '#1a5c3a', color: '#f5edd6' }}>Parent</span>
  if (role === 'both') return (
    <span style={{ display: 'inline-flex', gap: '4px' }}>
      <span style={{ ...base, background: '#1e3a5f', color: '#f5edd6' }}>Player</span>
      <span style={{ ...base, background: '#c4822a', color: '#0d1f3c' }}>Coach</span>
    </span>
  )
  return null
}

function TeamLogo({ name, logoUrl, size = 48, color = '#c4822a' }: { name: string; logoUrl: string | null; size?: number; color?: string }) {
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
  if (logoUrl) return <img src={logoUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: Math.round(size * 0.36),
      color: '#0d1f3c', letterSpacing: '0.04em',
    }}>
      {initials}
    </div>
  )
}

function SectionHeader({ label, linkHref, linkLabel }: { label: string; linkHref?: string; linkLabel?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,237,214,0.4)' }}>
        {label}
      </div>
      {linkHref && linkLabel && (
        <Link href={linkHref} style={{ fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#c4822a', textDecoration: 'none' }}>
          {linkLabel}
        </Link>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()

  const [sessionLoading, setSessionLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [cityName, setCityName] = useState<string | null>(null)
  const [lastVisit, setLastVisit] = useState<string | null>(null)

  const [pendingCatchRequests, setPendingCatchRequests] = useState(0)
  const [pendingJoins, setPendingJoins] = useState<PendingJoin[]>([])

  const [myTeams, setMyTeams] = useState<TeamWithEvent[]>([])
  const [teamsLoading, setTeamsLoading] = useState(true)

  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([])

  const [partnerCount, setPartnerCount] = useState<number | null>(null)
  const [nearbyPlayers, setNearbyPlayers] = useState<DiscoverProfile[]>([])
  const [nearbyCoaches, setNearbyCoaches] = useState<DiscoverProfile[]>([])
  const [isMobile, setIsMobile] = useState(false)

  // ── Auth ──────────────────────────────────────────────────────────────────
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

  // ── Mobile detection ─────────────────────────────────────────────────────
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Load dashboard data ───────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    const uid = userId

    async function load() {
      // 1. Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, role, zip_code, positions, highest_level, status, coaching_experience, coaching_specialties')
        .eq('id', uid)
        .single()

      if (!profileData) { router.push('/profile/setup'); return }
      const prof = profileData as UserProfile
      setProfile(prof)

      // 2. last_visited_at — read then update (column may not exist yet)
      const { data: visitRow, error: visitErr } = await supabase
        .from('profiles')
        .select('last_visited_at')
        .eq('id', uid)
        .single()
      if (!visitErr && (visitRow as Record<string, unknown>)?.last_visited_at) {
        setLastVisit((visitRow as Record<string, unknown>).last_visited_at as string)
      }
      supabase.from('profiles').update({ last_visited_at: new Date().toISOString() }).eq('id', uid).then(() => {})

      // 3. City + coords
      let userCoords: { lat: number; lon: number } | null = null
      if (prof.zip_code) {
        const [city, coords] = await Promise.all([fetchCity(prof.zip_code), fetchZipCoords(prof.zip_code)])
        setCityName(city)
        userCoords = coords
      }

      // 4. Parallel batch
      const [catchRes, teamsRes, postsRes, sentRes, receivedRes] = await Promise.all([
        supabase.from('catch_requests').select('id', { count: 'exact', head: true }).eq('receiver_id', uid).eq('status', 'pending'),
        supabase.from('team_members').select('team_id, role, teams(id, name, logo_url, primary_color)').eq('user_id', uid).eq('status', 'active'),
        supabase.from('posts').select('id, user_id, content, tag, created_at').order('created_at', { ascending: false }).limit(3),
        supabase.from('follows').select('following_id').eq('follower_id', uid).eq('status', 'accepted'),
        supabase.from('follows').select('follower_id').eq('following_id', uid).eq('status', 'accepted'),
      ])

      // Catch requests
      setPendingCatchRequests(catchRes.count ?? 0)

      // Partner count
      const partnerIds = new Set([
        ...((sentRes.data ?? []) as { following_id: string }[]).map(f => f.following_id),
        ...((receivedRes.data ?? []) as { follower_id: string }[]).map(f => f.follower_id),
      ])
      const totalPartners = partnerIds.size
      setPartnerCount(totalPartners)

      // 5. Teams → next events + pending join requests
      type RawTeamMember = { team_id: string; role: string; teams: { id: string; name: string; logo_url: string | null; primary_color: string | null } }
      const rawTeams = ((teamsRes.data ?? []) as unknown as RawTeamMember[]).filter(m => m.teams != null)

      const today = new Date().toISOString().split('T')[0]
      const teamsWithEvents: TeamWithEvent[] = await Promise.all(
        rawTeams.map(async m => {
          const { data: ev } = await supabase
            .from('schedule_events')
            .select('title, event_date')
            .eq('team_id', m.teams.id)
            .gte('event_date', today)
            .order('event_date', { ascending: true })
            .limit(1)
            .maybeSingle()
          return {
            teamId: m.teams.id,
            teamName: m.teams.name,
            logoUrl: m.teams.logo_url,
            myRole: m.role,
            nextEvent: ev as { title: string; event_date: string } | null,
            primaryColor: m.teams.primary_color ?? '#c4822a',
          }
        })
      )
      setMyTeams(teamsWithEvents)
      setTeamsLoading(false)

      // Pending join requests (admin teams only)
      const adminTeamIds = rawTeams.filter(m => m.role === 'admin').map(m => m.teams.id)
      if (adminTeamIds.length > 0) {
        const joinResults = await Promise.all(
          adminTeamIds.map(async teamId => {
            const { count } = await supabase
              .from('team_members')
              .select('id', { count: 'exact', head: true })
              .eq('team_id', teamId)
              .eq('status', 'pending')
            return { teamId, count: count ?? 0 }
          })
        )
        const joins: PendingJoin[] = joinResults
          .filter(r => r.count > 0)
          .map(r => ({
            teamId: r.teamId,
            teamName: rawTeams.find(m => m.teams.id === r.teamId)?.teams.name ?? '',
            count: r.count,
          }))
        setPendingJoins(joins)
      }

      // 6. Recent posts — fetch author profiles + like/comment counts
      const rawPosts = (postsRes.data ?? []) as { id: string; user_id: string; content: string; tag: string | null; created_at: string }[]
      if (rawPosts.length > 0) {
        const postIds = rawPosts.map(p => p.id)
        const authorIds = [...new Set(rawPosts.map(p => p.user_id))]
        const [authorData, likesData, commentsData] = await Promise.all([
          supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', authorIds),
          supabase.from('post_likes').select('post_id').in('post_id', postIds),
          supabase.from('post_comments').select('post_id').in('post_id', postIds),
        ])
        const am: Record<string, { first_name: string | null; last_name: string | null; avatar_url: string | null }> = {}
        for (const a of (authorData.data ?? [])) am[a.id] = a
        const likeCounts: Record<string, number> = {}
        for (const l of ((likesData.data ?? []) as { post_id: string }[])) likeCounts[l.post_id] = (likeCounts[l.post_id] ?? 0) + 1
        const commentCounts: Record<string, number> = {}
        for (const c of ((commentsData.data ?? []) as { post_id: string }[])) commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1
        setRecentPosts(rawPosts.map(p => ({
          id: p.id,
          content: p.content,
          tag: p.tag,
          created_at: p.created_at,
          authorName: [am[p.user_id]?.first_name, am[p.user_id]?.last_name].filter(Boolean).join(' ') || 'Player',
          authorAvatar: am[p.user_id]?.avatar_url ?? null,
          like_count: likeCounts[p.id] ?? 0,
          comment_count: commentCounts[p.id] ?? 0,
        })))
      }

      // 7. Discover (only if < 3 partners)
      if (totalPartners < 3) {
        const [playersRes, coachesRes] = await Promise.all([
          supabase.from('profiles').select('id, first_name, last_name, avatar_url, zip_code, positions, coaching_specialties, role').in('role', ['player', 'both']).neq('id', uid).limit(10),
          supabase.from('profiles').select('id, first_name, last_name, avatar_url, zip_code, positions, coaching_specialties, role').in('role', ['coach', 'both']).neq('id', uid).limit(10),
        ])

        async function withDist(profiles: UserProfile[]): Promise<DiscoverProfile[]> {
          return Promise.all(profiles.map(async p => {
            let distanceMi: number | null = null
            if (userCoords && p.zip_code) {
              const pc = await fetchZipCoords(p.zip_code)
              if (pc) distanceMi = getDistance(userCoords.lat, userCoords.lon, pc.lat, pc.lon)
            }
            return { id: p.id, first_name: p.first_name, last_name: p.last_name, avatar_url: p.avatar_url, zip_code: p.zip_code, positions: p.positions, coaching_specialties: p.coaching_specialties, distanceMi }
          }))
        }

        const [players, coaches] = await Promise.all([
          withDist((playersRes.data ?? []) as UserProfile[]),
          withDist((coachesRes.data ?? []) as UserProfile[]),
        ])
        setNearbyPlayers(players.sort((a, b) => (a.distanceMi ?? 9999) - (b.distanceMi ?? 9999)).slice(0, 3))
        setNearbyCoaches(coaches.sort((a, b) => (a.distanceMi ?? 9999) - (b.distanceMi ?? 9999)).slice(0, 3))
      }
    }

    load()
  }, [userId, router])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (sessionLoading || !profile) {
    return (
      <AuthenticatedLayout>
        <div style={{ minHeight: '100vh', background: '#0d1f3c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
        </div>
      </AuthenticatedLayout>
    )
  }

  const actionItems: React.ReactNode[] = []
  if (pendingCatchRequests > 0) {
    actionItems.push(
      <div key="catch" style={actionCardStyle}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '14px', color: '#c4822a' }}>
          {pendingCatchRequests} Catch Request{pendingCatchRequests !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => { const btn = document.querySelector('button[aria-label="Open messages"]') as HTMLButtonElement | null; btn?.click() }}
          style={viewBtnStyle}
        >
          View →
        </button>
      </div>
    )
  }
  for (const jr of pendingJoins) {
    actionItems.push(
      <Link key={jr.teamId} href={`/teams/${jr.teamId}?tab=roster`} style={{ ...actionCardStyle, textDecoration: 'none' }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '14px', color: '#c4822a' }}>
          {jr.count} Join Request{jr.count !== 1 ? 's' : ''} · {jr.teamName}
        </span>
        <span style={viewBtnStyle}>View →</span>
      </Link>
    )
  }

  const showDiscover = partnerCount !== null && partnerCount < 3 && (nearbyPlayers.length > 0 || nearbyCoaches.length > 0)

  return (
    <AuthenticatedLayout>
      <div style={{ minHeight: '100vh', background: '#0d1f3c', color: '#f5edd6', fontFamily: "'Barlow', sans-serif" }}>
        <Nav />
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px 80px' }}>

          {/* ── Greeting ── */}
          <div style={{ marginBottom: '36px' }}>
            <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(245,237,214,0.4)', marginBottom: '6px' }}>
              Welcome Back,
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(44px, 8vw, 64px)', letterSpacing: '0.03em', margin: 0, lineHeight: 1, color: '#f5edd6' }}>
                {profile.first_name ?? 'Ballplayer'}
              </h1>
              <RoleBadge role={profile.role} />
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              {cityName && (
                <span style={{ fontSize: '13px', color: 'rgba(245,237,214,0.45)' }}>📍 {cityName}</span>
              )}
              {lastVisit && (
                <span style={{ fontSize: '13px', color: 'rgba(245,237,214,0.3)' }}>Last visit: {formatLastVisit(lastVisit)}</span>
              )}
            </div>
          </div>

          {/* ── Needs Attention ── */}
          {actionItems.length > 0 && (
            <div style={{ marginBottom: '36px' }}>
              <SectionHeader label="Needs Attention" />
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {actionItems}
              </div>
            </div>
          )}

          {/* ── My Teams ── */}
          <div style={{ marginBottom: '36px' }}>
            <SectionHeader label="My Teams" linkHref="/teams" linkLabel="Browse All →" />
            {teamsLoading ? (
              <div style={{ fontSize: '13px', color: 'rgba(245,237,214,0.3)' }}>Loading…</div>
            ) : myTeams.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,237,214,0.1)', borderRadius: '16px', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '14px', color: 'rgba(245,237,214,0.4)' }}>You&apos;re not on a team yet.</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Link href="/teams" style={outlineBtnStyle}>Browse Teams</Link>
                  <Link href="/teams/create" style={solidBtnStyle}>Create a Team</Link>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                {myTeams.map(team => (
                  <div key={team.teamId} style={{ minWidth: '280px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,237,214,0.1)', borderLeft: `3px solid ${team.primaryColor}`, borderRadius: '16px', padding: '20px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <TeamLogo name={team.teamName} logoUrl={team.logoUrl} size={48} color={team.primaryColor} />
                      <div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '16px', color: '#f5edd6' }}>{team.teamName}</div>
                        <span style={{ fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '99px', background: `${team.primaryColor}26`, color: team.primaryColor, border: `1px solid ${team.primaryColor}44` }}>
                          {team.myRole}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(245,237,214,0.38)', flex: 1 }}>
                      {team.nextEvent
                        ? `📅 Next: ${team.nextEvent.title} · ${formatEventDate(team.nextEvent.event_date)}`
                        : 'No upcoming events'}
                    </div>
                    <Link href={`/teams/${team.teamId}`} style={{ fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: team.primaryColor, textDecoration: 'none' }}>
                      View Team →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── The Dugout ── */}
          <div style={{ marginBottom: '36px' }}>
            <SectionHeader label="The Dugout" linkHref="/feed" linkLabel="View All →" />
            {recentPosts.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,237,214,0.1)', borderRadius: '16px', padding: '32px 24px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'rgba(245,237,214,0.4)' }}>No posts yet — be the first to post!</p>
                <Link href="/feed" style={solidBtnStyle}>Go to The Dugout</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentPosts.map(post => {
                  const tagInfo = post.tag ? TAG_MAP[post.tag] : null
                  const firstWord = post.authorName.split(' ')[0]
                  const secondWord = post.authorName.split(' ')[1] ?? null
                  return (
                    <Link key={post.id} href="/feed" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,237,214,0.08)', borderRadius: '12px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start', textDecoration: 'none', transition: 'border-color 0.12s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(245,237,214,0.15)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(245,237,214,0.08)' }}
                    >
                      <Avatar url={post.authorAvatar} first={firstWord} last={secondWord} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px', color: '#f5edd6' }}>{post.authorName}</span>
                          {tagInfo && (
                            <span style={{ fontSize: '10px', background: 'rgba(196,130,42,0.15)', border: '1px solid rgba(196,130,42,0.3)', color: '#c4822a', borderRadius: '99px', padding: '2px 8px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.04em' }}>
                              {tagInfo.emoji} {tagInfo.label}
                            </span>
                          )}
                          <span style={{ fontSize: '11px', color: 'rgba(245,237,214,0.3)', marginLeft: 'auto', fontFamily: "'Barlow', sans-serif", flexShrink: 0 }}>{formatTimeAgo(post.created_at)}</span>
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'rgba(245,237,214,0.6)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                          {post.content}
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <span style={{ fontSize: '11px', color: 'rgba(245,237,214,0.25)', fontFamily: "'Barlow', sans-serif" }}>
                            ♥ {post.like_count}
                          </span>
                          <span style={{ fontSize: '11px', color: 'rgba(245,237,214,0.25)', fontFamily: "'Barlow', sans-serif" }}>
                            💬 {post.comment_count}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Quick Actions ── */}
          <div style={{ marginBottom: '36px' }}>
            <SectionHeader label="Quick Actions" />
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { emoji: '🤝', label: 'Find a Catch Partner', href: '/players?role=player' },
                { emoji: '👥', label: 'Browse Community', href: '/players' },
                { emoji: '⚾', label: 'Find a Team', href: '/teams' },
                { emoji: '📢', label: 'Post to Dugout', href: '/feed' },
              ].map(action => (
                <Link
                  key={action.href}
                  href={action.href}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,237,214,0.1)', borderRadius: '16px', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none', textAlign: 'center', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(196,130,42,0.4)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(245,237,214,0.1)' }}
                >
                  <span style={{ fontSize: '32px', lineHeight: 1 }}>{action.emoji}</span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(245,237,214,0.65)' }}>
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* ── Discover ── */}
          {showDiscover && (
            <div>
              <SectionHeader label="Discover" linkHref="/players" linkLabel="See All →" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>

                {nearbyPlayers.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,237,214,0.3)', marginBottom: '10px' }}>
                      Players Near You
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {nearbyPlayers.map(p => (
                        <div key={p.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,237,214,0.08)', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar url={p.avatar_url} first={p.first_name} last={p.last_name} size={36} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px', color: '#f5edd6', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                              {[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Player'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'rgba(245,237,214,0.35)', marginTop: '1px' }}>
                              {[p.positions?.slice(0, 2).join(', '), p.distanceMi !== null ? `${p.distanceMi.toFixed(1)} mi` : null].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <Link href="/players" style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#c4822a', textDecoration: 'none', flexShrink: 0 }}>
                            Partner Up
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {nearbyCoaches.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,237,214,0.3)', marginBottom: '10px' }}>
                      Coaches Near You
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {nearbyCoaches.map(p => (
                        <div key={p.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,237,214,0.08)', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar url={p.avatar_url} first={p.first_name} last={p.last_name} size={36} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px', color: '#f5edd6', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                              {[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Coach'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'rgba(245,237,214,0.35)', marginTop: '1px' }}>
                              {[p.coaching_specialties?.slice(0, 2).join(', '), p.distanceMi !== null ? `${p.distanceMi.toFixed(1)} mi` : null].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <Link href="/players" style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#c4822a', textDecoration: 'none', flexShrink: 0 }}>
                            Connect
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </main>
      </div>
    </AuthenticatedLayout>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const actionCardStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: 'rgba(196,130,42,0.1)', border: '1px solid rgba(196,130,42,0.4)',
  borderRadius: '12px', padding: '16px 20px', gap: '16px',
  flex: '1 1 auto', minWidth: '220px',
}

const viewBtnStyle: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
  fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#c4822a', background: 'transparent',
  border: '1px solid rgba(196,130,42,0.5)', borderRadius: '7px',
  padding: '5px 12px', cursor: 'pointer', flexShrink: 0,
}

const outlineBtnStyle: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
  fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#c4822a', background: 'transparent',
  border: '1px solid rgba(196,130,42,0.5)', borderRadius: '8px',
  padding: '8px 20px', textDecoration: 'none', display: 'inline-block',
}

const solidBtnStyle: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
  fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#0d1f3c', background: '#c4822a',
  border: 'none', borderRadius: '8px',
  padding: '8px 20px', textDecoration: 'none', display: 'inline-block',
}
