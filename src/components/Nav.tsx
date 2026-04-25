'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Nav() {
  const router = useRouter()
  const pathname = usePathname()
  const [userId, setUserId] = useState<string | null>(null)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchFirstName(uid: string) {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, avatar_url')
        .eq('id', uid)
        .single()
      if (data) {
        setFirstName(data.first_name ?? null)
        setAvatarUrl(data.avatar_url ?? null)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id)
        fetchFirstName(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null)
      if (session) fetchFirstName(session.user.id)
      else { setFirstName(null); setAvatarUrl(null) }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdown on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  async function handleLogOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function navLink(href: string, label: string, mobile = false) {
    const isActive = pathname === href
    return (
      <Link
        href={href}
        className={
          mobile
            ? `block font-condensed font-semibold tracking-widest uppercase text-sm px-4 py-3 transition-colors ${isActive ? 'text-dirt bg-dirt/10' : 'text-cream-dark hover:text-dirt hover:bg-dirt/10'}`
            : `font-condensed font-semibold tracking-widest uppercase text-sm px-4 py-2 rounded transition-colors ${isActive ? 'text-dirt bg-dirt/10' : 'text-cream-dark hover:text-dirt hover:bg-dirt/10'}`
        }
      >
        {label}
      </Link>
    )
  }

  return (
    <nav className="sticky top-0 z-50 bg-navy border-b-2 border-dirt flex items-center justify-between px-4 md:px-6 h-16">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-cream flex-shrink-0" />
        <span className="font-display text-2xl md:text-3xl tracking-wide text-cream">
          Catch<span className="text-dirt">Up</span>
        </span>
      </Link>

      {/* ── Desktop (md and above) ── */}
      <div className="hidden md:flex items-center gap-1">
        {userId && navLink('/players', 'Community')}
        {userId && navLink('/feed', 'Feed')}
        {userId && navLink('/teams', 'Teams')}
        <div className="flex items-center gap-2 ml-2">
          {userId ? (
            <>
              <Link
                href="/profile"
                className="font-condensed font-semibold tracking-widest uppercase text-sm px-3 py-2 rounded text-cream-dark hover:text-dirt hover:bg-dirt/10 transition-colors"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#c4822a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 10, color: '#0d1f3c', letterSpacing: '0.04em' }}>
                    {firstName ? firstName[0].toUpperCase() : '?'}
                  </div>
                )}
                {firstName ?? 'My Profile'}
              </Link>
              <button
                onClick={handleLogOut}
                className="font-condensed font-bold tracking-widest uppercase text-sm px-5 py-2 rounded border border-dirt text-dirt hover:bg-dirt/10 transition-colors"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth?tab=login"
                className="font-condensed font-bold tracking-widest uppercase text-sm px-5 py-2 rounded border border-dirt text-dirt hover:bg-dirt/10 transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/auth?tab=signup"
                className="font-condensed font-bold tracking-widest uppercase text-sm px-5 py-2 rounded bg-dirt text-navy hover:bg-dirt-dark transition-colors"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile (below md) ── */}
      <div className="flex md:hidden items-center gap-2">
        {userId ? (
          /* Hamburger + dropdown */
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Open menu"
              className="font-condensed font-bold tracking-widest uppercase text-xs px-3 py-1.5 rounded border border-dirt text-dirt"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {/* Hamburger icon */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                {menuOpen ? (
                  /* X icon when open */
                  <>
                    <path d="M3 3L13 13" stroke="#c4822a" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M13 3L3 13" stroke="#c4822a" strokeWidth="1.8" strokeLinecap="round" />
                  </>
                ) : (
                  /* Three lines when closed */
                  <>
                    <path d="M2 4h12" stroke="#c4822a" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M2 8h12" stroke="#c4822a" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M2 12h12" stroke="#c4822a" strokeWidth="1.8" strokeLinecap="round" />
                  </>
                )}
              </svg>
              Menu
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                minWidth: '180px', background: '#0d1f3c',
                border: '1px solid rgba(196,130,42,0.35)',
                borderRadius: '10px', overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                zIndex: 100,
              }}>
                {navLink('/players', 'Community', true)}
                {navLink('/feed', 'Feed', true)}
                {navLink('/teams', 'Teams', true)}
                {navLink('/profile', firstName ?? 'My Profile', true)}
                <div style={{ borderTop: '1px solid rgba(196,130,42,0.2)', margin: '4px 0' }} />
                <button
                  onClick={handleLogOut}
                  className="block w-full text-left font-condensed font-bold tracking-widest uppercase text-sm px-4 py-3 text-dirt hover:bg-dirt/10 transition-colors"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Logged-out mobile: Log In + Sign Up */
          <>
            <Link
              href="/auth?tab=login"
              className="font-condensed font-bold tracking-widest uppercase text-xs px-3 py-1.5 rounded border border-dirt text-dirt whitespace-nowrap"
            >
              Log In
            </Link>
            <Link
              href="/auth?tab=signup"
              className="font-condensed font-bold tracking-widest uppercase text-xs px-3 py-1.5 rounded bg-dirt text-navy whitespace-nowrap"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
