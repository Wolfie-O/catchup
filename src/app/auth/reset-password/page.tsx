'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }

    setLoading(false)
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
                Reset Your <span style={{ color: '#c4822a' }}>Password</span>
              </h1>
              <p style={{ color: 'rgba(245,237,214,0.5)', fontSize: '14px', marginTop: '8px', lineHeight: '1.5' }}>
                {sent
                  ? "Check your email for a reset link. It may take a minute to arrive."
                  : "Enter your email and we'll send you a link to reset your password."}
              </p>
            </div>

            {sent ? (
              /* Success state */
              <div style={{
                padding: '16px', borderRadius: '8px', textAlign: 'center',
                background: 'rgba(45,90,27,0.2)', border: '1px solid rgba(45,90,27,0.5)',
                marginBottom: '24px',
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>✓</div>
                <p style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
                  letterSpacing: '0.04em', color: 'rgba(245,237,214,0.8)', margin: 0,
                }}>
                  Reset link sent to <strong>{email}</strong>
                </p>
              </div>
            ) : (
              /* Form */
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

                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700,
                    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'rgba(245,237,214,0.65)',
                  }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
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
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            )}

            {/* Back to login */}
            <p style={{ textAlign: 'center', marginTop: '24px', margin: '24px 0 0' }}>
              <a
                href="/auth"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
                  letterSpacing: '0.05em', color: 'rgba(245,237,214,0.4)', textDecoration: 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c4822a')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,237,214,0.4)')}
              >
                ← Back to Log In
              </a>
            </p>

          </div>
        </div>
      </main>
    </div>
  )
}
