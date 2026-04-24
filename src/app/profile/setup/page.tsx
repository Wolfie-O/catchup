'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

const LEVELS = [
  'Pro / MiLB',
  'College',
  'High School',
  'Rec League',
  'Never played organized ball',
]

// ── shared style tokens ──────────────────────────────────────────
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
  padding: '11px 14px',
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
  backgroundPosition: 'right 14px center',
  paddingRight: '36px',
}

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(196,130,42,0.6)'
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(245,237,214,0.15)'
}

export default function ProfileSetupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [zip, setZip] = useState('')
  const [positions, setPositions] = useState<string[]>([])
  const [level, setLevel] = useState('')
  const [status, setStatus] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    if (redirectTo) router.push(redirectTo)
  }, [redirectTo, router])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 480)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Resolve the session two ways so we cover every arrival path:
  // 1. getSession() handles sessions already in localStorage (refresh / direct nav)
  // 2. onAuthStateChange handles sessions being established from a URL hash
  //    after a redirect from sign-up (PKCE / implicit flow)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id)
        setSessionLoading(false)
      } else {
        router.push('/auth?tab=signup')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
      setSessionLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function togglePosition(pos: string) {
    setPositions(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!userId) {
        setError('You must be logged in to set up a profile.')
        setLoading(false)
        return
      }

      // Upload avatar if provided — failure is non-blocking
      let avatarUrl: string | null = null
      let photoWarning = ''
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const path = `${userId}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true })
        if (uploadErr) {
          console.error('Avatar upload failed:', uploadErr.message)
          photoWarning = 'Profile saved! Photo upload failed — you can add a photo later in your profile settings.'
        } else {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
          avatarUrl = urlData.publicUrl
        }
      }

      // Save profile
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: userId,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dob || null,
        zip_code: zip,
        positions,
        highest_level: level,
        status,
        bio,
        avatar_url: avatarUrl,
      })

      if (profileErr) {
        setError(profileErr.message)
        setLoading(false)
        return
      }

      if (photoWarning) {
        setError(photoWarning)
        setLoading(false)
        // Still redirect — just give the user a moment to read the message
        setTimeout(() => setRedirectTo(searchParams?.get('redirect') ?? '/players'), 2500)
        return
      }

      setRedirectTo(searchParams?.get('redirect') ?? '/players')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (sessionLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1f3c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: '3px solid rgba(196,130,42,0.2)',
          borderTopColor: '#c4822a',
          animation: 'spin 0.7s linear infinite',
        }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1f3c', color: '#f5edd6', fontFamily: "'Barlow', sans-serif" }}>

      {/* Nav */}
      <nav style={{ borderBottom: '2px solid #c4822a', height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f5edd6', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '0.05em', color: '#f5edd6' }}>
            Catch<span style={{ color: '#c4822a' }}>Up</span>
          </span>
        </a>
      </nav>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 16px 80px' }}>

        {/* Progress */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,237,214,0.45)' }}>
              Step 1 of 2 — Basic Info
            </span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', color: '#c4822a' }}>50%</span>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ width: '50%', height: '100%', background: '#c4822a', borderRadius: '99px' }} />
          </div>
        </div>

        {/* Page title */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '48px', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>
            Set Up Your <span style={{ color: '#c4822a' }}>Profile</span>
          </h1>
          <p style={{ marginTop: '8px', fontSize: '15px', color: 'rgba(245,237,214,0.55)' }}>
            Tell the community who you are
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '16px', padding: '32px 28px' }}>
          <form onSubmit={handleSubmit}>

            {/* ── Avatar ── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100px', height: '100px', borderRadius: '50%', border: '2px dashed rgba(196,130,42,0.5)',
                  background: avatarPreview ? 'transparent' : 'rgba(255,255,255,0.04)',
                  cursor: 'pointer', overflow: 'hidden', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#c4822a')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(196,130,42,0.5)')}
                aria-label="Upload profile photo"
              >
                {avatarPreview
                  ? <img src={avatarPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '28px' }}>📷</span>
                }
              </button>
              <span style={{ marginTop: '10px', fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.08em', color: 'rgba(245,237,214,0.4)' }}>
                {avatarPreview ? 'Click to change photo' : 'Click to upload photo'}
              </span>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </div>

            {/* ── Name row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={LABEL}>First Name</label>
                <input
                  type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="Joe" required style={INPUT}
                  onFocus={focusBorder} onBlur={blurBorder}
                />
              </div>
              <div>
                <label style={LABEL}>Last Name</label>
                <input
                  type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                  placeholder="Smith" required style={INPUT}
                  onFocus={focusBorder} onBlur={blurBorder}
                />
              </div>
            </div>

            {/* ── DOB & Zip row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={LABEL}>Date of Birth</label>
                <input
                  type="date" value={dob} onChange={e => setDob(e.target.value)}
                  style={{ ...INPUT, colorScheme: 'dark' }}
                  onFocus={focusBorder} onBlur={blurBorder}
                />
              </div>
              <div>
                <label style={LABEL}>Zip Code</label>
                <input
                  type="text" value={zip} onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="12345" maxLength={5} style={INPUT}
                  onFocus={focusBorder} onBlur={blurBorder}
                />
              </div>
            </div>

            {/* ── Positions ── */}
            <div style={{ marginBottom: '20px' }}>
              <label style={LABEL}>Position(s)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {POSITIONS.map(pos => {
                  const active = positions.includes(pos)
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => togglePosition(pos)}
                      style={{
                        padding: '6px 14px', borderRadius: '99px', fontSize: '13px', cursor: 'pointer',
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em',
                        border: active ? '1px solid #c4822a' : '1px solid rgba(245,237,214,0.2)',
                        background: active ? '#c4822a' : 'rgba(255,255,255,0.04)',
                        color: active ? '#0d1f3c' : 'rgba(245,237,214,0.65)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {pos}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Level & Status row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={LABEL}>Highest Level Played</label>
                <select value={level} onChange={e => setLevel(e.target.value)} style={SELECT} onFocus={focusBorder} onBlur={blurBorder}>
                  <option value="" disabled style={{ background: '#0d1f3c' }}>Select...</option>
                  {LEVELS.map(l => <option key={l} value={l} style={{ background: '#0d1f3c' }}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL}>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} style={SELECT} onFocus={focusBorder} onBlur={blurBorder}>
                  <option value="" disabled style={{ background: '#0d1f3c' }}>Select...</option>
                  <option value="Current" style={{ background: '#0d1f3c' }}>Current</option>
                  <option value="Washed Up" style={{ background: '#0d1f3c' }}>Washed Up</option>
                </select>
              </div>
            </div>

            {/* ── Bio ── */}
            <div style={{ marginBottom: '24px' }}>
              <label style={LABEL}>Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell the community about yourself, what you're looking for, where you played..."
                rows={4}
                style={{
                  ...INPUT,
                  resize: 'vertical',
                  minHeight: '100px',
                  lineHeight: '1.5',
                } as React.CSSProperties}
                onFocus={focusBorder}
                onBlur={blurBorder}
              />
            </div>

            {/* ── Error ── */}
            {error && (
              <div style={{
                marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', fontSize: '14px',
                background: 'rgba(212,69,26,0.15)', border: '1px solid rgba(212,69,26,0.4)', color: '#f97950',
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em',
              }}>
                {error}
              </div>
            )}

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: '8px', border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? 'rgba(196,130,42,0.5)' : '#c4822a',
                color: '#0d1f3c',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '15px',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Saving…' : 'Save & Continue →'}
            </button>

          </form>
        </div>

      </main>

    </div>
  )
}
