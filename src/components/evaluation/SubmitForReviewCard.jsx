import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Input, { Textarea } from '../ui/Input'
import Card, { CardBody, CardHeader } from '../ui/Card'

function formatScore(value) {
  if (value == null) return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number % 1 ? number.toFixed(1) : String(number)
}

/**
 * Evaluator sidebar: preview total, optional AI override, remarks, submit.
 */
export default function SubmitForReviewCard({
  preview,
  scorecardBase,
  readOnlyReview,
  reviewStatus,
  canEditManual,
  canSubmit,
  manualComplete,
  overrideEnabled,
  onOverrideEnabledChange,
  aiOverrideByFieldKey,
  onAiOverrideChange,
  notes,
  onNotesChange,
  onSubmit,
  submitting = false,
  finalScore,
}) {
  const aiMetrics = (scorecardBase?.metrics || []).filter((metric) => metric.scoring_mode === 'ai')

  return (
    <Card className="submit-for-review-card">
      <CardHeader>
        <h3>{readOnlyReview ? 'Review status' : 'Submit for review'}</h3>
      </CardHeader>
      <CardBody className="stack-md">
        <div className="submit-for-review-card__total">
          <span className="submit-for-review-card__total-label">Preview total</span>
          <strong>
            {formatScore(preview?.computed_total)}
            <small>/ 100</small>
          </strong>
        </div>

        {readOnlyReview ? (
          <>
            <ReviewStatusBadge status={reviewStatus} />
            {reviewStatus === 'approved' && finalScore != null ? (
              <p className="submit-for-review-card__hint">
                Approved final score: <strong>{formatScore(finalScore)}/100</strong>
              </p>
            ) : null}
          </>
        ) : null}

        {canEditManual ? (
          <>
            <div className="submit-for-review-card__override">
              <label className="submit-for-review-card__override-toggle">
                <input
                  type="checkbox"
                  checked={overrideEnabled}
                  onChange={(event) => onOverrideEnabledChange(event.target.checked)}
                />
                <span className="submit-for-review-card__override-track">
                  <span />
                </span>
                <strong>Override Scores</strong>
              </label>

              {overrideEnabled ? (
                <div className="submit-for-review-card__override-fields">
                  {aiMetrics.map((metric) => (
                    <Input
                      key={metric.field_key}
                      label={metric.field_label || metric.field_key}
                      type="number"
                      min={0}
                      max={metric.max_score}
                      step={metric.max_score <= 20 ? 0.5 : 1}
                      value={aiOverrideByFieldKey[metric.field_key] ?? ''}
                      onChange={(event) =>
                        onAiOverrideChange(metric.field_key, event.target.value)
                      }
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="submit-for-review-card__summary">
              <div>
                <span>AI SCORE</span>
                <strong>{formatScore(preview?.ai_total)}</strong>
              </div>
              <div>
                <span>MANUAL SCORE</span>
                <strong>{formatScore(preview?.manual_total)}</strong>
              </div>
            </div>

            <Textarea
              label="Remarks"
              hint="Optional"
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
            />

            <Button
              variant="success"
              block
              disabled={!canSubmit}
              loading={submitting}
              onClick={onSubmit}
              leftIcon={<Icon name="check" size={17} />}
            >
              {reviewStatus === 'changes_requested' ? 'Resubmit for review' : 'Submit for review'}
            </Button>

            {!manualComplete ? (
              <p className="submit-for-review-card__hint">
                Finish GitHub and MVP scoring to enable submit.
              </p>
            ) : null}
          </>
        ) : null}
      </CardBody>
    </Card>
  )
}

function ReviewStatusBadge({ status }) {
  const config =
    {
      none: { label: 'Manual Analysis Pending', variant: 'warning' },
      pending_review: { label: 'Pending admin review', variant: 'info' },
      changes_requested: { label: 'Changes requested', variant: 'danger' },
      approved: { label: 'Approved', variant: 'success' },
    }[status || 'none'] || { label: String(status).replaceAll('_', ' '), variant: 'neutral' }

  return (
    <Badge variant={config.variant} dot className="badge--review">
      {config.label}
    </Badge>
  )
}
