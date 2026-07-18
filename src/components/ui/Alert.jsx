import Icon from './Icon'

const ICONS = {
  info: 'info',
  success: 'checkCircle',
  warning: 'alert',
  danger: 'xCircle',
}

export default function Alert({ variant = 'info', title, children, className = '' }) {
  return (
    <div className={`alert alert--${variant} ${className}`} role="alert">
      <Icon name={ICONS[variant] || 'info'} size={20} className="alert__icon" />
      <div>
        {title && <div className="alert__title">{title}</div>}
        {children && <div>{children}</div>}
      </div>
    </div>
  )
}
