'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Role = 'player' | 'coach' | 'parent' | 'both'

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']
const LEVELS = ['Pro / MiLB', 'College', 'High School', 'Rec League', 'Never played organized ball']
const COACH_SPECIALTIES = ['Hitting', 'Pitching', 'Catching', 'Infield', 'Outfield', 'Speed & Agility', 'Mental Game', 'General']
const COACH_EXPERIENCE = ['1-2 years', '3-5 years', '6-10 years', '10+ years']
const COACH_OFFERINGS = ['Private Lessons', 'Group Clinics', 'Team Coaching', 'Camps', 'Video Analysis']
const COACH_AGE_GROUPS = ['6-8', '9-10', '11-12', '13-14', '15-16', '17-18', 'College', 'Adult']
const PARENT_AGE_GROUPS = ['6-8', '9-10', '11-12', '13-14', '15-16', '17-18']
const PARENT_SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Elite']
const PARENT_LOOKING_FOR = ['Private Lessons', 'Group Clinics', 'Travel Team', 'Rec League', 'Camps']

const LABEL: React.CSSProperties = {
  display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700,
  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'rgba(245,237,214,0.65)',
}
const INPUT: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: '8px', fontSize: '14px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(245,237,214,0.15)',
  color: '#f5edd6', outline: 'none', boxSizing: 'border-box', fontFamily: "'Barlow', sans-serif",
}
const SELECT: React.CSSProperties = {
  ...INPUT, cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(245,237,214,0.4)' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: '36px',
}

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(196,130,42,0.6)'
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(245,237,214,0.15)'
}

function ChipSelect({ options, selected, onToggle }: {
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {options.map(opt => {
        const active = selected.includes(opt)
        return (
          <button key={opt} type="button" onClick={() => onToggle(opt)} style={{
            padding: '6px 14px', borderRadius: '99px', fontSize: '13px', cursor: 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em',
            border: active ? '1px solid #c4822a' : '1px solid rgba(245,237,214,0.2)',
            background: active ? '#c4822a' : 'rgba(255,255,255,0.04)',
            color: active ? '#0d1f3c' : 'rgba(245,237,214,0.65)',
            transition: 'all 0.15s',
          }}>
            {opt}
          </button>
        )
      })}
    </div>
  )
}

const ROLE_CARDS: { value: Role; icon: string; label: string; desc: string }[] = [
  { value: 'player', icon: '🧤', label: 'Player', desc: 'I play baseball and want to find games, partners, and teams' },
  { value: 'coach', icon: '🎓', label: 'Coach', desc: 'I coach or offer lessons and want to connect with players and teams' },
  { value: 'both', icon: '⚾', label: 'Both', desc: 'I play and coach' },
  { value: 'parent', icon: '👪', label: 'Parent', desc: "I'm looking for opportunities for my child" },
]

