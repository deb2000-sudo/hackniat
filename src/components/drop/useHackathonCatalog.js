import { useCallback, useEffect, useMemo } from 'react'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'

/**
 * The backend recomputes each hackathon's status in IST on every request and
 * there is no websocket behind it, so "closing soon" only ever arrives on the
 * next poll. A minute of drift on a multi-day deadline is invisible; a minute
 * of requests is not, so this sits at the slow end of the 30–60s guidance.
 */
const POLL_MS = 45_000

/** Anything newer than this is reused on mount instead of refetched. */
const STALE_MS = 20_000

/** Urgent first, dead last — the board is a "what can I still enter" list. */
const RANK = { closing_soon: 0, open: 1, upcoming: 2, closed: 3 }

const ACCEPTING = new Set(['open', 'closing_soon'])

/** An unrecognised status sorts with upcoming rather than vanishing to the end. */
const rankOf = (hackathon) => RANK[hackathon?.status] ?? RANK.upcoming

function sortForBoard(list) {
  return [...list].sort((a, b) => {
    const byStatus = rankOf(a) - rankOf(b)
    if (byStatus !== 0) return byStatus

    // Within a group: soonest first, except finished events, which read better
    // most-recent first.
    if (a.status === 'closed') return String(b.end_date || '').localeCompare(String(a.end_date || ''))
    return String(a.start_date || '').localeCompare(String(b.start_date || ''))
  })
}

export const isAccepting = (hackathon) => ACCEPTING.has(hackathon?.status)

/**
 * Live hackathon catalog for the public landing page.
 *
 * Call this once per page and pass the result down — every consumer shares one
 * cache entry, but each one would otherwise run its own poll timer.
 */
export function useHackathonCatalog({ includeClosed = true } = {}) {
  const { data, loading, error, reload } = useAsync(
    (opts) => hackathonsApi.catalog({ includeClosed, ...opts }),
    { key: queryKeys.hackathonCatalog(includeClosed), staleTime: STALE_MS },
  )

  const refresh = useCallback(() => reload({ force: true }), [reload])

  // Poll while the tab is visible, and re-sync the moment it comes back — a
  // board left open overnight should not still be advertising yesterday.
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    const timer = setInterval(refreshIfVisible, POLL_MS)
    window.addEventListener('focus', refreshIfVisible)
    document.addEventListener('visibilitychange', refreshIfVisible)

    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refreshIfVisible)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [refresh])

  const hackathons = useMemo(
    () => sortForBoard(Array.isArray(data) ? data : []),
    [data],
  )

  const liveCount = useMemo(
    () => hackathons.filter(isAccepting).length,
    [hackathons],
  )

  const themeCount = useMemo(() => {
    const ids = new Set()
    hackathons.forEach((hackathon) => {
      ;(hackathon.themes || []).forEach((theme) => ids.add(theme.id ?? theme.name))
    })
    return ids.size
  }, [hackathons])

  return {
    hackathons,
    liveCount,
    themeCount,
    // A failed refetch keeps the last good board on screen, so only the first
    // load is ever a spinner — and only an empty board is ever an error.
    loading: loading && !data,
    error: data ? null : error,
    refresh,
  }
}
