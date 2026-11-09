import { useState } from 'react'
import { toIsoDate } from '../core/dates.js'
import { SESSION_STATUS, SESSION_TYPES } from '../core/model.js'
import { validateQuickLog } from '../core/workout.js'
import { SESSION_TYPE_LABELS } from '../ui/labels.js'

const isBike = (type) => type === SESSION_TYPES.BIKE_TRAINER || type === SESSION_TYPES.BIKE_OUTDOOR

/** Registro sencillo de bici (rodillo u outdoor) o movilidad: hecha o no, duración, TSS, esfuerzo y notas. */
export default function QuickLog({ type, slot, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    type,
    slotId: slot?.id ?? null,
    name: slot?.name ?? SESSION_TYPE_LABELS[type],
    date: toIsoDate(new Date()),
    status: SESSION_STATUS.DONE,
    durationMin: '',
    tss: '',
    effort: '',
    notes: '',
  })
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const set = (field, value) => setDraft((previous) => ({ ...previous, [field]: value }))
  const done = draft.status === SESSION_STATUS.DONE

  async function submit(event) {
    event.preventDefault()
    const result = validateQuickLog(draft)
    setErrors(result.errors)
    if (!result.session) return
    setSaving(true)
    try {
      await onSave(result.session)
    } catch (error) {
      setErrors([`No se pudo guardar: ${error.message}`])
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1>Registrar {SESSION_TYPE_LABELS[type].toLowerCase()}</h1>

      <section className="card">
        <label className="field">
          <span className="field-label">Día</span>
          <input type="date" value={draft.date} max={toIsoDate(new Date())} onChange={(e) => set('date', e.target.value)} />
        </label>

        <div className="field">
          <span className="field-label">¿La hiciste?</span>
          <div className="segmented" role="group" aria-label="¿La hiciste?">
            <button type="button" className={`seg${done ? ' seg-active' : ''}`} aria-pressed={done} onClick={() => set('status', SESSION_STATUS.DONE)}>
              Sí, hecha
            </button>
            <button
              type="button"
              className={`seg${!done ? ' seg-active' : ''}`}
              aria-pressed={!done}
              onClick={() => set('status', SESSION_STATUS.SKIPPED)}
            >
              No la hice
            </button>
          </div>
        </div>

        {done && (
          <>
            <label className="field">
              <span className="field-label">Duración (minutos)</span>
              <input type="number" inputMode="numeric" min="1" value={draft.durationMin} onChange={(e) => set('durationMin', e.target.value)} />
            </label>
            {isBike(type) && (
              <label className="field">
                <span className="field-label">TSS (opcional)</span>
                <input type="number" inputMode="decimal" min="0" value={draft.tss} onChange={(e) => set('tss', e.target.value)} />
              </label>
            )}
            <label className="field">
              <span className="field-label">Esfuerzo de 1 a 10 (opcional)</span>
              <input type="number" inputMode="numeric" min="1" max="10" value={draft.effort} onChange={(e) => set('effort', e.target.value)} />
            </label>
          </>
        )}

        <label className="field">
          <span className="field-label">Notas (opcional)</span>
          <textarea rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
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
      </div>
    </form>
  )
}
