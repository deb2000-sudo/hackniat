export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header row-between wrap">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  )
}
