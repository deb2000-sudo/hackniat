import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { evaluationApi } from '../../api/evaluation'
import { useAsync } from '../../hooks/useAsync'
import {
  computeNormalizedAnalysisScore,
  groupReportSections,
  parseMarkdownSections,
} from '../../utils/analysisReport'
import { formatDateTime } from '../../utils/format'
import Alert from '../ui/Alert'
import Accordion from '../ui/Accordion'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card, { CardBody, CardHeader } from '../ui/Card'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import { modalAnalysisDetail } from '../ui/uiClasses'
import { LoadingBlock } from '../ui/Spinner'

function Markdown({ children }) {
  if (!children) return null
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}

function FieldScoresTable({ scores, emptyLabel = 'No scores available.' }) {
  if (!scores?.length) {
    return <p className="text-sm text-muted">{emptyLabel}</p>
  }

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

function ScoreBreakdown({ scoreSummary }) {
  if (!scoreSummary) return null

  return (
    <div className="analysis-score-summary">
      <div className="analysis-score-summary__total">
        <span>Combined AI score</span>
        <strong>
          {scoreSummary.roundedPercent}
          <small>/ 100</small>
        </strong>
        <em>
          {scoreSummary.earned.toFixed(1)} earned of {scoreSummary.max.toFixed(1)} max points
        </em>
      </div>
      <div className="analysis-score-summary__bars" aria-hidden="true">
        <span style={{ width: `${Math.min(100, scoreSummary.percent)}%` }} />
      </div>
    </div>
  )
}

function ReportSections({ sections }) {
  if (!sections?.length) return null
  return (
    <div className="analysis-report-sections stack-md">
      {sections.map((section) => (
        <section key={`${section.kind}-${section.title}`} className="analysis-report-section">
          <h4>{section.title}</h4>
          <Markdown>{section.body}</Markdown>
        </section>
      ))}
    </div>
  )
}

function AnalysisDetailContent({ report, groups }) {
  return (
    <div className="stack-md analysis-detail-panel">
      <ReportSections sections={groups.analysis} />
      <div className="analysis-report-block">
        <div className="analysis-report-block__head">
          <h4>Validity checklist</h4>
          <p>AI validation checks against the submission text.</p>
        </div>
        <Markdown>{report?.checklist || 'No checklist was returned.'}</Markdown>
      </div>
      <ReportSections sections={groups.detail} />
    </div>
  )
}

function AnalysisBody({
  report,
  recommendation,
  scoreSummary,
  groups,
  showDetailReport,
  onToggleDetailReport,
  collapsible,
  scoresOnly = false,
  detailModalOpen = false,
  onDetailModalClose,
}) {
  const hasAnalysisContent =
    scoreSummary ||
    groups.analysis.length ||
    scoreSummary?.requirementRows?.length ||
    scoreSummary?.demoRows?.length

  const hasDetailContent =
    groups.analysis.length > 0 ||
    Boolean(report?.checklist) ||
    groups.detail.length > 0

  const hasRecommendations =
    Boolean(recommendation) || groups.recommendations.length > 0

  const analysisInner = (
    <div className="stack-lg">
      <ScoreBreakdown scoreSummary={scoreSummary} />

      <div className="analysis-report-block">
        <div className="analysis-report-block__head">
          <h4>Requirement field scores</h4>
          <p>Scores for problem statement, solution description, and other requirement fields.</p>
        </div>
        <FieldScoresTable
          scores={scoreSummary?.requirementRows || report?.field_scores}
          emptyLabel="No requirement field scores were returned."
        />
      </div>

      <div className="analysis-report-block">
        <div className="analysis-report-block__head">
          <h4>Working demo video score</h4>
          <p>How well the recorded or uploaded demo supports the written submission.</p>
        </div>
        <FieldScoresTable
          scores={scoreSummary?.demoRows}
          emptyLabel="No working-demo score was returned for this submission."
        />
      </div>

      {!scoresOnly && (
        <>
          <ReportSections sections={groups.analysis} />

          {onToggleDetailReport && (
            <div className="analysis-detail-toggle">
              <Button
                type="button"
                variant={showDetailReport ? 'secondary' : 'ghost'}
                size="sm"
                onClick={onToggleDetailReport}
                leftIcon={<Icon name="file" size={16} />}
              >
                {showDetailReport ? 'Hide detail report' : 'Detail report'}
              </Button>
              <small>Validity checklist and longer narrative sections.</small>
            </div>
          )}

          {showDetailReport && (
            <div className="stack-md analysis-detail-panel">
              <div className="analysis-report-block">
                <div className="analysis-report-block__head">
                  <h4>Validity checklist</h4>
                  <p>AI validation checks against the submission text.</p>
                </div>
                <Markdown>{report?.checklist || 'No checklist was returned.'}</Markdown>
              </div>
              <ReportSections sections={groups.detail} />
            </div>
          )}
        </>
      )}
    </div>
  )

  const recommendationInner = (
    <div className="stack-md">
      {recommendation && (
        <div className="evaluation-recommendation-callout">
          <span>Recommendation</span>
          <p>{recommendation}</p>
        </div>
      )}
      {groups.recommendations.length ? (
        <ReportSections sections={groups.recommendations} />
      ) : !recommendation ? (
        <p className="text-sm text-muted">No recommendations were returned.</p>
      ) : null}
    </div>
  )

  if (collapsible) {
    return (
      <>
        <div className="stack-md">
          {hasAnalysisContent && (
            <Accordion
              title="AI Analysis Report"
              description="Field scores, demo score, and the findings evaluators need first."
              icon="chart"
              badge={
                scoreSummary ? (
                  <Badge variant="success">{scoreSummary.roundedPercent}/100</Badge>
                ) : null
              }
            >
              {analysisInner}
            </Accordion>
          )}
          {hasRecommendations && (
            <Accordion
              title="Recommendations"
              description="Suggested improvements after reviewing the analysis."
              icon="sparkles"
            >
              {recommendationInner}
            </Accordion>
          )}
        </div>

        {scoresOnly && onDetailModalClose ? (
          <Modal
            open={detailModalOpen}
            onClose={onDetailModalClose}
            title="Detail report"
            className={modalAnalysisDetail}
          >
            {hasDetailContent ? (
              <AnalysisDetailContent report={report} groups={groups} />
            ) : (
              <p className="text-sm text-muted">No detailed analysis sections were returned.</p>
            )}
          </Modal>
        ) : null}
      </>
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
        {scoreSummary && (
          <Badge variant="success">{scoreSummary.roundedPercent} / 100</Badge>
        )}
      </div>

      {hasAnalysisContent && (
        <Card>
          <CardHeader>
            <h3>AI Analysis Report</h3>
            <Icon name="chart" size={20} className="text-muted" />
          </CardHeader>
          <CardBody>{analysisInner}</CardBody>
        </Card>
      )}

      {hasRecommendations && (
        <Card>
          <CardHeader>
            <h3>Recommendations</h3>
            <Icon name="sparkles" size={20} className="text-muted" />
          </CardHeader>
          <CardBody>{recommendationInner}</CardBody>
        </Card>
      )}
    </div>
  )
}

export default function SubmissionReport({
  submissionId,
  collapsible = false,
  recommendation,
  embeddedAnalysis = null,
  demoScore = null,
  showDetailReport = false,
  onToggleDetailReport,
  scoresOnly = false,
  detailModalOpen = false,
  onDetailModalClose,
}) {
  const { data, loading, error, reload } = useAsync(() =>
    evaluationApi.getSubmissionReport(submissionId),
  )

  const report = data || embeddedAnalysis
  const fieldScores = report?.field_scores || embeddedAnalysis?.field_scores || null

  const sections = useMemo(
    () => parseMarkdownSections(report?.report),
    [report?.report],
  )
  const groups = useMemo(() => groupReportSections(sections), [sections])
  const resolvedDemoScore = useMemo(() => {
    const raw = demoScore ?? embeddedAnalysis?.overall_score ?? report?.overall_score
    if (raw == null) return null
    const value = Number(raw)
    // Treat as a 0–10 demo score; ignore already-normalized 0–100 composites.
    return Number.isFinite(value) && value <= 10 ? value : null
  }, [demoScore, embeddedAnalysis, report])
  const scoreSummary = useMemo(
    () =>
      computeNormalizedAnalysisScore(fieldScores, {
        demoScore: resolvedDemoScore,
      }),
    [fieldScores, resolvedDemoScore],
  )

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

  return (
    <AnalysisBody
      report={report}
      recommendation={recommendation}
      scoreSummary={scoreSummary}
      groups={groups}
      showDetailReport={showDetailReport}
      onToggleDetailReport={onToggleDetailReport}
      collapsible={collapsible}
      scoresOnly={scoresOnly}
      detailModalOpen={detailModalOpen}
      onDetailModalClose={onDetailModalClose}
    />
  )
}
