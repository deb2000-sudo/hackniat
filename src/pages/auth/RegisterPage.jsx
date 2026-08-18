import { Link } from 'react-router-dom'
import AuthShell from '../../components/layout/AuthShell'
import StudentRegisterForm from '../../components/auth/StudentRegisterForm'
import { LINK_INLINE } from '../../components/drop/theme'

export default function RegisterPage() {
  return (
    <AuthShell wide>
      <div className="stack-md register-page">
        <div>
          <h1>Create your account</h1>
          <p className="text-muted">
            Register as a learner. Team details are added later when you submit a project.
          </p>
        </div>
        <StudentRegisterForm />
        <p className="text-sm text-center text-muted">
          Already have an account?{' '}
          <Link to="/login" className={LINK_INLINE}>
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
