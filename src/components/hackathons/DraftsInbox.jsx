import { Link } from 'react-router-dom'
import Icon from '../ui/Icon'
import { DRAFT_STEPS, draftStepLabel } from './draftSteps'

/** "3 minutes ago" style stamp, falling back to the raw date for anything old. */
function lastEdited(value) {
  if (!value) return 'Not edited yet'
  const then = new Date(value)
  if (Number.isNaN(then.getTime())) return 'Not edited yet'
  const minutes = Math.round((Date.now() - then.getTime()) / 60000)
  if (minutes < 1) return 'Last edited just now'
  if (minutes < 60) return `Last edited ${minutes} min ago`
  if (minutes < 1440) return `Last edited ${Math.round(minutes / 60)} h ago`
  return `Last edited ${then.toLocaleDateString()}`
}

/**
 * Unfinished hackathons, so a half-built event is something you come back to
 * rather than something you lose. Each row resumes exactly where it stopped.
 */
export default function DraftsInbox({ drafts, onDiscard, discardingId = '' }) {
  if (!drafts?.length) return null

  return (
    <section className="drafts-inbox">
      <header className="drafts-inbox__head">
        <h2>
          Unfinished drafts
          <span className="drafts-inbox__count">{drafts.length}</span>
        </h2>
        <p>Pick up where you left off. Drafts are only visible to admins.</p>
      </header>

      <ul className="drafts-inbox__list">
        {drafts.map((draft) => {
          const completed = draft.completed_steps || []
          return (
            <li className="drafts-inbox__row" key={draft.id}>
              <div className="drafts-inbox__main">
                <strong>{draft.name?.trim() || 'Untitled hackathon draft'}</strong>
                <small>
                  {lastEdited(draft.updated_at)} · Resumes at{' '}
                  {draftStepLabel(draft.current_step)}
                </small>
              </div>

              <ol className="drafts-inbox__checklist" aria-label="Sections completed">
                {DRAFT_STEPS.map((item) => {
                  const done = completed.includes(item.key)
                  return (
                    <li key={item.key} className={done ? 'is-done' : ''} title={item.label}>
                      <Icon name={done ? 'checkCircle' : item.icon} size={14} />
                      <span>{item.label}</span>
                    </li>
                  )
                })}
              </ol>

              <div className="drafts-inbox__actions">
                <Link to={`/admin/hackathons/create?draftId=${encodeURIComponent(draft.id)}`}>
                  Continue editing
                  <Icon name="arrowRight" size={15} />
                </Link>
                <button
                  type="button"
                  onClick={() => onDiscard?.(draft)}
                  disabled={discardingId === draft.id}
                >
                  {discardingId === draft.id ? 'Discarding…' : 'Discard'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
