'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AuthenticatedLayout } from '@/app/layout-authenticated'
import Nav from '@/components/Nav'

// ── Types ──────────────────────────────────────────────────────────────────────

type MyProfile = {
  first_name: string | null
  last_name: string | null
  zip_code: string | null
  avatar_url: string | null
}

type AuthorProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  vouches: number | null
  highest_level: string | null
  status: string | null
}

type Post = {
  id: string
  user_id: string
  content: string
  image_url: string | null
  location_zip: string | null
  created_at: string
  tag: string | null
  author: AuthorProfile
  likeCount: number
  userLiked: boolean
  commentCount: number
}

type Comment = {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  author: AuthorProfile
}

// ── Tag definitions ────────────────────────────────────────────────────────────

const POST_TAGS = [
  { value: 'looking_for_players',       emoji: '🔍', label: 'Looking for Players',    short: 'Looking for Players' },
  { value: 'looking_for_team',          emoji: '🙋', label: 'Looking for a Team',     short: 'Looking for a Team' },
  { value: 'looking_for_catch_partner', emoji: '🤝', label: 'Looking for Catch Partner', short: 'Catch Partner' },
  { value: 'lessons_available',         emoji: '🎓', label: 'Lessons Available',      short: 'Lessons' },
  { value: 'tryouts',                   emoji: '📋', label: 'Tryouts',               short: 'Tryouts' },
  { value: 'camps_clinics',             emoji: '⛺', label: 'Camps & Clinics',       short: 'Camps' },
  { value: 'game_recap',                emoji: '🏆', label: 'Game Recap',            short: 'Game Recap' },
  { value: 'media',                     emoji: '📸', label: 'Media',                 short: 'Media' },
  { value: 'announcement',              emoji: '📢', label: 'Announcement',          short: 'Announcement' },
  { value: 'discussion',                emoji: '💬', label: 'Discussion',            short: 'Discussion' },
] as const

type PostTagValue = typeof POST_TAGS[number]['value']

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(first: string | null, last: string | null): string {
  return [(first || '')[0], (last || '')[0]].filter(Boolean).join('').toUpperCase() || '?'
}

async function fetchZipCoords(zip: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) return null
    const data = await res.json()
    return { lat: parseFloat(data.places[0].latitude), lon: parseFloat(data.places[0].longitude) }
  } catch {
    return null
  }
}

const zipCache: Record<string, { lat: number; lon: number } | null> = {}

