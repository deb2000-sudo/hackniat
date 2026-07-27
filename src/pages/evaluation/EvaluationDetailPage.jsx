import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { usePolling } from '../../hooks/usePolling'
import { useAuth } from '../../hooks/useAuth'
import { EVALUATION_STATUS, ROLE_HOME, ROLES } from '../../utils/constants'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Alert from '../../components/ui/Alert'
import { LoadingBlock } from '../../components/ui/Spinner'
import SessionMeta from '../../components/evaluation/SessionMeta'
import SessionStatusPanel from '../../components/evaluation/SessionStatusPanel'
import EvaluationResultView from '../../components/evaluation/EvaluationResultView'
import SubmissionReport from '../../components/evaluation/SubmissionReport'
import Card, { CardBody } from '../../components/ui/Card'

const TERMINAL = [EVALUATION_STATUS.COMPLETED, EVALUATION_STATUS.FAILED]

export default function EvaluationDetailPage() {
  const { sessionId } = useParams()
  const { user } = useAuth()
  const isStudent = user?.role === ROLES.STUDENT

  const fetcher = useCallback(() => evaluationApi.getSubmission(sessionId), [sessionId])

  const { data: session, error, loading } = usePolling(fetcher, {
    isDone: (s) => isStudent ? !!s?.report_published : TERMINAL.includes(s?.status),
    interval: 3000,
  })

  const backTo = ROLE_HOME[user?.role] || '/'

  if (loading && !session) {
    return (
      <div className="container page">
        <LoadingBlock label="Loading evaluation…" />
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="container container--narrow page stack-md">
        <Alert variant="danger" title="Unable to load this evaluation">
          {error.message}
        </Alert>
        <div>
          <Button as={Link} to={backTo} variant="secondary" leftIcon={<Icon name="arrowLeft" size={18} />}>
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }

  const canViewResult = isStudent
    ? !!session?.report_published
    : session?.status === EVALUATION_STATUS.COMPLETED

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Evaluation"
        title={session?.team_name || session?.title || session?.source_filename || 'Submission'}
        description={
          isStudent
            ? 'Track publication status and view your report when it becomes available.'
            : 'AI evaluation of the submitted hackathon demo.'
        }
        actions={
          <Button
            as={Link}
            to={backTo}
            variant="secondary"
            leftIcon={<Icon name="arrowLeft" size={18} />}
          >
            Back
          </Button>
        }
      />

      <div className="detail-layout">
        <SessionMeta session={session} />
        <div className="stack-lg">
          {canViewResult ? (
            <>
              <EvaluationResultView result={session.result} />
              <SubmissionReport submissionId={session.id} />
            </>
          ) : isStudent ? (
            <Card className="student-result-pending">
              <CardBody>
                <span><Icon name="clock" size={28} /></span>
                <h2>Submitted — results pending</h2>
                <p>
                  Your submission was recorded successfully. The evaluation report will appear
                  here after the hackathon ends and an administrator publishes it.
                </p>
              </CardBody>
            </Card>
          ) : (
            <SessionStatusPanel status={session?.status} error={session?.error} />
          )}
        </div>
      </div>
    </div>
  )
}
