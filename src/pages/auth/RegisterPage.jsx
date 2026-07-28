import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../../components/layout/AuthShell'
import StudentRegisterForm from '../../components/auth/StudentRegisterForm'
import Icon from '../../components/ui/Icon'

/**
 * Learner registration entry. Expanding "Learner from Nxtwave" reveals a
 * section-wise wizard (one step at a time). Evaluator signup is not shown.
 */
export default function RegisterPage() {
  const [learnerOpen, setLearnerOpen] = useState(false)
  const [wizardMounted, setWizardMounted] = useState(false)

  const toggleLearner = () => {
    setLearnerOpen((open) => {
      const next = !open
      if (next) setWizardMounted(true)
      return next
    })
  }

  return (
    <AuthShell wide={learnerOpen || wizardMounted}>
      <div className="stack-md register-page">
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
            onClick={toggleLearner}
          >
            <span className="register-role-trigger__icon" aria-hidden="true">
              <Icon name="users" size={20} />
            </span>
            <span className="register-role-trigger__copy">
              <strong>Learner from Nxtwave</strong>
            </span>
            <Icon
              name="chevronDown"
              size={18}
              className={`register-role-trigger__chevron ${learnerOpen ? 'is-open' : ''}`}
            />
          </button>

          <div
            id="learner-register-panel"
            className="register-role-panel__collapse"
            data-open={learnerOpen ? 'true' : 'false'}
          >
            <div className="register-role-panel__collapse-inner">
              {wizardMounted && (
                <div
                  className="register-role-panel__body"
                  role="region"
                  aria-label="Learner registration"
                  aria-hidden={!learnerOpen}
                >
                  <StudentRegisterForm />
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-center text-muted">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  )
}
