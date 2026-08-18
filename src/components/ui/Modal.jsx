import { useEffect } from 'react'
import Icon from './Icon'
import styles from './Modal.module.css'

export default function Modal({ open, onClose, title, children, footer, className = '' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.overlay} data-modal-overlay onClick={onClose} role="presentation">
      <div
        className={`${styles.modal} ${className}`.trim()}
        data-modal
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className={styles.header}>
            <h3>{title}</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="x" size={20} />
            </button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  )
}
