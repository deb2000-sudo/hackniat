import { forwardRef, useId, useState } from 'react'
import Icon from './Icon'

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

function normalizeHexColor(value, fallback = '#2563EB') {
  const raw = String(value || '').trim()
  return HEX_COLOR.test(raw) ? raw : fallback
}

/** Metric / scorecard color — large swatch + hex, saves the same #rrggbb value. */
export function ColorInput({
  label,
  value = '#2563EB',
  onChange,
  disabled = false,
  id,
  error,
  hint,
  required = false,
  className = '',
}) {
  const generatedId = useId()
  const inputId = id || generatedId
  const color = normalizeHexColor(value)

  return (
    <div className={`field ${className}`}>
      {label && (
        <span className="label">
          {label}
          {required && <span className="req">*</span>}
        </span>
      )}
      <div
        className={`flex min-h-11 items-center gap-3 rounded-drop border bg-surface px-3 py-2 ${
          error ? 'border-missing' : 'border-hairline'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        {disabled ? (
          <span
            className="size-9 shrink-0 rounded-drop border border-hairline shadow-sm"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        ) : (
          <>
            <label
              htmlFor={inputId}
              className="size-9 shrink-0 cursor-pointer rounded-drop border border-hairline shadow-sm transition-[transform,box-shadow] hover:scale-105 hover:shadow-md focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-volt"
              style={{ backgroundColor: color }}
              title={`Pick color (${color})`}
            />
            <input
              id={inputId}
              type="color"
              className="sr-only"
              value={color}
              onChange={onChange}
            />
          </>
        )}
        <span className="font-mono text-[13px] font-medium tracking-wide text-ink">
          {color.toUpperCase()}
        </span>
      </div>
      {error ? (
        <span className="field__error">{error}</span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </div>
  )
}

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
