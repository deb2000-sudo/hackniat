import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { evaluationApi } from '../../api/evaluation'
import { useAsync } from '../../hooks/useAsync'
import { formatDateTime } from '../../utils/format'
import Alert from '../ui/Alert'
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

export default function SubmissionReport({ submissionId }) {
  const { data, loading, error, reload } = useAsync(() =>
    evaluationApi.getSubmissionReport(submissionId),
  )

  if (loading) {
    return (
      <Card>
        <CardBody>
          <LoadingBlock label="Loading analysis report…" />
        </CardBody>
      </Card>
    )
  }

  if (error) {
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
    <div className="stack-lg">
      <div className="row-between wrap">
        <div>
          <div className="eyebrow" style={{ color: 'var(--brand-600)' }}>
            Detailed analysis
          </div>
          <p className="text-sm text-muted" style={{ marginTop: 4 }}>
            Analyzed {formatDateTime(data?.analyzed_at)}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h3>Validation checklist</h3>
          <Icon name="clipboard" size={20} className="text-muted" />
        </CardHeader>
        <CardBody>
          <Markdown>{data?.checklist || 'No checklist was returned.'}</Markdown>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3>Analysis report</h3>
          <Icon name="file" size={20} className="text-muted" />
        </CardHeader>
        <CardBody>
          <Markdown>{data?.report || 'No report was returned.'}</Markdown>
        </CardBody>
      </Card>
    </div>
  )
}
