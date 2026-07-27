import Icon from './Icon'

export default function Accordion({
  title,
  description,
  icon = 'clipboard',
  badge,
  defaultOpen = false,
  className = '',
  children,
}) {
  return (
    <details className={`evaluation-accordion ${className}`} open={defaultOpen || undefined}>
      <summary>
        <span className="evaluation-accordion__icon">
          <Icon name={icon} size={19} />
        </span>
        <span className="evaluation-accordion__heading">
          <strong>{title}</strong>
          {description && <small>{description}</small>}
        </span>
        {badge && <span className="evaluation-accordion__badge">{badge}</span>}
        <Icon name="chevronDown" size={18} className="evaluation-accordion__chevron" />
      </summary>
      <div className="evaluation-accordion__content">{children}</div>
    </details>
  )
}
