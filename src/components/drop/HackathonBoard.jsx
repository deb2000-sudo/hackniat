import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconArrow, IconUsers } from './icons'
import { DAY, describeRemaining, formatRemaining, useNow } from './useCountdown'

/**
 * Deadlines are anchored once, at module load, to a fixed offset from now.
 * A landing page with hard-coded dates is a landing page that quietly rots —
 * this way every countdown is always plausible and always genuinely counting.
 */
const ANCHOR = Date.now()
const away = (days, hours, mins) => ANCHOR + ((days * 24 + hours) * 60 + mins) * 60 * 1000

const HACKATHONS = [
  {
    id: 'ship-in-48',
    name: 'Ship in 48',
    org: 'Basement Collective',
    deadline: away(2, 11, 24),
    team: 'Solo or team of 4',
    prize: '$5,000',
    entrants: 312,
    solo: true,
    isTeam: true,
  },
  {
    id: 'cold-start',
    name: 'Cold start',
    org: 'Nightshift Labs',
    deadline: away(0, 18, 40),
    team: 'Teams of 2–5',
    prize: '$12,000',
    entrants: 847,
    solo: false,
    isTeam: true,
  },
  {
    id: 'agents-actually',
    name: 'Agents, actually',
    org: 'Runloop',
    deadline: away(5, 3, 12),
    team: 'Solo only',
    prize: '$8,000',
    entrants: 1204,
    solo: true,
    isTeam: false,
  },
  {
    id: 'offline-first',
    name: 'Offline first',
    org: 'Terminal Club',
    deadline: away(0, 9, 15),
    team: 'Teams of 3',
    prize: '$3,000',
    entrants: 96,
    solo: false,
    isTeam: true,
  },
  {
    id: 'one-weekend-one-api',
    name: 'One weekend, one API',
    org: 'Postbox',
    deadline: away(11, 6, 48),
    team: 'Solo or team of 3',
    prize: '$15,000',
    entrants: 2038,
    solo: true,
    isTeam: true,
  },
  {
    id: 'small-models-big-jobs',
    name: 'Small models, big jobs',
    org: 'Cutoff',
    deadline: away(3, 21, 5),
    team: 'Teams of 2–4',
    prize: '$6,500',
    entrants: 528,
    solo: false,
    isTeam: true,
  },
]

/** The board previews a slice of the live board; the rest sit behind "see all". */
const TOTAL_LIVE = 14

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'closing', label: 'Closing soon' },
  { id: 'solo', label: 'Solo' },
  { id: 'team', label: 'Team' },
]

const matches = (filter, hackathon, remaining) => {
  switch (filter) {
    case 'open':
      return remaining >= DAY
    case 'closing':
      return remaining > 0 && remaining < DAY
    case 'solo':
      return hackathon.solo
    case 'team':
      return hackathon.isTeam
    default:
      return true
  }
}

const statusOf = (remaining) => {
  if (remaining <= 0) return { label: 'Closed', tone: 'border-hairline bg-raised text-muted' }
  if (remaining < DAY) return { label: 'Closing soon', tone: 'border-[#4A3308] bg-[#2A1E05] text-warn' }
  return { label: 'Open', tone: 'border-volt-edge bg-volt-tint text-volt' }
}

const WRAP = 'mx-auto w-full max-w-[1180px] px-5'
const META_LABEL = 'text-[11.5px] tracking-[0.06em] text-muted uppercase'

function HackathonCard({ hackathon, remaining }) {
  const status = statusOf(remaining)

  return (
    <article className="group flex flex-col rounded-drop border border-hairline bg-surface p-[22px] transition-[transform,border-color,background-color] duration-150 hover:-translate-y-[3px] hover:border-volt-edge hover:bg-raised">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">
            {hackathon.name}
          </h3>
          <p className="mt-[5px] text-[13.5px] text-muted">by {hackathon.org}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-[5px] text-[11.5px] font-medium whitespace-nowrap ${status.tone}`}
        >
          {status.label}
        </span>
      </div>

      <p className="my-[18px] mt-5 border-y border-hairline py-3.5 font-mono text-[20px] tracking-[-0.01em] text-ink tabular-nums">
        <time
          dateTime={new Date(hackathon.deadline).toISOString()}
          aria-label={describeRemaining(remaining)}
        >
          {formatRemaining(remaining)}
        </time>
        {/* "left" is a word, not a number — sans, not mono. */}
        <small className="ml-2 font-sans text-[13px] tracking-normal text-muted">left</small>
      </p>

      <dl className="mb-[18px] grid grid-cols-2 gap-3.5">
        <div>
          <dt className={META_LABEL}>Team size</dt>
          <dd className="mt-[5px] text-[14.5px] text-ink">{hackathon.team}</dd>
        </div>
        <div>
          <dt className={META_LABEL}>Prize</dt>
          <dd className="mt-[5px] font-mono text-[15px] text-ink tabular-nums">{hackathon.prize}</dd>
        </div>
      </dl>

      <p className="mt-auto flex items-center gap-2 border-t border-hairline pt-4 text-[13.5px] text-muted">
        <IconUsers width={15} height={15} />
        <span>
          <span className="font-mono tabular-nums">
            {hackathon.entrants.toLocaleString('en-US')}
          </span>{' '}
          building
        </span>
      </p>
    </article>
  )
}

export default function HackathonBoard() {
  const [filter, setFilter] = useState('all')
  const now = useNow()

  const visible = HACKATHONS.map((hackathon) => ({
    hackathon,
    remaining: Math.max(0, hackathon.deadline - now),
  })).filter(({ hackathon, remaining }) => matches(filter, hackathon, remaining))

  return (
    <section className="pt-2 pb-11 md:py-18" id="hackathons" aria-labelledby="drop-board-title">
      <div className={WRAP}>
        <div className="mb-4 flex items-end justify-between gap-6 md:mb-6">
          <h2
            id="drop-board-title"
            className="text-2xl font-semibold tracking-[-0.025em] text-ink md:text-[32px]"
          >
            Live right now
          </h2>
          <p className="font-mono text-[13px] text-muted tabular-nums" aria-live="polite">
            {visible.length} of {TOTAL_LIVE} live
          </p>
        </div>

        <div
          className="drop-filters -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:mb-6 md:px-0"
          role="group"
          aria-label="Filter hackathons"
        >
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={[
                'shrink-0 rounded-full border px-4 py-[9px] text-sm whitespace-nowrap transition-colors',
                filter === option.id
                  ? 'border-[#3A3A44] bg-raised text-ink'
                  : 'border-hairline text-muted hover:border-[#3A3A44] hover:text-ink',
              ].join(' ')}
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map(({ hackathon, remaining }) => (
              <HackathonCard key={hackathon.id} hackathon={hackathon} remaining={remaining} />
            ))}
          </div>
        ) : (
          <p className="rounded-drop border border-dashed border-hairline px-6 py-14 text-center text-muted">
            Nothing matches that filter. Try another.
          </p>
        )}

        <p className="mt-8">
          <Link
            to="/hackathons"
            className="group/link inline-flex items-center gap-2 text-[15px] font-medium text-ink transition-colors hover:text-volt"
          >
            See all hackathons
            <IconArrow
              width={16}
              height={16}
              className="transition-transform duration-150 group-hover/link:translate-x-[3px]"
            />
          </Link>
        </p>
      </div>
    </section>
  )
}
