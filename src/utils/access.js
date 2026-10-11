import { ROLE_HOME, ROLES } from './constants'

/**
 * Admin screen permission keys, as sent in `user.permissions` and saved on a
 * custom role. The SUPER_ADMIN_ONLY keys (Application Settings, and the Access
 * screens via `ROLE_MANAGEMENT`) are never on a custom
 * role — only Super Admin has it.
 */
export const PERMISSIONS = {
  OVERVIEW: 'overview',
  SUBMISSIONS: 'submissions',
  HACKATHONS: 'hackathons',
  THEMES: 'themes',
  REQUIREMENTS: 'requirements',
  VIDEO_ANALYSIS: 'video_analysis',
  STUDENT_MANAGEMENT: 'student_management',
  EVALUATOR_MANAGEMENT: 'evaluator_management',
  UNIVERSITY_MANAGEMENT: 'university_management',
  BATCH_MANAGEMENT: 'batch_management',
  APPLICATION_SETTINGS: 'application_settings',
  ROLE_MANAGEMENT: 'role_management',
}

/** Roles that use the admin shell. */
export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CUSTOM]

/**
 * Browser path prefixes for the admin shell. Admin and custom roles live under
 * /admin; Super Admin gets the same screens under /super-admin. Only the
 * address bar differs — the API paths (/admin/users, …) are shared.
 */
export const ADMIN_BASE = '/admin'
export const SUPER_ADMIN_BASE = '/super-admin'

const ADMIN_PREFIX_RE = /^\/admin(?=\/|$)/
const SUPER_ADMIN_PREFIX_RE = /^\/super-admin(?=\/|$)/

/** The admin-shell prefix for this user's address bar. */
export function adminBase(user) {
  return user?.role === ROLES.SUPER_ADMIN ? SUPER_ADMIN_BASE : ADMIN_BASE
}

/**
 * Re-home an admin-shell path onto this user's prefix: `/admin/themes` becomes
 * `/super-admin/themes` for a Super Admin and the reverse for anyone else.
 * Paths outside the admin shell (e.g. /hackathons) come back unchanged.
 */
export function adminPath(path, user) {
  const base = adminBase(user)
  return String(path).replace(ADMIN_PREFIX_RE, base).replace(SUPER_ADMIN_PREFIX_RE, base)
}

/**
 * Where this user should be instead, when the path is on the other role's
 * prefix (a Super Admin on /admin…, an Admin or custom role on /super-admin…);
 * otherwise null. Students and evaluators are left to the role guards.
 */
export function crossAdminRedirect(pathname, user) {
  if (!user || !isAdminRole(user.role)) return null
  const wrong = user.role === ROLES.SUPER_ADMIN ? ADMIN_PREFIX_RE : SUPER_ADMIN_PREFIX_RE
  return wrong.test(pathname) ? adminPath(pathname, user) : null
}

/**
 * Where each admin screen lives, in sidebar order, written with the /admin
 * prefix — run through adminPath() for the user. A user is sent to the first
 * one they may open: /admin for Admin, /super-admin for Super Admin.
 */
export const ADMIN_SCREENS = [
  { permission: PERMISSIONS.OVERVIEW, to: '/admin' },
  { permission: PERMISSIONS.SUBMISSIONS, to: '/admin/submissions' },
  { permission: PERMISSIONS.HACKATHONS, to: '/hackathons' },
  { permission: PERMISSIONS.THEMES, to: '/admin/themes' },
  { permission: PERMISSIONS.REQUIREMENTS, to: '/admin/evaluation-requirements' },
  { permission: PERMISSIONS.VIDEO_ANALYSIS, to: '/admin/ai-prompts' },
  { permission: PERMISSIONS.STUDENT_MANAGEMENT, to: '/admin/users' },
  { permission: PERMISSIONS.EVALUATOR_MANAGEMENT, to: '/admin/evaluators' },
  { permission: PERMISSIONS.UNIVERSITY_MANAGEMENT, to: '/admin/universities' },
  { permission: PERMISSIONS.BATCH_MANAGEMENT, to: '/admin/batches' },
  { permission: PERMISSIONS.APPLICATION_SETTINGS, to: '/admin/settings' },
  { permission: PERMISSIONS.ROLE_MANAGEMENT, to: '/admin/access/roles' },
]

/**
 * First-login setup for an account Super Admin created (`profile_completed:
 * false`). Its own page, outside the admin shell, so the address bar says
 * where the user is instead of showing an admin path the API would refuse.
 */
export const COMPLETE_PROFILE_PATH = '/complete-profile'

/** Has this signed-in user still to finish first-login setup? Only an explicit false counts. */
export function needsProfileCompletion(user) {
  return user?.profile_completed === false
}

/** Landing page for a custom role that has no screens at all. */
export const NO_ACCESS_PATH = '/admin/no-access'

/**
 * Screens only Super Admin may open. The API answers anyone else with 403, so
 * they are never granted to Admin in code, never offered as a custom-role
 * checkbox, and dropped from a custom role saved before they were restricted.
 */
export const SUPER_ADMIN_ONLY = [PERMISSIONS.APPLICATION_SETTINGS, PERMISSIONS.ROLE_MANAGEMENT]

/** Every admin screen built-in Admin gets. */
const ADMIN_AREAS = ADMIN_SCREENS.map((screen) => screen.permission).filter(
  (key) => !SUPER_ADMIN_ONLY.includes(key),
)

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role)
}

/**
 * The screens this user may open.
 *
 * Admin and Super Admin are fixed built-in roles, so their screens come from
 * the role itself — Admin keeps exactly today's sidebar even if `permissions`
 * is missing from an older /auth/me. A custom user gets only what the server
 * sent; everyone else gets nothing.
 */
export function userPermissions(user) {
  if (!user) return []
  if (user.role === ROLES.SUPER_ADMIN) return [...ADMIN_AREAS, ...SUPER_ADMIN_ONLY]
  if (user.role === ROLES.ADMIN) return ADMIN_AREAS
  if (user.role === ROLES.CUSTOM && Array.isArray(user.permissions)) {
    return user.permissions.filter((key) => !SUPER_ADMIN_ONLY.includes(key))
  }
  return []
}

export function hasPermission(user, key) {
  return userPermissions(user).includes(key)
}

/**
 * Where to send this user: first-login setup while their profile is
 * unfinished, otherwise their role home or first allowed admin screen.
 */
export function homePath(user) {
  if (!user) return '/'
  // Checked before role and permissions: until setup is done the API refuses
  // every screen, and a custom role's permissions may not be filled in yet.
  if (needsProfileCompletion(user)) return COMPLETE_PROFILE_PATH
  if (!isAdminRole(user.role)) return ROLE_HOME[user.role] || '/'
  const allowed = userPermissions(user)
  const screen = ADMIN_SCREENS.find((entry) => allowed.includes(entry.permission))
  return screen ? adminPath(screen.to, user) : NO_ACCESS_PATH
}

const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.EVALUATOR]: 'Evaluator',
  [ROLES.STUDENT]: 'Student',
}

/** Display name for an account's role; custom accounts show their role's name. */
export function roleLabel(account) {
  if (!account) return ''
  if (account.role === ROLES.CUSTOM) return account.custom_role_name || 'Custom'
  return ROLE_LABELS[account.role] || account.role || ''
}
