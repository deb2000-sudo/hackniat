import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'

/** Team members with the leader called out, plus a size counter. */
export default function TeamRoster({ team }) {
  const members = team?.members || []
  const max = team?.max_members || members.length

  return (
    <div className="stack-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          {team?.team_name || 'Your team'}
        </span>
        <span className="text-[13px] text-muted">
          {members.length} of {max} {max === 1 ? 'member' : 'members'}
          {team?.is_full ? ' · Team full' : ''}
        </span>
      </div>

      <ul className="stack-sm">
        {members.map((member) => (
          <li
            key={member.user_id || member.email}
            className="flex items-center gap-3 rounded-drop border border-hairline bg-surface px-3.5 py-3"
          >
            <Avatar name={member.name || member.email} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium text-ink">
                {member.name || member.email}
              </div>
              {member.name && member.email && (
                <div className="truncate text-[12px] text-muted">{member.email}</div>
              )}
            </div>
            {member.role === 'leader' && <Badge variant="brand">Leader</Badge>}
          </li>
        ))}
        {!members.length && <li className="text-sm text-muted">No members yet.</li>}
      </ul>
    </div>
  )
}
