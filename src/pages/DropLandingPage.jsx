import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNow } from '../components/drop/useCountdown'
import { useDropSurface } from '../components/drop/useDropSurface'
import { isAccepting, useHackathonCatalog } from '../components/drop/useHackathonCatalog'
import { useTheme } from '../theme/useTheme'
import { formatDate } from '../utils/format'
import { BrandLockup } from '../components/brand/BrandMark'
import { GhostMark, HeroScene } from './landing/LandingArt'
import './landing/challazo-home.css'

const PITCH =
  "Find a hackathon, submit your build, and find out what's wrong with it before the deadline — not after."

/** The board is a teaser; the rest live behind "See all hackathons". */
const PREVIEW_LIMIT = 6
const THEME_LIMIT = 2

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'closing_soon', label: 'Closing soon' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'closed', label: 'Closed' },
  { id: 'solo', label: 'Solo' },
  { id: 'team', label: 'Team' },
]

const matchesFilter = (filter, hackathon) => {
  switch (filter) {
    // "Open" is the practical question — can I still enter — so it covers the
    // closing-soon window too.
    case 'open':
      return isAccepting(hackathon)
    case 'closing_soon':
    case 'upcoming':
    case 'closed':
      return hackathon.status === filter
    case 'solo':
      return hackathon.team_mode === 'solo' || hackathon.max_team_size === 1
    case 'team':
      return hackathon.team_mode === 'team' || hackathon.max_team_size > 1
    default:
      return true
  }
}

const DRAFT = [
  { heading: true, text: '# Problem' },
  { text: '' },
  {
    text: "Hackathon teams waste a lot of time on things that aren't building. It's a big problem and it affects everyone.",
  },
  { text: '' },
  { heading: true, text: '# Solution' },
  { text: '' },
  {
    text: 'One dashboard that pulls your repo, deploys and issue tracker into a single view, so you can see project health without switching tabs.',
    caret: true,
  },
]

const CHECKS = [
  { kind: 'bad', icon: '✕', text: 'Demo video missing' },
  { kind: 'warn', icon: '!', text: "Your problem statement doesn't say who has this problem" },
  { kind: 'warn', icon: '!', text: "MVP link isn't public — we couldn't open it" },
  { kind: 'good', icon: '✓', text: 'Solution description looks solid' },
]

const STEPS = [
  { num: '01', title: 'Find it', body: "Browse live hackathons. Filter by team size, prize, or how long you've got." },
  {
    num: '02',
    title: 'Check it',
    body: "Run the readiness check as many times as you want before you submit. It tells you exactly what's missing.",
  },
  {
    num: '03',
    title: 'Learn from it',
    body: 'Score, rubric breakdown, and written feedback on every submission. No exceptions.',
  },
]

const FOOTER_COLUMNS = [
  {
    title: 'Hackathons',
    links: [
      { label: 'Browse all', to: '/hackathons' },
      { label: 'Closing soon', href: '#live' },
      { label: 'Upcoming', href: '#live' },
      { label: 'Past results', href: '#live' },
    ],
  },
  {
    title: 'Build',
    links: [
      { label: 'Readiness check', href: '#check', isNew: true },
      { label: 'Submission guide', href: '#check' },
      { label: 'Rubrics explained', href: '#check' },
      { label: 'Changelog', href: '#check' },
    ],
  },
  {
    title: 'Organizers',
    links: [
      { label: 'List a hackathon', to: '/register' },
      { label: 'Evaluator tools', to: '/register/evaluator' },
      { label: 'Scoring & feedback', href: '#how' },
      { label: 'Pricing', href: '#join' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#top' },
      { label: 'Blog', href: '#top' },
      { label: 'Support', href: '#top' },
      { label: 'Contact', href: '#top' },
    ],
  },
]

const SOCIALS = ['GitHub', 'X', 'LinkedIn', 'Discord']

const SECOND = 1000
const HOUR = 3600 * SECOND
const DAY = 24 * HOUR

/** Fallback for the readiness demo when nothing is open: 10h 20m from load. */
const DEMO_DEADLINE = Date.now() + (10 * 60 + 20) * 60 * SECOND

const pad = (n) => String(n).padStart(2, '0')
const plural = (n, word) => `${word}${n === 1 ? '' : 's'}`

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const inWords = (n) => NUMBER_WORDS[n] ?? String(n)
const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1)

