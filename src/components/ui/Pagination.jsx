import { MONO } from '../drop/theme'
import Button from './Button'
import Icon from './Icon'

/**
 * Pager for a server-paged table: "11–20 of 37", Previous, "Page X of Y", Next.
 *
 * Renders nothing when everything fits on one page. `page` is 1-based and is
 * clamped for display, so a page that just emptied out never reads "Page 4 of 3".
 */
export default function Pagination({
  page,
  total,
  pageSize,
  disabled = false,
  onChange,
  label = 'Pages',
  className = '',
}) {
  if (!total || total <= pageSize) return null

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)
  const first = (current - 1) * pageSize + 1
  const last = Math.min(current * pageSize, total)

  return (
    <nav
      aria-label={label}
      className={`mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted ${className}`}
    >
      <span aria-live="polite">
        <span className={MONO}>
          {first}–{last}
        </span>{' '}
        of <span className={MONO}>{total}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || current <= 1}
          onClick={() => onChange(current - 1)}
          leftIcon={<Icon name="arrowLeft" size={15} />}
        >
          Previous
        </Button>
        <span className="px-1">
          Page <span className={MONO}>{current}</span> of <span className={MONO}>{totalPages}</span>
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || current >= totalPages}
          onClick={() => onChange(current + 1)}
          rightIcon={<Icon name="arrowRight" size={15} />}
        >
          Next
        </Button>
      </div>
    </nav>
  )
}
