'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const LEVELS = ['Pro / MiLB', 'College', 'High School', 'Rec League', 'Adult Amateur', 'Youth']

const INPUT: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: '8px', fontSize: '14px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(245,237,214,0.15)',
  color: '#f5edd6', outline: 'none', boxSizing: 'border-box',
  fontFamily: "'Barlow', sans-serif",
}

const SELECT: React.CSSProperties = {
  ...INPUT, cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(245,237,214,0.4)' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 13px center', paddingRight: '34px',
}

const LABEL: React.CSSProperties = {
  display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700,
  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'rgba(245,237,214,0.65)',
}

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(196,130,42,0.6)'
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(245,237,214,0.15)'
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}

export default function CreateTeamPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userId, setUserId]             = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  const [name, setName]           = useState('')
  const [level, setLevel]         = useState('')
  const [zip, setZip]             = useState('')
  const [joinType, setJoinType]   = useState<'request' | 'invite'>('request')
  const [bio, setBio]             = useState('')
  const [logoFile, setLogoFile]   = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !name.trim()) return
    setSaving(true)
    setError(null)

    let logo_url: string | null = null

    if (logoFile) {
      const ext = logoFile.name.split('.').pop()
      const path = `${userId}-${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('teams').upload(path, logoFile, { upsert: true })
      if (!uploadErr) {
        const { data } = supabase.storage.from('teams').getPublicUrl(path)
        logo_url = data.publicUrl
      }
    }

    const { data: team, error: insertErr } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        level: level || null,
        zip_code: zip || null,
        join_type: joinType,
        bio: bio.trim() || null,
        logo_url,
        created_by: userId,
      })
      .select('id')
      .single()

    if (insertErr || !team) {
      setError('Failed to create team. Please try again.')
      setSaving(false)
      return
    }

    await supabase.from('team_members').insert({
      team_id: team.id, user_id: userId, role: 'admin', status: 'active',
    })

    router.push(`/teams/${team.id}`)
  }

  if (sessionLoading) {
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

      <main style={{ maxWidth: '520px', margin: '0 auto', padding: '40px 16px 80px' }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '42px', letterSpacing: '0.05em', margin: '0 0 6px' }}>
          Create Your <span style={{ color: '#c4822a' }}>Team</span>
        </h1>
        <p style={{ fontSize: '15px', color: 'rgba(245,237,214,0.5)', margin: '0 0 32px' }}>
          Set up your team profile and start building your roster.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Logo upload */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <button
              type="button" onClick={() => fileInputRef.current?.click()}
              style={{
                width: 100, height: 100, borderRadius: '50%', padding: 0, overflow: 'hidden',
                border: '2px dashed rgba(196,130,42,0.5)', background: 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#c4822a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: '#0d1f3c' }}>
                  {name ? getInitials(name) : '?'}
                </div>
              )}
            </button>
            <span style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", color: 'rgba(245,237,214,0.4)', letterSpacing: '0.06em' }}>
              Click to upload logo
            </span>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]; if (!f) return
                setLogoFile(f); setLogoPreview(URL.createObjectURL(f))
              }}
            />
          </div>

          {/* Team name */}
          <div>
            <label style={LABEL}>Team Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="East Side Ballers" required style={INPUT}
              onFocus={focusBorder} onBlur={blurBorder}
            />
          </div>

          {/* Level + Zip */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={LABEL}>Level</label>
              <select value={level} onChange={e => setLevel(e.target.value)}
                style={{ ...SELECT, width: '100%' }} onFocus={focusBorder} onBlur={blurBorder}
              >
                <option value="" style={{ background: '#0d1f3c' }}>Select…</option>
                {LEVELS.map(l => <option key={l} value={l} style={{ background: '#0d1f3c' }}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Zip Code</label>
              <input type="text" value={zip}
                onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                maxLength={5} placeholder="12345" style={INPUT}
                onFocus={focusBorder} onBlur={blurBorder}
              />
            </div>
          </div>

          {/* Join type */}
          <div>
            <label style={LABEL}>Who Can Join</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['request', 'invite'] as const).map(type => (
                <button
                  key={type} type="button" onClick={() => setJoinType(type)}
                  style={{
                    flex: 1, padding: '9px', borderRadius: '8px', cursor: 'pointer',
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    letterSpacing: '0.06em', fontSize: '13px', transition: 'all 0.15s',
                    border: joinType === type ? '1px solid #c4822a' : '1px solid rgba(245,237,214,0.2)',
                    background: joinType === type ? 'rgba(196,130,42,0.15)' : 'transparent',
                    color: joinType === type ? '#c4822a' : 'rgba(245,237,214,0.5)',
                  }}
                >
                  {type === 'request' ? 'Open to Requests' : 'Invite Only'}
                </button>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label style={LABEL}>About the Team</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)}
              placeholder="Tell players what your team is about, your schedule, what you're looking for..."
              rows={4}
              style={{ ...INPUT, resize: 'vertical', minHeight: '90px', lineHeight: '1.5' } as React.CSSProperties}
              onFocus={focusBorder} onBlur={blurBorder}
            />
          </div>

          {error && (
            <p style={{ margin: 0, color: '#fc8181', fontFamily: "'Barlow', sans-serif", fontSize: '14px' }}>
              {error}
            </p>
          )}

          <button
            type="submit" disabled={saving || !name.trim()}
            style={{
              padding: '13px', borderRadius: '9px', border: 'none',
              background: saving || !name.trim() ? 'rgba(196,130,42,0.4)' : '#c4822a',
              color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              fontSize: '15px', cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Creating…' : 'Create Team'}
          </button>
        </form>
      </main>
    </div>
  )
}
