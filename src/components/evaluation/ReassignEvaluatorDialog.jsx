import { useState } from 'react'
import { isEvaluatorSubmitted } from '../../api/evaluation'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { Textarea } from '../ui/Input'
import Modal from '../ui/Modal'

const REASON_MAX = 500

/**
 * Asks why a submission's evaluator is being changed (or removed) before the
 * change is made. The reason is sent with the assignment and kept in the
 * submission's assignment history. Allowed even after the evaluator has
 * submitted — the dialog says so plainly.
 *
 * `change` is `{ submission, toId, toName }`; `toId` null means unassign.
 */
export default function ReassignEvaluatorDialog({ change, saving = false, error = '', onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  const submission = change?.submission
  const fromName = submission?.assigned_evaluator_name || 'the current evaluator'
  const toName = change?.toId ? change.toName || 'the selected evaluator' : null
  const evaluated = isEvaluatorSubmitted(submission)
  const trimmed = reason.trim()

  return (
    <Modal
      open={Boolean(change)}
      onClose={() => !saving && onCancel()}
      title={toName ? 'Change evaluator' : 'Remove evaluator'}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={evaluated ? 'danger' : 'accent'}
            loading={saving}
            disabled={!trimmed || saving}
            onClick={() => onConfirm(trimmed)}
          >
            {toName ? 'Change evaluator' : 'Remove evaluator'}
          </Button>
        </>
      }
    >
      <div className="stack-md">
        {error && <Alert variant="danger">{error}</Alert>}

        <p className="flex flex-wrap items-center gap-2 text-[14px] text-ink">
          <strong>{fromName}</strong>
          <Icon name="arrowRight" size={15} className="text-muted" />
          <strong>{toName || 'Unassigned'}</strong>
          {submission?.team_name && (
            <span className="text-muted">· {submission.team_name}</span>
          )}
        </p>

        {evaluated ? (
          <Alert variant="warning" title="Already evaluated">
            {fromName} has already submitted an evaluation for this submission. The change and your
            reason are recorded in its assignment history.
          </Alert>
        ) : (
          <p className="text-[13px] text-muted">
            The change and your reason are recorded in this submission&rsquo;s assignment history.
            AI analysis that has already run is not repeated.
          </p>
        )}

        <Textarea
          label="Reason"
          required
          rows={3}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Conflict of interest, evaluator unavailable, workload balancing…"
          hint={`${trimmed.length}/${REASON_MAX}`}
          autoFocus
        />
      </div>
    </Modal>
  )
}
