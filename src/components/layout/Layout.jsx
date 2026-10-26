import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { COMPLETE_PROFILE_PATH, needsProfileCompletion } from '../../utils/access'
import { useDropSurface } from '../drop/useDropSurface'
import Navbar from './Navbar'
import Footer from './Footer'

/**
 * App chrome for authenticated / main pages: navbar + content + footer.
 *
 * An account Super Admin created must finish its profile first, and until then
 * the API refuses every screen. So any page in this shell — /admin,
 * /super-admin, a typed URL — sends that user to /complete-profile, which lives
 * outside the shell (no sidebar). Only an explicit `false` redirects: students,
 * evaluators and seeded accounts are never blocked by a missing flag.
 */
export default function Layout() {
  useDropSurface()
  const { user } = useAuth()

  if (needsProfileCompletion(user)) {
    return <Navigate to={COMPLETE_PROFILE_PATH} replace />
  }

  return (
    <div className="drop app-shell">
      <Navbar />
      <div className="app-content">
        <main className="grow">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}
