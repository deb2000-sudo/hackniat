import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'

/**
 * Team members with the leader called out, plus a size counter:
 *
 * - no fixed size (max_members null): "3 members"
 * - exact size: "2 of 3"
 * - a range: "2 of 2–6" — already big enough to submit, and can still grow
 *
 * "· Team full" only when the API says so (a sized team at its maximum).
 */
export default function TeamRoster({ team, minMembers }) {
  const members = team?.members || []
  const count = Number(team?.member_count ?? members.length) || members.length
  const max = team?.max_members == null ? null : Number(team.max_members)
  const min = Number(team?.min_members ?? minMembers) || 0
  const unit = (n) => (n === 1 ? 'member' : 'members')
  const counter =
    max == null
      ? `${count} ${unit(count)}`
      : min > 1 && min < max
        ? `${count} of ${min}–${max}`
        : `${count} of ${max}`

  return (
    <div className="stack-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          {team?.team_name || 'Your team'}
        </span>
        <span className="text-[13px] text-muted">
          {counter}
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
