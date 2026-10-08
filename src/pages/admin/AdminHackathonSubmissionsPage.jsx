import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { useHackathonSubmissions } from '../../hooks/useHackathonSubmissions'
import { formatDate, formatDateTime } from '../../utils/format'
import { BADGE, BADGE_OPEN, BTN_VOLT, EYEBROW, MONO, PANEL, WRAP_APP } from '../../components/drop/theme'
import { roundDisplayName, roundStatusBadge } from '../../components/hackathons/roundStatus'
import PageHeader from '../../components/layout/PageHeader'
import TeamDetailsModal from '../../components/evaluation/TeamDetailsModal'
import WithdrawSubmissionDialog from '../../components/evaluation/WithdrawSubmissionDialog'
import { WITHDRAW_ASSIGNED_MESSAGE, canWithdraw } from '../../components/evaluation/withdraw'
import Alert from '../../components/ui/Alert'
import Badge, { ReviewStatusBadge, StatusBadge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card, { CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Input, { Select } from '../../components/ui/Input'
import Pagination from '../../components/ui/Pagination'
import { LoadingBlock } from '../../components/ui/Spinner'

/** Neutral stat pill. text-ink, not text-muted: these are numbers to read. */
const BADGE_STAT = 'border-hairline bg-raised text-ink'

/** Rows per page of the submissions table. */
const PAGE_SIZE = 10

/** How long typing pauses before the search is sent. */
const SEARCH_DELAY_MS = 300

export default function AdminHackathonSubmissionsPage() {
  const { hackathonId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  // The hackathon and its evaluator roster. Submissions load separately, a
  // page at a time, so paging or filtering never refetches these.
  const { data, error: hackathonError, reload: reloadHackathon } = useAsync(async () => {
    // Only the hackathon itself is essential — without it the page has no
    // subject. A failing evaluators feed should leave the dropdowns empty,
    // not take the whole screen down.
    const [hackathonResult, evaluatorsResult] = await Promise.allSettled([
      hackathonsApi.get(hackathonId),
      hackathonsApi.evaluators(hackathonId),
    ])
    if (hackathonResult.status === 'rejected') throw hackathonResult.reason
    return {
      hackathon: hackathonResult.value,
      // Only this hackathon's roster can be assigned. Hackathons with no saved
      // roster yet report every approved evaluator as assigned.
      evaluators:
        evaluatorsResult.status === 'fulfilled' && Array.isArray(evaluatorsResult.value?.evaluators)
          ? evaluatorsResult.value.evaluators.filter((item) => item.assigned)
          : [],
    }
  })
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  // Selected rows by id, holding the row itself so a selection made on one
  // page still counts after moving to another.
  const [selected, setSelected] = useState(() => new Map())
  const [assigningId, setAssigningId] = useState('')
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [sheetUrl, setSheetUrl] = useState('')
  const [popupBlocked, setPopupBlocked] = useState(false)

  // Search once typing pauses, from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  // The chosen round lives in the URL so refresh, back, and a shared link all
  // land on the same queue.
  const roundParam = searchParams.get('round')
  const requestedRoundIndex = useMemo(() => {
    if (roundParam === null || roundParam === '') return null
    const parsed = Number(roundParam)
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
  }, [roundParam])

  const feed = useHackathonSubmissions(hackathonId, {
    roundIndex: requestedRoundIndex,
    status,
    search,
    page,
    pageSize: PAGE_SIZE,
  })
  const submissions = feed.rows
  const loading = feed.loading
  const error = hackathonError || feed.error

  /**
   * One entry per round the admin can open, with its own counts.
   *
   * Built from the hackathon's timeline, unioned with every round the counts
   * mention: a submission filed against a round that was later removed from
   * the timeline must still be reachable, or editing the timeline would
   * quietly hide real work.
   */
  const rounds = useMemo(() => {
    const timeline = data?.hackathon?.timeline || []
    const indices = new Set(timeline.map((_, index) => index))
    feed.roundSummary.forEach((_, index) => indices.add(index))
    return [...indices]
      .sort((a, b) => a - b)
      .map((index) => {
        const round = timeline[index] || null
        const counts = feed.roundSummary.get(index) || { total: 0, evaluated: 0 }
        return {
          index,
          round,
          name: roundDisplayName(round, index),
          total: counts.total,
          evaluated: counts.evaluated,
          awaiting: counts.total - counts.evaluated,
        }
      })
  }, [data?.hackathon?.timeline, feed.roundSummary])

  // An index that no longer exists falls back to the round picker rather than
  // an empty table.
  const activeRoundIndex = rounds.some((entry) => entry.index === requestedRoundIndex)
    ? requestedRoundIndex
    : null
  const activeRound = rounds.find((entry) => entry.index === activeRoundIndex) || null

  // A single-round hackathon has nothing to choose between, so it goes straight
  // to its table.
  const showRoundPicker = activeRoundIndex === null && rounds.length > 1

  const allSubmissionsCount = rounds.reduce((sum, entry) => sum + entry.total, 0)
  /** Submissions in the open round — the whole hackathon when there is only one. */
  const roundSubmissionsCount = activeRound ? activeRound.total : allSubmissionsCount

  const totalPages = Math.max(1, Math.ceil(feed.total / PAGE_SIZE))
  // A page that emptied out (filters, or the last row moved on) steps back to
  // the last one that still has rows.
  if (!loading && feed.loaded && page > totalPages) setPage(totalPages)

  // Filters and selections belong to the round that was open; carrying them
  // into the next one would hide rows there for no visible reason.
  const resetRoundView = () => {
    setSelected(new Map())
    setQuery('')
    setSearch('')
    setStatus('all')
    setPage(1)
  }

  const openRound = (index) => {
    resetRoundView()
    setSearchParams({ round: String(index) })
  }

  const showAllRounds = () => {
    resetRoundView()
    setSearchParams({})
  }

  const hackathon = data?.hackathon
  const evaluators = useMemo(() => data?.evaluators || [], [data?.evaluators])
  const evaluatorIds = useMemo(() => new Set(evaluators.map((item) => item.id)), [evaluators])

  const isUnassigned = (submission) => !submission?.assigned_evaluator_id
  const selectableVisible = useMemo(() => submissions.filter(isUnassigned), [submissions])
  const allVisibleSelected =
    selectableVisible.length > 0 && selectableVisible.every((item) => selected.has(item.id))
  const someVisibleSelected = selectableVisible.some((item) => selected.has(item.id))

  const unselect = (ids) =>
    setSelected((current) => {
      if (!ids.some((id) => current.has(id))) return current
      const next = new Map(current)
      ids.forEach((id) => next.delete(id))
      return next
    })

  const toggleSelected = (submission) => {
    if (!isUnassigned(submission)) return
    setSelected((current) => {
      const next = new Map(current)
      if (next.has(submission.id)) next.delete(submission.id)
      else next.set(submission.id, submission)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelected((current) => {
      const next = new Map(current)
      if (allVisibleSelected) selectableVisible.forEach((item) => next.delete(item.id))
      else selectableVisible.forEach((item) => next.set(item.id, item))
      return next
    })
  }

  // Which submission's roster the modal is showing. Held as the whole row so
  // the dialog can title itself before the fetch lands.
  const [teamSubmission, setTeamSubmission] = useState(null)

  const onAssign = async (submissionId, evaluatorId) => {
    setAssigningId(submissionId)
    setActionError('')
    setActionMessage('')
    try {
      const updated = await evaluationApi.assignSubmission(
        submissionId,
        evaluatorId || null,
      )
      feed.patch([updated])
      unselect([submissionId])
      if (!evaluatorId) {
        setActionMessage('Submission is now unassigned.')
      } else if (updated.status === 'processing' || updated.auto_ai_evaluation) {
        setActionMessage(
          `Assigned to ${updated.assigned_evaluator_name || 'the selected evaluator'}. AI evaluation queued.`,
        )
      } else {
        setActionMessage(
          `Submission assigned to ${updated.assigned_evaluator_name || 'the selected evaluator'}.`,
        )
      }
    } catch (err) {
      setActionError(err.message || 'Unable to update the evaluator assignment.')
    } finally {
      setAssigningId('')
    }
  }

  /** Selected rows that still need an evaluator, from every page. */
  const selectedUnassigned = useMemo(
    () => [...selected.values()].filter(isUnassigned),
    [selected],
  )
  const selectedUnassignedCount = selectedUnassigned.length

  const onDivideEqually = async () => {
    const idsToAssign = selectedUnassigned.map((submission) => submission.id)
    if (!idsToAssign.length) return
    setBulkAssigning(true)
    setActionError('')
    setActionMessage('')
    try {
      const result = await evaluationApi.assignHackathonSubmissionsEqually(
        hackathonId,
        idsToAssign,
      )
      const updatedSubmissions = Array.isArray(result?.submissions)
        ? result.submissions
        : []
      if (updatedSubmissions.length) feed.patch(updatedSubmissions)
      else feed.reload()
      setSelected(new Map())
      const queued = Number(result?.auto_ai_evaluation_queued || 0)
      setActionMessage(
        `${result?.assigned_count ?? updatedSubmissions.length} assigned across ${
          result?.evaluator_count ?? evaluators.length
        } evaluators${queued ? ` · ${queued} AI evaluation${queued === 1 ? '' : 's'} queued` : ''}.`,
      )
    } catch (err) {
      setActionError(err.message || 'Unable to divide the selected submissions.')
    } finally {
      setBulkAssigning(false)
    }
  }

  // The row whose withdraw is being confirmed.
  const [withdrawing, setWithdrawing] = useState(null)

  const onWithdrawn = (submission) => {
    setWithdrawing(null)
    setActionError('')
    feed.remove([submission.id])
    unselect([submission.id])
    setActionMessage(
      `${submission.team_name || 'Submission'} withdrawn. They can submit again while the round is open.`,
    )
    // Refetch so the round counts and the page drop the withdrawn entry too.
    feed.reload()
  }

  const onWithdrawBlocked = () => {
    setWithdrawing(null)
    setActionMessage('')
    setActionError(WITHDRAW_ASSIGNED_MESSAGE)
    // Someone assigned it meanwhile — refetch so the row shows its evaluator.
    feed.reload()
  }

  const reloadAll = () => {
    reloadHackathon({ force: true })
    feed.reload()
  }

  const linkedSheetUrl = sheetUrl || hackathon?.export_spreadsheet_url || ''

  /**
   * Push this hackathon's submissions into its linked Google Sheet and open it.
   *
   * The tab is opened after an await, so it is outside the user-gesture window
   * and browsers may block it. `window.open` returns null when that happens —
   * we keep the URL and render a link rather than leaving the admin thinking
   * the sync silently failed.
   */
  const syncToGoogleSheet = async () => {
    setExporting(true)
    setExportError('')
    setPopupBlocked(false)
    try {
      const result = await evaluationApi.syncHackathonToGoogleSheet(hackathonId)
      const url = result?.spreadsheet_url || ''
      setSheetUrl(url)
      if (!url) {
        setExportError('The sync finished but did not return a spreadsheet link.')
        return
      }
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) setPopupBlocked(true)
      // Pick up export_spreadsheet_url / _synced_at for the header line.
      reloadHackathon({ force: true })
    } catch (err) {
      setExportError(err.message || 'Could not sync submissions to Google Sheets.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className={`${WRAP_APP} py-7 md:py-10 admin-submissions-page`}>
      <PageHeader
        eyebrow={activeRound ? activeRound.name : 'Hackathon submissions'}
        title={hackathon?.name || 'Submissions'}
        description={
          hackathon
            ? `${formatDate(hackathon.start_date)} – ${formatDate(hackathon.end_date)} · ${
                showRoundPicker
                  ? `${rounds.length} rounds · ${allSubmissionsCount} submissions`
                  : `${roundSubmissionsCount} submissions${activeRound ? ` in ${activeRound.name}` : ''}`
              }`
            : 'Review hackathon submissions.'
        }

        actions={
          <>
            {activeRound && rounds.length > 1 && (
              <Button
                variant="secondary"
                onClick={showAllRounds}
                leftIcon={<Icon name="arrowLeft" size={17} />}
              >
                All rounds
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={syncToGoogleSheet}
              loading={exporting}
              disabled={exporting}
              leftIcon={<Icon name="upload" size={17} />}
            >
              {exporting ? 'Syncing…' : 'Sync to Google Sheets'}
            </Button>
            <Button
              variant="ghost"
              onClick={reloadAll}
              loading={loading}
              leftIcon={<Icon name="refresh" size={17} />}
            >
              Refresh
            </Button>
            <Button
              as={Link}
              to="/admin/submissions"
              variant="secondary"
              leftIcon={<Icon name="arrowLeft" size={17} />}
            >
              All hackathons
            </Button>
          </>
        }
      />

      {/* Once a sheet exists the admin can reach it without re-syncing. */}
      {linkedSheetUrl && (
        <p className="-mt-3 mb-5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
          <Icon name="clipboard" size={14} />
          <a href={linkedSheetUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Google Sheet
          </a>
          <span>
            {hackathon?.export_spreadsheet_synced_at
              ? `· last synced ${formatDateTime(hackathon.export_spreadsheet_synced_at)}`
              : '· not synced yet'}
          </span>
        </p>
      )}

      {hackathon?.banner_url && (
        <div className="admin-hackathon-queue-banner">
          <img src={hackathon.banner_url} alt="" />
          <div />
          <span>
            <Icon name="video" size={18} />
            {showRoundPicker ? allSubmissionsCount : roundSubmissionsCount} submissions
          </span>
        </div>
      )}

      {error && (
        <Alert variant="danger" title="Unable to load hackathon submissions">
          {error.message}
        </Alert>
      )}
      {actionError && <Alert variant="danger">{actionError}</Alert>}
      {actionMessage && <Alert variant="success">{actionMessage}</Alert>}
      {/* This app has no toast layer, so sync feedback lands beside the other
          action results rather than floating over the page. */}
      {exportError && <Alert variant="danger">{exportError}</Alert>}
      {popupBlocked && sheetUrl && (
        <Alert variant="warning" title="Sheet updated — your browser blocked the new tab">
          <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Open the Google Sheet
          </a>
        </Alert>
      )}

      {showRoundPicker ? (
        /* Round picker. Submissions are filed per timeline round, so the
           queue is opened one round at a time instead of pooling every round
           into a single table. */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rounds.map((entry) => {
            const badge = entry.round ? roundStatusBadge(entry.round) : null
            return (
              <article
                key={entry.index}
                className={`${PANEL} flex flex-col gap-4 p-5 transition-[transform,border-color,background-color] duration-150 hover:-translate-y-[3px] hover:border-volt-edge hover:bg-raised`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={EYEBROW}>Round {entry.index + 1}</span>
                    <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.02em] text-ink">
                      {entry.name}
                    </h2>
                    {entry.round?.start_date && (
                      <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted">
                        <Icon name="calendar" size={15} />
                        {formatDate(entry.round.start_date)}
                        {entry.round.end_date ? ` – ${formatDate(entry.round.end_date)}` : ''}
                      </p>
                    )}
                  </div>
                  {badge && <span className={`${BADGE} ${badge.tone}`}>{badge.label}</span>}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
                  <span className={`${BADGE} ${BADGE_STAT}`}>
                    <strong className={`${MONO} mr-1`}>{entry.total}</strong>
                    Submissions
                  </span>
                  <span className={`${BADGE} ${BADGE_OPEN}`}>
                    <strong className={`${MONO} mr-1`}>{entry.evaluated}</strong>
                    Evaluated
                  </span>
                  <span className={`${BADGE} ${BADGE_STAT}`}>
                    <strong className={`${MONO} mr-1`}>{entry.awaiting}</strong>
                    Awaiting evaluation
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openRound(entry.index)}
                  className={`${BTN_VOLT} mt-auto w-full`}
                >
                  View Submissions
                  <Icon name="arrowRight" size={16} />
                </button>
              </article>
            )
          })}
        </div>
      ) : (
        <>
        <div className="admin-submissions-toolbar">
          <div className="admin-submissions-search">
            <Icon name="search" size={17} />
            <Input
              aria-label="Search submissions"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search team, theme, or ID"
            />
          </div>
          <div className="admin-submissions-toolbar__actions">
            <Select
              aria-label="Filter submission status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">All statuses</option>
              <option value="uploaded">Uploaded</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </Select>
            <Button
              variant="secondary"
              onClick={onDivideEqually}
              disabled={!selectedUnassignedCount || !evaluators.length}
              loading={bulkAssigning}
              leftIcon={<Icon name="users" size={17} />}
            >
              Divide equally
              {selectedUnassignedCount > 0 && (
                <span className="admin-selection-count">{selectedUnassignedCount}</span>
              )}
            </Button>
          </div>
        </div>

        {!feed.loaded ? (
          <LoadingBlock label="Loading hackathon submissions…" />
        ) : submissions.length ? (
          <>
          <div className={`table-wrap transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
            <table className="table admin-submissions-table">
              <thead>
                <tr>
                  <th className="admin-select-column">
                    <input
                      type="checkbox"
                      aria-label="Select all unassigned submissions on this page"
                      checked={allVisibleSelected}
                      disabled={!selectableVisible.length}
                      ref={(input) => {
                        if (input) input.indeterminate = someVisibleSelected && !allVisibleSelected
                      }}
                      onChange={toggleAllVisible}
                    />
                  </th>
                  <th>Team</th>
                  <th>Theme</th>
                  <th>Status</th>
                  <th>Review</th>
                  <th>Report</th>
                  <th>Submitted</th>
                  <th>Evaluator</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => {
                  const canSelect = isUnassigned(submission)
                  return (
                  <tr
                    key={submission.id}
                    className={selected.has(submission.id) ? 'is-selected' : ''}
                  >
                    <td className="admin-select-column">
                      <input
                        type="checkbox"
                        aria-label={`Select ${submission.team_name || 'submission'}`}
                        checked={selected.has(submission.id)}
                        disabled={!canSelect || bulkAssigning}
                        title={
                          canSelect
                            ? undefined
                            : 'Already assigned to an evaluator'
                        }
                        onChange={() => toggleSelected(submission)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="team-name-button"
                        onClick={() => setTeamSubmission(submission)}
                        title="View team members"
                      >
                        <strong>{submission.team_name || 'Unnamed team'}</strong>
                      </button>
                    </td>
                    <td>{submission.theme_name || submission.theme_chosen || '—'}</td>
                    <td><StatusBadge status={submission.status} /></td>
                    <td><ReviewStatusBadge status={submission.review_status} /></td>
                    <td>
                      <Badge variant={submission.report_published ? 'success' : 'neutral'} dot>
                        {submission.report_published ? 'Published' : 'Private'}
                      </Badge>
                    </td>
                    <td className="text-muted">{formatDateTime(submission.created_at)}</td>
                    <td>
                      <Select
                        className="admin-evaluator-select"
                        aria-label={`Assign evaluator for ${submission.team_name || 'submission'}`}
                        value={submission.assigned_evaluator_id || ''}
                        disabled={assigningId === submission.id || bulkAssigning}
                        onChange={(event) => onAssign(submission.id, event.target.value || null)}
                      >
                        <option value="">Unassigned</option>
                        {/* Someone taken off the roster keeps the rows they
                            already hold, but is not offered anywhere else. */}
                        {submission.assigned_evaluator_id &&
                          !evaluatorIds.has(submission.assigned_evaluator_id) && (
                            <option value={submission.assigned_evaluator_id}>
                              {submission.assigned_evaluator_name || 'Assigned evaluator'}
                            </option>
                          )}
                        {evaluators.map((evaluator) => (
                          <option key={evaluator.id} value={evaluator.id}>
                            {evaluator.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {/* Only while nobody is assigned; assigning hides it at once. */}
                        {canWithdraw(submission) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-missing hover:text-missing"
                            disabled={assigningId === submission.id || bulkAssigning}
                            onClick={() => setWithdrawing(submission)}
                            leftIcon={<Icon name="trash" size={15} />}
                          >
                            Withdraw
                          </Button>
                        )}
                        <Button
                          as={Link}
                          to={`/admin/submissions/${submission.id}`}
                          variant="ghost"
                          size="sm"
                          rightIcon={<Icon name="arrowRight" size={15} />}
                        >
                          Review
                        </Button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={feed.total}
            pageSize={PAGE_SIZE}
            disabled={loading}
            label="Submissions pages"
            onChange={(next) => {
              setPage(next)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
          </>
        ) : !error && !loading ? (
          <Card>
            <CardBody>
              <EmptyState
                icon="video"
                title={roundSubmissionsCount ? 'No matching submissions' : 'No submissions yet'}
                description={
                  roundSubmissionsCount
                    ? 'Try another search or status filter.'
                    : activeRound
                      ? `New student submissions for ${activeRound.name} will appear here.`
                      : 'New student submissions for this hackathon will appear here.'
                }
              />
            </CardBody>
          </Card>
        ) : null}
        </>
      )}

      <WithdrawSubmissionDialog
        submission={withdrawing}
        onClose={() => setWithdrawing(null)}
        onWithdrawn={onWithdrawn}
        onAssigned={onWithdrawBlocked}
      />

      <TeamDetailsModal
        open={Boolean(teamSubmission)}
        submission={teamSubmission}
        onClose={() => setTeamSubmission(null)}
      />
    </div>
  )
}
