import { useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import BrandMark from '../brand/BrandMark'
import { useAuth } from '../../hooks/useAuth'
import { prefetchRouteData } from '../../lib/prefetch'
import { adminPath, isAdminRole, homePath, PERMISSIONS, userPermissions } from '../../utils/access'
import { ROLES } from '../../utils/constants'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import { RoleBadge } from '../ui/Badge'
import ThemeToggle from '../drop/ThemeToggle'
import ProfileModal from './ProfileModal'

const NAV_BY_ROLE = {
  [ROLES.STUDENT]: [
    { to: '/student', label: 'Dashboard', icon: 'chart', end: true },
    { to: '/student/submission', label: 'Submission', icon: 'upload' },
    { to: '/student/evaluations', label: 'Evaluations', icon: 'clipboard' },
    { to: '/hackathons', label: 'Hackathons', icon: 'trophy' },
  ],
  [ROLES.EVALUATOR]: [
    { to: '/evaluator', label: 'Assigned submissions', icon: 'clipboard', end: true },
    { to: '/hackathons', label: 'Hackathons', icon: 'trophy' },
  ],
}

/**
 * The admin sidebar. Each item carries the permission key that opens it, so a
 * custom role sees only its own screens; Admin and Super Admin see all of them.
 */
const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: 'chart', end: true, permission: PERMISSIONS.OVERVIEW },
  { to: '/admin/submissions', label: 'Submissions', icon: 'video', permission: PERMISSIONS.SUBMISSIONS },
  { to: '/hackathons', label: 'Hackathons', icon: 'trophy', permission: PERMISSIONS.HACKATHONS },
  { to: '/admin/themes', label: 'Themes', icon: 'sparkles', permission: PERMISSIONS.THEMES },
  {
    to: '/admin/evaluation-requirements',
    label: 'Requirements',
    icon: 'clipboard',
    permission: PERMISSIONS.REQUIREMENTS,
  },
  {
    to: '/admin/ai-prompts',
    label: 'Video Analysis',
    icon: 'sparkles',
    permission: PERMISSIONS.VIDEO_ANALYSIS,
  },
  {
    label: 'General Management',
    icon: 'users',
    children: [
      {
        to: '/admin/users',
        label: 'Student Management',
        icon: 'user',
        permission: PERMISSIONS.STUDENT_MANAGEMENT,
      },
      {
        to: '/admin/evaluators',
        label: 'Evaluator Management',
        icon: 'shield',
        permission: PERMISSIONS.EVALUATOR_MANAGEMENT,
      },
      // Campuses students pick from at registration — kept beside the people
      // pages because an unlisted campus blocks their sign-up.
      {
        to: '/admin/universities',
        label: 'University Management',
        icon: 'university',
        permission: PERMISSIONS.UNIVERSITY_MANAGEMENT,
      },
      {
        to: '/admin/batches',
        label: 'Batch Management',
        icon: 'calendar',
        permission: PERMISSIONS.BATCH_MANAGEMENT,
      },
    ],
  },
  {
    to: '/admin/settings',
    label: 'Application Settings',
    icon: 'settings',
    permission: PERMISSIONS.APPLICATION_SETTINGS,
  },
  // Super Admin only: no custom role can be given role_management.
  {
    label: 'Application Access',
    icon: 'shield',
    children: [
      {
        to: '/admin/access/roles',
        label: 'Application Managed Roles',
        icon: 'shield',
        permission: PERMISSIONS.ROLE_MANAGEMENT,
      },
      {
        to: '/admin/access/users',
        label: 'Application Managed Users',
        icon: 'userPlus',
        permission: PERMISSIONS.ROLE_MANAGEMENT,
      },
      {
        to: '/admin/application-logs',
        label: 'Application Logs',
        icon: 'chart',
        permission: PERMISSIONS.ROLE_MANAGEMENT,
      },
    ],
  },
]

/**
 * Sidebar items for this user, with groups that end up empty dropped. ADMIN_NAV
 * is written with /admin; a Super Admin's links move to /super-admin.
 * /hackathons is outside the admin shell and stays as it is.
 */
