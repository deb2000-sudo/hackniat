import styles from './Card.module.css'

export default function Card({ hover = false, className = '', children, ...rest }) {
  return (
    <div
      className={`${styles.card} ${hover ? styles.hover : ''} ${className}`}
      data-card
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`${styles.header} ${className}`} data-card-header>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={`${styles.body} ${className}`} data-card-body>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`${styles.footer} ${className}`} data-card-footer>
      {children}
    </div>
  )
}