export default function ProfileEditPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pageLoading, setPageLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const [role, setRole] = useState<Role | ''>('')
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [zip, setZip] = useState('')
  const [bio, setBio] = useState('')

  // Player fields
  const [positions, setPositions] = useState<string[]>([])
  const [level, setLevel] = useState('')
  const [status, setStatus] = useState('')

  // Coach fields
  const [coachingSpecialties, setCoachingSpecialties] = useState<string[]>([])
  const [coachingExperience, setCoachingExperience] = useState('')
  const [coachingOfferings, setCoachingOfferings] = useState<string[]>([])
  const [ageGroupsCoached, setAgeGroupsCoached] = useState<string[]>([])

  // Parent fields
  const [childPosition, setChildPosition] = useState('')
  const [childAgeGroup, setChildAgeGroup] = useState('')
  const [childSkillLevel, setChildSkillLevel] = useState('')
  const [parentLookingFor, setParentLookingFor] = useState<string[]>([])

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 480)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth?tab=login'); return }

      setUserId(session.user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, first_name, last_name, zip_code, bio, avatar_url, positions, highest_level, status, coaching_specialties, coaching_experience, coaching_offerings, age_groups_coached, child_position, child_age_group, child_skill_level, parent_looking_for')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setRole((profile.role as Role) || '')
        setFirstName(profile.first_name ?? '')
        setLastName(profile.last_name ?? '')
        setZip(profile.zip_code ?? '')
        setBio(profile.bio ?? '')
        setExistingAvatarUrl(profile.avatar_url ?? null)
        setAvatarPreview(profile.avatar_url ?? null)
        setPositions(profile.positions ?? [])
        setLevel(profile.highest_level ?? '')
        setStatus(profile.status ?? '')
        setCoachingSpecialties(profile.coaching_specialties ?? [])
        setCoachingExperience(profile.coaching_experience ?? '')
        setCoachingOfferings(profile.coaching_offerings ?? [])
        setAgeGroupsCoached(profile.age_groups_coached ?? [])
        setChildPosition(profile.child_position ?? '')
        setChildAgeGroup(profile.child_age_group ?? '')
        setChildSkillLevel(profile.child_skill_level ?? '')
        setParentLookingFor(profile.parent_looking_for ?? [])
      }

      setPageLoading(false)
    }
    load()
  }, [])

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function toggleChip(list: string[], setList: (v: string[]) => void, val: string) {
    setList(list.includes(val) ? list.filter(x => x !== val) : [...list, val])
  }

  const isPlayer = role === 'player' || role === 'both'
  const isCoach = role === 'coach' || role === 'both'
  const isParent = role === 'parent'
  const bioLabel = isParent ? 'About My Child' : 'About You'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!role) { setError('Please select your role.'); return }
    setError('')
    setLoading(true)

    try {
      if (!userId) {
        setError('You must be logged in.')
        setLoading(false)
        return
      }

      let avatarUrl = existingAvatarUrl
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const path = `${userId}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('avatars').upload(path, avatarFile, { upsert: true })
        if (uploadErr) {
          setError('Profile saved, but photo upload failed — try again later.')
        } else {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
          avatarUrl = urlData.publicUrl
        }
      }

      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: userId,
        role,
        first_name: firstName,
        last_name: lastName,
        zip_code: zip,
        bio,
        avatar_url: avatarUrl,
        ...(isPlayer ? { positions, highest_level: level, status } : {}),
        ...(isCoach ? {
          coaching_specialties: coachingSpecialties,
          coaching_experience: coachingExperience,
          coaching_offerings: coachingOfferings,
          age_groups_coached: ageGroupsCoached,
        } : {}),
        ...(isParent ? {
          child_position: childPosition,
          child_age_group: childAgeGroup,
          child_skill_level: childSkillLevel,
          parent_looking_for: parentLookingFor,
        } : {}),
      })

      if (profileErr) {
        setError(profileErr.message)
        setLoading(false)
        return
      }

      router.push('/profile')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (pageLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1f3c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1f3c', color: '#f5edd6', fontFamily: "'Barlow', sans-serif" }}>
      <nav style={{ borderBottom: '2px solid #c4822a', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f5edd6', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '0.05em', color: '#f5edd6' }}>
            Catch<span style={{ color: '#c4822a' }}>Up</span>
          </span>
        </a>
        <a href="/profile" style={{ fontSize: '13px', color: 'rgba(245,237,214,0.4)', textDecoration: 'none', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em' }}>
          ← Back to Profile
        </a>
      </nav>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 16px 80px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '48px', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>
            Edit Your <span style={{ color: '#c4822a' }}>Profile</span>
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ── Role selector ── */}
          <div style={{ marginBottom: '24px' }}>
            <label style={LABEL}>I am a...</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {ROLE_CARDS.map(card => {
                const active = role === card.value
                return (
                  <button
                    key={card.value}
                    type="button"
                    onClick={() => setRole(card.value)}
                    style={{
                      padding: '16px 12px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                      border: active ? '2px solid #c4822a' : '1px solid rgba(245,237,214,0.15)',
                      background: active ? 'rgba(196,130,42,0.12)' : 'rgba(255,255,255,0.04)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>{card.icon}</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '16px', letterSpacing: '0.05em', color: active ? '#c4822a' : '#f5edd6', marginBottom: '4px' }}>
                      {card.label}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(245,237,214,0.5)', lineHeight: 1.4 }}>
                      {card.desc}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Fields ── */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)', borderRadius: '16px', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Photo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100px', height: '100px', borderRadius: '50%', border: '2px dashed rgba(196,130,42,0.5)',
                  background: avatarPreview ? 'transparent' : 'rgba(255,255,255,0.04)',
                  cursor: 'pointer', overflow: 'hidden', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#c4822a')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(196,130,42,0.5)')}
                aria-label="Upload profile photo"
              >
                {avatarPreview
                  ? <img src={avatarPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '28px' }}>📷</span>}
              </button>
              <span style={{ marginTop: '10px', fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.08em', color: 'rgba(245,237,214,0.4)' }}>
                {avatarPreview ? 'Click to change photo' : 'Click to upload photo'}
              </span>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </div>

            {/* Name */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={LABEL}>First Name</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="Joe" required style={INPUT} onFocus={focusBorder} onBlur={blurBorder} />
              </div>
              <div>
                <label style={LABEL}>Last Name</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                  placeholder="Smith" required style={INPUT} onFocus={focusBorder} onBlur={blurBorder} />
              </div>
            </div>

            {/* Zip */}
            <div>
              <label style={LABEL}>Zip Code</label>
              <input type="text" value={zip} onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="12345" maxLength={5} style={INPUT} onFocus={focusBorder} onBlur={blurBorder} />
            </div>

            {/* ── Player fields ── */}
            {isPlayer && (
              <>
                <div>
                  <label style={LABEL}>Position(s)</label>
                  <ChipSelect options={POSITIONS} selected={positions} onToggle={v => toggleChip(positions, setPositions, v)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              </>
            )}

            {/* ── Coach fields ── */}
            {isCoach && (
              <>
                <div>
                  <label style={LABEL}>Coaching Specialties</label>
                  <ChipSelect options={COACH_SPECIALTIES} selected={coachingSpecialties} onToggle={v => toggleChip(coachingSpecialties, setCoachingSpecialties, v)} />
                </div>
                <div>
                  <label style={LABEL}>Experience Level</label>
                  <select value={coachingExperience} onChange={e => setCoachingExperience(e.target.value)} style={SELECT} onFocus={focusBorder} onBlur={blurBorder}>
                    <option value="" disabled style={{ background: '#0d1f3c' }}>Select...</option>
                    {COACH_EXPERIENCE.map(exp => <option key={exp} value={exp} style={{ background: '#0d1f3c' }}>{exp}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL}>What I Offer</label>
                  <ChipSelect options={COACH_OFFERINGS} selected={coachingOfferings} onToggle={v => toggleChip(coachingOfferings, setCoachingOfferings, v)} />
                </div>
                <div>
                  <label style={LABEL}>Age Groups I Work With</label>
                  <ChipSelect options={COACH_AGE_GROUPS} selected={ageGroupsCoached} onToggle={v => toggleChip(ageGroupsCoached, setAgeGroupsCoached, v)} />
                </div>
                <div>
                  <label style={LABEL}>Bio</label>
                  <textarea
                    value={bio} onChange={e => setBio(e.target.value)}
                    placeholder="Tell players and parents about yourself, your coaching philosophy, and experience"
                    rows={4}
                    style={{ ...INPUT, resize: 'vertical', minHeight: '100px', lineHeight: '1.5' } as React.CSSProperties}
                    onFocus={focusBorder} onBlur={blurBorder}
                  />
                </div>
              </>
            )}

            {/* ── Parent fields ── */}
            {isParent && (
              <>
                <div>
                  <label style={LABEL}>Child&apos;s Primary Position</label>
                  <select value={childPosition} onChange={e => setChildPosition(e.target.value)} style={SELECT} onFocus={focusBorder} onBlur={blurBorder}>
                    <option value="" disabled style={{ background: '#0d1f3c' }}>Select...</option>
                    {POSITIONS.map(p => <option key={p} value={p} style={{ background: '#0d1f3c' }}>{p}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={LABEL}>Child&apos;s Age Group</label>
                    <select value={childAgeGroup} onChange={e => setChildAgeGroup(e.target.value)} style={SELECT} onFocus={focusBorder} onBlur={blurBorder}>
                      <option value="" disabled style={{ background: '#0d1f3c' }}>Select...</option>
                      {PARENT_AGE_GROUPS.map(g => <option key={g} value={g} style={{ background: '#0d1f3c' }}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LABEL}>Child&apos;s Skill Level</label>
                    <select value={childSkillLevel} onChange={e => setChildSkillLevel(e.target.value)} style={SELECT} onFocus={focusBorder} onBlur={blurBorder}>
                      <option value="" disabled style={{ background: '#0d1f3c' }}>Select...</option>
                      {PARENT_SKILL_LEVELS.map(s => <option key={s} value={s} style={{ background: '#0d1f3c' }}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={LABEL}>Looking For</label>
                  <ChipSelect options={PARENT_LOOKING_FOR} selected={parentLookingFor} onToggle={v => toggleChip(parentLookingFor, setParentLookingFor, v)} />
                </div>
              </>
            )}

            {/* ── Bio (player / parent only — coaches have it in their section) ── */}
            {!isCoach && (
              <div>
                <label style={LABEL}>{bioLabel}</label>
                <textarea
                  value={bio} onChange={e => setBio(e.target.value)}
                  placeholder={isParent ? 'Tell coaches and teams about your child...' : 'Tell the community about yourself...'}
                  rows={4}
                  style={{ ...INPUT, resize: 'vertical', minHeight: '100px', lineHeight: '1.5' } as React.CSSProperties}
                  onFocus={focusBorder} onBlur={blurBorder}
                />
              </div>
            )}

            {error && (
              <div style={{
                padding: '12px 16px', borderRadius: '8px', fontSize: '14px',
                background: 'rgba(212,69,26,0.15)', border: '1px solid rgba(212,69,26,0.4)', color: '#f97950',
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: '8px', border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? 'rgba(196,130,42,0.5)' : '#c4822a',
                color: '#0d1f3c', fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '15px',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
