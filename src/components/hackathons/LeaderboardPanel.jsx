import { useCallback, useState } from 'react'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { LoadingBlock } from '../ui/Spinner'
import { BADGE, BADGE_CLOSED, BADGE_OPEN, MONO } from '../drop/theme'
import { participationErrorCode, participationErrorMessage } from './errorCodes'

/**
 * The board comes back under more than one plausible key depending on the
 * serializer, so read them all rather than showing an empty table.
 */
function readEntries(board) {
  if (Array.isArray(board)) return board
  return board?.entries || board?.leaderboard || board?.results || board?.rankings || []
}

/** "1st" when the backend sends it, otherwise a positional fallback. */
function rankLabel(entry, index) {
  if (entry?.rank_label) return entry.rank_label
  const rank = entry?.rank ?? index + 1
  const remainder = rank % 100
  if (remainder >= 11 && remainder <= 13) return `${rank}th`
  return `${rank}${{ 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10] || 'th'}`
}

function entryName(entry) {
  return entry?.team_name || entry?.submitter_name || entry?.student_name || 'Unnamed team'
}

/**
 * The submitter, shown beneath the team name. Compared against the resolved
 * display name rather than team_name: a solo entry with no team falls back to
 * the submitter for both, and would otherwise print the same name twice.
 */
function entrySubtitle(entry) {
  const submitter = entry?.submitter_name || entry?.student_name || ''
  return submitter && submitter !== entryName(entry) ? submitter : ''
}

/**
 * Ranked standings for one round.
 *
 * Admins and evaluators see it as a preview at any time; students only reach it
 * once the round's board is published, which is why `canManage` gates the
 * publish controls rather than the panel itself.
 */
export default function LeaderboardPanel({
  hackathonId,
  roundIndex = 0,
  roundTitle = '',
  published = false,
  canManage = false,
  onPublishedChange,
}) {
  const fetcher = useCallback(
    (options) => hackathonsApi.roundLeaderboard(hackathonId, roundIndex, options),
    [hackathonId, roundIndex],
  )
  const { data, loading, error, reload } = useAsync(fetcher, {
    enabled: Boolean(hackathonId),
  })

  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  const entries = readEntries(data)
  const stats = data?.stats || {}
  const approvedCount = stats.approved_count ?? entries.length
  const totalSubmissions = stats.total_submissions ?? null
  const isPublished = data?.published ?? published

  const setPublished = async (nextPublish, notify) => {
    setBusy(nextPublish ? 'publish' : 'unpublish')
    setActionError('')
    setNotice('')
    try {
      await hackathonsApi.publishRoundLeaderboard(hackathonId, roundIndex, {
        publish: nextPublish,
        notify,
      })
      setNotice(
        nextPublish
          ? notify
            ? 'Leaderboard published and ranked candidates emailed.'
            : 'Leaderboard published.'
          : 'Leaderboard hidden from students.',
      )
      await reload({ force: true })
      onPublishedChange?.(nextPublish)
    } catch (err) {
      setActionError(participationErrorMessage(err, 'Could not update the leaderboard.'))
    } finally {
      setBusy('')
    }
  }

  // Students hit this until an admin publishes; it is a state, not a failure.
  if (error && participationErrorCode(error) === 'LEADERBOARD_NOT_PUBLISHED') {
    return (
      <Alert variant="info" title="Leaderboard not published yet">
        Results appear here once an administrator publishes this round&rsquo;s standings.
      </Alert>
    )
  }

  if (loading && !data) return <LoadingBlock label="Loading leaderboard…" />

  if (error && !data) {
    return (
      <Alert variant="danger" title="Unable to load the leaderboard">
        {error.message}
      </Alert>
    )
  }

  return (
    <section className="leaderboard">
      <header className="leaderboard__head">
        <div>
          <h3>
            Leaderboard
            {roundTitle ? <span className="leaderboard__round"> · {roundTitle}</span> : null}
          </h3>
          {canManage && (
            <p className="leaderboard__stats">
              <span className={`${BADGE} ${isPublished ? BADGE_OPEN : BADGE_CLOSED}`}>
                {isPublished ? 'Published' : 'Draft — students cannot see this'}
              </span>
              <span>
                <strong className={MONO}>{approvedCount}</strong> approved
                {totalSubmissions != null ? (
                  <>
                    {' of '}
                    <strong className={MONO}>{totalSubmissions}</strong> submissions
                  </>
                ) : null}
              </span>
            </p>
          )}
        </div>

        {canManage && (
          <div className="leaderboard__actions">
            {isPublished ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === 'publish'}
                  disabled={Boolean(busy)}
                  onClick={() => setPublished(true, true)}
                >
                  Re-send emails
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busy === 'unpublish'}
                  disabled={Boolean(busy)}
                  onClick={() => setPublished(false)}
                >
                  Unpublish
                </Button>
              </>
            ) : (
              <Button
                variant="accent"
                size="sm"
                loading={busy === 'publish'}
                disabled={Boolean(busy) || !entries.length}
                onClick={() => setPublished(true, true)}
                leftIcon={<Icon name="trophy" size={16} />}
              >
                Publish leaderboard
              </Button>
            )}
          </div>
        )}
      </header>

      {actionError && <Alert variant="danger">{actionError}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {entries.length ? (
        <ol className="leaderboard__list">
          {entries.map((entry, index) => {
            const subtitle = entrySubtitle(entry)
            return (
              <li
                key={entry?.submission_id || entry?.id || index}
                className={`leaderboard__row ${entry?.is_current_user ? 'is-you' : ''}`}
              >
                <span className={`leaderboard__rank ${MONO}`}>{rankLabel(entry, index)}</span>
                <span className="leaderboard__who">
                  <strong>{entryName(entry)}</strong>
                  {subtitle && <small>{subtitle}</small>}
                </span>
                {entry?.is_current_user && (
                  <span className={`${BADGE} ${BADGE_OPEN}`}>You</span>
                )}
                <span className={`leaderboard__score ${MONO}`}>
                  {entry?.final_score ?? entry?.score ?? '—'}
                </span>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="text-sm text-muted">
          {canManage
            ? 'No approved evaluations yet, so there is nothing to rank.'
            : 'No ranked entries for this round yet.'}
        </p>
      )}
    </section>
  )
}
