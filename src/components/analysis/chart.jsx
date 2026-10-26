/** Tooltip listing every series at the hovered point, each with its colour. */
export function ChartTooltip({ active, payload, label, format = String }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-drop border border-hairline bg-surface px-3 py-2 text-[12.5px] shadow-lg">
      <div className="text-muted">{label}</div>
      {payload.map((item) => (
        <div key={item.dataKey} className="mt-0.5 flex items-center gap-2 text-ink">
          <span
            className="inline-block size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: item.color || item.fill }}
            aria-hidden="true"
          />
          <span className="text-muted">{item.name}</span>
          <span className="ml-auto pl-3 font-semibold">{format(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

/** Legend for two or more series: a swatch and a text label, so colour is never alone. */
export function ChartLegend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-sm"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
