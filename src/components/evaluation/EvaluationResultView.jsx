import Card, { CardBody, CardHeader } from '../ui/Card'
import ScoreRing from '../ui/ScoreRing'
import Icon from '../ui/Icon'
import CriteriaBar from './CriteriaBar'
import { CRITERIA_LABELS } from '../../utils/constants'

/**
 * Renders a completed AI EvaluationResult: overall score, per-criterion
 * breakdown, summary, strengths, improvements, recommendation and any
 * checklist / report text.
 */
export default function EvaluationResultView({ result }) {
  if (!result) return null

  const {
    overall_score,
    criteria = {},
    summary,
    strengths = [],
    improvements = [],
    recommendation,
  } = result

  return (
    <div className="stack-lg">
      <div className="result-top">
        <Card>
          <CardBody className="text-center stack-md">
            <div className="eyebrow" style={{ color: 'var(--brand-600)' }}>
              Overall Score
            </div>
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <ScoreRing value={overall_score} max={10} size={150} />
            </div>
            {recommendation && (
              <div className="stack-sm">
                <span className="text-subtle text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Recommendation
                </span>
                <p style={{ fontWeight: 600, color: 'var(--heading)' }}>{recommendation}</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3>Criteria Breakdown</h3>
            <Icon name="chart" size={20} className="text-muted" />
          </CardHeader>
          <CardBody className="stack-md">
            {Object.entries(CRITERIA_LABELS).map(([key, label]) => (
              <CriteriaBar key={key} label={label} value={criteria[key] ?? 0} max={10} />
            ))}
          </CardBody>
        </Card>
      </div>

      {summary && (
        <Card>
          <CardHeader>
            <h3>Summary</h3>
          </CardHeader>
          <CardBody>
            <p className="prose">{summary}</p>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-2">
        <Card>
          <CardHeader>
            <h3>Strengths</h3>
            <Icon name="checkCircle" size={20} style={{ color: 'var(--success-500)' }} />
          </CardHeader>
          <CardBody>
            {strengths.length ? (
              <ul className="point-list point-list--good">
                {strengths.map((item, i) => (
                  <li key={i}>
                    <Icon name="check" size={18} className="point-list__mark" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted text-sm">No strengths listed.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3>Areas to Improve</h3>
            <Icon name="alert" size={20} style={{ color: 'var(--warning-500)' }} />
          </CardHeader>
          <CardBody>
            {improvements.length ? (
              <ul className="point-list point-list--warn">
                {improvements.map((item, i) => (
                  <li key={i}>
                    <Icon name="arrowRight" size={18} className="point-list__mark" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted text-sm">No improvements listed.</p>
            )}
          </CardBody>
        </Card>
      </div>

    </div>
  )
}
