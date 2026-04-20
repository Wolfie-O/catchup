'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ConfirmResetPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // After success, redirect to /players after 2 seconds
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => router.push('/players'), 2000)
    return () => clearTimeout(t)
  }, [success, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1f3c', color: '#f5edd6', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{ borderBottom: '2px solid #c4822a', height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f5edd6', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '0.05em', color: '#f5edd6' }}>
            Catch<span style={{ color: '#c4822a' }}>Up</span>
          </span>
        </a>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

          {/* Card */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(196,130,42,0.3)',
            borderRadius: '16px',
            padding: '40px 36px',
          }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '56px', height: '56px', borderRadius: '50%',
                background: 'rgba(196,130,42,0.15)', border: '1px solid rgba(196,130,42,0.35)',
                fontSize: '24px', marginBottom: '16px',
              }}>🔑</div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '36px', letterSpacing: '0.05em', color: '#f5edd6', margin: 0 }}>
                {success ? <>Password <span style={{ color: '#c4822a' }}>Updated</span></> : <>Set New <span style={{ color: '#c4822a' }}>Password</span></>}
              </h1>
              <p style={{ color: 'rgba(245,237,214,0.5)', fontSize: '14px', marginTop: '8px' }}>
                {success ? 'Redirecting you to the app…' : 'Choose a new password for your account.'}
              </p>
            </div>

            {success ? (
              /* Success state */
              <div style={{
                padding: '20px', borderRadius: '8px', textAlign: 'center',
                background: 'rgba(45,90,27,0.2)', border: '1px solid rgba(45,90,27,0.5)',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>✓</div>
                <p style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
                  letterSpacing: '0.04em', color: 'rgba(245,237,214,0.8)', margin: 0,
                }}>
                  Your password has been updated. Taking you to the app…
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <div style={{
                    marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', fontSize: '14px',
                    background: 'rgba(212,69,26,0.15)', border: '1px solid rgba(212,69,26,0.4)', color: '#f97950',
                    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em',
                  }}>
                    {error}
                  </div>
                )}

                {/* New password */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700,
                    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'rgba(245,237,214,0.65)',
                  }}>New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    style={{
                      width: '100%', padding: '11px 14px', borderRadius: '8px', fontSize: '14px',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(245,237,214,0.15)',
                      color: '#f5edd6', outline: 'none', boxSizing: 'border-box',
                      fontFamily: "'Barlow', sans-serif",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(196,130,42,0.6)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(245,237,214,0.15)')}
                  />
                </div>

                {/* Confirm password */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700,
                    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'rgba(245,237,214,0.65)',
                  }}>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your new password"
                    required
                    style={{
                      width: '100%', padding: '11px 14px', borderRadius: '8px', fontSize: '14px',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(245,237,214,0.15)',
                      color: '#f5edd6', outline: 'none', boxSizing: 'border-box',
                      fontFamily: "'Barlow', sans-serif",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(196,130,42,0.6)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(245,237,214,0.15)')}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '13px', borderRadius: '8px', border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: loading ? 'rgba(196,130,42,0.5)' : '#c4822a',
                    color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '14px',
                    transition: 'background 0.15s',
                  }}
                >
                  {loading ? 'Updating…' : 'Set New Password'}
                </button>
              </form>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
