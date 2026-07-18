export default function Card({ hover = false, className = '', children, ...rest }) {
  return (
    <div className={`card ${hover ? 'card--hover' : ''} ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return <div className={`card__header ${className}`}>{children}</div>
}

export function CardBody({ children, className = '' }) {
  return <div className={`card__body ${className}`}>{children}</div>
}

export function CardFooter({ children, className = '' }) {
  return <div className={`card__footer ${className}`}>{children}</div>
}
