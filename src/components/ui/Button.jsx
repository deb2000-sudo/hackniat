import Spinner from './Spinner'

const VARIANTS = ['primary', 'accent', 'secondary', 'ghost', 'danger', 'success']

/**
 * Reusable button. Renders a <button> by default, or any element passed via
 * the `as` prop (e.g. Link) while keeping consistent styling.
 */
export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size,
  block = false,
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  className = '',
  children,
  ...rest
}) {
  const variantClass = VARIANTS.includes(variant) ? `btn--${variant}` : 'btn--primary'
  const classes = [
    'btn',
    variantClass,
    size ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const isDisabled = disabled || loading
  const extraProps =
    Component === 'button'
      ? { disabled: isDisabled, type: rest.type || 'button' }
      : { 'aria-disabled': isDisabled }

  return (
    <Component className={classes} {...extraProps} {...rest}>
      {loading ? (
        <Spinner size="sm" onBrand={['primary', 'accent', 'danger', 'success'].includes(variant)} />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </Component>
  )
}
