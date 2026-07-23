import Card, { CardBody, CardHeader } from '../ui/Card'
import ScoreRing from '../ui/ScoreRing'
import Icon from '../ui/Icon'
import CriteriaBar from './CriteriaBar'
import { CRITERIA_LABELS } from '../../utils/constants'

/**
 * Renders a completed AI EvaluationResult: overall score, criteria
 * breakdown, summary, strengths, improvements, recommendation and any
 * checklist / report text. The backend doesn't provide scoring fields yet,
 * so every one of these renders an explicit "not available" state instead
 * of a fabricated zero/empty result when the data is missing.
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
      <Card className="score-hero">
        <CardBody className="text-center stack-md">
          <div className="eyebrow" style={{ color: 'var(--brand-600)' }}>
            Overall Score
          </div>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <ScoreRing value={overall_score} max={10} size={150} />
          </div>
          {recommendation && (
            <div className="score-hero__recommendation">{recommendation}</div>
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
            <CriteriaBar key={key} label={label} value={criteria[key]} max={10} />
          ))}
        </CardBody>
      </Card>

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
              <p className="text-muted text-sm">Scoring not yet available.</p>
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
              <p className="text-muted text-sm">Scoring not yet available.</p>
            )}
          </CardBody>
        </Card>
      </div>

    </div>
  )
}
