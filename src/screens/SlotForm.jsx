import { useState } from 'react'
import { validateSlot } from '../core/plan.js'
import { SESSION_TYPES } from '../core/model.js'
import { WEEKDAY_NAMES } from '../core/dates.js'
import { SESSION_TYPE_LABELS } from '../ui/labels.js'

/** Formulario para añadir o editar una sesión del plan semanal (día, tipo y, en fuerza, qué sesión). */
export default function SlotForm({ initial, templates, isNew, onSave, onDelete, onCancel }) {
  const [draft, setDraft] = useState({ ...initial, name: initial.name || SESSION_TYPE_LABELS[initial.type] })
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)

  const set = (field, value) => setDraft((previous) => ({ ...previous, [field]: value }))

  function changeType(type) {
    // Si el nombre era el de serie del tipo anterior, se cambia al del nuevo; si lo escribió David, se respeta.
    const wasDefault = !draft.name.trim() || draft.name === SESSION_TYPE_LABELS[draft.type]
    setDraft((previous) => ({ ...previous, type, name: wasDefault ? SESSION_TYPE_LABELS[type] : previous.name }))
  }

  async function submit(event) {
    event.preventDefault()
    const result = validateSlot(draft, { templates })
    setErrors(result.errors)
    if (!result.slot) return
    setSaving(true)
    try {
      await onSave(result.slot)
    } catch (error) {
      setErrors([`No se pudo guardar: ${error.message}`])
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1>{isNew ? 'Añadir sesión' : 'Editar sesión'}</h1>

      <section className="card">
        <label className="field">
          <span className="field-label">Día</span>
          <select value={draft.weekday} onChange={(e) => set('weekday', Number(e.target.value))}>
            {WEEKDAY_NAMES.slice(1).map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Tipo</span>
          <select value={draft.type} onChange={(e) => changeType(e.target.value)}>
            {Object.values(SESSION_TYPES).map((type) => (
              <option key={type} value={type}>
                {SESSION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Nombre</span>
          <input type="text" value={draft.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" />
        </label>

        {draft.type === SESSION_TYPES.STRENGTH && (
          <label className="field">
            <span className="field-label">Sesión de fuerza</span>
            <select value={draft.templateId ?? ''} onChange={(e) => set('templateId', e.target.value || null)}>
              <option value="">Automática: la siguiente a la última que hiciste</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  Siempre: {template.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="check">
          <input type="checkbox" checked={Boolean(draft.flexible)} onChange={(e) => set('flexible', e.target.checked)} />
          <span>Se puede mover a otro día si hace falta</span>
        </label>
      </section>

      {errors.length > 0 && (
        <ul className="message message-error errors" role="alert">
          {errors.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          Guardar
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        {!isNew && (
          <button type="button" className="btn btn-secondary btn-danger" onClick={onDelete} disabled={saving}>
            Quitar del plan
          </button>
        )}
      </div>
    </form>
  )
}
