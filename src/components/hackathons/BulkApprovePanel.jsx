import { useEffect, useState } from 'react'
import { hackathonsApi } from '../../api/hackathons'
import { MONO } from '../drop/theme'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import { LoadingBlock } from '../ui/Spinner'

const CONFIRM_TEXT =
  'This approves every evaluation the evaluators have submitted for this hackathon. Their scores will count on the leaderboard.'

const count = (value) => Number(value) || 0
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Super Admin: approve every evaluation an evaluator has submitted for this
 * hackathon in one request, so those scores count on the leaderboard.
 *
 * Counts load when the section opens. After the POST the response is used as
 * it is — no refetch: what was approved, what is eligible for the leaderboard,
 * what is not ready yet, and any submission that failed (which stays waiting).
 * Students still only see a leaderboard once its round is published.
 *
 * Written without try/finally so the React Compiler can optimise it.
 */
export default function BulkApprovePanel({ hackathonId }) {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [approving, setApproving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    hackathonsApi
      .evaluationApprovals(hackathonId, { signal: controller.signal })
      .then((payload) => {
        if (!active) return
        setState(payload)
        setLoading(false)
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return
        setLoadError(error?.message || 'Unable to load evaluations awaiting approval.')
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [hackathonId])

  const approveAll = async () => {
    setApproving(true)
    setActionError('')
    setResult(null)

    const payload = await hackathonsApi.approveAllEvaluations(hackathonId).catch((error) => {
      setActionError(error?.message || 'Unable to approve evaluations.')
      return null
    })

    setApproving(false)
    setConfirming(false)
    if (!payload) return

    // Use the response as it is: failures stay waiting, everything approved
    // now joins the approved count.
    const failed = Array.isArray(payload.failed) ? payload.failed : []
    const approvedNow = count(payload.approved_now)
    setResult({ ...payload, failed, approved_now: approvedNow })
    setState((current) => ({
      ...current,
      pending_review_count: payload.pending_review_count ?? failed.length,
      approved_count: payload.approved_count ?? count(current?.approved_count) + approvedNow,
      skipped_count: payload.skipped_count ?? payload.skipped ?? current?.skipped_count,
    }))
  }

  if (loading) return <LoadingBlock label="Loading evaluations…" />

  if (loadError) {
    return (
      <Alert variant="danger" title="Unable to load evaluations">
        {loadError}
      </Alert>
    )
  }

  const pending = count(state?.pending_review_count)
  const approved = count(state?.approved_count)
  const skipped = count(state?.skipped_count)

  return (
    <div className="stack-md">
      {actionError && <Alert variant="danger">{actionError}</Alert>}

      {result && (
        <Alert variant="success">
          {plural(result.approved_now, 'evaluation')} approved.{' '}
          {plural(count(result.leaderboard_eligible), 'score')} can appear on the leaderboard.
          {count(result.skipped) > 0 &&
            ` ${count(result.skipped)} ${count(result.skipped) === 1 ? 'is' : 'are'} not ready yet.`}
        </Alert>
      )}

      {result?.failed.length > 0 && (
        <Alert variant="warning" title={`${plural(result.failed.length, 'submission')} could not be approved`}>
          <p>These stay waiting for approval.</p>
          <ul className="mt-2 flex flex-col gap-1">
            {result.failed.map((item, index) => (
              <li key={`${item.submission_id}-${index}`} className="text-[13px]">
                <span className={MONO}>{item.submission_id}</span>
                {item.reason ? ` — ${item.reason}` : ''}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <dl className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-drop border border-hairline bg-surface p-3.5">
          <dt className="text-[12.5px] text-muted">Waiting for approval</dt>
          <dd className={`${MONO} mt-1 text-[22px] font-semibold text-ink`}>{pending}</dd>
        </div>
        <div className="rounded-drop border border-hairline bg-surface p-3.5">
          <dt className="text-[12.5px] text-muted">Already on the leaderboard</dt>
          <dd className={`${MONO} mt-1 text-[22px] font-semibold text-ink`}>{approved}</dd>
        </div>
        <div className="rounded-drop border border-hairline bg-surface p-3.5">
          <dt className="text-[12.5px] text-muted">Still with the evaluator</dt>
          <dd className={`${MONO} mt-1 text-[22px] font-semibold text-ink`}>{skipped}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">
          {pending === 0
            ? 'Nothing is waiting for approval.'
            : `${plural(pending, 'evaluation')} will be approved. Students see the leaderboard only after its round is published.`}
        </p>
        <Button
          variant="accent"
          disabled={pending === 0 || approving}
          loading={approving}
          leftIcon={<Icon name="checkCircle" size={17} />}
          onClick={() => {
            setActionError('')
            setConfirming(true)
          }}
        >
          Approve all evaluated submissions
        </Button>
      </div>

      <Modal
        open={confirming}
        onClose={() => !approving && setConfirming(false)}
        title="Approve all evaluated submissions"
        footer={
          <>
            <Button variant="ghost" disabled={approving} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="accent" loading={approving} onClick={approveAll}>
              Approve {plural(pending, 'evaluation')}
            </Button>
          </>
        }
      >
        <p>{CONFIRM_TEXT}</p>
      </Modal>
    </div>
  )
}
