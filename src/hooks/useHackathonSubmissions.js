import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { evaluationApi, isSubmissionEvaluated } from '../api/evaluation'

/** 0-based timeline round a submission belongs to. Legacy rows carry none. */
export function submissionRoundIndex(submission) {
  return Number(submission?.round_index) || 0
}

function matchesFilters(submission, { roundIndex, status, search }) {
  if (roundIndex !== null && submissionRoundIndex(submission) !== roundIndex) return false
  if (status !== 'all' && submission.status !== status) return false
  if (!search) return true
  const needle = search.toLowerCase()
  return [submission.team_name, submission.theme_name || submission.theme_chosen, submission.id].some(
    (value) => String(value || '').toLowerCase().includes(needle),
  )
}

/** Per-round totals worked out from a full list, for a backend that does not page. */
function summariseLocally(items) {
  const summary = new Map()
  items.forEach((submission) => {
    const index = submissionRoundIndex(submission)
    const entry = summary.get(index) || { total: 0, evaluated: 0 }
    entry.total += 1
    if (isSubmissionEvaluated(submission)) entry.evaluated += 1
    summary.set(index, entry)
  })
  return summary
}

function summaryFromServer(rows) {
  return new Map(
    rows.map((row) => [
      Number(row.round_index) || 0,
      { total: Number(row.total) || 0, evaluated: Number(row.evaluated) || 0 },
    ]),
  )
}

/**
 * One page of the admin submissions queue for a hackathon.
 *
 * Asks the backend for just the page on screen, filtered by round, status and
 * search. A backend that does not page yet answers with every submission
 * instead; that list is then kept and paged here, and changing the page or the
 * filters stops refetching. Either way the caller gets the same shape: the
 * rows to draw, how many match, and per-round counts that ignore the filters.
 *
 * The previous page stays on screen while the next one loads, so the table
 * does not collapse to a spinner on every click.
 */
export function useHackathonSubmissions(hackathonId, { roundIndex, status, search, page, pageSize }) {
  const [feed, setFeed] = useState(null)
  const [nonce, setNonce] = useState(0)
  const loadedKeyRef = useRef('')

  const isLegacy = feed?.mode === 'legacy' && feed.hackathonId === hackathonId
  const params = useMemo(
    () => ({
      page,
      page_size: pageSize,
      round_index: roundIndex ?? undefined,
      status: status === 'all' ? undefined : status,
      q: search || undefined,
    }),
    [page, pageSize, roundIndex, status, search],
  )
  const baseKey = `${hackathonId}|${nonce}`
  // A full list answers every page and filter, so only a reload refetches it.
  const requestKey = isLegacy ? baseKey : `${baseKey}|${JSON.stringify(params)}`

  useEffect(() => {
    if (loadedKeyRef.current === requestKey) return undefined
    const controller = new AbortController()
    let active = true

    evaluationApi
      .listHackathonSubmissionsPage(hackathonId, isLegacy ? {} : params, { signal: controller.signal })
      .then((result) => {
        if (!active) return
        const key = result.paginated ? requestKey : baseKey
        loadedKeyRef.current = key
        setFeed({
          key,
          hackathonId,
          mode: result.paginated ? 'server' : 'legacy',
          items: result.items,
          total: result.total,
          roundSummary: result.paginated ? summaryFromServer(result.roundSummary) : null,
          error: null,
        })
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return
        loadedKeyRef.current = requestKey
        setFeed((current) => ({ ...(current || { items: [] }), key: requestKey, error }))
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [hackathonId, requestKey, baseKey, isLegacy, params])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  /** Merge updated submissions into whatever is held, matched by id. */
  const patch = useCallback((updatedList) => {
    const byId = new Map(updatedList.filter((item) => item?.id).map((item) => [item.id, item]))
    if (!byId.size) return
    setFeed((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (byId.has(item.id) ? { ...item, ...byId.get(item.id) } : item)),
          }
        : current,
    )
  }, [])

  /** Drop submissions from whatever is held, e.g. right after a withdraw. */
  const remove = useCallback((ids) => {
    const gone = new Set(ids)
    setFeed((current) =>
      current
        ? {
            ...current,
            items: current.items.filter((item) => !gone.has(item.id)),
            total: Math.max(0, (current.total || 0) - current.items.filter((item) => gone.has(item.id)).length),
          }
        : current,
    )
  }, [])

  const view = useMemo(() => {
    const items = feed?.items || []
    if (feed?.mode !== 'legacy') {
      return { rows: items, total: feed?.total || 0, roundSummary: feed?.roundSummary || new Map() }
    }
    const filtered = items
      .filter((submission) => matchesFilters(submission, { roundIndex, status, search }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const start = (page - 1) * pageSize
    return {
      rows: filtered.slice(start, start + pageSize),
      total: filtered.length,
      roundSummary: summariseLocally(items),
    }
  }, [feed, roundIndex, status, search, page, pageSize])

  return {
    ...view,
    loaded: Boolean(feed),
    loading: feed?.key !== requestKey,
    error: feed?.key === requestKey ? feed.error : null,
    reload,
    patch,
    remove,
  }
}