function navFor(user) {
  if (!isAdminRole(user.role)) return NAV_BY_ROLE[user.role] || []
  const allowed = userPermissions(user)
  const rehome = (item) => ({ ...item, to: adminPath(item.to, user) })
  return ADMIN_NAV.flatMap((item) => {
    if (!item.children) return allowed.includes(item.permission) ? [rehome(item)] : []
    const children = item.children
      .filter((child) => allowed.includes(child.permission))
      .map(rehome)
    return children.length ? [{ ...item, children }] : []
  })
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const links = user ? navFor(user) : []

  const handleLogout = async () => {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  if (!user) return null

  return (
    <>
      <div className="mobile-sidebar-bar">
        <Link to={homePath(user)} className="brand">
          <BrandMark variant="c" size={32} title="Challazo" />
          <span className="brand__name czm-wordmark">Challazo</span>
        </Link>
        <button
          type="button"
          className="mobile-sidebar-toggle"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
        >
          <Icon name="menu" size={22} />
        </button>
      </div>

      {open && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar__header">
          <Link to={homePath(user)} className="brand" onClick={() => setOpen(false)}>
            <BrandMark variant="c" size={34} title="Challazo" />
            <span className="brand__name czm-wordmark">Challazo</span>
          </Link>
          <button
            type="button"
            className="sidebar__close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="sidebar__workspace">
          <span>{isAdminRole(user.role) ? 'Administration' : 'Workspace'}</span>
          <small>{isAdminRole(user.role) ? 'Manage Challazo' : 'Challazo portal'}</small>
        </div>

        <nav className="sidebar__nav" aria-label="Primary navigation">
          <span className="sidebar__nav-label">Menu</span>
          {links.map((link) => {
            if (link.children) {
              const groupActive = link.children.some((child) =>
                location.pathname.startsWith(child.to),
              )
              return (
                <details
                  className={`sidebar-nav-group ${groupActive ? 'is-active' : ''}`}
                  open={groupActive || undefined}
                  key={link.label}
                >
                  <summary className="sidebar-link">
                    <span className="sidebar-link__icon"><Icon name={link.icon} size={19} /></span>
                    <span>{link.label}</span>
                    <Icon name="chevronDown" size={15} className="sidebar-nav-group__chevron" />
                  </summary>
                  <div className="sidebar-nav-group__items">
                    {link.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onMouseEnter={() => prefetchRouteData(child.to)}
                        onFocus={() => prefetchRouteData(child.to)}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          `sidebar-sub-link ${isActive ? 'is-active' : ''}`
                        }
                      >
                        <span><Icon name={child.icon} size={16} /></span>
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                </details>
              )
            }
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onMouseEnter={() => prefetchRouteData(link.to)}
                onFocus={() => prefetchRouteData(link.to)}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}
              >
                <span className="sidebar-link__icon"><Icon name={link.icon} size={19} /></span>
                <span>{link.label}</span>
                <Icon name="arrowRight" size={14} className="sidebar-link__arrow" />
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="mb-2 px-1">
            <ThemeToggle className="w-full" />
          </div>
          <details className="sidebar-profile-menu">
            <summary className="sidebar-profile">
              <Avatar name={user.name} size="sm" />
              <div>
                <strong>{user.name}</strong>
                <RoleBadge account={user} />
              </div>
              <Icon name="chevronDown" size={16} className="sidebar-profile__chevron" />
            </summary>
            <div className="sidebar-profile-menu__popover">
              <div className="sidebar-profile-menu__heading">
                <small>Signed in as</small>
                <strong>{user.name}</strong>
              </div>
              <button
                type="button"
                className="sidebar-utility"
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open')
                  setOpen(false)
                  setProfileOpen(true)
                }}
              >
                <Icon name="user" size={17} />
                Profile
              </button>
              <Link
                className="sidebar-utility"
                to="/settings/change-password"
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open')
                  setOpen(false)
                }}
              >
                <Icon name="settings" size={17} />
                Settings
              </Link>
              <button type="button" className="sidebar-utility sidebar-utility--danger" onClick={handleLogout}>
                <Icon name="logout" size={17} />
                Sign out
              </button>
            </div>
          </details>
        </div>
      </aside>

      {/* Mounted only while open, so it fetches /auth/me fresh each time. */}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  )
}
