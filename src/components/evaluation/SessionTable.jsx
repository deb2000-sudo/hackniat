import { Link } from 'react-router-dom'
import { StatusBadge } from '../ui/Badge'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { formatDateTime, formatScore } from '../../utils/format'

/**
 * Table of evaluation sessions.
 * @param {Array} sessions
 * @param {(session) => string} detailPath  builds the link to a session detail
 * @param {string} actionLabel label for the row action
 */
export default function SessionTable({ sessions, detailPath, actionLabel = 'View' }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Submission</th>
            <th>Status</th>
            <th>Score</th>
            <th>Submitted</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>
                <div className="row" style={{ gap: 10 }}>
                  <Icon name="video" size={18} className="text-muted" />
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {s.team_name || s.title || s.source_filename || 'Submission'}
                    </div>
                    <div className="text-xs text-subtle">
                      {[s.theme_chosen, s.source_filename].filter(Boolean).join(' · ')}
                    </div>
                    <div className="text-xs text-subtle mono">{s.id.slice(0, 12)}…</div>
                  </div>
                </div>
              </td>
              <td>
                <StatusBadge status={s.status} />
              </td>
              <td className="mono" style={{ fontWeight: 700 }}>
                {s.overall_score != null ? formatScore(s.overall_score) : '—'}
              </td>
              <td className="text-muted text-sm">{formatDateTime(s.created_at)}</td>
              <td style={{ textAlign: 'right' }}>
                <Button
                  as={Link}
                  to={detailPath(s)}
                  variant="ghost"
                  size="sm"
                  rightIcon={<Icon name="arrowRight" size={16} />}
                >
                  {actionLabel}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
