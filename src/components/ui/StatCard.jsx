import Icon from './Icon'
import styles from './StatCard.module.css'

export default function StatCard({ icon, value, label }) {
  return (
    <div className={styles.stat}>
      {icon && (
        <div className={styles.icon} data-stat-icon>
          <Icon name={icon} size={22} />
        </div>
      )}
      <div>
        <div className={styles.value}>{value}</div>
        <div className={styles.label}>{label}</div>
      </div>
    </div>
  )
}
