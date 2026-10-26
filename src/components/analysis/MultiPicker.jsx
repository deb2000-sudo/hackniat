import { useEffect, useId, useRef, useState } from 'react'
import Icon from '../ui/Icon'

/**
 * A dropdown of checkboxes with a search box, for picking several ids.
 *
 * `options` are `{ id, label, hint? }`. At `max` the unticked boxes are
 * disabled and the panel says why, so the request never goes out over the
 * API's limit. `emptyLabel` is what the button says with nothing ticked
 * ("All hackathons" where empty means all).
 */
export default function MultiPicker({
  label,
  options,
  selected,
  onChange,
  max,
  emptyLabel = 'None selected',
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'mousedown' && rootRef.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options
  const atMax = selected.length >= max

  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id])

  const summary = !selected.length
    ? emptyLabel
    : selected.length === 1
      ? options.find((option) => option.id === selected[0])?.label || '1 selected'
      : `${selected.length} selected`

  return (
    <div className="field relative min-w-0" ref={rootRef}>
      <span className="label">{label}</span>
      <button
        type="button"
        className="input flex items-center justify-between gap-2 text-left"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{summary}</span>
        <Icon name="chevronDown" size={16} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute top-full right-0 left-0 z-20 mt-1 rounded-drop border border-hairline bg-surface p-2 shadow-lg"
        >
          <input
            className="input mb-2"
            aria-label={`Search ${label.toLowerCase()}`}
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <div className="mb-1.5 flex items-center justify-between px-1 text-[12px] text-muted">
            <span>
              {selected.length} of {max} max
            </span>
            {selected.length > 0 && (
              <button type="button" className="font-medium text-ink" onClick={() => onChange([])}>
                Clear
              </button>
            )}
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {visible.map((option) => {
              const checked = selected.includes(option.id)
              const blocked = !checked && atMax
              return (
                <li key={option.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-[13.5px] hover:bg-raised ${
                      blocked ? 'cursor-not-allowed opacity-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      disabled={blocked}
                      onChange={() => toggle(option.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-ink">{option.label}</span>
                      {option.hint && <span className="block text-[12px] text-muted">{option.hint}</span>}
                    </span>
                  </label>
                </li>
              )
            })}
            {!visible.length && <li className="px-2 py-3 text-[13px] text-muted">No matches.</li>}
          </ul>
          {atMax && (
            <p className="mt-1.5 px-1 text-[12px] text-muted">
              You can pick up to {max}. Untick one to choose another.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
