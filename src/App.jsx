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
import ReviewSubmissionPage from './pages/evaluator/ReviewSubmissionPage'

import AdminDashboard from './pages/admin/AdminDashboard'
import UsersPage from './pages/admin/UsersPage'
import EvaluatorsPage from './pages/admin/EvaluatorsPage'
import HackathonsPage from './pages/admin/HackathonsPage'
import HackathonFormPage from './pages/admin/HackathonFormPage'
import HackathonDetailPage from './pages/admin/HackathonDetailPage'
import ChangePasswordPage from './pages/settings/ChangePasswordPage'

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
              <Route path="/evaluator/review" element={<ReviewSubmissionPage />} />
              <Route path="/evaluator/evaluations/:sessionId" element={<EvaluationDetailPage />} />
            </Route>

            {/* Admin */}
            <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/hackathons" element={<Navigate to="/hackathons" replace />} />
              <Route path="/admin/hackathons/new" element={<HackathonFormPage />} />
              <Route path="/admin/hackathons/:hackathonId/edit" element={<HackathonFormPage />} />
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
