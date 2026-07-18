import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ROLE_HOME } from '../utils/constants'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

export default function NotFoundPage() {
  const { user } = useAuth()
  const home = user ? ROLE_HOME[user.role] || '/' : '/'
  return (
    <div className="container page" style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
      <div className="text-center stack-md">
        <div style={{ fontSize: '5rem', fontWeight: 800, color: 'var(--brand-600)', lineHeight: 1 }}>
          404
        </div>
        <h1>Page not found</h1>
        <p className="text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button as={Link} to={home} variant="accent" leftIcon={<Icon name="arrowLeft" size={18} />}>
            Back home
          </Button>
        </div>
      </div>
    </div>
  )
}
