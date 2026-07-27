import { useMemo, useState } from 'react'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Card, { CardBody, CardHeader } from '../ui/Card'
import Icon from '../ui/Icon'
import Input, { Select, Textarea } from '../ui/Input'

const FIELD_TYPES = [
  ['text', 'Short text'],
  ['textarea', 'Long text'],
  ['url', 'URL'],
  ['number', 'Number'],
  ['date', 'Date'],
  ['file', 'File'],
  ['other', 'Other'],
]

const EMPTY_FIELD = {
  key: '',
  label: '',
  field_type: 'text',
  is_required: true,
  placeholder: '',
  description: '',
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalize(initialValue) {
  return {
    name: initialValue?.name || '',
    description: initialValue?.description || '',
    fields: initialValue?.fields?.length
      ? initialValue.fields.map((field) => ({
          key: field.key || '',
          label: field.label || '',
          field_type: field.field_type || 'text',
          is_required: field.is_required ?? true,
          placeholder: field.placeholder || '',
          description: field.description || '',
        }))
      : [{ ...EMPTY_FIELD }],
  }
}

function clean(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    fields: form.fields.map((field) => ({
      ...(field.key.trim() ? { key: field.key.trim() } : {}),
      label: field.label.trim(),
      field_type: field.field_type,
      is_required: field.is_required,
      placeholder: field.placeholder.trim() || null,
      description: field.description.trim() || null,
    })),
  }
}

function validate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Requirement name is required.'
  if (!form.fields.length) errors.fields = 'Add at least one submission field.'

  const effectiveKeys = new Map()
  form.fields.forEach((field, index) => {
    if (!field.label.trim()) errors[`fields.${index}.label`] = 'Field label is required.'
    const key = field.key.trim() || slugify(field.label)
    if (!key) errors[`fields.${index}.key`] = 'Enter a machine key or a valid label.'
    if (key && effectiveKeys.has(key)) {
      errors[`fields.${index}.key`] = `Duplicate key “${key}”.`
      errors[`fields.${effectiveKeys.get(key)}.key`] = `Duplicate key “${key}”.`
    } else if (key) {
      effectiveKeys.set(key, index)
    }
  })
  return errors
}

