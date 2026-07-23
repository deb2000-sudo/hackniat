import Card, { CardBody, CardHeader } from '../ui/Card'
import { StatusBadge } from '../ui/Badge'
import Icon from '../ui/Icon'
import { formatDateTime } from '../../utils/format'

/** Read-only "Submission Info" panel for an evaluation session. */
export default function SessionMeta({ session }) {
  if (!session) return null
  const githubLink = session.github_repo_link || session.github_link
  const projectLink = session.project_link

  return (
    <Card className="submission-info">
      <CardHeader>
        <h3>Submission Info</h3>
        <StatusBadge status={session.status} />
      </CardHeader>
      <CardBody>
        <dl className="kv">
          <dt>Session ID</dt>
          <dd className="mono text-sm">{session.id}</dd>

          <dt>File</dt>
          <dd>{session.source_filename || '—'}</dd>

          {session.team_name && (
            <>
              <dt>Team</dt>
              <dd>{session.team_name}</dd>
            </>
          )}

          {session.theme_chosen && (
            <>
              <dt>Theme</dt>
              <dd>{session.theme_chosen}</dd>
            </>
          )}

          <dt>Submitted</dt>
          <dd>{formatDateTime(session.created_at)}</dd>

          <dt>Last updated</dt>
          <dd>{formatDateTime(session.updated_at)}</dd>

          {session.problem_statement && (
            <>
              <dt>Problem statement</dt>
              <dd>{session.problem_statement}</dd>
            </>
          )}
          {session.solution_description && (
            <>
              <dt>Solution</dt>
              <dd>{session.solution_description}</dd>
            </>
          )}
          {session.criteria && (
            <>
              <dt>Custom criteria</dt>
              <dd>{session.criteria}</dd>
            </>
          )}
        </dl>

        {(githubLink || projectLink) && (
          <div className="submission-info__links">
            {githubLink && (
              <a
                className="submission-info__link"
                href={githubLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="file" size={16} />
                GitHub repository
              </a>
            )}
            {projectLink && (
              <a
                className="submission-info__link"
                href={projectLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="arrowRight" size={16} />
                Project link
              </a>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
