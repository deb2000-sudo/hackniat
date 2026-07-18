import Card, { CardBody } from '../ui/Card'
import Spinner from '../ui/Spinner'
import Icon from '../ui/Icon'
import Alert from '../ui/Alert'
import { EVALUATION_STATUS } from '../../utils/constants'

/** Visual state for a session that is not yet completed. */
export default function SessionStatusPanel({ status, error }) {
  if (status === EVALUATION_STATUS.FAILED) {
    return (
      <Alert variant="danger" title="Evaluation failed">
        {error || 'Something went wrong while analyzing this submission. Please try uploading again.'}
      </Alert>
    )
  }

  const isProcessing = status === EVALUATION_STATUS.PROCESSING
  const isUploaded = status === EVALUATION_STATUS.UPLOADED

  return (
    <Card>
      <CardBody className="text-center stack-md" style={{ padding: '48px 24px' }}>
        {isProcessing || isUploaded ? (
          <div style={{ display: 'grid', placeItems: 'center', gap: 16 }}>
            <Spinner size="lg" />
            <div>
              <h3>{isProcessing ? 'Analyzing your submission…' : 'Preparing analysis…'}</h3>
              <p className="text-muted" style={{ marginTop: 6 }}>
                The AI is reviewing your video. This can take a little while — results will appear
                here automatically.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
            <Icon name="clock" size={32} className="text-muted" />
            <p className="text-muted">Waiting for status…</p>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