async function getZipCoords(zip: string) {
  if (zip in zipCache) return zipCache[zip]
  const coords = await fetchZipCoords(zip)
  zipCache[zip] = coords
  return coords
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatTimeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({
  url, first, last, size = 44,
}: {
  url: string | null; first: string | null; last: string | null; size?: number
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={[first, last].filter(Boolean).join(' ')}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#c4822a', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: Math.round(size * 0.38),
      color: '#0d1f3c', letterSpacing: '0.04em',
    }}>
      {getInitials(first, last)}
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconCamera() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="rgba(245,237,214,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function IconHeartFilled() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="#c4822a" stroke="#c4822a" strokeWidth="1">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function IconHeartOutline() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="rgba(245,237,214,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function IconComment() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="rgba(245,237,214,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

// ── PostCard ───────────────────────────────────────────────────────────────────

function PostCard({ post, currentUserId, currentUserProfile, distanceMi }: {
  post: Post
  currentUserId: string
  currentUserProfile: MyProfile | null
  distanceMi: number | null
}) {
  const [liked, setLiked] = useState(post.userLiked)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [commenting, setCommenting] = useState(false)
  const [commentCount, setCommentCount] = useState(post.commentCount)

  const isVerified = (post.author.vouches ?? 0) >= 3
  const authorName = [post.author.first_name, post.author.last_name].filter(Boolean).join(' ') || 'Player'
  const authorMeta = [post.author.highest_level, post.author.status].filter(Boolean).join(' · ')

  async function toggleLike() {
    if (liked) {
      setLiked(false)
      setLikeCount(c => c - 1)
      await supabase.from('post_likes').delete()
        .eq('post_id', post.id).eq('user_id', currentUserId)
    } else {
      setLiked(true)
      setLikeCount(c => c + 1)
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUserId })
    }
  }

  async function loadComments() {
    if (commentsLoaded) return
    const { data: rawComments, error } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Feed] load comments error:', error)
      setCommentsLoaded(true)
      return
    }

    const raw = rawComments ?? []
    if (raw.length > 0) {
      const authorIds = [...new Set(raw.map((c: { user_id: string }) => c.user_id))]
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, vouches, highest_level, status')
        .in('id', authorIds)

      const profileMap: Record<string, AuthorProfile> = {}
      for (const p of profilesData ?? []) profileMap[p.id] = p as AuthorProfile

      setComments(raw.map((c: { id: string; post_id: string; user_id: string; content: string; created_at: string }) => ({
        id: c.id,
        post_id: c.post_id,
        user_id: c.user_id,
        content: c.content,
        created_at: c.created_at,
        author: profileMap[c.user_id] ?? {
          id: c.user_id, first_name: null, last_name: null, avatar_url: null,
          vouches: null, highest_level: null, status: null,
        },
      })))
    }
    setCommentsLoaded(true)
  }

  function handleToggleComments() {
    const next = !showComments
    setShowComments(next)
    if (next && !commentsLoaded) loadComments()
  }

  async function submitComment() {
    if (!commentInput.trim() || commenting) return
    const content = commentInput.trim()
    setCommentInput('')
    setCommenting(true)

    const { error } = await supabase.from('post_comments').insert({
      post_id: post.id,
      user_id: currentUserId,
      content,
    })

    if (error) {
      console.error('[Feed] submit comment error:', error)
      setCommentInput(content)
    } else {
      setComments(prev => [...prev, {
        id: Date.now().toString(),
        post_id: post.id,
        user_id: currentUserId,
        content,
        created_at: new Date().toISOString(),
        author: {
          id: currentUserId,
          first_name: currentUserProfile?.first_name ?? null,
          last_name: currentUserProfile?.last_name ?? null,
          avatar_url: currentUserProfile?.avatar_url ?? null,
          vouches: null, highest_level: null, status: null,
        },
      }])
      setCommentCount(c => c + 1)
    }
    setCommenting(false)
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)',
      borderRadius: '12px', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 16px 12px' }}>
        <Avatar url={post.author.avatar_url} first={post.author.first_name} last={post.author.last_name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: '15px', color: '#f5edd6',
            }}>
              {authorName}
            </span>
            {isVerified && (
              <span style={{
                fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                letterSpacing: '0.06em', color: '#f0b429',
                background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.3)',
                borderRadius: '4px', padding: '1px 5px',
              }}>
                ★ Verified
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
            {authorMeta && (
              <span style={{ fontSize: '12px', color: 'rgba(245,237,214,0.4)', fontFamily: "'Barlow', sans-serif" }}>
                {authorMeta}
              </span>
            )}
            {authorMeta && (
              <span style={{ fontSize: '12px', color: 'rgba(245,237,214,0.2)' }}>·</span>
            )}
            <span style={{ fontSize: '12px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif" }}>
              {formatTimeAgo(post.created_at)}
            </span>
            {distanceMi !== null && (
              <>
                <span style={{ fontSize: '12px', color: 'rgba(245,237,214,0.2)' }}>·</span>
                <span style={{ fontSize: '12px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif" }}>
                  📍 {distanceMi.toFixed(1)} mi away
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tag badge */}
      {post.tag && (() => {
        const t = POST_TAGS.find(t => t.value === post.tag)
        return t ? (
          <div style={{ padding: '0 16px 10px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: 'rgba(196,130,42,0.15)', border: '1px solid rgba(196,130,42,0.3)',
              color: '#c4822a', fontSize: '11px', borderRadius: '99px', padding: '3px 10px',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.04em',
            }}>
              {t.emoji} {t.label}
            </span>
          </div>
        ) : null
      })()}

      {/* Content */}
      {post.content && (
        <p style={{
          margin: 0, padding: '0 16px 14px',
          fontSize: '14px', lineHeight: '1.6', color: '#f5edd6',
          fontFamily: "'Barlow', sans-serif", whiteSpace: 'pre-wrap',
        }}>
          {post.content}
        </p>
      )}

      {/* Image — full card width, clipped by card overflow:hidden */}
      {post.image_url && (
        <img
          src={post.image_url}
          alt="Post"
          style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }}
        />
      )}

      {/* Action bar */}
      <div style={{
        display: 'flex', gap: '4px', padding: '8px 12px 12px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        marginTop: post.image_url ? '0' : undefined,
      }}>
        <button
          onClick={toggleLike}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 10px', borderRadius: '7px',
            color: liked ? '#c4822a' : 'rgba(245,237,214,0.5)',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
            fontSize: '13px', letterSpacing: '0.03em',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
        >
          {liked ? <IconHeartFilled /> : <IconHeartOutline />}
          {likeCount > 0 ? likeCount : null}
        </button>

        <button
          onClick={handleToggleComments}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 10px', borderRadius: '7px',
            color: showComments ? '#c4822a' : 'rgba(245,237,214,0.5)',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
            fontSize: '13px', letterSpacing: '0.03em',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
        >
          <IconComment />
          {commentCount > 0 ? commentCount : null}
        </button>
      </div>

      {/* Comment section */}
      {showComments && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px 16px' }}>

          {/* Existing comments */}
          {comments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
              {comments.map(c => {
                const cName = [c.author.first_name, c.author.last_name].filter(Boolean).join(' ') || 'Player'
                return (
                  <div key={c.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <Avatar url={c.author.avatar_url} first={c.author.first_name} last={c.author.last_name} size={30} />
                    <div style={{
                      flex: 1, background: 'rgba(255,255,255,0.05)',
                      borderRadius: '8px', padding: '8px 12px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                          fontSize: '13px', color: '#f5edd6',
                        }}>
                          {cName}
                        </span>
                        <span style={{ fontSize: '11px', color: 'rgba(245,237,214,0.3)', fontFamily: "'Barlow', sans-serif" }}>
                          {formatTimeAgo(c.created_at)}
                        </span>
                      </div>
                      <p style={{
                        margin: 0, fontSize: '13px', lineHeight: '1.5',
                        color: 'rgba(245,237,214,0.8)', fontFamily: "'Barlow', sans-serif",
                      }}>
                        {c.content}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add comment input */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitComment() } }}
              placeholder="Add a comment…"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(245,237,214,0.1)',
                borderRadius: '8px', color: '#f5edd6',
                fontSize: '13px', fontFamily: "'Barlow', sans-serif",
                padding: '8px 12px', outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(196,130,42,0.45)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(245,237,214,0.1)' }}
            />
            <button
              onClick={submitComment}
              disabled={!commentInput.trim() || commenting}
              style={{
                padding: '8px 14px', borderRadius: '8px', border: 'none', flexShrink: 0,
                background: commentInput.trim() && !commenting ? '#c4822a' : 'rgba(196,130,42,0.3)',
                color: commentInput.trim() && !commenting ? '#0d1f3c' : 'rgba(13,31,60,0.5)',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: '13px', letterSpacing: '0.05em',
                cursor: commentInput.trim() && !commenting ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s',
              }}
            >
              {commenting ? '…' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const router = useRouter()

  // ── Auth + profile ──────────────────────────────────────────────────────────
  const [sessionLoading, setSessionLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null)

  // ── Distance filter ─────────────────────────────────────────────────────────
  const [distanceFilter, setDistanceFilter] = useState<'area' | '5' | '10' | '20' | '50' | 'everywhere'>('area')
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [zipCoordsReady, setZipCoordsReady] = useState(false)

  // ── Feed state ──────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [pendingPosts, setPendingPosts] = useState<Post[]>([])

  // ── Create post ─────────────────────────────────────────────────────────────
  const [postContent, setPostContent] = useState('')
  const [postImage, setPostImage] = useState<File | null>(null)
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null)
  const [postTag, setPostTag] = useState<PostTagValue | null>(null)
  const [posting, setPosting] = useState(false)

  // ── Tag filter ───────────────────────────────────────────────────────────────
  const [tagFilter, setTagFilter] = useState<PostTagValue | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Pre-fetch all zip coords, then mark filter as ready ────────────────────
  const prefetchAllZips = useCallback(async (fetchedPosts: Post[], userZip: string | null) => {
    console.log('[Feed] prefetching zips for posts:', fetchedPosts.map(p => p.location_zip))
    const allZips = [...new Set([
      ...fetchedPosts.map(p => p.location_zip).filter(Boolean) as string[],
      ...(userZip ? [userZip] : []),
    ])]
    await Promise.all(allZips.map(async zip => {
      const coords = await getZipCoords(zip)
      console.log('[Feed] prefetched zip:', zip, coords)
    }))
    setZipCoordsReady(true)
  }, [])

  // ── Auth init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth?tab=login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, zip_code, avatar_url')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        console.log('[Feed] myProfile:', profile)
        setMyProfile(profile as MyProfile)
        if (profile.zip_code) {
          const coords = await getZipCoords(profile.zip_code)
          setUserCoords(coords)
        }
      }
      setSessionLoading(false)
      setUserId(session.user.id) // set last — batched with above, so fetchPosts fires after myProfile is ready
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/auth?tab=login')
    })
    return () => subscription.unsubscribe()
  }, [router])

  // ── Fetch posts ─────────────────────────────────────────────────────────────

  const fetchPosts = useCallback(async (uid: string, userZip: string | null) => {
    setPostsLoading(true)
    setZipCoordsReady(false)

    // 1. Fetch posts
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (postsError) {
      console.error('[Feed] fetch posts error:', postsError)
      setPostsLoading(false)
      return
    }

    const rawPosts = postsData ?? []

    if (rawPosts.length === 0) {
      setPosts([])
      setPostsLoading(false)
      setZipCoordsReady(true)
      return
    }

    const postIds = rawPosts.map((p: { id: string }) => p.id)
    const authorIds = [...new Set(rawPosts.map((p: { user_id: string }) => p.user_id))]

    // 2. Fetch author profiles
    const { data: authorsData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, vouches, highest_level, status')
      .in('id', authorIds)

    const authorMap: Record<string, AuthorProfile> = {}
    for (const a of authorsData ?? []) authorMap[a.id] = a as AuthorProfile

    // 3. Fetch likes for all posts
    const { data: likesData } = await supabase
      .from('post_likes')
      .select('post_id, user_id')
      .in('post_id', postIds)

    const likeCountMap: Record<string, number> = {}
    const userLikedSet = new Set<string>()
    for (const like of likesData ?? []) {
      likeCountMap[like.post_id] = (likeCountMap[like.post_id] ?? 0) + 1
      if (like.user_id === uid) userLikedSet.add(like.post_id)
    }

    // 4. Fetch comment counts
    const { data: commentsData } = await supabase
      .from('post_comments')
      .select('post_id')
      .in('post_id', postIds)

    const commentCountMap: Record<string, number> = {}
    for (const c of commentsData ?? []) {
      commentCountMap[c.post_id] = (commentCountMap[c.post_id] ?? 0) + 1
    }

    // 5. Combine
    const combined: Post[] = rawPosts.map((p: {
      id: string; user_id: string; content: string; image_url: string | null;
      location_zip: string | null; created_at: string; tag: string | null
    }) => ({
      id: p.id,
      user_id: p.user_id,
      content: p.content,
      image_url: p.image_url ?? null,
      location_zip: p.location_zip ?? null,
      created_at: p.created_at,
      tag: p.tag ?? null,
      author: authorMap[p.user_id] ?? {
        id: p.user_id, first_name: null, last_name: null, avatar_url: null,
        vouches: null, highest_level: null, status: null,
      },
      likeCount: likeCountMap[p.id] ?? 0,
      userLiked: userLikedSet.has(p.id),
      commentCount: commentCountMap[p.id] ?? 0,
    }))

    // 6. Set state, then kick off zip pre-fetch in background
    setPosts(combined)
    setPostsLoading(false)

    prefetchAllZips(combined, userZip) // non-blocking — sets zipCoordsReady when done
  }, [prefetchAllZips])

  useEffect(() => {
    if (userId) fetchPosts(userId, myProfile?.zip_code ?? null)
  }, [userId, fetchPosts])

  // ── Realtime: new posts from other users ────────────────────────────────────

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'posts',
      }, async (payload) => {
        const raw = payload.new as {
          id: string; user_id: string; content: string;
          image_url: string | null; location_zip: string | null; created_at: string; tag: string | null
        }
        // Own posts are prepended optimistically in handlePost
        if (raw.user_id === userId) return

        const { data: authorData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, vouches, highest_level, status')
          .eq('id', raw.user_id)
          .single()

        const newPost: Post = {
          id: raw.id,
          user_id: raw.user_id,
          content: raw.content,
          image_url: raw.image_url,
          location_zip: raw.location_zip,
          created_at: raw.created_at,
          tag: raw.tag ?? null,
          author: (authorData as AuthorProfile) ?? {
            id: raw.user_id, first_name: null, last_name: null, avatar_url: null,
            vouches: null, highest_level: null, status: null,
          },
          likeCount: 0,
          userLiked: false,
          commentCount: 0,
        }
        setPendingPosts(prev => [newPost, ...prev])
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [userId])

  // distanceFilter changes just re-run the useMemo — no re-fetch needed since
  // zipCache is already populated by prefetchAllZips at load time.

  // ── Auto-resize textarea ────────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [postContent])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPostImage(file)
    const reader = new FileReader()
    reader.onloadend = () => setPostImagePreview(reader.result as string)
    reader.readAsDataURL(file)
    // Reset input so selecting the same file again still fires onChange
    e.target.value = ''
  }

  function removeImage() {
    setPostImage(null)
    setPostImagePreview(null)
  }

  async function handlePost() {
    if (!postContent.trim() || !userId || posting) return
    setPosting(true)

    let imageUrl: string | null = null

    if (postImage) {
      const ext = postImage.name.split('.').pop() ?? 'jpg'
      const fileName = `${userId}-${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, postImage, { upsert: false })

      if (uploadError) {
        console.error('[Feed] image upload error:', uploadError)
      } else if (uploadData) {
        const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName)
        imageUrl = publicUrl
      }
    }

    console.log('[Feed] creating post with location_zip:', myProfile?.zip_code)
    const { data: newPostData, error } = await supabase.from('posts').insert({
      user_id: userId,
      content: postContent.trim(),
      image_url: imageUrl,
      location_zip: myProfile?.zip_code ?? null,
      tag: postTag ?? null,
    }).select('*').single()

    if (error) {
      console.error('[Feed] post insert error:', error)
    } else {
      setPostContent('')
      setPostImage(null)
      setPostImagePreview(null)
      setPostTag(null)
      if (newPostData) {
        const optimisticPost: Post = {
          id: newPostData.id,
          user_id: userId,
          content: newPostData.content,
          image_url: newPostData.image_url ?? null,
          location_zip: newPostData.location_zip ?? null,
          created_at: newPostData.created_at,
          tag: newPostData.tag ?? null,
          author: {
            id: userId,
            first_name: myProfile?.first_name ?? null,
            last_name: myProfile?.last_name ?? null,
            avatar_url: myProfile?.avatar_url ?? null,
            vouches: null, highest_level: null, status: null,
          },
          likeCount: 0,
          userLiked: false,
          commentCount: 0,
        }
        setPosts(prev => [optimisticPost, ...prev])
      }
    }

    setPosting(false)
  }

  // ── Filters (distance + tag, client-side) ──────────────────────────────────

  const displayedPosts = useMemo(() => {
    console.log('[Feed] filtering with cache size:', Object.keys(zipCache).length, '| zipCoordsReady:', zipCoordsReady, '| distanceFilter:', distanceFilter, '| userCoords:', userCoords)

    let base = posts

    // Distance filter
    if (distanceFilter !== 'everywhere' && zipCoordsReady && userCoords) {
      if (distanceFilter === 'area') {
        base = base.filter(p => {
          if (!p.location_zip) return true
          const c = zipCache[p.location_zip]
          if (c === undefined || c === null) return true
          const d = getDistance(userCoords.lat, userCoords.lon, c.lat, c.lon)
          console.log('[Feed] post', p.id, '| zip:', p.location_zip, '| distance:', d.toFixed(1), 'mi | limit: 10 mi | pass:', d <= 10)
          return d <= 10
        })
      } else {
        const maxMi = parseInt(distanceFilter)
        base = base.filter(p => {
          if (!p.location_zip) return true
          const c = zipCache[p.location_zip]
          if (c === undefined || c === null) return true
          const d = getDistance(userCoords.lat, userCoords.lon, c.lat, c.lon)
          console.log('[Feed] post', p.id, '| zip:', p.location_zip, '| distance:', d.toFixed(1), 'mi | limit:', maxMi, 'mi | pass:', d <= maxMi)
          return d <= maxMi
        })
      }
    }

    // Tag filter
    if (tagFilter) base = base.filter(p => p.tag === tagFilter)

    return base
  }, [posts, distanceFilter, userCoords, zipCoordsReady, tagFilter])

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <AuthenticatedLayout>
        <div style={{
          minHeight: '100vh', background: '#0d1f3c',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a',
            animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      </AuthenticatedLayout>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AuthenticatedLayout>
      <div style={{ minHeight: '100vh', background: '#0d1f3c', color: '#f5edd6', fontFamily: "'Barlow', sans-serif" }}>

        <Nav />

        {/* ── Main content ── */}
        <main style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 16px 80px' }}>

          {/* Page header */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(36px, 6vw, 56px)',
              letterSpacing: '0.05em', margin: 0, lineHeight: 1,
            }}>
              The <span style={{ color: '#c4822a' }}>Dugout</span>
            </h1>
            <p style={{ marginTop: '6px', fontSize: '15px', color: 'rgba(245,237,214,0.5)', margin: '6px 0 0' }}>
              What's happening in your baseball community
            </p>
          </div>

          {/* Distance filter */}
          <div style={{ marginBottom: userCoords === null && distanceFilter !== 'everywhere' ? '12px' : '24px' }}>
            <select
              value={distanceFilter}
              onChange={e => setDistanceFilter(e.target.value as typeof distanceFilter)}
              style={{
                padding: '8px 32px 8px 12px', borderRadius: '8px',
                border: '1px solid rgba(196,130,42,0.3)',
                background: 'rgba(255,255,255,0.06)', color: '#f5edd6',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: '13px', letterSpacing: '0.06em', outline: 'none', cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(245,237,214,0.4)' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
              }}
            >
              <option value="area" style={{ background: '#0d1f3c' }}>My Area</option>
              <option value="5" style={{ background: '#0d1f3c' }}>Within 5 miles</option>
              <option value="10" style={{ background: '#0d1f3c' }}>Within 10 miles</option>
              <option value="20" style={{ background: '#0d1f3c' }}>Within 20 miles</option>
              <option value="50" style={{ background: '#0d1f3c' }}>Within 50 miles</option>
              <option value="everywhere" style={{ background: '#0d1f3c' }}>Everywhere</option>
            </select>
          </div>

          {/* Location unavailable notice */}
          {userCoords === null && distanceFilter !== 'everywhere' && (
            <p style={{ fontSize: '12px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif", margin: '0 0 24px' }}>
              Location not available — showing all posts
            </p>
          )}

          {/* ── Create post box ── */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,130,42,0.2)',
            borderRadius: '12px', padding: '16px', marginBottom: '24px',
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <Avatar
                url={myProfile?.avatar_url ?? null}
                first={myProfile?.first_name ?? null}
                last={myProfile?.last_name ?? null}
                size={44}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <textarea
                  ref={textareaRef}
                  value={postContent}
                  onChange={e => setPostContent(e.target.value)}
                  placeholder="What's on your mind? Share a baseball thought, highlight, or question..."
                  rows={2}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(245,237,214,0.1)',
                    borderRadius: '8px', color: '#f5edd6',
                    fontSize: '14px', fontFamily: "'Barlow', sans-serif",
                    padding: '10px 12px', resize: 'none', outline: 'none',
                    lineHeight: '1.5', boxSizing: 'border-box',
                    minHeight: '72px', overflow: 'hidden',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(196,130,42,0.45)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(245,237,214,0.1)' }}
                />

                {/* Image preview */}
                {postImagePreview && (
                  <div style={{ position: 'relative', marginTop: '10px', display: 'inline-block', maxWidth: '100%' }}>
                    <img
                      src={postImagePreview}
                      alt="Preview"
                      style={{
                        maxWidth: '100%', maxHeight: '240px', objectFit: 'cover',
                        borderRadius: '8px', display: 'block',
                        border: '1px solid rgba(196,130,42,0.25)',
                      }}
                    />
                    <button
                      onClick={removeImage}
                      aria-label="Remove image"
                      style={{
                        position: 'absolute', top: '6px', right: '6px',
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: 'rgba(0,0,0,0.7)', border: 'none',
                        cursor: 'pointer', color: '#f5edd6', fontSize: '14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Tag selector */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{
                    fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'rgba(245,237,214,0.4)', marginBottom: '8px',
                  }}>
                    Tag Your Post (Optional)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {POST_TAGS.map(t => {
                      const active = postTag === t.value
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setPostTag(active ? null : t.value as PostTagValue)}
                          style={{
                            padding: '4px 10px', borderRadius: '99px', cursor: 'pointer',
                            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                            fontSize: '11px', letterSpacing: '0.04em',
                            border: active ? '1px solid #c4822a' : '1px solid rgba(245,237,214,0.2)',
                            background: active ? '#c4822a' : 'transparent',
                            color: active ? '#0d1f3c' : 'rgba(245,237,214,0.6)',
                            transition: 'all 0.12s',
                          }}
                        >
                          {t.emoji} {t.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: 'none', border: '1px solid rgba(245,237,214,0.12)',
                      borderRadius: '7px', padding: '6px 12px', cursor: 'pointer',
                      color: 'rgba(245,237,214,0.55)', fontSize: '12px',
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget
                      el.style.borderColor = 'rgba(196,130,42,0.45)'
                      el.style.color = '#c4822a'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget
                      el.style.borderColor = 'rgba(245,237,214,0.12)'
                      el.style.color = 'rgba(245,237,214,0.55)'
                    }}
                  >
                    <IconCamera />
                    Photo
                  </button>

                  <button
                    onClick={handlePost}
                    disabled={!postContent.trim() || posting}
                    style={{
                      padding: '7px 22px', borderRadius: '8px', border: 'none',
                      background: postContent.trim() && !posting ? '#c4822a' : 'rgba(196,130,42,0.3)',
                      color: postContent.trim() && !posting ? '#0d1f3c' : 'rgba(13,31,60,0.5)',
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                      fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase',
                      cursor: postContent.trim() && !posting ? 'pointer' : 'not-allowed',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {posting ? 'Posting…' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />

          {/* ── Tag filter bar ── */}
          <div style={{
            display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px',
            marginBottom: '20px', scrollbarWidth: 'none',
          }}>
            {([{ value: null, emoji: '', label: 'All' }, ...POST_TAGS] as Array<{ value: string | null; emoji: string; label: string }>).map(t => {
              const active = tagFilter === t.value
              return (
                <button
                  key={t.value ?? 'all'}
                  onClick={() => setTagFilter(t.value as PostTagValue | null)}
                  style={{
                    flexShrink: 0, padding: '6px 14px', borderRadius: '99px', cursor: 'pointer',
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    fontSize: '12px', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                    border: active ? 'none' : '1px solid rgba(245,237,214,0.2)',
                    background: active ? '#c4822a' : 'transparent',
                    color: active ? '#0d1f3c' : 'rgba(245,237,214,0.6)',
                    transition: 'all 0.12s',
                  }}
                >
                  {t.emoji ? `${t.emoji} ${t.label}` : t.label}
                </button>
              )
            })}
          </div>

          {/* ── New posts banner ── */}
          {pendingPosts.length > 0 && (
            <button
              onClick={() => {
                setPosts(prev => [...pendingPosts, ...prev])
                setPendingPosts([])
              }}
              style={{
                width: '100%', marginBottom: '16px', padding: '10px 16px',
                background: 'rgba(196,130,42,0.12)', border: '1px solid rgba(196,130,42,0.4)',
                borderRadius: '8px', cursor: 'pointer', color: '#c4822a',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: '13px', letterSpacing: '0.05em', textAlign: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,130,42,0.2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,130,42,0.12)' }}
            >
              ↑ {pendingPosts.length} new post{pendingPosts.length === 1 ? '' : 's'} — click to load
            </button>
          )}

          {/* ── Feed ── */}
          {postsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '3px solid rgba(196,130,42,0.2)', borderTopColor: '#c4822a',
                animation: 'spin 0.7s linear infinite',
              }} />
            </div>
          ) : !zipCoordsReady && distanceFilter !== 'everywhere' ? (
            <p style={{ fontSize: '13px', color: 'rgba(245,237,214,0.35)', fontFamily: "'Barlow', sans-serif", textAlign: 'center', padding: '48px 0' }}>
              Loading nearby posts…
            </p>
          ) : displayedPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '52px', marginBottom: '16px' }}>⚾</div>
              <h2 style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px',
                letterSpacing: '0.05em', color: '#f5edd6', margin: '0 0 8px',
              }}>
                No Posts Yet
              </h2>
              <p style={{ color: 'rgba(245,237,214,0.45)', fontSize: '15px', margin: 0 }}>
                {tagFilter
                  ? 'No posts with this tag yet — try a different filter or be the first!'
                  : distanceFilter === 'everywhere'
                  ? 'Be the first — share a baseball thought!'
                  : distanceFilter === 'area'
                  ? 'No posts in your area yet — try a wider distance or be the first!'
                  : `No posts within ${distanceFilter} miles — try a wider distance or Everywhere.`}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {displayedPosts.map(post => {
                const postCoords = post.location_zip ? zipCache[post.location_zip] ?? null : null
                const distanceMi = userCoords && postCoords
                  ? getDistance(userCoords.lat, userCoords.lon, postCoords.lat, postCoords.lon)
                  : null
                return (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={userId!}
                    currentUserProfile={myProfile}
                    distanceMi={distanceMi}
                  />
                )
              })}
            </div>
          )}

        </main>
      </div>
    </AuthenticatedLayout>
  )
}
