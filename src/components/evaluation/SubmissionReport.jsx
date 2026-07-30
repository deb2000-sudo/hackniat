import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { evaluationApi } from '../../api/evaluation'
import { useAsync } from '../../hooks/useAsync'
import { formatDateTime } from '../../utils/format'
import Alert from '../ui/Alert'
import Accordion from '../ui/Accordion'
import Badge from '../ui/Badge'
import Card, { CardBody, CardHeader } from '../ui/Card'
import Icon from '../ui/Icon'
import { LoadingBlock } from '../ui/Spinner'

function Markdown({ children }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}

function FieldScoresTable({ scores }) {
  if (!scores?.length) return null

  return (
    <div className="table-wrap">
      <table className="field-scores-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Score</th>
            <th>Rationale</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((item) => (
            <tr key={item.field_key || item.field_label}>
              <td>
                <strong>{item.field_label || item.field_key}</strong>
                {item.skipped ? (
                  <div>
                    <Badge variant="neutral">Skipped</Badge>
                  </div>
                ) : null}
              </td>
              <td className="mono">
                {item.skipped
                  ? '—'
                  : `${Number(item.score ?? 0).toFixed(1)} / ${Number(item.max_score ?? 10)}`}
              </td>
              <td className="field-scores-rationale">
                {item.rationale || (item.skipped ? 'Not scored for this submission.' : '—')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SubmissionReport({
  submissionId,
  collapsible = false,
  recommendation,
  embeddedAnalysis = null,
}) {
  const { data, loading, error, reload } = useAsync(() =>
    evaluationApi.getSubmissionReport(submissionId),
  )

  const report = data || embeddedAnalysis
  const fieldScores = report?.field_scores || embeddedAnalysis?.field_scores || null
  const hasVideoReport = Boolean(report?.report)

  if (loading && !embeddedAnalysis) {
    return (
      <Card>
        <CardBody>
          <LoadingBlock label="Loading analysis report…" />
        </CardBody>
      </Card>
    )
  }

  if (error && !embeddedAnalysis) {
    if (error.status === 403) {
      return (
        <Alert variant="info" title="Report not available yet">
          The evaluation report will appear after an administrator publishes it.
        </Alert>
      )
    }
    return (
      <Alert variant="danger" title="Unable to load analysis report">
        <div className="stack-sm">
          <span>{error.message}</span>
          <button type="button" className="link-btn" onClick={reload}>
            Try again
          </button>
        </div>
      </Alert>
    )
  }

  if (collapsible) {
    return (
      <div className="stack-md">
        {fieldScores?.length ? (
          <Accordion
            title="Field scores"
            description="Per-field metric scoring from the evaluation requirement prompts."
            icon="chart"
          >
            <FieldScoresTable scores={fieldScores} />
          </Accordion>
        ) : null}
        <Accordion
          title="Validity checklist"
          description="Open to inspect the AI validation checks."
          icon="checkCircle"
        >
          <Markdown>{report?.checklist || 'No checklist was returned.'}</Markdown>
        </Accordion>
        {hasVideoReport || recommendation ? (
          <Accordion
            title="Recommendations"
            description="Open to review the AI findings and suggested improvements."
            icon="sparkles"
          >
            {recommendation && (
              <div className="evaluation-recommendation-callout">
                <span>Recommendation</span>
                <p>{recommendation}</p>
              </div>
            )}
            <Markdown>{report?.report || 'No recommendations were returned.'}</Markdown>
          </Accordion>
        ) : null}
      </div>
    )
  }

  return (
    <div className="stack-lg">
      <div className="row-between wrap">
        <div>
          <div className="eyebrow" style={{ color: 'var(--brand-600)' }}>
            Detailed analysis
          </div>
          <p className="text-sm text-muted" style={{ marginTop: 4 }}>
            Analyzed {formatDateTime(report?.analyzed_at)}
          </p>
        </div>
      </div>

      {fieldScores?.length ? (
        <Card>
          <CardHeader>
            <h3>Field scores</h3>
            <Icon name="chart" size={20} className="text-muted" />
          </CardHeader>
          <CardBody>
            <FieldScoresTable scores={fieldScores} />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h3>Validation checklist</h3>
          <Icon name="clipboard" size={20} className="text-muted" />
        </CardHeader>
        <CardBody>
          <Markdown>{report?.checklist || 'No checklist was returned.'}</Markdown>
        </CardBody>
      </Card>

      {(hasVideoReport || recommendation) && (
        <Card>
          <CardHeader>
            <h3>Analysis report</h3>
            <Icon name="file" size={20} className="text-muted" />
          </CardHeader>
          <CardBody>
            {recommendation && (
              <div className="evaluation-recommendation-callout" style={{ marginBottom: 16 }}>
                <span>Recommendation</span>
                <p>{recommendation}</p>
              </div>
            )}
            <Markdown>{report?.report || 'No report was returned.'}</Markdown>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
