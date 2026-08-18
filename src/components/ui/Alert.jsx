import Icon from './Icon'
import styles from './Alert.module.css'

const ICONS = {
  info: 'info',
  success: 'checkCircle',
  warning: 'alert',
  danger: 'xCircle',
}

export default function Alert({ variant = 'info', title, children, className = '' }) {
  return (
    <div
      className={`${styles.alert} ${styles[variant] || styles.info} ${className}`}
      data-alert
      data-alert-variant={variant}
      role="alert"
    >
      <Icon name={ICONS[variant] || 'info'} size={20} className={styles.icon} />
      <div>
        {title && <div className={styles.title}>{title}</div>}
        {children && <div>{children}</div>}
      </div>
    </div>
  )
}
