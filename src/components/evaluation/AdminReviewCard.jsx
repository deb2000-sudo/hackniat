import Badge, { ReviewStatusBadge } from '../ui/Badge'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { Textarea } from '../ui/Input'
import Card, { CardBody, CardHeader } from '../ui/Card'
import { formatDateTime } from '../../utils/format'

function formatScore(value) {
  if (value == null) return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number % 1 ? number.toFixed(1) : String(number)
}

/**
 * Admin sidebar: evaluator info, override scores, approve / request changes.
 */
export default function AdminReviewCard({
  preview,
  scorecard,
  reviewStatus,
  evaluatorName,
  evaluatorNotes,
  finalScore,
  reportPublished,
  publishedAt,
  reviewNotes,
  onReviewNotesChange,
  onApprove,
  onRequestChanges,
  approving,
  requestingChanges,
}) {
  const aiMetrics = (scorecard?.metrics || []).filter((metric) => metric.scoring_mode === 'ai')
  const overriddenMetrics = aiMetrics.filter(
    (metric) => metric.source === 'evaluator_override',
  )
  const hasOverrides = overriddenMetrics.length > 0

  return (
    <Card className="submit-for-review-card admin-review-card">
      <CardHeader>
        <h3>Admin review</h3>
      </CardHeader>
      <CardBody className="stack-md">
        <div className="submit-for-review-card__total">
          <span className="submit-for-review-card__total-label">Preview total</span>
          <strong>
            {formatScore(preview?.computed_total ?? finalScore)}
            <small>/ 100</small>
          </strong>
        </div>

        <ReviewStatusBadge status={reviewStatus} />

        <div className="admin-review-card__meta">
          <div className="row-between text-sm">
            <span className="text-muted">Assigned evaluator</span>
            <strong>{evaluatorName || 'Unassigned'}</strong>
          </div>
        </div>

        {hasOverrides ? (
          <div className="submit-for-review-card__override admin-review-card__overrides">
            <strong>Override scores</strong>
            <div className="admin-review-card__override-list">
              {overriddenMetrics.map((metric) => (
                <div key={metric.field_key} className="admin-review-card__override-row">
                  <span>{metric.field_label || metric.field_key}</span>
                  <strong>
                    {formatScore(metric.score)} / {metric.max_score}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}

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

        {evaluatorNotes ? (
          <div className="evaluator-submitted-notes">
            <span>Evaluator remarks</span>
            <p>{evaluatorNotes}</p>
          </div>
        ) : null}

        {reviewStatus === 'pending_review' ? (
          <>
            <Textarea
              label="Admin review notes"
              hint="Optional for approval; recommended when requesting changes."
              rows={3}
              maxLength={5000}
              value={reviewNotes}
              onChange={(event) => onReviewNotesChange(event.target.value)}
              disabled={approving || requestingChanges}
            />
            <div className="admin-review-actions">
              <Button
                variant="secondary"
                block
                loading={requestingChanges}
                disabled={approving}
                onClick={onRequestChanges}
                leftIcon={<Icon name="refresh" size={17} />}
              >
                Request changes
              </Button>
              <Button
                variant="success"
                block
                loading={approving}
                disabled={requestingChanges}
                onClick={onApprove}
                leftIcon={<Icon name="check" size={17} />}
              >
                Approve & publish
              </Button>
            </div>
          </>
        ) : null}

        {reviewStatus === 'approved' && finalScore != null ? (
          <p className="submit-for-review-card__hint">
            Approved final score: <strong>{formatScore(finalScore)}/100</strong>
          </p>
        ) : null}

        <div className="admin-review-card__visibility stack-sm">
          <div className="row-between text-sm">
            <span className="text-muted">Report</span>
            <Badge variant={reportPublished ? 'success' : 'neutral'} dot>
              {reportPublished ? 'Published' : 'Private'}
            </Badge>
          </div>
          {reportPublished && publishedAt ? (
            <div className="row-between text-sm">
              <span className="text-muted">Published at</span>
              <strong>{formatDateTime(publishedAt)}</strong>
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  )
}