export default function RequirementForm({
  initialValue,
  onSubmit,
  submitting,
  submitError,
}) {
  const initialForm = useMemo(() => normalize(initialValue), [initialValue])
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const editing = !!initialValue

  const update = (property) => (event) => {
    setForm((current) => ({ ...current, [property]: event.target.value }))
    setErrors((current) => ({ ...current, [property]: undefined, form: undefined }))
  }

  const updateField = (index, property) => (event) => {
    const value = property === 'is_required' ? event.target.checked : event.target.value
    setForm((current) => ({
      ...current,
      fields: current.fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, [property]: value } : field,
      ),
    }))
    setErrors((current) => ({
      ...current,
      [`fields.${index}.${property}`]: undefined,
      form: undefined,
    }))
  }

  const addField = () => {
    setForm((current) => ({ ...current, fields: [...current.fields, { ...EMPTY_FIELD }] }))
    setErrors((current) => ({ ...current, fields: undefined, form: undefined }))
  }

  const removeField = (index) => {
    setForm((current) => ({
      ...current,
      fields: current.fields.filter((_, fieldIndex) => fieldIndex !== index),
    }))
  }

  const moveField = (index, direction) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= form.fields.length) return
    setForm((current) => {
      const fields = [...current.fields]
      ;[fields[index], fields[nextIndex]] = [fields[nextIndex], fields[index]]
      return { ...current, fields }
    })
  }

  const submit = (event) => {
    event.preventDefault()
    const validation = validate(form)
    setErrors(validation)
    if (Object.keys(validation).length) return

    const payload = clean(form)
    if (!editing) {
      onSubmit(payload)
      return
    }

    const original = clean(initialForm)
    const changes = {}
    if (payload.name !== original.name) changes.name = payload.name
    if (payload.description !== original.description) changes.description = payload.description
    if (JSON.stringify(payload.fields) !== JSON.stringify(original.fields)) changes.fields = payload.fields
    if (!Object.keys(changes).length) {
      setErrors({ form: 'Make at least one change before saving.' })
      return
    }
    onSubmit(changes)
  }

  return (
    <form className="stack-lg requirement-form" onSubmit={submit} noValidate>
      {(submitError || errors.form || errors.fields) && (
        <Alert variant="danger">{submitError || errors.form || errors.fields}</Alert>
      )}

      <Card>
        <CardHeader>
          <div className="requirement-section-heading">
            <span><Icon name="clipboard" size={19} /></span>
            <div>
              <h3>Requirement details</h3>
              <p>Name this reusable set and explain when it should be used.</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="stack-md">
          <Input
            label="Name"
            required
            maxLength={200}
            value={form.name}
            onChange={update('name')}
            error={errors.name}
            placeholder="Takeover MVP Submission"
          />
          <Textarea
            label="Description"
            maxLength={5000}
            rows={3}
            value={form.description}
            onChange={update('description')}
            placeholder="Explain which round or submission this requirement is for."
          />
        </CardBody>
      </Card>

      <div className="row-between wrap requirement-fields-title">
        <div>
          <h2>Submission fields</h2>
          <p>Define what students must provide. Drag-free ordering keeps this editor keyboard-friendly.</p>
        </div>
        <Button
          variant="secondary"
          leftIcon={<Icon name="plus" size={17} />}
          onClick={addField}
        >
          Add field
        </Button>
      </div>

      <div className="stack-md">
        {form.fields.map((field, index) => (
          <Card className="requirement-field-card" key={index}>
            <CardHeader className="requirement-field-card__header">
              <div className="row">
                <span className="requirement-field-card__number">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3>{field.label.trim() || `Untitled field ${index + 1}`}</h3>
                  <span>{field.field_type}</span>
                </div>
              </div>
              <div className="row requirement-field-card__controls">
                <button
                  type="button"
                  className="icon-btn"
                  disabled={index === 0}
                  onClick={() => moveField(index, -1)}
                  aria-label={`Move field ${index + 1} up`}
                >
                  <Icon name="arrowUp" size={17} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={index === form.fields.length - 1}
                  onClick={() => moveField(index, 1)}
                  aria-label={`Move field ${index + 1} down`}
                >
                  <Icon name="arrowDown" size={17} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => removeField(index)}
                  aria-label={`Remove field ${index + 1}`}
                >
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </CardHeader>
            <CardBody className="stack-md">
              <div className="grid grid-2">
                <Input
                  label="Field label"
                  required
                  maxLength={200}
                  value={field.label}
                  onChange={updateField(index, 'label')}
                  error={errors[`fields.${index}.label`]}
                  placeholder="Problem Statement"
                />
                <Select
                  label="Field type"
                  value={field.field_type}
                  onChange={updateField(index, 'field_type')}
                >
                  {FIELD_TYPES.map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </Select>
              </div>
              <Input
                label="Machine key"
                maxLength={100}
                value={field.key}
                onChange={updateField(index, 'key')}
                error={errors[`fields.${index}.key`]}
                placeholder={slugify(field.label) || 'Auto-generated from the label'}
                hint="Optional. Keep this stable after collecting submissions."
              />
              <div className="grid grid-2">
                <Input
                  label="Placeholder"
                  maxLength={300}
                  value={field.placeholder}
                  onChange={updateField(index, 'placeholder')}
                  placeholder="Shown inside the input"
                />
                <label className="requirement-toggle">
                  <input
                    type="checkbox"
                    checked={field.is_required}
                    onChange={updateField(index, 'is_required')}
                  />
                  <span className="requirement-toggle__track"><span /></span>
                  <span>
                    <strong>Required field</strong>
                    <small>Students must complete this field</small>
                  </span>
                </label>
              </div>
              <Textarea
                label="Helper description"
                maxLength={2000}
                rows={2}
                value={field.description}
                onChange={updateField(index, 'description')}
                placeholder="Give students a little more context."
              />
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="requirement-form__actions">
        <span><Icon name="shield" size={17} /> Fields are saved in the order shown.</span>
        <Button type="submit" variant="accent" size="lg" loading={submitting}>
          {editing ? 'Save requirement' : 'Create requirement'}
        </Button>
      </div>
    </form>
  )
}