/** Catalog dates are calendar days in IST; a bare date ends at 23:59:59 there. */
function toInstant(value, endOfDay) {
  if (!value) return null
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return Date.parse(`${text}T${endOfDay ? '23:59:59' : '00:00:00'}+05:30`)
  }
  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? null : parsed
}

function splitDuration(ms) {
  return {
    d: Math.floor(ms / DAY),
    h: Math.floor((ms % DAY) / HOUR),
    m: Math.floor((ms % HOUR) / 60000),
    s: Math.floor((ms % 60000) / SECOND),
  }
}

/** "Ends in 3d 04h 12m", or a ticking "Ends in 04:12:09" inside the last day. */
function countdownLabel(prefix, ms) {
  const { d, h, m, s } = splitDuration(ms)
  return d > 0 ? `${prefix} ${d}d ${pad(h)}h ${pad(m)}m` : `${prefix} ${pad(h)}:${pad(m)}:${pad(s)}`
}

/** The clock is live, so the reassurance has to earn itself as time runs out. */
function reassurance(ms) {
  if (ms <= 0) return 'Deadline passed.'
  if (ms > 6 * HOUR) return 'Plenty of time.'
  if (ms > HOUR) return 'Still fixable.'
  return 'Cutting it close.'
}

/** Soonest deadline among hackathons still taking entries. */
function nextDeadline(hackathons) {
  const ends = hackathons
    .filter(isAccepting)
    .map((hackathon) => toInstant(hackathon.end_date, true))
    .filter((value) => value && value > Date.now())
  return ends.length ? Math.min(...ends) : null
}

/* ------------------------------------------------------------------------ */
/*  Page-wide behaviour: fonts, reveal-on-scroll, scroll chrome, pointer    */
/* ------------------------------------------------------------------------ */

