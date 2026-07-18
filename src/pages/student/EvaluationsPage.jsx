import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { useAsync } from '../../hooks/useAsync'
import { EVALUATION_STATUS } from '../../utils/constants'
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
  const evaluations = useMemo(
    () => (data || []).filter((submission) => submission.status !== EVALUATION_STATUS.UPLOADED),
    [data],
  )

  const stats = useMemo(
    () => ({
      processing: evaluations.filter((item) => item.status === EVALUATION_STATUS.PROCESSING).length,
      completed: evaluations.filter((item) => item.status === EVALUATION_STATUS.COMPLETED).length,
      failed: evaluations.filter((item) => item.status === EVALUATION_STATUS.FAILED).length,
    }),
    [evaluations],
  )

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Evaluations"
        title="Your evaluations"
        description="Track analyses in progress and review completed AI evaluation reports."
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
        <StatCard icon="clock" value={stats.processing} label="In progress" />
        <StatCard icon="checkCircle" value={stats.completed} label="Completed" />
        <StatCard icon="alert" value={stats.failed} label="Failed" />
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
          actionLabel="View evaluation"
        />
      ) : (
        <Card>
          <CardBody>
            <EmptyState
              icon="chart"
              title="No evaluations yet"
              description="Create a submission and select Analyze to start your first evaluation."
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
