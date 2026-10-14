import { useEffect, useState } from 'react'
import { hackathonsApi } from '../../api/hackathons'
import { formatDateTime } from '../../utils/format'
import { MONO } from '../drop/theme'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import { LoadingBlock } from '../ui/Spinner'
import { participationErrorMessage } from './errorCodes'

const MIN_PLACES = 1
const MAX_PLACES = 100
const DEFAULT_PLACES = 5
const SHORTCUTS = [5, 10]
/** Typing pauses this long before the preview reloads. */
const PREVIEW_DELAY_MS = 300

/** The typed number when it is a whole number from 1 to 100, else null. */
function parsePlaces(value) {
  const n = Number(value)
  return Number.isInteger(n) && n >= MIN_PLACES && n <= MAX_PLACES ? n : null
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Super Admin: email a round's top N places. Separate from publishing the
 * leaderboard, which shows the board to students and sends no email.
 *
 * Nothing is fetched until the board is published (the API would refuse). The
 * preview reloads as the number changes; Announce winners confirms, then uses
 * the POST response as it is. Place names come from the API's place_label —
 * never renamed here.
 *
 * Written without try/finally so the React Compiler can optimise it.
 */
export default function WinnerAnnouncementPanel({
  hackathonId,
  roundIndex,
  roundTitle,
  leaderboardPublished,
}) {
  const [places, setPlaces] = useState(String(DEFAULT_PLACES))
  const topN = parsePlaces(places)

  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [previewing, setPreviewing] = useState(false)

  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sent, setSent] = useState(null)

  useEffect(() => {
    if (!leaderboardPublished || !topN) return undefined
    const controller = new AbortController()
    let active = true

    const timer = setTimeout(() => {
      setPreviewing(true)
      setPreviewError('')
      hackathonsApi
        .previewWinners(hackathonId, roundIndex, topN, { signal: controller.signal })
        .then((payload) => {
          if (!active) return
          setPreview(payload)
          setPreviewing(false)
        })
        .catch((error) => {
          if (!active || error?.name === 'AbortError') return
          setPreviewError(participationErrorMessage(error, 'Could not load the winners preview.'))
          setPreviewing(false)
        })
    }, PREVIEW_DELAY_MS)

    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [hackathonId, roundIndex, topN, leaderboardPublished])

  if (!leaderboardPublished) {
    return (
      <section className="stack-sm">
        <h4 className="text-[15px] font-semibold text-ink">{roundTitle}</h4>
        <Alert variant="info">
          Publish the leaderboard first. Announcing winners sends email and does not publish the
          board.
        </Alert>
      </section>
    )
  }

  const choosePlaces = (value) => {
    setPlaces(String(value))
    setSent(null)
    setSendError('')
  }

  const announce = async () => {
    setSending(true)
    setSendError('')
    setSent(null)

    const payload = await hackathonsApi.announceWinners(hackathonId, roundIndex, topN).catch((error) => {
      setSendError(participationErrorMessage(error, 'Could not send the winner announcement.'))
      return null
    })

    setSending(false)
    setConfirming(false)
    if (!payload) return

    // The response lists who was emailed and the new last_announcement.
    setPreview(payload)
    setSent(payload)
  }

  // Only trust a preview made for the number currently in the field.
  const current = preview && Number(preview.top_n) === topN ? preview : null
  const entries = Array.isArray(current?.entries) ? current.entries : []
  const announcedCount = Number(current?.announced_count) || entries.length
  const last = (current || preview)?.last_announcement

  return (
    <section className="stack-md">
      <h4 className="text-[15px] font-semibold text-ink">{roundTitle}</h4>

      {sendError && <Alert variant="danger">{sendError}</Alert>}
      {sent && <Alert variant="success">{plural(Number(sent.emails_sent) || 0, 'email')} sent.</Alert>}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-[170px]">
          <Input
            label="How many places"
            type="number"
            inputMode="numeric"
            min={MIN_PLACES}
            max={MAX_PLACES}
            step={1}
            value={places}
            onChange={(event) => choosePlaces(event.target.value)}
            error={places !== '' && !topN ? `A whole number from ${MIN_PLACES} to ${MAX_PLACES}` : undefined}
          />
        </div>
        <div className="flex gap-2 pb-[2px]">
          {SHORTCUTS.map((value) => (
            <Button
              key={value}
              variant={topN === value ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={topN === value}
              onClick={() => choosePlaces(value)}
            >
              Top {value}
            </Button>
          ))}
        </div>
      </div>

      {last && (
        <p className="flex items-center gap-2 text-[12.5px] text-muted">
          <Icon name="clock" size={14} />
          Last sent {formatDateTime(last.announced_at)} IST · top {last.top_n} ·{' '}
          {plural(Number(last.emails_sent) || 0, 'email')}
        </p>
      )}

      {previewError ? (
        <Alert variant="warning">{previewError}</Alert>
      ) : previewing && !current ? (
        <LoadingBlock label="Loading winners…" />
      ) : current ? (
        <div className={`stack-sm ${previewing ? 'opacity-60' : ''}`} aria-busy={previewing}>
          {entries.length ? (
            <ol className="divide-y divide-hairline overflow-hidden rounded-drop border border-hairline">
              {entries.map((entry, index) => (
                <li
                  key={`${entry.rank}-${entry.team_name}-${index}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5"
                >
                  <span className="min-w-0 text-[14px] text-ink">
                    <strong className="font-semibold">{entry.place_label}</strong>
                    {' · '}
                    {entry.team_name}
                  </span>
                  <span className={`${MONO} text-[13px] text-muted`}>{entry.score}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-muted">No ranked teams to announce yet.</p>
          )}
          {announcedCount > topN && (
            <p className="text-[12.5px] text-muted">Tied teams on the last place are included.</p>
          )}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          variant="accent"
          leftIcon={<Icon name="trophy" size={16} />}
          loading={sending}
          disabled={sending || !topN || !entries.length}
          onClick={() => {
            setSendError('')
            setConfirming(true)
          }}
        >
          Announce winners
        </Button>
      </div>

      <Modal
        open={confirming}
        onClose={() => !sending && setConfirming(false)}
        title={`Announce winners · ${roundTitle}`}
        footer={
          <>
            <Button variant="ghost" disabled={sending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="accent" loading={sending} onClick={announce}>
              Send {plural(announcedCount, 'announcement')}
            </Button>
          </>
        }
      >
        <p>
          This emails the top {topN} places. Rank 1 is told they won 1st prize, rank 2 is 1st
          runner-up, rank 3 is 2nd runner-up, and the rest are told their rank.
        </p>
      </Modal>
    </section>
  )
}
