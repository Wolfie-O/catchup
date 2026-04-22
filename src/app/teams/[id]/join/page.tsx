'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function TeamLogo({ name, logoUrl, size = 80 }: { name: string; logoUrl: string | null; size?: number }) {
  function getInitials(n: string) {
    return n.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
  }
  if (logoUrl) {
    return <img src={logoUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#c4822a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: size * 0.36, color: '#0d1f3c', letterSpacing: '0.04em',
    }}>
      {getInitials(name)}
    </div>
  )
}

type Team = { id: string; name: string; level: string | null; zip_code: string | null; bio: string | null; logo_url: string | null }

export default function JoinTeamPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const teamId = params.id as string
  const token = searchParams.get('token')

  const [userId, setUserId] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  const [team, setTeam] = useState<Team | null>(null)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null) // null = checking
  const [alreadyMember, setAlreadyMember] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push(`/auth?tab=login&redirect=/teams/${teamId}/join${token ? `?token=${token}` : ''}`)
        return
      }
      setUserId(session.user.id)
      setSessionLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/auth?tab=login')
    })
    return () => subscription.unsubscribe()
  }, [router, teamId, token])

  // Validate token and load team
  useEffect(() => {
    if (!userId || !token) return

    async function validate() {
      // Check token
      const { data: invite, error: inviteErr } = await supabase
        .from('team_invites')
        .select('team_id')
        .eq('token', token)
        .eq('team_id', teamId)
        .single()

      if (inviteErr || !invite) {
        setTokenValid(false)
        return
      }

      setTokenValid(true)

      // Load team info
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, name, level, zip_code, bio, logo_url')
        .eq('id', teamId)
        .single()

      if (teamData) setTeam(teamData)

      // Check if already a member
      const { data: existing } = await supabase
        .from('team_members')
        .select('id, status')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .single()

      if (existing) setAlreadyMember(true)
    }

    validate()
  }, [userId, token, teamId])

  async function handleAccept() {
    if (!userId || !team) return
    setJoining(true)
    setError(null)

    // Upsert member record with active status
    const { error: insertErr } = await supabase
      .from('team_members')
      .upsert(
        { team_id: team.id, user_id: userId, role: 'player', status: 'active' },
        { onConflict: 'team_id,user_id' }
      )

    if (insertErr) {
      setError('Something went wrong. Please try again.')
      setJoining(false)
      return
    }

    setJoined(true)
    setTimeout(() => router.push(`/teams/${team.id}`), 1800)
  }

  // --- Loading states ---
  if (sessionLoading || tokenValid === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1f3c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1f3c', color: '#f5edd6', fontFamily: "'Barlow', sans-serif" }}>
      {/* Minimal nav */}
      <nav style={{ height: '64px', borderBottom: '2px solid #c4822a', display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <Link href="/teams" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '0.05em', color: '#f5edd6' }}>
            Catch<span style={{ color: '#c4822a' }}>Up</span>
          </span>
        </Link>
      </nav>

      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '60px 16px 80px', textAlign: 'center' }}>

        {/* Invalid token */}
        {!tokenValid && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '36px', letterSpacing: '0.05em', margin: '0 0 12px', color: '#f5edd6' }}>
              Invalid Invite Link
            </h1>
            <p style={{ fontSize: '15px', color: 'rgba(245,237,214,0.55)', margin: '0 0 32px', lineHeight: 1.6 }}>
              This invite link is invalid or has expired. Ask a team admin for a new link.
            </p>
            <Link href="/teams" style={{
              display: 'inline-block', padding: '11px 28px', borderRadius: '8px',
              background: '#c4822a', color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '14px',
              textDecoration: 'none',
            }}>
              Browse Teams
            </Link>
          </>
        )}

        {/* Valid token, team loaded */}
        {tokenValid && team && (
          <>
            {/* Team logo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <TeamLogo name={team.name} logoUrl={team.logo_url} size={96} />
            </div>

            {joined ? (
              <>
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '38px', letterSpacing: '0.05em', margin: '0 0 10px' }}>
                  You&apos;re <span style={{ color: '#c4822a' }}>In!</span>
                </h1>
                <p style={{ fontSize: '15px', color: 'rgba(245,237,214,0.6)', margin: 0 }}>
                  Taking you to the team page…
                </p>
              </>
            ) : alreadyMember ? (
              <>
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '36px', letterSpacing: '0.05em', margin: '0 0 10px' }}>
                  Already a <span style={{ color: '#c4822a' }}>Member</span>
                </h1>
                <p style={{ fontSize: '15px', color: 'rgba(245,237,214,0.55)', margin: '0 0 28px' }}>
                  You&apos;re already on {team.name}.
                </p>
                <Link href={`/teams/${team.id}`} style={{
                  display: 'inline-block', padding: '11px 28px', borderRadius: '8px',
                  background: '#c4822a', color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '14px',
                  textDecoration: 'none',
                }}>
                  Go to Team Page
                </Link>
              </>
            ) : (
              <>
                <p style={{ fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,237,214,0.45)', margin: '0 0 6px' }}>
                  You&apos;ve been invited to join
                </p>
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '42px', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                  {team.name}
                </h1>

                {(team.level || team.zip_code) && (
                  <p style={{ fontSize: '14px', color: 'rgba(245,237,214,0.45)', margin: '0 0 16px' }}>
                    {[team.level, team.zip_code].filter(Boolean).join(' · ')}
                  </p>
                )}

                {team.bio && (
                  <p style={{
                    fontSize: '15px', color: 'rgba(245,237,214,0.65)', margin: '0 0 32px',
                    lineHeight: 1.6, background: 'rgba(255,255,255,0.04)',
                    borderRadius: '10px', padding: '14px 18px', textAlign: 'left',
                  }}>
                    {team.bio}
                  </p>
                )}

                {!team.bio && <div style={{ marginBottom: '32px' }} />}

                {error && (
                  <p style={{ color: '#fc8181', fontSize: '14px', margin: '0 0 16px' }}>{error}</p>
                )}

                <button
                  onClick={handleAccept}
                  disabled={joining}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '9px', border: 'none',
                    background: joining ? 'rgba(196,130,42,0.4)' : '#c4822a',
                    color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    fontSize: '16px', cursor: joining ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {joining ? 'Joining…' : 'Accept Invitation'}
                </button>

                <Link href="/teams" style={{
                  display: 'block', marginTop: '14px', fontSize: '13px',
                  color: 'rgba(245,237,214,0.35)', textDecoration: 'none',
                }}>
                  No thanks, browse teams instead
                </Link>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
