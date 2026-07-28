import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ROLES } from './utils/constants'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/routing/ProtectedRoute'
import PublicOnlyRoute from './components/routing/PublicOnlyRoute'
import { LoadingBlock } from './components/ui/Spinner'

// Route-level code splitting: only the landing/auth shell is eager; every
// feature page loads on demand so login and first paint stay lean.
const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const EvaluatorRegisterPage = lazy(() => import('./pages/auth/EvaluatorRegisterPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'))
const NewEvaluationPage = lazy(() => import('./pages/student/NewEvaluationPage'))
const SubmissionVideoPage = lazy(() => import('./pages/student/SubmissionVideoPage'))
const EvaluationsPage = lazy(() => import('./pages/student/EvaluationsPage'))
const EvaluationDetailPage = lazy(() => import('./pages/evaluation/EvaluationDetailPage'))

const EvaluatorDashboard = lazy(() => import('./pages/evaluator/EvaluatorDashboard'))
const EvaluatorHackathonSubmissionsPage = lazy(
  () => import('./pages/evaluator/EvaluatorHackathonSubmissionsPage'),
)
const EvaluatorSubmissionDetailPage = lazy(
  () => import('./pages/evaluator/EvaluatorSubmissionDetailPage'),
)

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const UsersPage = lazy(() => import('./pages/admin/UsersPage'))
const EvaluatorsPage = lazy(() => import('./pages/admin/EvaluatorsPage'))
const HackathonsPage = lazy(() => import('./pages/admin/HackathonsPage'))
const HackathonFormPage = lazy(() => import('./pages/admin/HackathonFormPage'))
const HackathonDetailPage = lazy(() => import('./pages/admin/HackathonDetailPage'))
const EvaluationRequirementsPage = lazy(
  () => import('./pages/admin/EvaluationRequirementsPage'),
)
const EvaluationRequirementFormPage = lazy(
  () => import('./pages/admin/EvaluationRequirementFormPage'),
)
const AdminSubmissionsPage = lazy(() => import('./pages/admin/AdminSubmissionsPage'))
const AdminSubmissionDetailPage = lazy(
  () => import('./pages/admin/AdminSubmissionDetailPage'),
)
const AdminHackathonSubmissionsPage = lazy(
  () => import('./pages/admin/AdminHackathonSubmissionsPage'),
)
const ThemesPage = lazy(() => import('./pages/admin/ThemesPage'))
const ChangePasswordPage = lazy(() => import('./pages/settings/ChangePasswordPage'))
const MetricScoringPage = lazy(() => import('./pages/MetricScoringPage'))

function RouteFallback() {
  return (
    <div className="container page">
      <LoadingBlock label="Loading…" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/register/evaluator" element={<EvaluatorRegisterPage />} />
            </Route>

            <Route element={<Layout />}>
              <Route element={<ProtectedRoute />}>
                <Route path="/settings/change-password" element={<ChangePasswordPage />} />
                <Route path="/hackathons" element={<HackathonsPage />} />
                <Route path="/hackathons/:hackathonId" element={<HackathonDetailPage />} />
                <Route path="/ai-scoring" element={<MetricScoringPage />} />
              </Route>

              <Route element={<ProtectedRoute roles={[ROLES.STUDENT]} />}>
                <Route path="/student" element={<StudentDashboard />} />
                <Route path="/student/submission" element={<NewEvaluationPage />} />
                <Route path="/student/new" element={<Navigate to="/student/submission" replace />} />
                <Route path="/student/submissions/:sessionId" element={<SubmissionVideoPage />} />
                <Route path="/student/evaluations" element={<EvaluationsPage />} />
                <Route path="/student/evaluations/:sessionId" element={<EvaluationDetailPage />} />
              </Route>

              <Route element={<ProtectedRoute roles={[ROLES.EVALUATOR]} />}>
                <Route path="/evaluator" element={<EvaluatorDashboard />} />
                <Route path="/evaluator/review" element={<Navigate to="/evaluator" replace />} />
                <Route
                  path="/evaluator/hackathons/:hackathonId"
                  element={<EvaluatorHackathonSubmissionsPage />}
                />
                <Route
                  path="/evaluator/submissions/:submissionId"
                  element={<EvaluatorSubmissionDetailPage />}
                />
                <Route path="/evaluator/evaluations/:sessionId" element={<EvaluationDetailPage />} />
              </Route>

              <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/hackathons" element={<Navigate to="/hackathons" replace />} />
                <Route path="/admin/hackathons/new" element={<HackathonFormPage />} />
                <Route path="/admin/hackathons/:hackathonId/edit" element={<HackathonFormPage />} />
                <Route path="/admin/submissions" element={<AdminSubmissionsPage />} />
                <Route
                  path="/admin/submissions/hackathons/:hackathonId"
                  element={<AdminHackathonSubmissionsPage />}
                />
                <Route path="/admin/submissions/:submissionId" element={<AdminSubmissionDetailPage />} />
                <Route path="/admin/themes" element={<ThemesPage />} />
                <Route path="/admin/evaluation-requirements" element={<EvaluationRequirementsPage />} />
                <Route
                  path="/admin/evaluation-requirements/new"
                  element={<EvaluationRequirementFormPage />}
                />
                <Route
                  path="/admin/evaluation-requirements/:requirementId/edit"
                  element={<EvaluationRequirementFormPage />}
                />
                <Route
                  path="/admin/evaluation-requirements/:evaluationRequirementId/ai-scoring"
                  element={<MetricScoringPage />}
                />
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/evaluators" element={<EvaluatorsPage />} />
              </Route>

              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
