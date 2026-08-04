import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import { WRAP_APP } from '../../components/drop/theme'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import StatCard from '../../components/ui/StatCard'
import { LoadingBlock } from '../../components/ui/Spinner'
import SessionTable from '../../components/evaluation/SessionTable'

export default function EvaluationsPage() {
  const { data, loading, error, reload } = useAsync(
    (opts) => evaluationApi.listSubmissions(opts),
    { key: queryKeys.submissionsMine, staleTime: 30_000 },
  )
  const evaluations = useMemo(() => data || [], [data])

  const stats = useMemo(
    () => ({
      pending: evaluations.filter((item) => !item.report_published).length,
      published: evaluations.filter((item) => item.report_published).length,
    }),
    [evaluations],
  )

  return (
    <div className={`${WRAP_APP} student-evaluations-page py-7 md:py-10`}>
      <PageHeader
        eyebrow="Evaluations"
        title="Your evaluations"
        description="Track your submissions and open reports after an administrator publishes them."
        actions={
          <Button
            variant="secondary"
            onClick={() => reload({ force: true })}
            loading={loading && !data}
            leftIcon={<Icon name="refresh" size={18} />}
          >
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="mb-6">
          <Alert variant="danger" title="Unable to load evaluations">
            {error.message}
          </Alert>
        </div>
      )}

      <div className="mb-8 grid grid-3 gap-4">
        <StatCard icon="video" value={evaluations.length} label="Submitted" />
        <StatCard icon="clock" value={stats.pending} label="Results pending" />
        <StatCard icon="checkCircle" value={stats.published} label="Reports published" />
      </div>

      <Card className="student-evaluations-history">
        <CardHeader>
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
              Evaluation history
            </h2>
            <p className="mt-1 text-[13.5px] text-muted">
              Open a submission to check status or view a published report.
            </p>
          </div>
        </CardHeader>
        <CardBody className="student-evaluations-history__body">
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
          )}
        </CardBody>
      </Card>
    </div>
  )
}
