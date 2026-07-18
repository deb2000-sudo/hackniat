import { Link } from 'react-router-dom'
import Icon from '../ui/Icon'

const HIGHLIGHTS = [
  { icon: 'upload', text: 'Upload a demo video and get scored in minutes' },
  { icon: 'chart', text: 'Detailed breakdown across five judging criteria' },
  { icon: 'shield', text: 'Secure, role-based access for every participant' },
]

/** Two-column authentication layout with a branded promo aside. */
export default function AuthShell({ children, wide = false }) {
  return (
    <div className="auth">
      <aside className="auth__aside">
        <Link to="/" className="brand" style={{ color: '#fff' }}>
          <span className="brand__mark" style={{ background: 'rgba(255,255,255,0.18)', boxShadow: 'none' }}>
            <Icon name="sparkles" size={20} />
          </span>
          <span className="brand__name" style={{ color: '#fff' }}>
            HackNIAT
          </span>
        </Link>
        <div>
          <h2>Turn your hackathon demo into instant, structured feedback.</h2>
          <p>Join students and evaluators using AI to make hackathon judging faster and fairer.</p>
          <div style={{ marginTop: 28 }}>
            {HIGHLIGHTS.map((h) => (
              <div className="auth__feature" key={h.text}>
                <span className="auth__feature-icon">
                  <Icon name={h.icon} size={18} />
                </span>
                <span style={{ paddingTop: 6 }}>{h.text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
          © {new Date().getFullYear()} HackNIAT
        </p>
      </aside>
      <div className="auth__main">
        <div className={`auth__card ${wide ? 'auth__card--wide' : ''}`}>{children}</div>
      </div>
    </div>
  )
}
