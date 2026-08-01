import { forwardRef, useId, useState } from 'react'
import Icon from './Icon'

/** Labelled text input with error + hint support. */
export default function Input({
  label,
  error,
  hint,
  required = false,
  className = '',
  id,
  ...rest
}) {
  const generatedId = useId()
  const inputId = id || generatedId
  return (
    <div className="field">
      {label && (
        <label className="label" htmlFor={inputId}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`input ${error ? 'input--error' : ''} ${className}`}
        aria-invalid={!!error}
        {...rest}
      />
      {error ? (
        <span className="field__error">{error}</span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </div>
  )
}

/** Password input with a show/hide toggle. */
export function PasswordInput({ label, error, hint, required = false, id, ...rest }) {
  const [visible, setVisible] = useState(false)
  const generatedId = useId()
  const inputId = id || generatedId
  return (
    <div className="field">
      {label && (
        <label className="label" htmlFor={inputId}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      <div className="input-group">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={`input ${error ? 'input--error' : ''}`}
          aria-invalid={!!error}
          {...rest}
        />
        <button
          type="button"
          className="input-group__addon"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>
      {error ? (
        <span className="field__error">{error}</span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </div>
  )
}

/** Labelled textarea. */
export const Textarea = forwardRef(function Textarea(
  { label, error, hint, required = false, id, className = '', ...rest },
  ref,
) {
  const generatedId = useId()
  const inputId = id || generatedId
  return (
    <div className="field">
      {label && (
        <label className="label" htmlFor={inputId}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={`textarea ${error ? 'textarea--error' : ''} ${className}`}
        aria-invalid={!!error}
        {...rest}
      />
      {error ? (
        <span className="field__error">{error}</span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </div>
  )
})

/** Labelled select input. */
export function Select({ label, error, hint, required = false, id, className = '', children, ...rest }) {
  const generatedId = useId()
  const inputId = id || generatedId
  return (
    <div className="field">
      {label && (
        <label className="label" htmlFor={inputId}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      <select
        id={inputId}
        className={`select ${error ? 'select--error' : ''} ${className}`}
        aria-invalid={!!error}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <span className="field__error">{error}</span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </div>
  )
}
