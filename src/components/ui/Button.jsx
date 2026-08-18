import Spinner from './Spinner'
import { BUTTON_VARIANTS as VARIANTS, buttonClass } from './uiClasses'

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
  const resolvedVariant = VARIANTS.includes(variant) ? variant : 'primary'
  const classes = [buttonClass({ variant: resolvedVariant, size, block }), className]
    .filter(Boolean)
    .join(' ')

  const isDisabled = disabled || loading
  const extraProps =
    Component === 'button'
      ? { disabled: isDisabled, type: rest.type || 'button' }
      : { 'aria-disabled': isDisabled }

  return (
    <Component
      className={classes}
      data-btn
      data-btn-variant={resolvedVariant}
      {...extraProps}
      {...rest}
    >
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
