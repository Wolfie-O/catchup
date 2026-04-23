'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Tab = 'signup' | 'login'

function AuthForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = params.get('redirect') ?? null
  const initialTab = params.get('tab') === 'login' ? 'login' : 'signup'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function switchTab(t: Tab) {
    setTab(t)
    setError('')
    setEmail('')
    setPassword('')
    setConfirm('')
  }

  async function handleGoogle() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/players` },
    })
    if (error) setError(error.message)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (tab === 'signup' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    if (tab === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push(redirectTo ?? '/profile/setup')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push(redirectTo ?? '/players')
      }
    }

    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1f3c', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{
        borderBottom: '2px solid #c4822a',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
      }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f5edd6', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '0.05em', color: '#f5edd6' }}>
            Catch<span style={{ color: '#c4822a' }}>Up</span>
          </span>
        </a>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>

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
              }}>⚾</div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '40px', letterSpacing: '0.05em', color: '#f5edd6', margin: 0 }}>
                {tab === 'signup' ? <>Join <span style={{ color: '#c4822a' }}>CatchUp</span></> : <>Welcome <span style={{ color: '#c4822a' }}>Back</span></>}
              </h1>
              <p style={{ color: 'rgba(245,237,214,0.5)', fontSize: '14px', marginTop: '6px' }}>
                {tab === 'signup' ? 'Create your free player profile.' : 'Sign in to your account.'}
              </p>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', background: 'rgba(255,255,255,0.06)',
              borderRadius: '8px', padding: '4px', marginBottom: '24px',
            }}>
              {(['signup', 'login'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => switchTab(t)}
                  style={{
                    flex: 1, padding: '8px', border: 'none', cursor: 'pointer',
                    borderRadius: '6px', transition: 'all 0.15s',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '12px',
                    background: tab === t ? '#c4822a' : 'transparent',
                    color: tab === t ? '#0d1f3c' : 'rgba(245,237,214,0.45)',
                  }}
                >
                  {t === 'signup' ? 'Sign Up' : 'Log In'}
                </button>
              ))}
            </div>

            {/* Google */}
            <button
              onClick={handleGoogle}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '10px', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer',
                background: 'transparent', border: '1px solid rgba(245,237,214,0.25)',
                color: 'rgba(245,237,214,0.9)', transition: 'background 0.15s',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                letterSpacing: '0.05em', fontSize: '15px',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path fill="#EA4335" d="M24 9.5c3.1 0 5.8 1.1 8 2.9l6-6C34.5 3.1 29.6 1 24 1 14.7 1 6.9 6.7 3.4 14.8l7 5.4C12.1 13.7 17.6 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-16.9z"/>
                <path fill="#FBBC05" d="M10.4 28.6A14.8 14.8 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6l-7-5.4A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6.2z"/>
                <path fill="#34A853" d="M24 47c5.9 0 10.8-2 14.4-5.3l-7.4-5.7c-2 1.4-4.6 2.2-7 2.2-6.4 0-11.9-4.3-13.8-10.1l-7.8 6.2C6.9 41.3 14.7 47 24 47z"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(245,237,214,0.12)' }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(245,237,214,0.3)' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(245,237,214,0.12)' }} />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', fontSize: '14px',
                background: 'rgba(212,69,26,0.15)', border: '1px solid rgba(212,69,26,0.4)', color: '#f97950',
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em',
              }}>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600,
                  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'rgba(245,237,214,0.65)',
                }}>Email</label>
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

              {/* Password */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600,
                  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'rgba(245,237,214,0.65)',
                }}>Password</label>
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

              {/* Forgot password — login tab only */}
              {tab === 'login' && (
                <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '16px' }}>
                  <a
                    href="/auth/reset-password"
                    style={{
                      fontSize: '12px', color: '#c4822a', textDecoration: 'none',
                      fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.04em',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    Forgot your password?
                  </a>
                </div>
              )}

              {/* Confirm Password — sign up only */}
              {tab === 'signup' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600,
                    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'rgba(245,237,214,0.65)',
                  }}>Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
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
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', marginTop: '8px', padding: '13px', borderRadius: '8px',
                  border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? 'rgba(196,130,42,0.5)' : '#c4822a',
                  color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '14px',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? '...' : tab === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            {/* Cross-link */}
            <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif" }}>
              {tab === 'signup' ? 'Already have an account? ' : 'New to CatchUp? '}
              <button
                onClick={() => switchTab(tab === 'signup' ? 'login' : 'signup')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,237,214,0.55)', textDecoration: 'underline', fontSize: '13px', fontFamily: "'Barlow', sans-serif" }}
              >
                {tab === 'signup' ? 'Log in' : 'Sign up free'}
              </button>
            </p>

          </div>

          {/* Back home */}
          <p style={{ textAlign: 'center', marginTop: '20px' }}>
            <a href="/" style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', letterSpacing: '0.05em',
              color: 'rgba(245,237,214,0.3)', textDecoration: 'none',
            }}>← Back to home</a>
          </p>

        </div>
      </main>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0d1f3c' }} />}>
      <AuthForm />
    </Suspense>
  )
}
