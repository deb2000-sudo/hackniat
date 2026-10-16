import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getHackathonStatus } from '../../utils/hackathons'
import { formatScheduleRange } from '../../utils/schedule'
import { BADGE, BADGE_CLOSING, BADGE_NEUTRAL, BADGE_OPEN, BTN_GHOST, BTN_VOLT, PANEL } from '../drop/theme'
import Icon from '../ui/Icon'

/** How many themes show before "+N more". */
const THEME_LIMIT = 3

const STATUS_TONE = { live: BADGE_OPEN, upcoming: BADGE_CLOSING, past: BADGE_NEUTRAL }

/** "Winter Build Sprint" → "WB"; "H" when the name has no letters. */
function initialsOf(name) {
  const letters = String(name || '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
  return letters || 'H'
}

/**
 * A released hackathon on the student dashboard: banner with status, name,
 * IST schedule, themes, and the way in. The whole card is one link to the
 * hackathon; the official site, when there is one, is a separate link.
 */
export default function StudentHackathonCard({ hackathon }) {
  // Banners are time-limited signed URLs; a stale one must not leave a broken image.
  const [bannerBroken, setBannerBroken] = useState(false)
  const status = getHackathonStatus(hackathon)
  const themes = Array.isArray(hackathon.themes) ? hackathon.themes : []
  const extraThemes = Math.max(0, themes.length - THEME_LIMIT)
  const teamLabel = hackathon.featured_round?.team_mode_label || hackathon.team_mode_label
  const href = `/hackathons/${hackathon.id}`

  return (
    <article
      className={`${PANEL} group relative flex flex-col overflow-hidden transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-volt-edge hover:shadow-lg`}
    >
      <div className="relative aspect-[2/1] overflow-hidden border-b border-hairline bg-raised">
        {hackathon.banner_url && !bannerBroken ? (
          <img
            src={hackathon.banner_url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBannerBroken(true)}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          // No banner: a quiet accent panel with the hackathon's initials.
          <div className="grid size-full place-items-center bg-linear-to-br from-volt-tint via-raised to-raised">
            <span className="grid size-16 place-items-center rounded-2xl border border-volt-edge bg-surface text-[22px] font-semibold tracking-[-0.02em] text-volt-ink shadow-sm">
              {initialsOf(hackathon.name)}
            </span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <span className={`${BADGE} ${STATUS_TONE[status.key] || BADGE_NEUTRAL} backdrop-blur-sm`}>
            {status.label}
          </span>
          {teamLabel && (
            <span className={`${BADGE} ${BADGE_NEUTRAL} bg-surface/90 backdrop-blur-sm`}>
              {teamLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[16px] leading-snug font-semibold tracking-[-0.01em] text-ink">
            {/* The stretched link makes the whole card clickable. */}
            <Link to={href} className="after:absolute after:inset-0 focus-visible:outline-none">
              {hackathon.name}
            </Link>
          </h3>
          <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-muted">
            <Icon name="calendar" size={14} className="mt-[2px] shrink-0" />
            <span>{formatScheduleRange(hackathon) || 'Dates to be announced'}</span>
          </p>
        </div>

        <div>
          <span className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
            Themes
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {themes.length ? (
              <>
                {themes.slice(0, THEME_LIMIT).map((theme) => (
                  <span
                    key={theme.id || theme.name}
                    className="max-w-full truncate rounded-full border border-hairline bg-raised px-2.5 py-1 text-[12px] font-medium text-ink"
                    title={theme.name}
                  >
                    {theme.name}
                  </span>
                ))}
                {extraThemes > 0 && (
                  <span className="rounded-full px-1.5 py-1 text-[12px] text-muted">
                    +{extraThemes} more
                  </span>
                )}
              </>
            ) : (
              <span className="text-[12.5px] text-muted">Themes not released yet</span>
            )}
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
          <span className={`${BTN_VOLT} pointer-events-none min-h-9 px-3.5 text-[13px]`} aria-hidden="true">
            View hackathon
            <Icon name="arrowRight" size={14} />
          </span>
          {hackathon.hackathon_url && (
            // Above the stretched link so it opens the external site instead.
            <a
              href={hackathon.hackathon_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BTN_GHOST} relative z-10 min-h-9 px-3 text-[13px]`}
            >
              Official site
              <Icon name="arrowRight" size={13} className="-rotate-45" />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
