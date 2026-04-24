'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
}

type Team = { id: string; name: string; level: string | null; zip_code: string | null; bio: string | null; logo_url: string | null }

function JoinPageInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const teamId = params?.id as string
  const token = searchParams?.get('token') ?? null

  const [userId, setUserId] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  const [team, setTeam] = useState<Team | null>(null)
  const [teamLoading, setTeamLoading] = useState(true)
  const [memberCount, setMemberCount] = useState(0)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [alreadyMember, setAlreadyMember] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  // Auth check — background only, does not block invite fetch
  useEffect(() => {
    anonClient.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null)
      setSessionLoading(false)
    })
    const { data: { subscription } } = anonClient.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Token + team validation — no auth required, runs immediately
  useEffect(() => {
    if (!token) {
      setTokenValid(false)
      setTeamLoading(false)
      return
    }

    async function validate() {
      try {
        // Step 1: look up invite by token only
        const { data: invite, error: inviteErr } = await anonClient
          .from('team_invites')
          .select('id, token, team_id, status')
          .eq('token', token)
          .maybeSingle()

        if (inviteErr) {
          setQueryError(`Could not verify invite: ${inviteErr.message}`)
          setTokenValid(false)
          setTeamLoading(false)
          return
        }

        if (!invite) {
          setTokenValid(false)
          setTeamLoading(false)
          return
        }

        setTokenValid(true)

        // Step 2: fetch team info separately (avoids join RLS issues)
        const { data: teamData, error: teamErr } = await anonClient
          .from('teams')
          .select('id, name, logo_url, level, zip_code, bio')
          .eq('id', invite.team_id)
          .maybeSingle()

        if (teamErr) {
          setQueryError(`Could not load team: ${teamErr.message}`)
        } else if (teamData) {
          setTeam(teamData as Team)
        }

        // Step 3: fetch active member count
        const { count } = await anonClient
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', invite.team_id)
          .eq('status', 'active')

        setMemberCount(count ?? 0)
        setTeamLoading(false)

      } catch (err) {
        setQueryError(`Unexpected error: ${String(err)}`)
        setTokenValid(false)
        setTeamLoading(false)
      }
    }

    validate()
  }, [token, teamId])

  // Membership check — only once logged in and token is confirmed valid
  useEffect(() => {
    if (sessionLoading || !userId || !teamId || !tokenValid) return

    anonClient
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => { if (data) setAlreadyMember(true) })
  }, [sessionLoading, userId, teamId, tokenValid])

  async function handleAccept() {
    if (!userId || !team) return
    setJoining(true)
    setAcceptError(null)

    const { error: insertErr } = await anonClient
      .from('team_members')
      .upsert(
        { team_id: team.id, user_id: userId, role: 'player', status: 'active' },
        { onConflict: 'team_id,user_id' }
      )

    if (insertErr) {
      setAcceptError('Something went wrong. Please try again.')
      setJoining(false)
      return
    }

    await anonClient.from('team_invites').update({ status: 'accepted' }).eq('token', token!)

    setJoined(true)
    setTimeout(() => router.push(`/teams/${team.id}`), 1800)
  }

  const joinUrl = `/teams/${teamId}/join?token=${token ?? ''}`
  const setupUrl = `/profile/setup?redirect=${encodeURIComponent(joinUrl)}`
  const signupUrl = `/auth?tab=signup&redirect=${encodeURIComponent(setupUrl)}`
  const redirectParam = encodeURIComponent(joinUrl)

  const authBtnBase: React.CSSProperties = {
    display: 'block', width: '100%', padding: '13px', borderRadius: '9px',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '15px',
    textDecoration: 'none', textAlign: 'center', cursor: 'pointer',
    transition: 'background 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1f3c', color: '#f5edd6', fontFamily: "'Barlow', sans-serif" }}>
      <nav style={{ height: '64px', borderBottom: '2px solid #c4822a', display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <Link href="/teams" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '0.05em', color: '#f5edd6' }}>
            Catch<span style={{ color: '#c4822a' }}>Up</span>
          </span>
        </Link>
      </nav>

      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '60px 16px 80px', textAlign: 'center' }}>

        {/* Query error */}
        {queryError && (
          <div style={{ color: 'red', padding: '2rem', textAlign: 'left', wordBreak: 'break-all', background: 'rgba(255,0,0,0.1)', borderRadius: 8, marginBottom: 24 }}>
            <strong>Error:</strong><br />{queryError}
          </div>
        )}

        {/* Still checking */}
        {tokenValid === null && <Spinner />}

        {/* Invalid token */}
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

        {/* Valid token */}
        {tokenValid === true && (
          <>
            {teamLoading && <Spinner />}

            {!teamLoading && team && (
              <>
                {/* Team header */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                  <TeamLogo name={team.name} logoUrl={team.logo_url} size={96} />
                </div>
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

                {/* Not logged in */}
                {!userId && !sessionLoading && (
                  <>
                    <p style={{ fontSize: '16px', color: 'rgba(245,237,214,0.75)', margin: '0 0 28px', lineHeight: 1.6 }}>
                      You&apos;ve been invited to join <strong style={{ color: '#f5edd6' }}>{team.name}</strong> on CatchUp.
                      Create an account or log in to accept.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <Link href={signupUrl} style={{ ...authBtnBase, background: '#c4822a', color: '#0d1f3c' }}>
                        Sign Up &amp; Join
                      </Link>
                      <Link href={`/auth?tab=login&redirect=${redirectParam}`} style={{ ...authBtnBase, background: 'transparent', color: '#c4822a', border: '1px solid rgba(196,130,42,0.5)' }}>
                        Log In &amp; Join
                      </Link>
                    </div>
                  </>
                )}

                {/* Auth resolving */}
                {sessionLoading && (
                  <p style={{ fontSize: '13px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif" }}>
                    Checking your account…
                  </p>
                )}

                {/* Logged in — success */}
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

                {/* Logged in — already a member */}
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

                {/* Logged in — accept */}
                {userId && !joined && !alreadyMember && !sessionLoading && (
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
              </>
            )}

            {/* Team fetch failed */}
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
