import { evaluationApi } from '../api/evaluation'
import { hackathonsApi } from '../api/hackathons'
import { adminApi } from '../api/admin'
import { ROLES } from '../utils/constants'
import { prefetchQuery } from './queryCache'
import { queryKeys } from './queryKeys'

/** Warm the caches the user is about to need after a successful login. */
export function prefetchForRole(role) {
  if (!role) return

  if (role === ROLES.STUDENT) {
    prefetchQuery(queryKeys.submissionsMine, () => evaluationApi.listSubmissions())
    prefetchQuery(queryKeys.hackathons, () => hackathonsApi.list())
    return
  }

  if (role === ROLES.EVALUATOR) {
    prefetchQuery(queryKeys.submissionsEvaluatorHackathons, () =>
      evaluationApi.listEvaluatorHackathons(),
    )
    prefetchQuery(queryKeys.hackathons, () => hackathonsApi.list())
    return
  }

  // Custom roles are skipped: their screens vary, and warming one they cannot
  // open would only fetch a 403.
  if (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN) {
    // Same loader as the page: this key holds the per-list shape it reads.
    prefetchQuery(queryKeys.adminOverview, () => adminApi.loadOverview())
    prefetchQuery(queryKeys.hackathons, () => hackathonsApi.list())
    // Must match what AdminSubmissionsPage reads from this key — warming it
    // with a bare array made the page render as empty.
    prefetchQuery(queryKeys.submissionsAdminHackathons, () =>
      evaluationApi.loadSubmissionHackathonsWithCounts(),
    )
  }
}

/** Prefetch by route path (nav hover / intent). */
export function prefetchRouteData(rawPathname) {
  if (!rawPathname) return
  // Super Admin's /super-admin… screens read the same data as /admin….
  const pathname = String(rawPathname).replace(/^\/super-admin(?=\/|$)/, '/admin')

  if (pathname === '/student' || pathname === '/student/evaluations') {
    prefetchQuery(queryKeys.submissionsMine, () => evaluationApi.listSubmissions())
  }
  if (pathname === '/student' || pathname === '/hackathons') {
    prefetchQuery(queryKeys.hackathons, () => hackathonsApi.list())
  }
  if (pathname === '/evaluator') {
    prefetchQuery(queryKeys.submissionsEvaluatorHackathons, () =>
      evaluationApi.listEvaluatorHackathons(),
    )
  }
  if (pathname === '/admin') {
    // Same loader as the page: this key holds the per-list shape it reads.
    prefetchQuery(queryKeys.adminOverview, () => adminApi.loadOverview())
    prefetchQuery(queryKeys.hackathons, () => hackathonsApi.list())
  }
  if (pathname === '/admin/submissions') {
    // Must match what AdminSubmissionsPage reads from this key — warming it
    // with a bare array made the page render as empty.
    prefetchQuery(queryKeys.submissionsAdminHackathons, () =>
      evaluationApi.loadSubmissionHackathonsWithCounts(),
    )
  }
  if (pathname === '/admin/users') {
    prefetchQuery(queryKeys.adminUsers, () => adminApi.getUsers())
  }
  if (pathname === '/admin/evaluators') {
    prefetchQuery(queryKeys.adminPendingEvaluators, async () => {
      const [evaluators, pending] = await Promise.all([
        adminApi.getEvaluators(),
        adminApi.getPendingEvaluators(),
      ])
      return { evaluators, pending }
    })
  }
}
