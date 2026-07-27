import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { useAsync } from '../../hooks/useAsync'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card, { CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import StatCard from '../../components/ui/StatCard'
import { LoadingBlock } from '../../components/ui/Spinner'
import SessionTable from '../../components/evaluation/SessionTable'

export default function EvaluationsPage() {
  const { data, loading, error, reload } = useAsync(() => evaluationApi.listSubmissions())
  const evaluations = useMemo(() => data || [], [data])

  const stats = useMemo(
    () => ({
      pending: evaluations.filter((item) => !item.report_published).length,
      published: evaluations.filter((item) => item.report_published).length,
    }),
    [evaluations],
  )

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Evaluations"
        title="Your evaluations"
        description="Track your submissions and open reports after an administrator publishes them."
        actions={
          <Button
            variant="secondary"
            onClick={reload}
            loading={loading}
            leftIcon={<Icon name="refresh" size={18} />}
          >
            Refresh
          </Button>
        }
      />

      {error && (
        <div style={{ marginBottom: 24 }}>
          <Alert variant="danger" title="Unable to load evaluations">
            {error.message}
          </Alert>
        </div>
      )}

      <div className="grid grid-3" style={{ marginBottom: 28 }}>
        <StatCard icon="video" value={evaluations.length} label="Submitted" />
        <StatCard icon="clock" value={stats.pending} label="Results pending" />
        <StatCard icon="checkCircle" value={stats.published} label="Reports published" />
      </div>

      <div className="row-between" style={{ marginBottom: 14 }}>
        <h3>Evaluation history</h3>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading evaluations…" />
      ) : evaluations.length ? (
        <SessionTable
          sessions={evaluations}
          detailPath={(submission) => `/student/evaluations/${submission.id}`}
          actionLabel="View status"
          publicationGated
        />
      ) : (
        <Card>
          <CardBody>
            <EmptyState
              icon="chart"
              title="No evaluations yet"
              description="Submit your working demo to join the evaluation queue."
              action={
                <Button
                  as={Link}
                  to="/student/submission"
                  variant="accent"
                  leftIcon={<Icon name="upload" size={18} />}
                >
                  Create submission
                </Button>
              }
            />
          </CardBody>
        </Card>
      )}
    </div>
  )
}
