import { useState } from 'react'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import { trackEvent } from '../../lib/logrocket'
import { formatDate } from '../../utils/format'
import { getHackathonStatus } from '../../utils/hackathons'
import { BADGE, BADGE_NEUTRAL, PANEL } from '../drop/theme'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { LoadingBlock } from '../ui/Spinner'
import { participationErrorMessage } from './errorCodes'

/**
 * How a new hackathon starts: blank (today's empty draft), or a copy of an
 * existing hackathon. Either way the result is a draft id, handed to
 * `onDraft`, which the create page puts in the URL and loads like any draft —
 * so nothing goes live until it is edited and published.
 *
 * The hackathon list is fetched only once "Start from an existing hackathon"
 * is chosen.
 */
export default function HackathonStartChoice({ onDraft }) {
  const [mode, setMode] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const picking = mode === 'existing'
  const {
    data,
    loading,
    error: listError,
    reload,
  } = useAsync((options) => hackathonsApi.list(options), {
    key: queryKeys.hackathons,
    staleTime: 60_000,
    enabled: picking,
  })

  const startBlank = async () => {
    setBusy('blank')
    setError('')
    const draft = await hackathonsApi.createDraft().catch((err) => {
      setError(err?.message || 'Could not start a new hackathon draft.')
      return null
    })
    setBusy('')
    if (draft?.id) onDraft(draft.id)
  }

  const startFrom = async (hackathon) => {
    setBusy(hackathon.id)
    setError('')
    const draft = await hackathonsApi.duplicate(hackathon.id).catch((err) => {
      setError(participationErrorMessage(err, 'Could not copy that hackathon.'))
      return null
    })
    setBusy('')
    if (!draft?.id) return
    trackEvent('Hackathon Duplicated', { sourceHackathonId: String(hackathon.id) })
    onDraft(draft.id)
  }

  const needle = query.trim().toLowerCase()
  const hackathons = (Array.isArray(data) ? data : [])
    .filter((hackathon) => !needle || String(hackathon.name || '').toLowerCase().includes(needle))
    .sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')))

  return (
    <div className="stack-lg">
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={`${PANEL} flex flex-col gap-3 p-5`}>
          <span className="grid size-10 place-items-center rounded-drop border border-hairline bg-raised text-muted">
            <Icon name="plus" size={18} />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold text-ink">Start blank</h2>
            <p className="mt-1 text-[13.5px] text-muted">
              An empty hackathon. You fill in every section yourself.
            </p>
          </div>
          <div className="mt-auto pt-1">
            <Button
              variant="accent"
              loading={busy === 'blank'}
              disabled={Boolean(busy)}
              onClick={startBlank}
            >
              Start blank
            </Button>
          </div>
        </div>

        <div
          className={`${PANEL} flex flex-col gap-3 p-5 ${picking ? 'border-volt-edge' : ''}`}
        >
          <span className="grid size-10 place-items-center rounded-drop border border-hairline bg-raised text-muted">
            <Icon name="clipboard" size={18} />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold text-ink">Start from an existing hackathon</h2>
            <p className="mt-1 text-[13.5px] text-muted">
              Copies its content, rounds, banner and settings into a new draft. Students, teams,
              submissions and scores stay on the original.
            </p>
          </div>
          <div className="mt-auto pt-1">
            <Button
              variant={picking ? 'secondary' : 'ghost'}
              disabled={Boolean(busy)}
              onClick={() => setMode(picking ? '' : 'existing')}
            >
              {picking ? 'Hide list' : 'Choose a hackathon'}
            </Button>
          </div>
        </div>
      </div>

      {picking && (
        <section className={`${PANEL} overflow-hidden`} aria-label="Hackathons to copy">
          <div className="flex flex-col gap-3 border-b border-hairline p-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-[15px] font-semibold text-ink">Pick a hackathon to copy</h3>
            <div className="input-group w-full sm:max-w-xs">
              <input
                className="input"
                type="search"
                placeholder="Search by name"
                aria-label="Search hackathons"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                style={{ paddingLeft: 38 }}
              />
              <span
                className="input-group__addon"
                style={{ left: 4, right: 'auto', pointerEvents: 'none' }}
              >
                <Icon name="search" size={18} />
              </span>
            </div>
          </div>

          {loading && !data ? (
            <div className="p-6">
              <LoadingBlock label="Loading hackathons…" />
            </div>
          ) : listError ? (
            <div className="p-4">
              <Alert variant="danger" title="Unable to load hackathons">
                {listError.message}{' '}
                <button type="button" className="link-btn" onClick={() => reload({ force: true })}>
                  Try again
                </button>
              </Alert>
            </div>
          ) : hackathons.length ? (
            <ul className="max-h-[420px] divide-y divide-hairline overflow-y-auto">
              {hackathons.map((hackathon) => {
                const status = getHackathonStatus(hackathon)
                return (
                  <li
                    key={hackathon.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[14.5px] font-medium text-ink">
                        {hackathon.name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                        <span>
                          {formatDate(hackathon.start_date)} – {formatDate(hackathon.end_date)}
                        </span>
                        {status?.label && (
                          <span className={`${BADGE} ${BADGE_NEUTRAL}`}>{status.label}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busy === hackathon.id}
                      disabled={Boolean(busy)}
                      onClick={() => startFrom(hackathon)}
                    >
                      Use this hackathon
                    </Button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-[13px] text-muted">
              {needle ? 'No hackathon matches that name.' : 'There are no hackathons to copy yet.'}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
