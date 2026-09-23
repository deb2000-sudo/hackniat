import { useState } from 'react'
import Icon from './Icon'
import styles from './Accordion.module.css'

export default function Accordion({
  title,
  description,
  icon = 'clipboard',
  badge,
  defaultOpen = false,
  /**
   * Hold the body back until the section is first opened.
   *
   * `<details>` renders its children even while collapsed, so a panel that
   * fetches on mount would call the API for a section nobody opened. Once
   * opened the body stays mounted, so collapsing never discards its state.
   */
  lazy = false,
  className = '',
  children,
}) {
  const [opened, setOpened] = useState(defaultOpen)

  return (
    <details
      className={`${styles.accordion} ${className}`}
      data-accordion
      open={defaultOpen || undefined}
      onToggle={
        lazy
          ? (event) => {
              if (event.currentTarget.open) setOpened(true)
            }
          : undefined
      }
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
      <div className={styles.content}>{lazy && !opened ? null : children}</div>
    </details>
  )
}
