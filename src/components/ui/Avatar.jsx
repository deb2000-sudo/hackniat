import { getInitials } from '../../utils/format'

export default function Avatar({ name, size = 'md', className = '' }) {
  const sizeClass = size === 'md' ? '' : `avatar--${size}`
  return (
    <span className={`avatar ${sizeClass} ${className}`} title={name}>
      {getInitials(name)}
    </span>
  )
}
