import Icon from './Icon'
import styles from './EmptyState.module.css'

export default function EmptyState({ icon = 'file', title, description, action }) {
  return (
    <div className={styles.empty}>
      <div className={styles.icon} data-empty-icon>
        <Icon name={icon} size={26} />
      </div>
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}
