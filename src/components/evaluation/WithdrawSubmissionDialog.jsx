import { useState } from 'react'
import { evaluationApi } from '../../api/evaluation'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Modal from '../ui/Modal'

/**
 * Confirm-then-withdraw for an admin. Owns the request so the list row and the
 * detail page behave the same way.
 *
 *   onWithdrawn(submission)  — deleted; the caller removes it from view
 *   onAssigned(submission)   — 409: an evaluator was assigned in the meantime,
 *                              nothing was deleted; the caller refreshes it
 *
 * Any other failure stays in the dialog so the admin can retry or cancel.
 *
 * Written without try/finally so the React Compiler can optimise it.
 */
export default function WithdrawSubmissionDialog({ submission, ...props }) {
  // Nothing to confirm while closed. Rendering the body only with a real
  // submission also matters for the React Compiler: it sees `submission.id`
  // used unguarded in the handler, treats `submission` as never null, and
  // drops the optional chaining elsewhere — which crashed every page that
  // mounted this dialog closed. Keyed so each open starts with a clean state.
  if (!submission) return null
  return <WithdrawConfirm key={submission.id} submission={submission} {...props} />
}

function WithdrawConfirm({ submission, onClose, onWithdrawn, onAssigned }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    if (busy) return
    setError('')
    onClose()
  }

  const confirm = async () => {
    setBusy(true)
    setError('')
    const outcome = await evaluationApi
      .withdrawSubmission(submission.id)
      .then(() => 'withdrawn')
      .catch((err) => {
        if (err?.status === 409 || err?.code === 'SUBMISSION_ASSIGNED') return 'assigned'
        setError(err?.message || 'Unable to withdraw this submission.')
        return null
      })
    setBusy(false)
    if (outcome === 'withdrawn') onWithdrawn(submission)
    else if (outcome === 'assigned') onAssigned(submission)
  }

  const team = submission.team_name

  return (
    <Modal
      open
      onClose={close}
      title="Withdraw submission"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} loading={busy}>
            Withdraw
          </Button>
        </>
      }
    >
      <div className="stack-md">
        {error && <Alert variant="danger">{error}</Alert>}
        <div>
          <p className="text-[15px] font-medium text-ink">Withdraw this submission?</p>
          {team && <p className="mt-0.5 text-[13px] text-muted">{team}</p>}
        </div>
        <p className="text-[14px] text-muted">
          The video, answers, and AI analysis will be deleted. The student can submit again. This
          cannot be done after an evaluator is assigned.
        </p>
      </div>
    </Modal>
  )
}
