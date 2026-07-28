import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../../components/layout/AuthShell'
import StudentRegisterForm from '../../components/auth/StudentRegisterForm'
import Icon from '../../components/ui/Icon'

/**
 * Primary registration entry: learners expand the Nxtwave panel to register.
 * Evaluator signup lives on a separate lazy-loaded route.
 */
export default function RegisterPage() {
  const [learnerOpen, setLearnerOpen] = useState(false)

  return (
    <AuthShell wide={learnerOpen}>
      <div className="stack-md">
        <div>
          <h1>Create your account</h1>
          <p className="text-muted">Join HackNIAT to submit your hackathon project.</p>
        </div>

        <div className={`register-role-panel ${learnerOpen ? 'is-open' : ''}`}>
          <button
            type="button"
            className="register-role-trigger"
            aria-expanded={learnerOpen}
            aria-controls="learner-register-panel"
            onClick={() => setLearnerOpen((open) => !open)}
          >
            <span className="register-role-trigger__icon" aria-hidden="true">
              <Icon name="users" size={20} />
            </span>
            <span className="register-role-trigger__copy">
              <strong>Learner from Nxtwave</strong>
              <small>Register your student team to submit demos</small>
            </span>
            <Icon
              name="chevronDown"
              size={18}
              className={`register-role-trigger__chevron ${learnerOpen ? 'is-open' : ''}`}
            />
          </button>

          {learnerOpen && (
            <div
              id="learner-register-panel"
              className="register-role-panel__body"
              role="region"
              aria-label="Learner registration form"
            >
              <StudentRegisterForm />
            </div>
          )}
        </div>

        <div className="register-alt">
          <p className="text-sm text-muted">
            Registering as an evaluator?{' '}
            <Link to="/register/evaluator">Go to evaluator registration</Link>
          </p>
          <p className="text-sm text-center text-muted">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </AuthShell>
  )
}
