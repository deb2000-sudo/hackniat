import { accountName } from '../../utils/format'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'

/**
 * Confirm deleting one account (a student or an evaluator).
 *
 * Names the person in the message and on the button, so the admin confirms
 * who they are removing, and lists what the delete does to their data —
 * `consequences` differ per account type. Closing is blocked while the delete
 * is in flight.
 */
export default function DeleteUserModal({
  account,
  title,
  consequences = [],
  error = '',
  deleting = false,
  onCancel,
  onConfirm,
}) {
  const name = accountName(account)
  return (
    <Modal
      open={!!account}
      onClose={() => !deleting && onCancel()}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={deleting}
            leftIcon={<Icon name="trash" size={16} />}
          >
            Delete {name}
          </Button>
        </>
      }
    >
      <div className="stack-md">
        {error && <Alert variant="danger">{error}</Alert>}
        <p>
          Delete <strong>{name}</strong>
          {account?.email && account.email !== name ? <> ({account.email})</> : null}? This cannot be
          undone.
        </p>
        {consequences.length > 0 && (
          <ul className="text-sm text-muted" style={{ paddingLeft: 18, listStyle: 'disc' }}>
            {consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
