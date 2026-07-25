import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ROLES } from '../../utils/constants'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { RoleBadge } from '../ui/Badge'

const NAV_BY_ROLE = {
  [ROLES.STUDENT]: [
    { to: '/student', label: 'Dashboard', end: true },
    { to: '/student/submission', label: 'Submission' },
    { to: '/student/evaluations', label: 'Evaluations' },
    { to: '/hackathons', label: 'Hackathons' },
  ],
  [ROLES.EVALUATOR]: [
    { to: '/evaluator', label: 'Dashboard', end: true },
    { to: '/evaluator/review', label: 'Review Submission' },
    { to: '/hackathons', label: 'Hackathons' },
  ],
  [ROLES.ADMIN]: [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/hackathons', label: 'Hackathons' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/evaluators', label: 'Evaluators' },
  ],
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const links = user ? NAV_BY_ROLE[user.role] || [] : []

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to={user ? `/${user.role}` : '/'} className="brand">
          <span className="brand__mark">
            <Icon name="sparkles" size={20} />
          </span>
          <span className="brand__name">
            Hack<span>NIAT</span>
          </span>
        </Link>

        {links.length > 0 && (
          <nav className="nav-links">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}

        {user ? (
          <div className="nav-user">
            <details className="user-menu">
              <summary className="user-menu__trigger" aria-label="Open profile and settings menu">
                <Avatar name={user.name} size="sm" />
                <div style={{ lineHeight: 1.2 }} className="text-sm user-menu__identity">
                  <div style={{ fontWeight: 600 }} className="truncate">
                    {user.name}
                  </div>
                  <RoleBadge role={user.role} />
                </div>
                <Icon name="chevronDown" size={16} className="user-menu__chevron" />
              </summary>
              <div className="user-menu__popover">
                <Link className="user-menu__item" to="/settings/change-password">
                  <Icon name="settings" size={18} />
                  Change password
                </Link>
                <button type="button" className="user-menu__item" onClick={handleLogout}>
                  <Icon name="logout" size={18} />
                  Logout
                </button>
              </div>
            </details>
          </div>
        ) : (
          <div className="row">
            <Button as={Link} to="/login" variant="ghost" size="sm">
              Sign in
            </Button>
            <Button as={Link} to="/register" variant="primary" size="sm">
              Get started
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
