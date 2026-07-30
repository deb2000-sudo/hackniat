import { Link } from 'react-router-dom'
import AuthShell from '../../components/layout/AuthShell'
import EvaluatorRegisterForm from '../../components/auth/EvaluatorRegisterForm'
import Icon from '../../components/ui/Icon'
import { LINK_INLINE } from '../../components/drop/theme'

/**
 * Dedicated evaluator registration page. Lazy-loaded so the student register
 * flow does not pay for this form until navigated here.
 */
export default function EvaluatorRegisterPage() {
  return (
    <AuthShell>
      <div className="stack-md">
        <div>
          <Link to="/register" className="register-back-link">
            <Icon name="arrowLeft" size={16} />
            Back to registration
          </Link>
          <h1>Evaluator registration</h1>
          <p className="text-muted">
            Create an evaluator account with your Nxtwave email. An administrator must approve
            your account before you can sign in.
          </p>
        </div>

        <EvaluatorRegisterForm />

        <p className="text-sm text-center text-muted">
          Already have an account? <Link to="/login" className={LINK_INLINE}>Sign in</Link>
        </p>
      </div>
    </AuthShell>
  )
}
