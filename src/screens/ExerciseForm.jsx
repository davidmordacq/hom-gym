import { useState } from 'react'
import { MUSCLE_GROUPS } from '../core/defaultData.js'
import { validateExercise } from '../core/exercises.js'
import { RESISTANCE_TYPES } from '../core/model.js'
import { RESISTANCE_TYPE_HELP, RESISTANCE_TYPE_LABELS } from '../ui/labels.js'

/** Formulario para crear o editar un ejercicio. `initial` es el ejercicio de partida. */
export default function ExerciseForm({ initial, scales, isNew, onSave, onCancel }) {
  const [draft, setDraft] = useState({ ...initial, videoUrl: initial.videoUrl ?? '' })
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)

  const set = (field, value) => setDraft((previous) => ({ ...previous, [field]: value }))

  function toggleGroup(id) {
    const has = draft.muscleGroups.includes(id)
    set('muscleGroups', has ? draft.muscleGroups.filter((g) => g !== id) : [...draft.muscleGroups, id])
  }

  async function submit(event) {
    event.preventDefault()
    const result = validateExercise(draft, { scales })
    setErrors(result.errors)
    if (!result.exercise) return
    setSaving(true)
    try {
      await onSave(result.exercise)
    } catch (error) {
      setErrors([`No se pudo guardar: ${error.message}`])
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1>{isNew ? 'Nuevo ejercicio' : 'Editar ejercicio'}</h1>

      <section className="card">
        <label className="field">
          <span className="field-label">Nombre</span>
          <input type="text" value={draft.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" />
        </label>

        <div className="field">
          <span className="field-label">Grupos musculares (el primero que marques es el principal)</span>
          <div className="chips" role="group" aria-label="Grupos musculares">
            {MUSCLE_GROUPS.map((group) => {
              const order = draft.muscleGroups.indexOf(group.id)
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`chip${order >= 0 ? ' chip-on' : ''}`}
                  aria-pressed={order >= 0}
                  onClick={() => toggleGroup(group.id)}
                >
                  {group.label}
                  {order === 0 && draft.muscleGroups.length > 1 ? ' ★' : ''}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="field">
          <span className="field-label">Tipo de ejercicio</span>
          <div className="segmented" role="group" aria-label="Tipo de ejercicio">
            {Object.values(RESISTANCE_TYPES).map((type) => (
              <button
                key={type}
                type="button"
                className={`seg${draft.resistanceType === type ? ' seg-active' : ''}`}
                aria-pressed={draft.resistanceType === type}
                onClick={() => set('resistanceType', type)}
              >
                {RESISTANCE_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          <p className="muted small">{RESISTANCE_TYPE_HELP[draft.resistanceType]}</p>
        </div>

        <label className="field">
          <span className="field-label">Material o niveles de resistencia</span>
          <select value={draft.scaleId ?? ''} onChange={(e) => set('scaleId', e.target.value || null)}>
            <option value="">Sin niveles (solo subo repeticiones)</option>
            {scales.map((scale) => (
              <option key={scale.id} value={scale.id}>
                {scale.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <label className="field">
          <span className="field-label">Vídeo de YouTube (opcional)</span>
          <input
            type="url"
            inputMode="url"
            placeholder="Pega aquí el enlace del vídeo"
            value={draft.videoUrl}
            onChange={(e) => set('videoUrl', e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span className="field-label">Notas (opcional)</span>
          <textarea rows={4} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
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
