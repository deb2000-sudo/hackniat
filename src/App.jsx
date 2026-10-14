import { Fragment, lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import {
  ADMIN_BASE,
  ADMIN_ROLES,
  adminPath,
  COMPLETE_PROFILE_PATH,
  PERMISSIONS,
  STAFF_BASE,
  SUPER_ADMIN_BASE,
} from './utils/access'
import { useAuth } from './hooks/useAuth'
import { ROLES } from './utils/constants'
import Layout from './components/layout/Layout'
import CompleteProfileRoute from './components/routing/CompleteProfileRoute'
import ProtectedRoute from './components/routing/ProtectedRoute'
import VerificationGate from './components/auth/VerificationGate'
import PublicOnlyRoute from './components/routing/PublicOnlyRoute'
import { LoadingBlock } from './components/ui/Spinner'

// Route-level code splitting: only the landing/auth shell is eager; every
// feature page loads on demand so login and first paint stay lean.
const DropLandingPage = lazy(() => import('./pages/DropLandingPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const EvaluatorRegisterPage = lazy(() => import('./pages/auth/EvaluatorRegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
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
const HackathonSettingsPage = lazy(() => import('./pages/admin/HackathonSettingsPage'))
const EvaluationRequirementsPage = lazy(() => import('./pages/admin/EvaluationRequirementsPage'))
const EvaluationRequirementFormPage = lazy(
  () => import('./pages/admin/EvaluationRequirementFormPage'),
)
const AdminSubmissionsPage = lazy(() => import('./pages/admin/AdminSubmissionsPage'))
const AdminSubmissionDetailPage = lazy(() => import('./pages/admin/AdminSubmissionDetailPage'))
const AdminHackathonSubmissionsPage = lazy(
  () => import('./pages/admin/AdminHackathonSubmissionsPage'),
)
const ThemesPage = lazy(() => import('./pages/admin/ThemesPage'))
const UniversitiesPage = lazy(() => import('./pages/admin/UniversitiesPage'))
const BatchesPage = lazy(() => import('./pages/admin/BatchesPage'))
const AiPromptsPage = lazy(() => import('./pages/admin/AiPromptsPage'))
const ApplicationSettingsPage = lazy(() => import('./pages/admin/ApplicationSettingsPage'))
const AccessRolesPage = lazy(() => import('./pages/admin/access/AccessRolesPage'))
const AccessUsersPage = lazy(() => import('./pages/admin/access/AccessUsersPage'))
// Carries recharts, so only Super Admin ever downloads it.
const ApplicationLogsPage = lazy(() => import('./pages/admin/access/ApplicationLogsPage'))
const NoAccessPage = lazy(() => import('./pages/admin/NoAccessPage'))
// Pulls in Firebase Phone Auth, so only loaded for someone who needs it.
const ProfileCompletionPage = lazy(() => import('./pages/auth/ProfileCompletionPage'))
const ChangePasswordPage = lazy(() => import('./pages/settings/ChangePasswordPage'))
const MetricScoringPage = lazy(() => import('./pages/MetricScoringPage'))

/** Redirect to an admin-shell path under the signed-in user's own prefix. */
function ShellRedirect({ to }) {
  const { user } = useAuth()
  return <Navigate to={adminPath(to, user)} replace />
}

/** An admin-shell screen that also needs one permission key. */
function AdminRoute({ permission }) {
  return <ProtectedRoute roles={ADMIN_ROLES} permission={permission} />
}

/**
 * The admin-shell screens under one browser prefix. Registered three times —
 * /admin for Admin, /super-admin for Super Admin, /staff for custom roles —
 * with the same page components; ProtectedRoute moves anyone on another
 * role's prefix to their own.
 * Each group also needs its screen's permission key, so a custom role only
 * reaches the screens saved on it.
 */
function adminShellRoutes(base) {
  return (
    <Fragment key={base}>
      {/* A custom role with no screens lands here; no permission needed. */}
      <Route element={<ProtectedRoute roles={ADMIN_ROLES} />}>
        <Route path={`${base}/no-access`} element={<NoAccessPage />} />
      </Route>
      <Route element={<AdminRoute permission={PERMISSIONS.OVERVIEW} />}>
        <Route path={base} element={<AdminDashboard />} />
      </Route>
      <Route element={<AdminRoute permission={PERMISSIONS.HACKATHONS} />}>
        <Route path={`${base}/hackathons`} element={<Navigate to="/hackathons" replace />} />
        {/* Draft-backed creation. /new is kept so old links still land
              in the right place. */}
        <Route path={`${base}/hackathons/create`} element={<HackathonFormPage draftFlow />} />
        <Route
          path={`${base}/hackathons/new`}
          element={<Navigate to={`${base}/hackathons/create`} replace />}
        />
        <Route path={`${base}/hackathons/:hackathonId/edit`} element={<HackathonFormPage />} />
        <Route
          path={`${base}/hackathons/:hackathonId/settings`}
          element={<HackathonSettingsPage />}
        />
      </Route>
      <Route element={<AdminRoute permission={PERMISSIONS.SUBMISSIONS} />}>
        <Route path={`${base}/submissions`} element={<AdminSubmissionsPage />} />
        <Route
          path={`${base}/submissions/hackathons/:hackathonId`}
          element={<AdminHackathonSubmissionsPage />}
        />
        <Route path={`${base}/submissions/:submissionId`} element={<AdminSubmissionDetailPage />} />
      </Route>
      <Route element={<AdminRoute permission={PERMISSIONS.THEMES} />}>
        <Route path={`${base}/themes`} element={<ThemesPage />} />
      </Route>
      <Route element={<AdminRoute permission={PERMISSIONS.UNIVERSITY_MANAGEMENT} />}>
        <Route path={`${base}/universities`} element={<UniversitiesPage />} />
      </Route>
      <Route element={<AdminRoute permission={PERMISSIONS.BATCH_MANAGEMENT} />}>
        <Route path={`${base}/batches`} element={<BatchesPage />} />
      </Route>
      <Route element={<AdminRoute permission={PERMISSIONS.VIDEO_ANALYSIS} />}>
        <Route path={`${base}/ai-prompts`} element={<AiPromptsPage />} />
      </Route>
      <Route element={<AdminRoute permission={PERMISSIONS.REQUIREMENTS} />}>
        <Route path={`${base}/evaluation-requirements`} element={<EvaluationRequirementsPage />} />
        <Route
          path={`${base}/evaluation-requirements/new`}
          element={<EvaluationRequirementFormPage />}
        />
        <Route
          path={`${base}/evaluation-requirements/:requirementId/edit`}
          element={<EvaluationRequirementFormPage />}
        />
        <Route
          path={`${base}/evaluation-requirements/:requirementId/ai-scoring`}
          element={<MetricScoringPage />}
        />
      </Route>
      <Route element={<AdminRoute permission={PERMISSIONS.STUDENT_MANAGEMENT} />}>
        <Route path={`${base}/users`} element={<UsersPage />} />
      </Route>
      <Route element={<AdminRoute permission={PERMISSIONS.EVALUATOR_MANAGEMENT} />}>
        <Route path={`${base}/evaluators`} element={<EvaluatorsPage />} />
      </Route>
      <Route element={<AdminRoute permission={PERMISSIONS.APPLICATION_SETTINGS} />}>
        <Route path={`${base}/settings`} element={<ApplicationSettingsPage />} />
      </Route>
      <Route element={<AdminRoute permission={PERMISSIONS.ROLE_MANAGEMENT} />}>
        <Route path={`${base}/access`} element={<Navigate to={`${base}/access/roles`} replace />} />
        <Route path={`${base}/access/roles`} element={<AccessRolesPage />} />
        <Route path={`${base}/access/users`} element={<AccessUsersPage />} />
        <Route path={`${base}/application-logs`} element={<ApplicationLogsPage />} />
      </Route>
    </Fragment>
  )
}

function RouteFallback() {
  return (
    <div className="drop min-h-screen bg-canvas">
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
            <Route path="/" element={<DropLandingPage />} />

            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/register/evaluator" element={<EvaluatorRegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* First-login setup: signed in, but outside Layout (no sidebar)
                and outside every admin permission check. */}
            <Route element={<ProtectedRoute />}>
              <Route element={<CompleteProfileRoute />}>
                <Route path={COMPLETE_PROFILE_PATH} element={<ProfileCompletionPage />} />
              </Route>
            </Route>

            <Route element={<Layout />}>
              <Route element={<ProtectedRoute />}>
                <Route path="/settings/change-password" element={<ChangePasswordPage />} />
                <Route path="/hackathons" element={<HackathonsPage />} />
                <Route path="/hackathons/:hackathonId" element={<HackathonDetailPage />} />
                <Route
                  path="/ai-scoring"
                  element={<ShellRedirect to="/admin/evaluation-requirements" />}
                />
              </Route>

              <Route element={<ProtectedRoute roles={[ROLES.STUDENT]} />}>
                <Route path="/student" element={<StudentDashboard />} />
                <Route path="/student/submission" element={<NewEvaluationPage />} />
                <Route
                  path="/student/new"
                  element={<Navigate to="/student/submission" replace />}
                />
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
                <Route
                  path="/evaluator/evaluations/:sessionId"
                  element={<EvaluationDetailPage />}
                />
              </Route>

              {/* Admin shell under each role's prefix: /admin (Admin),
                  /super-admin (Super Admin), /staff (custom roles). */}
              {adminShellRoutes(ADMIN_BASE)}
              {adminShellRoutes(SUPER_ADMIN_BASE)}
              {adminShellRoutes(STAFF_BASE)}

              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Route>
          </Routes>
        </Suspense>
        {/* Over every route: blocks the app until a due verification is done. */}
        <VerificationGate />
      </AuthProvider>
    </BrowserRouter>
  )
}
