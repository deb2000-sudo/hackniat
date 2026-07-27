import { useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ROLES } from '../../utils/constants'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import { RoleBadge } from '../ui/Badge'

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
  [ROLES.ADMIN]: [
    { to: '/admin', label: 'Overview', icon: 'chart', end: true },
    { to: '/admin/submissions', label: 'Submissions', icon: 'video' },
    { to: '/hackathons', label: 'Hackathons', icon: 'trophy' },
    { to: '/admin/themes', label: 'Themes', icon: 'sparkles' },
    { to: '/admin/evaluation-requirements', label: 'Requirements', icon: 'clipboard' },
    { to: '/ai-scoring', label: 'AI scoring', icon: 'spark' },
    {
      label: 'User Management',
      icon: 'users',
      children: [
        { to: '/admin/users', label: 'Student Management', icon: 'user' },
        { to: '/admin/evaluators', label: 'Evaluator Management', icon: 'shield' },
      ],
    },
  ],
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const links = user ? NAV_BY_ROLE[user.role] || [] : []

  const handleLogout = async () => {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  if (!user) return null

  return (
    <>
      <div className="mobile-sidebar-bar">
        <Link to={`/${user.role}`} className="brand">
          <span className="brand__mark"><Icon name="sparkles" size={19} /></span>
          <span className="brand__name">Hack<span>NIAT</span></span>
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
          <Link to={`/${user.role}`} className="brand" onClick={() => setOpen(false)}>
            <span className="brand__mark"><Icon name="sparkles" size={20} /></span>
            <span className="brand__name">Hack<span>NIAT</span></span>
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
          <span>{user.role === ROLES.ADMIN ? 'Administration' : 'Workspace'}</span>
          <small>{user.role === ROLES.ADMIN ? 'Manage HackNIAT' : 'HackNIAT portal'}</small>
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
                  defaultOpen={groupActive}
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
          <details className="sidebar-profile-menu">
            <summary className="sidebar-profile">
              <Avatar name={user.name} size="sm" />
              <div>
                <strong>{user.name}</strong>
                <RoleBadge role={user.role} />
              </div>
              <Icon name="chevronDown" size={16} className="sidebar-profile__chevron" />
            </summary>
            <div className="sidebar-profile-menu__popover">
              <div className="sidebar-profile-menu__heading">
                <small>Signed in as</small>
                <strong>{user.name}</strong>
              </div>
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
    </>
  )
}
