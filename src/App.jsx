import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ROLES } from './utils/constants'

import Layout from './components/layout/Layout'
import ProtectedRoute from './components/routing/ProtectedRoute'
import PublicOnlyRoute from './components/routing/PublicOnlyRoute'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import NotFoundPage from './pages/NotFoundPage'

import StudentDashboard from './pages/student/StudentDashboard'
import NewEvaluationPage from './pages/student/NewEvaluationPage'
import SubmissionVideoPage from './pages/student/SubmissionVideoPage'
import EvaluationsPage from './pages/student/EvaluationsPage'
import EvaluationDetailPage from './pages/evaluation/EvaluationDetailPage'

import EvaluatorDashboard from './pages/evaluator/EvaluatorDashboard'
import EvaluatorHackathonSubmissionsPage from './pages/evaluator/EvaluatorHackathonSubmissionsPage'
import EvaluatorSubmissionDetailPage from './pages/evaluator/EvaluatorSubmissionDetailPage'

import AdminDashboard from './pages/admin/AdminDashboard'
import UsersPage from './pages/admin/UsersPage'
import EvaluatorsPage from './pages/admin/EvaluatorsPage'
import HackathonsPage from './pages/admin/HackathonsPage'
import HackathonFormPage from './pages/admin/HackathonFormPage'
import HackathonDetailPage from './pages/admin/HackathonDetailPage'
import EvaluationRequirementsPage from './pages/admin/EvaluationRequirementsPage'
import EvaluationRequirementFormPage from './pages/admin/EvaluationRequirementFormPage'
import AdminSubmissionsPage from './pages/admin/AdminSubmissionsPage'
import AdminSubmissionDetailPage from './pages/admin/AdminSubmissionDetailPage'
import AdminHackathonSubmissionsPage from './pages/admin/AdminHackathonSubmissionsPage'
import ThemesPage from './pages/admin/ThemesPage'
import ChangePasswordPage from './pages/settings/ChangePasswordPage'
import MetricScoringPage from './pages/MetricScoringPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* Auth (redirect away if already signed in) */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Authenticated app chrome */}
          <Route element={<Layout />}>
            <Route element={<ProtectedRoute />}>
              <Route path="/settings/change-password" element={<ChangePasswordPage />} />
              <Route path="/hackathons" element={<HackathonsPage />} />
              <Route path="/hackathons/:hackathonId" element={<HackathonDetailPage />} />
              <Route path="/ai-scoring" element={<MetricScoringPage />} />
            </Route>

            {/* Student */}
            <Route element={<ProtectedRoute roles={[ROLES.STUDENT]} />}>
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/student/submission" element={<NewEvaluationPage />} />
              <Route path="/student/new" element={<Navigate to="/student/submission" replace />} />
              <Route path="/student/submissions/:sessionId" element={<SubmissionVideoPage />} />
              <Route path="/student/evaluations" element={<EvaluationsPage />} />
              <Route path="/student/evaluations/:sessionId" element={<EvaluationDetailPage />} />
            </Route>

            {/* Evaluator */}
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

            {/* Admin */}
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
      </AuthProvider>
    </BrowserRouter>
  )
}
