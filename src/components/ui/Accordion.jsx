import Icon from './Icon'
import styles from './Accordion.module.css'

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
    <details
      className={`${styles.accordion} ${className}`}
      data-accordion
      open={defaultOpen || undefined}
    >
      <summary>
        <span className={styles.icon}>
          <Icon name={icon} size={19} />
        </span>
        <span className={styles.heading}>
          <strong>{title}</strong>
          {description && <small>{description}</small>}
        </span>
        {badge && <span className={styles.badge}>{badge}</span>}
        <Icon name="chevronDown" size={18} className={styles.chevron} />
      </summary>
      <div className={styles.content}>{children}</div>
    </details>
  )
}