function useLandingChrome(rootRef, { progRef, headerRef, barRef, bigRef }) {
  // Reveal on scroll. Only elements whose className never changes carry
  // `hz-rv`, so React never wipes the `is-in` added here.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const selector = '.hz-rv:not(.is-in), .hz-fcol:not(.is-in), .hz-rail:not(.is-in)'
    const revealAll = () => root.querySelectorAll(selector).forEach((node) => node.classList.add('is-in'))

    if (!('IntersectionObserver' in window)) {
      revealAll()
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
    )
    root.querySelectorAll(selector).forEach((node) => observer.observe(node))
    // Nothing should stay invisible if an observer never fires.
    const fallback = setTimeout(revealAll, 3000)
    return () => {
      observer.disconnect()
      clearTimeout(fallback)
    }
  }, [rootRef])

  // Progress bar, header border, back-to-top ring.
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0
      if (progRef.current) progRef.current.style.width = `${progress * 100}%`
      headerRef.current?.classList.toggle('is-stuck', window.scrollY > 10)
      if (barRef.current) barRef.current.style.strokeDashoffset = (132 - 132 * progress).toFixed(1)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [progRef, headerRef, barRef])

  // Smooth in-page anchors, card tilt, magnetic buttons, footer wordmark drift.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(pointer: fine)').matches

    const onClick = (event) => {
      const anchor = event.target.closest?.('a[href^="#"]')
      if (!anchor) return
      const target = document.querySelector(anchor.getAttribute('href'))
      if (!target) return
      event.preventDefault()
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    }
    root.addEventListener('click', onClick)

    let active = null
    const release = () => {
      if (active) active.style.transform = ''
      active = null
    }
    const onMove = (event) => {
      const el = event.target.closest?.('.hz-card, .hz-magnet')
      if (el !== active) release()
      if (bigRef.current) {
        const shift = ((event.clientX / window.innerWidth - 0.5) * 34).toFixed(1)
        bigRef.current.style.transform = `translate3d(${shift}px,0,0)`
      }
      if (!el) return
      active = el
      const r = el.getBoundingClientRect()
      if (el.classList.contains('hz-card')) {
        const rx = (((event.clientY - r.top) / r.height - 0.5) * -2.4).toFixed(2)
        const ry = (((event.clientX - r.left) / r.width - 0.5) * 2.4).toFixed(2)
        el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`
      } else {
        const x = ((event.clientX - r.left - r.width / 2) * 0.14).toFixed(1)
        const y = ((event.clientY - r.top - r.height / 2) * 0.2).toFixed(1)
        el.style.transform = `translate(${x}px,${y}px)`
      }
    }
    const pointerFx = fine && !reduce
    if (pointerFx) {
      root.addEventListener('pointermove', onMove, { passive: true })
      root.addEventListener('pointerleave', release)
    }
    return () => {
      root.removeEventListener('click', onClick)
      if (pointerFx) {
        root.removeEventListener('pointermove', onMove)
        root.removeEventListener('pointerleave', release)
      }
    }
  }, [rootRef, bigRef])
}

/* ------------------------------------------------------------------------ */
/*  Header                                                                  */
/* ------------------------------------------------------------------------ */

function ThemeButton() {
  const { isDark, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      className="hz-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}

/* ------------------------------------------------------------------------ */
/*  Hero                                                                    */
/* ------------------------------------------------------------------------ */

const HERO_WORDS = ['Build.', 'Ship.', 'Drop.']

/** Types and erases Build. / Ship. / Drop. by writing the DOM directly, so the 60fps loop never re-renders. */
function TypedLine() {
  const typedRef = useRef(null)
  const cursorRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const TYPE = 58
    const ERASE = 36
    const HOLD = 1050
    const GAP = 260
    let wordIndex = 0
    let charIndex = HERO_WORDS[0].length
    let phase = 'hold'
    let last = 0
    let wait = 950
    let frame = 0

    const tick = (ts) => {
      if (!last) last = ts
      if (ts - last >= wait) {
        last = ts
        const word = HERO_WORDS[wordIndex]
        if (phase === 'type') {
          charIndex += 1
          if (charIndex >= word.length) {
            phase = 'hold'
            wait = HOLD
          } else wait = TYPE
        } else if (phase === 'hold') {
          phase = 'erase'
          wait = ERASE
        } else {
          charIndex -= 1
          if (charIndex <= 0) {
            wordIndex = (wordIndex + 1) % HERO_WORDS.length
            phase = 'type'
            wait = GAP
          } else wait = ERASE
        }
        if (typedRef.current) typedRef.current.textContent = HERO_WORDS[wordIndex].slice(0, charIndex)
        cursorRef.current?.classList.toggle('is-busy', phase !== 'hold')
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <span className="hz-typeline" aria-hidden="true">
      <span ref={typedRef}>Build.</span>
      <span ref={cursorRef} className="hz-cursor" />
    </span>
  )
}

/** Held back until the catalog lands: a number on a landing page is a claim. */
function LiveBadge({ count, loading }) {
  if (loading || !count) {
    return (
      <span className="hz-badge is-muted">
        <span className="hz-dot" />
        {loading ? 'Checking what’s live…' : 'No hackathons open right now'}
      </span>
    )
  }
  return (
    <span className="hz-badge">
      <span className="hz-dot" />
      {count} {plural(count, 'hackathon')} live right now
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/*  Live listings                                                           */
/* ------------------------------------------------------------------------ */

function HackathonCard({ hackathon, index, now }) {
  const [bannerBroken, setBannerBroken] = useState(false)
  const accepting = isAccepting(hackathon)
  const start = toInstant(hackathon.start_date, false)
  const end = toInstant(hackathon.end_date, true)
  const from = formatDate(hackathon.start_date)
  const to = formatDate(hackathon.end_date)
  const roundTitle = hackathon.featured_round?.title
  const themes = hackathon.themes || []
  const extraThemes = Math.max(0, themes.length - THEME_LIMIT)
  const teamSize = hackathon.featured_round?.team_mode_label || hackathon.team_mode_label || 'Not set'

  let endsText = '—'
  if (hackathon.status === 'closed' || (end && end <= now)) endsText = `Closed ${to}`
  else if (hackathon.status === 'upcoming' && start && start > now) endsText = countdownLabel('Starts in', start - now)
  else if (end) endsText = countdownLabel('Ends in', end - now)

  const progress =
    start && end && end > start ? Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100)) : 0

  const flags = [
    hackathon.status_label && { label: hackathon.status_label, soon: hackathon.status === 'closing_soon' },
    hackathon.team_mode_label && { label: hackathon.team_mode_label },
  ].filter(Boolean)

  return (
    <Link
      to={`/hackathons/${hackathon.id}`}
      className={`hz-card${accepting ? ' is-open' : ''}`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className={`hz-banner hz-v${(index % 3) + 1}`}>
        {hackathon.banner_url && !bannerBroken ? (
          // Banners are signed URLs; a stale one falls back to the generated art.
          <img src={hackathon.banner_url} alt="" loading="lazy" onError={() => setBannerBroken(true)} />
        ) : (
          <>
            <div className="hz-mesh" />
            <GhostMark />
            <span className="hz-btitle">{roundTitle || hackathon.name}</span>
          </>
        )}
        <span className="hz-shine" />
        <span className="hz-flags">
          {flags.map((flag) => (
            <span key={flag.label} className={`hz-flag${flag.soon ? ' is-soon' : ''}`}>
              {flag.label}
            </span>
          ))}
        </span>
      </div>

      <div className="hz-cbody">
        <h3>{hackathon.name}</h3>
        {roundTitle && <p className="hz-round">{roundTitle}</p>}
        <p className="hz-dates">
          <b>{from}</b>
          <em>–</em>
          <b>{to}</b>
        </p>
        <p className={`hz-ends${accepting ? ' is-hot' : ''}`}>{endsText}</p>
        <div className="hz-kvs">
          <div className="hz-kv">
            <div className="hz-k">Team size</div>
            <div className="hz-v">{teamSize}</div>
          </div>
          <div className="hz-kv">
            <div className="hz-k">Top prize</div>
            <div className="hz-v">{hackathon.prizes?.winner || 'TBA'}</div>
          </div>
        </div>
        {themes.length > 0 && (
          <div className="hz-tags">
            {themes.slice(0, THEME_LIMIT).map((theme) => (
              <span key={theme.id ?? theme.name} className="hz-tag">
                {theme.name}
              </span>
            ))}
            {extraThemes > 0 && <span className="hz-tag">+{extraThemes}</span>}
          </div>
        )}
        <div className="hz-cfoot">
          <span className="hz-enter">
            {accepting ? 'Submit a build' : hackathon.status === 'closed' ? 'See results' : 'View details'}{' '}
            <span className="hz-arr">→</span>
          </span>
          <span className="hz-cmeter">
            <i style={{ width: `${progress.toFixed(1)}%` }} />
          </span>
        </div>
      </div>
    </Link>
  )
}

function boardHeading(total, live, loading) {
  if (loading) return 'Checking the clocks…'
  if (!total) return 'No clocks running yet.'
  const clocks = `${capitalise(inWords(total))} ${plural(total, 'clock')}`
  if (!live) return `${clocks}, none still running.`
  if (total === 1) return 'One clock, still running.'
  return `${clocks}, ${inWords(live)} still running.`
}

function LiveListings({ hackathons, liveCount, loading, error, onRetry }) {
  const [filter, setFilter] = useState('all')
  // One shared clock for every card's countdown and meter.
  const now = useNow()

  const filtered = hackathons.filter((hackathon) => matchesFilter(filter, hackathon))
  const visible = filtered.slice(0, PREVIEW_LIMIT)
  const disabled = loading || Boolean(error)

  return (
    <section id="live" aria-labelledby="hz-live-title">
      <div className="hz-wrap">
        <div className="hz-sechead">
          <div style={{ minWidth: 0 }}>
            <p className="hz-eyebrow hz-rv" style={{ maxWidth: 340 }}>
              {liveCount || loading ? 'Live right now' : 'Hackathons on Challazo'}
            </p>
            <h2 id="hz-live-title" className="hz-rv">
              {boardHeading(hackathons.length, liveCount, loading)}
            </h2>
          </div>
          <span className="hz-count hz-rv" aria-live="polite">
            {loading || error ? '' : `${visible.length} of ${hackathons.length}`}
          </span>
        </div>

        <div className="hz-chips hz-rv" role="group" aria-label="Filter hackathons">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="hz-chip"
              aria-pressed={filter === option.id}
              disabled={disabled}
              onClick={() => setFilter(option.id)}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        <div className="hz-cards">
          {loading ? (
            [0, 1, 2].map((key) => <div key={key} className="hz-card is-skeleton" aria-hidden="true" />)
          ) : error ? (
            <div className="hz-empty">
              <b>We couldn&rsquo;t load the hackathon board.</b>
              {error.message}
              {onRetry && (
                <div style={{ marginTop: 20 }}>
                  <button type="button" className="hz-btn hz-btn-ghost" onClick={onRetry}>
                    Try again
                  </button>
                </div>
              )}
            </div>
          ) : visible.length ? (
            visible.map((hackathon, index) => (
              <HackathonCard key={hackathon.id} hackathon={hackathon} index={index} now={now} />
            ))
          ) : (
            <div className="hz-empty">
              <b>Nothing here yet</b>
              {hackathons.length
                ? 'Nothing matches this filter right now. Try another, or turn on deadline alerts in the footer.'
                : 'New hackathons go up every week — turn on deadline alerts in the footer and we’ll tell you.'}
            </div>
          )}
        </div>

        <Link className="hz-seeall" to="/hackathons">
          See all hackathons <span className="hz-arr">→</span>
        </Link>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------------ */
/*  Statement                                                               */
/* ------------------------------------------------------------------------ */

const CYCLE_WORDS = ['Score', 'Rank', 'Nothing']

function WordCycle() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    let swap = 0
    const timer = setInterval(() => {
      setVisible(false)
      swap = setTimeout(() => {
        setIndex((value) => (value + 1) % CYCLE_WORDS.length)
        setVisible(true)
      }, 300)
    }, 2600)
    return () => {
      clearInterval(timer)
      clearTimeout(swap)
    }
  }, [])

  return (
    <span className="hz-wordcycle" style={{ opacity: visible ? 1 : 0 }}>
      {CYCLE_WORDS[index]}
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/*  Readiness check                                                         */
/* ------------------------------------------------------------------------ */

function ReadinessClock({ deadline }) {
  const now = useNow()
  const ms = Math.max(0, deadline - now)
  const { d, h, m } = splitDuration(ms)
  return (
    <h3>
      {d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`} left. {reassurance(ms)}
    </h3>
  )
}

