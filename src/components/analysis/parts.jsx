import { MONO, PANEL } from '../drop/theme'

/** One headline number. `value` is already formatted, so a null arrives as a dash. */
export function Tile({ label, value, note }) {
  return (
    <div className={`${PANEL} min-w-0 px-4 py-3.5`}>
      <div className={`${MONO} text-[22px] leading-none font-semibold tracking-[-0.03em] text-ink`}>
        {value}
      </div>
      <div className="mt-1.5 text-[12.5px] text-muted">{label}</div>
      {note && <div className="mt-1 text-[11.5px] text-muted opacity-80">{note}</div>}
    </div>
  )
}

/** A titled block of the Analysis screen. */
export function Section({ title, description, actions, children }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

/** Table cell for a number: right-aligned, tabular figures. */
export function Num({ children, sub }) {
  return (
    <td style={{ textAlign: 'right' }} className={MONO}>
      {children}
      {sub && <div className="text-[11.5px] text-muted">{sub}</div>}
    </td>
  )
}

/** Matching right-aligned header for a {@link Num} column. */
export function NumHead({ children }) {
  return <th style={{ textAlign: 'right' }}>{children}</th>
}
