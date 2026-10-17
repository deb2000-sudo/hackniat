import { formatDateTime } from '../../utils/format'
import Card, { CardBody, CardHeader } from '../ui/Card'
import Icon from '../ui/Icon'

/**
 * Every evaluator change on a submission, newest first: when, who changed it,
 * from → to, and the reason given. Read from `assignment_history`; renders
 * nothing until there is at least one entry.
 */
export default function AssignmentHistoryCard({ history }) {
  const entries = (Array.isArray(history) ? [...history] : []).sort((a, b) =>
    String(b?.changed_at || '').localeCompare(String(a?.changed_at || '')),
  )
  if (!entries.length) return null

  return (
    <Card>
      <CardHeader>
        <div>
          <h3>Assignment history</h3>
          <p className="text-sm text-muted">Evaluator changes and the reason given for each.</p>
        </div>
        <Icon name="clock" size={20} className="text-muted" />
      </CardHeader>
      <CardBody>
        <ol className="stack-md">
          {entries.map((entry, index) => {
            const from = entry.from_evaluator_name || (entry.from_evaluator_id ? 'Evaluator' : 'Unassigned')
            const to = entry.to_evaluator_name || (entry.to_evaluator_id ? 'Evaluator' : 'Unassigned')
            return (
              <li
                key={`${entry.changed_at}-${index}`}
                className="rounded-drop border border-hairline p-3"
              >
                <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium text-ink">
                  <span>{from}</span>
                  <Icon name="arrowRight" size={13} className="text-muted" />
                  <span>{to}</span>
                </div>
                <p className="mt-1 text-[12.5px] text-muted">
                  {formatDateTime(entry.changed_at)} IST
                  {entry.changed_by_name ? ` · by ${entry.changed_by_name}` : ''}
                  {entry.evaluation_submitted ? ' · after the evaluation was submitted' : ''}
                </p>
                {entry.reason && (
                  <p className="mt-2 rounded-md bg-raised px-2.5 py-1.5 text-[13px] text-ink">
                    {entry.reason}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      </CardBody>
    </Card>
  )
}
