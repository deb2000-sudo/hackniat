import { Link } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import Button from '../components/ui/Button'
import Card, { CardBody } from '../components/ui/Card'
import Icon from '../components/ui/Icon'
import { CRITERIA_LABELS } from '../utils/constants'

const FEATURES = [
  {
    icon: 'upload',
    title: 'Upload your demo',
    desc: 'Submit your hackathon demo video in a couple of clicks. We handle the rest.',
  },
  {
    icon: 'sparkles',
    title: 'AI-powered evaluation',
    desc: 'Our AI watches your submission and scores it across five key hackathon criteria.',
  },
  {
    icon: 'chart',
    title: 'Actionable feedback',
    desc: 'Get a detailed breakdown with strengths, improvements and a clear recommendation.',
  },
  {
    icon: 'shield',
    title: 'Role-based access',
    desc: 'Purpose-built experiences for students, evaluators and administrators.',
  },
]

export default function LandingPage() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="grow">
        <section className="container">
          <div className="hero">
            <span className="hero__badge">
              <Icon name="sparkles" size={16} />
              AI Hackathon Evaluator
            </span>
            <h1>Evaluate hackathon submissions with AI</h1>
            <p>
              HackNIAT analyzes your project demo video and delivers instant, structured feedback —
              overall score, criteria breakdown, strengths, and next steps — so teams improve faster
              and evaluators judge fairer.
            </p>
            <div className="hero__actions">
              <Button as={Link} to="/register" variant="accent" size="lg" rightIcon={<Icon name="arrowRight" size={18} />}>
                Get started free
              </Button>
              <Button as={Link} to="/login" variant="secondary" size="lg">
                Sign in
              </Button>
            </div>
          </div>
        </section>

        <section className="container page">
          <div className="grid grid-4">
            {FEATURES.map((f) => (
              <Card key={f.title} hover className="feature-card">
                <div className="feature-card__icon">
                  <Icon name={f.icon} size={22} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="container page">
          <Card>
            <CardBody>
              <div className="split-center">
                <div className="stack-md">
                  <div className="eyebrow" style={{ color: 'var(--brand-600)' }}>
                    How scoring works
                  </div>
                  <h2>Five criteria, one clear score</h2>
                  <p className="text-muted">
                    Every submission is scored out of 10 on each dimension below, then combined into
                    an overall score with a written recommendation.
                  </p>
                  <div className="hero__actions" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
                    <Button as={Link} to="/register" variant="primary">
                      Submit a project
                    </Button>
                  </div>
                </div>
                <div className="stack-sm">
                  {Object.values(CRITERIA_LABELS).map((label, i) => (
                    <div key={label} className="row" style={{ gap: 12 }}>
                      <span className="avatar avatar--sm" style={{ background: 'var(--brand-600)' }}>
                        {i + 1}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        </section>
      </main>
      <Footer />
    </div>
  )
}
