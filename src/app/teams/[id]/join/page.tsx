'use client'

import React, { Suspense, useEffect, useState } from 'react'
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
      fontFamily: "'Bebas Neue', sans-serif", fontSize: Math.round(size * 0.36), color: '#0d1f3c', letterSpacing: '0.04em',
    }}>
      {getInitials(name)}
    </div>
  )
}

type Team = { id: string; name: string; level: string | null; zip_code: string | null; bio: string | null; logo_url: string | null }

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
}

function JoinPageInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const teamId = params.id as string
  const token = searchParams.get('token')

  const [userId, setUserId] = useState<string | null>(null)
  // sessionLoading only gates the membership check, NOT the token/team fetch
  const [sessionLoading, setSessionLoading] = useState(true)

  const [team, setTeam] = useState<Team | null>(null)
  const [teamLoading, setTeamLoading] = useState(true)
  const [memberCount, setMemberCount] = useState(0)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null) // null = still checking
  const [queryError, setQueryError] = useState<string | null>(null)
  const [alreadyMember, setAlreadyMember] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  // ── Auth check — runs in background, does NOT block token validation ──
  useEffect(() => {
    console.log('[JoinPage] auth check starting')
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[JoinPage] session result:', session ? `logged in as ${session.user.id}` : 'not logged in')
      setUserId(session?.user.id ?? null)
      setSessionLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      console.log('[JoinPage] auth state changed:', session ? `logged in as ${session.user.id}` : 'not logged in')
      setUserId(session?.user.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Token + team validation — runs immediately, does NOT wait for auth ──
  useEffect(() => {
    console.log('[JoinPage] validate effect running. token:', token, 'teamId:', teamId)

    if (!token) {
      console.log('[JoinPage] no token in URL — marking invalid')
      setTokenValid(false)
      setTeamLoading(false)
      return
    }

    async function validate() {
      console.log('[JoinPage] querying team_invites for token:', token, 'and teamId:', teamId)

      const { data: invite, error: inviteErr } = await supabase
        .from('team_invites')
        .select('team_id')
        .eq('token', token)
        .eq('team_id', teamId)
        .maybeSingle()  // returns null (not error) when no row found

      console.log('[JoinPage] invite query result — data:', invite, 'error:', inviteErr)

      if (inviteErr) {
        console.error('[JoinPage] invite query error:', inviteErr.message, inviteErr.details)
        setQueryError(`Could not verify invite: ${inviteErr.message}`)
        setTokenValid(false)
        setTeamLoading(false)
        return
      }

      if (!invite) {
        console.log('[JoinPage] no matching invite row found — token invalid or wrong team')
        setTokenValid(false)
        setTeamLoading(false)
        return
      }

      console.log('[JoinPage] token is valid — fetching team info')
      setTokenValid(true)

      const [teamRes, countRes] = await Promise.all([
        supabase.from('teams').select('id, name, level, zip_code, bio, logo_url').eq('id', teamId).maybeSingle(),
        supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'active'),
      ])

      console.log('[JoinPage] team query — data:', teamRes.data, 'error:', teamRes.error)
      console.log('[JoinPage] member count —', countRes.count, 'error:', countRes.error)

      if (teamRes.error) {
        console.error('[JoinPage] team fetch error:', teamRes.error.message)
        setQueryError(`Could not load team: ${teamRes.error.message}`)
      } else if (teamRes.data) {
        setTeam(teamRes.data as Team)
      }

      setMemberCount(countRes.count ?? 0)
      setTeamLoading(false)
    }

    validate()
  }, [token, teamId]) // intentionally NOT depending on sessionLoading or userId

  // ── Membership check — runs once we know the user is logged in ──
  useEffect(() => {
    if (sessionLoading || !userId || !teamId || !tokenValid) return
    console.log('[JoinPage] checking existing membership for user:', userId)

    supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        console.log('[JoinPage] membership check — data:', data, 'error:', error)
        if (data) setAlreadyMember(true)
      })
  }, [sessionLoading, userId, teamId, tokenValid])

  async function handleAccept() {
    if (!userId || !team) return
    setJoining(true)
    setAcceptError(null)
    console.log('[JoinPage] accepting invite — userId:', userId, 'teamId:', team.id)

    const { error: insertErr } = await supabase
      .from('team_members')
      .upsert(
        { team_id: team.id, user_id: userId, role: 'player', status: 'active' },
        { onConflict: 'team_id,user_id' }
      )

    console.log('[JoinPage] upsert result — error:', insertErr)

    if (insertErr) {
      setAcceptError('Something went wrong. Please try again.')
      setJoining(false)
      return
    }

    await supabase.from('team_invites').update({ status: 'accepted' }).eq('token', token!)
    console.log('[JoinPage] invite marked accepted — redirecting')

    setJoined(true)
    setTimeout(() => router.push(`/teams/${team.id}`), 1800)
  }

  const redirectParam = encodeURIComponent(`/teams/${teamId}/join?token=${token ?? ''}`)

  const authBtnBase: React.CSSProperties = {
    display: 'block', width: '100%', padding: '13px', borderRadius: '9px',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '15px',
    textDecoration: 'none', textAlign: 'center', cursor: 'pointer',
    transition: 'background 0.15s',
  }

  // ── Render ──
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

        {/* ── Still checking token ── */}
        {tokenValid === null && <Spinner />}

        {/* ── DB / query error ── */}
        {queryError && (
          <div style={{ background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.35)', borderRadius: '10px', padding: '18px', marginBottom: '24px' }}>
            <p style={{ color: '#fc8181', fontSize: '14px', margin: 0, fontFamily: "'Barlow', sans-serif", lineHeight: 1.6 }}>
              {queryError}
            </p>
          </div>
        )}

        {/* ── Invalid / missing token ── */}
        {tokenValid === false && !queryError && (
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

        {/* ── Valid token ── */}
        {tokenValid === true && (
          <>
            {/* Team still loading */}
            {teamLoading && <Spinner />}

            {/* Team loaded */}
            {!teamLoading && team && (
              <>
                {/* Team logo */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                  <TeamLogo name={team.name} logoUrl={team.logo_url} size={96} />
                </div>

                {/* Team name + meta */}
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '42px', letterSpacing: '0.05em', margin: '0 0 6px', lineHeight: 1 }}>
                  {team.name}
                </h1>
                {(team.level || memberCount > 0) && (
                  <p style={{ fontSize: '14px', color: 'rgba(245,237,214,0.45)', margin: '0 0 16px' }}>
                    {[team.level, `${memberCount} member${memberCount !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                  </p>
                )}
                {team.bio && (
                  <p style={{
                    fontSize: '14px', color: 'rgba(245,237,214,0.65)', margin: '0 0 28px',
                    lineHeight: 1.6, background: 'rgba(255,255,255,0.04)',
                    borderRadius: '10px', padding: '12px 16px', textAlign: 'left',
                  }}>
                    {team.bio}
                  </p>
                )}
                {!team.bio && <div style={{ marginBottom: '24px' }} />}

                {/* ── NOT LOGGED IN ── */}
                {!userId && (
                  <>
                    <p style={{ fontSize: '16px', color: 'rgba(245,237,214,0.75)', margin: '0 0 28px', lineHeight: 1.6 }}>
                      You&apos;ve been invited to join <strong style={{ color: '#f5edd6' }}>{team.name}</strong> on CatchUp.
                      Create an account or log in to accept.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <Link
                        href={`/auth?tab=signup&redirect=${redirectParam}`}
                        style={{ ...authBtnBase, background: '#c4822a', color: '#0d1f3c' }}
                      >
                        Sign Up &amp; Join
                      </Link>
                      <Link
                        href={`/auth?tab=login&redirect=${redirectParam}`}
                        style={{ ...authBtnBase, background: 'transparent', color: '#c4822a', border: '1px solid rgba(196,130,42,0.5)' }}
                      >
                        Log In &amp; Join
                      </Link>
                    </div>
                  </>
                )}

                {/* ── LOGGED IN — joined ── */}
                {userId && joined && (
                  <>
                    <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '38px', letterSpacing: '0.05em', margin: '0 0 10px' }}>
                      You&apos;re <span style={{ color: '#c4822a' }}>In!</span>
                    </h2>
                    <p style={{ fontSize: '15px', color: 'rgba(245,237,214,0.6)', margin: 0 }}>
                      Taking you to the team page…
                    </p>
                  </>
                )}

                {/* ── LOGGED IN — already a member ── */}
                {userId && !joined && alreadyMember && (
                  <>
                    <p style={{ fontSize: '15px', color: 'rgba(245,237,214,0.55)', margin: '0 0 24px' }}>
                      You&apos;re already a member of {team.name}.
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
                )}

                {/* ── LOGGED IN — accept invitation ── */}
                {userId && !joined && !alreadyMember && (
                  <>
                    <p style={{ fontSize: '14px', color: 'rgba(245,237,214,0.5)', margin: '0 0 24px' }}>
                      You&apos;ve been invited to join as a player.
                    </p>
                    {acceptError && (
                      <p style={{ color: '#fc8181', fontSize: '14px', margin: '0 0 16px' }}>{acceptError}</p>
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

                {/* ── LOGGED IN — auth still loading ── */}
                {sessionLoading && (
                  <p style={{ fontSize: '13px', color: 'rgba(245,237,214,0.3)', margin: '16px 0 0', fontFamily: "'Barlow', sans-serif" }}>
                    Checking your account…
                  </p>
                )}
              </>
            )}

            {/* Team fetch failed but token was valid */}
            {!teamLoading && !team && !queryError && (
              <p style={{ color: 'rgba(245,237,214,0.5)', fontSize: '14px' }}>
                Could not load team details. Please try again.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default function JoinTeamPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0d1f3c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
      </div>
    }>
      <JoinPageInner />
    </Suspense>
  )
}
