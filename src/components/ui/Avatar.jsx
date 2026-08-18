import { getInitials } from '../../utils/format'
import styles from './Avatar.module.css'

export default function Avatar({ name, size = 'md', className = '' }) {
  const sizeClass = size === 'md' ? '' : styles[size] || ''
  return (
    <span className={`${styles.avatar} ${sizeClass} ${className}`} data-avatar title={name}>
      {getInitials(name)}
    </span>
  )
}