function ReadinessDemo({ deadline }) {
  const [shown, setShown] = useState(0)
  const [running, setRunning] = useState(false)
  const [runId, setRunId] = useState(0)
  const itemsRef = useRef(null)

  // Each run reveals the checks one by one under a scan line.
  useEffect(() => {
    if (!runId) return undefined
    const timers = CHECKS.map((_, index) => setTimeout(() => setShown(index + 1), 520 + index * 560))
    timers.push(setTimeout(() => setRunning(false), 520 + CHECKS.length * 560))
    return () => timers.forEach(clearTimeout)
  }, [runId])

  const run = () => {
    setShown(0)
    setRunning(true)
    setRunId((value) => value + 1)
  }

  // First run starts when the panel scrolls into view.
  useEffect(() => {
    const node = itemsRef.current
    if (!node || !('IntersectionObserver' in window)) {
      run()
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          run()
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const count = (kind) => CHECKS.filter((check) => check.kind === kind).length
  const blockers = count('bad')
  const warnings = count('warn')
  const passed = count('good')

  return (
    <div className="hz-demo">
      <div className="hz-panel hz-rv">
        <div className="hz-pbar">
          <span>submission.md</span>
          <span className="hz-draft">DRAFT</span>
        </div>
        <div className="hz-code">
          {DRAFT.map((line, index) => (
            <div key={index} className="hz-ln">
              <span className="hz-n">{index + 1}</span>
              <span className={line.heading ? 'hz-h' : undefined}>
                {line.text}
                {line.caret && <span className="hz-caret" />}
              </span>
            </div>
          ))}
        </div>
        <div className="hz-meta">
          <span>MVP link</span>
          <span>drop-mvp-a91.vercel.app</span>
        </div>
        <div className="hz-meta">
          <span>Demo video</span>
          <span className="hz-missing">not added</span>
        </div>
      </div>

      <div className="hz-panel hz-rv" style={{ transitionDelay: '.09s' }}>
        <div className="hz-rhead">
          <ReadinessClock deadline={deadline} />
          <p className="hz-tally" aria-live="polite">
            {running ? (
              <b>Running the check…</b>
            ) : (
              <>
                <b>
                  {blockers} {plural(blockers, 'blocker')}
                </b>{' '}
                · {warnings} {plural(warnings, 'warning')} · {passed} passed
              </>
            )}
          </p>
        </div>
        <div className="hz-items" ref={itemsRef} role="list">
          <span key={runId} className={`hz-scan${running ? ' is-run' : ''}`} aria-hidden="true" />
          {CHECKS.map((check, index) => (
            <div
              key={check.text}
              role="listitem"
              className={`hz-item${index < shown ? ` is-shown is-${check.kind}` : ''}`}
            >
              <span className="hz-ic" aria-hidden="true">
                {check.icon}
              </span>
              <span>{check.text}</span>
            </div>
          ))}
        </div>
        <div className="hz-rfoot">
          <span>Fix something, run it again. There&rsquo;s no limit before the deadline.</span>
          <button type="button" className={`hz-rerun${running ? ' is-busy' : ''}`} onClick={run}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.3 5.7" />
              <path d="M20 4v7h-7" />
            </svg>
            Run again
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/*  How it works                                                            */
/* ------------------------------------------------------------------------ */

/** Counts up once it scrolls into view, and again if the catalog changes the number. */
function CountUp({ value, suffix = '' }) {
  const ref = useRef(null)
  const fromRef = useRef(0)
  const [seen, setSeen] = useState(false)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node || !('IntersectionObserver' in window)) {
      setSeen(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true)
          observer.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!seen) return undefined
    const from = fromRef.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let start = 0
    const step = (ts) => {
      if (!start) start = ts
      const k = reduce ? 1 : Math.min(1, (ts - start) / 1200)
      const eased = 1 - Math.pow(1 - k, 3)
      const next = Math.round(from + (value - from) * eased)
      fromRef.current = next
      setDisplay(next)
      if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [seen, value])

  return (
    <b ref={ref}>
      {display}
      {suffix}
    </b>
  )
}

/* ------------------------------------------------------------------------ */
/*  Footer                                                                  */
/* ------------------------------------------------------------------------ */

const TIMEZONE_LABEL = (() => {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    return zone.split('/').pop().replace('_', ' ') || 'IST'
  } catch {
    return 'IST'
  }
})()

function LocalTime() {
  const now = new Date(useNow())
  return (
    <span className="hz-ftime">
      {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())} {TIMEZONE_LABEL}
    </span>
  )
}

function NextDeadline({ deadline }) {
  const now = useNow()
  if (!deadline) {
    return (
      <div className="hz-next">
        <span>Next deadline</span>
        <span>none open</span>
      </div>
    )
  }
  const { d, h, m, s } = splitDuration(Math.max(0, deadline - now))
  return (
    <div className="hz-next">
      <span>Next deadline</span>
      <span>
        closes in{' '}
        <b>
          {pad(d * 24 + h)}:{pad(m)}:{pad(s)}
        </b>
      </span>
    </div>
  )
}

function AlertsForm() {
  const [email, setEmail] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [done, setDone] = useState(false)

  const submit = (event) => {
    event.preventDefault()
    const value = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setInvalid(true)
      setTimeout(() => setInvalid(false), 1600)
      return
    }
    // TODO: send to a deadline-alerts endpoint once one exists. Nothing is stored yet.
    setDone(true)
  }

  if (done) {
    return (
      <div className="hz-done" role="status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12.5 L9.5 18 L20 6.5" />
        </svg>
        <span>
          You&rsquo;re on the list. Check <b>{email.trim()}</b>.
        </span>
      </div>
    )
  }

  return (
    <form className="hz-field" onSubmit={submit} noValidate>
      <label htmlFor="hz-alert-email" className="hz-sr">
        Email address
      </label>
      <input
        id="hz-alert-email"
        type="email"
        placeholder="you@college.edu"
        autoComplete="email"
        required
        value={email}
        className={invalid ? 'is-invalid' : undefined}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button className="hz-btn hz-btn-primary" type="submit">
        Notify me
      </button>
    </form>
  )
}

function FooterLink({ link }) {
  const content = (
    <>
      {link.label} {link.isNew ? <span className="hz-tagnew">new</span> : <span className="hz-mini">→</span>}
    </>
  )
  return link.to ? (
    <Link className="hz-flink" to={link.to}>
      {content}
    </Link>
  ) : (
    <a className="hz-flink" href={link.href}>
      {content}
    </a>
  )
}

/* ------------------------------------------------------------------------ */
/*  Page                                                                    */
/* ------------------------------------------------------------------------ */

export default function DropLandingPage() {
  useDropSurface({ title: 'Challazo — Build. Ship. Drop.', description: PITCH })

  // One catalog poll for the whole page: badge, board, numbers and footer all
  // read the same data.
  const { hackathons, liveCount, themeCount, loading, error, refresh } = useHackathonCatalog()

  const rootRef = useRef(null)
  const progRef = useRef(null)
  const headerRef = useRef(null)
  const barRef = useRef(null)
  const bigRef = useRef(null)
  useLandingChrome(rootRef, { progRef, headerRef, barRef, bigRef })

  const deadline = nextDeadline(hackathons)
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div className="chz" ref={rootRef}>
      <a href="#main" className="hz-skip">
        Skip to content
      </a>
      <div className="hz-prog" ref={progRef} />

      <header className="hz-header" id="top" ref={headerRef}>
        <div className="hz-wrap hz-nav">
          <a className="hz-lockup" href="#top" aria-label="Challazo home">
            <BrandLockup variant="arrow" size={30} fontSize={21} />
          </a>
          <nav className="hz-navlinks" aria-label="Primary">
            <a href="#live">Hackathons</a>
            <a href="#how" className="hz-hide-sm">
              How it works
            </a>
            <Link to="/login">Sign in</Link>
            <ThemeButton />
          </nav>
        </div>
      </header>

      <main id="main">
        {/* ------------------------------ Hero ------------------------------ */}
        <section className="hz-hero" aria-labelledby="hz-hero-title">
          <div className="hz-wrap hz-hero-grid">
            <div>
              <LiveBadge count={liveCount} loading={loading} />
              <h1 id="hz-hero-title">
                <span className="hz-sr">Build. Ship. Drop. Challazo</span>
                <TypedLine />
                <span className="hz-brandline" aria-hidden="true">
                  <span className="hz-hl">Challazo</span>
                </span>
              </h1>
              <p className="hz-lede">{PITCH}</p>
              <div className="hz-cta-row">
                <a className="hz-btn hz-btn-primary hz-magnet" href="#live">
                  Browse hackathons <span className="hz-arr">→</span>
                </a>
                <a className="hz-btn hz-btn-ghost hz-magnet" href="#how">
                  How it works
                </a>
              </div>
            </div>
            <HeroScene />
          </div>
        </section>

        <LiveListings
          hackathons={hackathons}
          liveCount={liveCount}
          loading={loading}
          error={error}
          onRetry={refresh}
        />

        {/* ---------------------------- Statement ---------------------------- */}
        <section className="hz-statement" aria-labelledby="hz-statement-title">
          <div className="hz-wrap">
            <h2 id="hz-statement-title">Ever lost and never found out why?</h2>
            <p>
              Form in. {reduceMotion ? <span className="hz-wordcycle">Score</span> : <WordCycle />} out.
              Silence. That&rsquo;s how most hackathons end.
            </p>
          </div>
        </section>

        {/* ------------------------- Readiness check ------------------------- */}
        <section id="check" aria-labelledby="hz-check-title">
          <div className="hz-wrap">
            <p className="hz-eyebrow hz-rv">Readiness check</p>
            <h2 id="hz-check-title" className="hz-rv">
              Find out before the deadline, not after.
            </h2>
            <p className="hz-sub hz-rv">
              Run it any time before you submit. It reads your entry the way an evaluator will, and
              tells you what&rsquo;s weak while you can still do something about it.
            </p>
            <ReadinessDemo deadline={deadline || DEMO_DEADLINE} />
          </div>
        </section>

        {/* --------------------------- How it works --------------------------- */}
        <section id="how" aria-labelledby="hz-how-title">
          <div className="hz-wrap">
            <p className="hz-eyebrow hz-rv">How it works</p>
            <h2 id="hz-how-title" className="hz-rv">
              Three steps. The useful one happens before you submit.
            </h2>
            <div className="hz-steps">
              <div className="hz-rail">
                <i />
              </div>
              {STEPS.map((step, index) => (
                <div
                  key={step.num}
                  className="hz-step hz-rv"
                  style={{ transitionDelay: `${index * 0.08}s` }}
                >
                  <div className="hz-num">{step.num}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>

            <div className="hz-stats">
              <div className="hz-stat hz-rv">
                <CountUp value={liveCount} />
                <span>live {plural(liveCount, 'hackathon')}</span>
              </div>
              <div className="hz-stat hz-rv" style={{ transitionDelay: '.07s' }}>
                <CountUp value={themeCount} />
                <span>{plural(themeCount, 'theme')} to build on</span>
              </div>
              <div className="hz-stat hz-rv" style={{ transitionDelay: '.14s' }}>
                <CountUp value={100} suffix="%" />
                <span>of entries get feedback</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------- Organizers ---------------------------- */}
        <section className="hz-org" aria-labelledby="hz-org-title">
          <div className="hz-wrap hz-org-grid">
            <div className="hz-rv">
              <h2 id="hz-org-title">Running a hackathon?</h2>
              <p>
                List it on Challazo. Set your rubric, assign evaluators, and let the platform handle
                submissions, scoring, and feedback delivery.
              </p>
            </div>
            <div className="hz-rv" style={{ transitionDelay: '.08s' }}>
              <div className="hz-orglist">
                <div className="hz-orgrow">
                  <i>✓</i>Your rubric, your weights, your rounds
                </div>
                <div className="hz-orgrow">
                  <i>✓</i>Evaluators score in one queue, not a spreadsheet
                </div>
                <div className="hz-orgrow">
                  <i>✓</i>Feedback goes out to every team automatically
                </div>
              </div>
              <Link className="hz-btn hz-btn-light hz-magnet" to="/register">
                List a hackathon <span className="hz-arr">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ------------------------------- CTA -------------------------------- */}
        <section className="hz-cta" id="join" aria-labelledby="hz-cta-title">
          <div className="hz-wrap">
            <h2 id="hz-cta-title">Something&rsquo;s always closing soon.</h2>
            <p>Free for builders. Drop your first entry in under five minutes.</p>
            <div className="hz-cta-row is-static">
              <Link className="hz-btn hz-btn-dark hz-magnet" to="/register">
                Create your account <span className="hz-arr">→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------- Footer ------------------------------- */}
      <footer className="hz-footer">
        <div className="hz-hairline" />
        <div className="hz-wrap">
          <div className="hz-ftop">
            <div className="hz-rv">
              <div className="hz-fbrandline">
                <BrandLockup variant="arrow" size={36} fontSize={26} onDark />
              </div>
              <p className="hz-ftag">{PITCH}</p>
              <span className="hz-pill">
                <span className="hz-pdot" />
                <b>{liveCount}</b> {plural(liveCount, 'hackathon')} live · <b>{themeCount}</b>{' '}
                {plural(themeCount, 'theme')} open
              </span>
            </div>

            <div className="hz-alerts hz-rv" style={{ transitionDelay: '.1s' }}>
              <h3>Deadline alerts</h3>
              <p>One email when a hackathon you follow is 24 hours from closing. Nothing else.</p>
              <AlertsForm />
              <NextDeadline deadline={deadline} />
            </div>
          </div>

          <div className="hz-fcols">
            {FOOTER_COLUMNS.map((column, index) => (
              <div
                key={column.title}
                className="hz-fcol hz-rv"
                style={{ transitionDelay: `${index * 0.07}s` }}
              >
                <h4>{column.title}</h4>
                <ul>
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <FooterLink link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="hz-socials hz-rv">
            {SOCIALS.map((name) => (
              <a key={name} className="hz-soc" href="#top">
                <span>{name} ↗</span>
              </a>
            ))}
          </div>
        </div>

        <div className="hz-bigwrap" aria-hidden="true">
          <div className="hz-bigmark" ref={bigRef}>
            CHALLAZO
          </div>
        </div>

        <div className="hz-wrap">
          <div className="hz-fbot">
            <div className="hz-set">
              <span>© {new Date().getFullYear()} Challazo</span>
              <span>Hyderabad, India</span>
              <LocalTime />
            </div>
            <div className="hz-set">
              <a href="#top">Guidelines</a>
              <a href="#top">Privacy</a>
              <a href="#top">Terms</a>
              <button
                type="button"
                className="hz-totop"
                aria-label="Back to top"
                onClick={() =>
                  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
                }
              >
                <svg className="hz-ring2" viewBox="0 0 46 46" fill="none" aria-hidden="true">
                  <circle className="hz-trk" cx="23" cy="23" r="21" strokeWidth="1.5" />
                  <circle ref={barRef} className="hz-bar" cx="23" cy="23" r="21" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <svg className="hz-up" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 19V5" />
                  <path d="M5.5 11.5 L12 5 L18.5 11.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
