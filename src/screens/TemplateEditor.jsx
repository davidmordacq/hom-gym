import { useMemo, useState } from 'react'
import { groupExercises, searchExercises } from '../core/exercises.js'
import {
  MAX_SESSION_MINUTES, MAX_SETS_PER_EXERCISE, blankItem, estimateMinutes, itemTargetText, minutesText, moveItem,
  validateTemplate,
} from '../core/templates.js'

/** Editor de una sesión de fuerza: ejercicios, series, cada lado y core en el descanso. */
export default function TemplateEditor({ initial, templates, exercises, rules, isNew, onSave, onDelete, onCancel }) {
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const coreOptions = useMemo(
    () => exercises.filter((e) => e.muscleGroups.includes('core')).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [exercises],
  )
  const minutes = estimateMinutes(draft, exercises, { rules })

  const setItems = (items) => setDraft((previous) => ({ ...previous, items }))
  const changeItem = (index, patch) => setItems(draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  const changeSets = (index, delta) => {
    const current = Number(draft.items[index].sets) || 0
    changeItem(index, { sets: Math.min(MAX_SETS_PER_EXERCISE, Math.max(1, current + delta)) })
  }

  async function submit(event) {
    event.preventDefault()
    const result = validateTemplate(draft, { exercises, templates })
    setErrors(result.errors)
    if (!result.template) return
    setSaving(true)
    try {
      await onSave(result.template)
    } catch (error) {
      setErrors([`No se pudo guardar: ${error.message}`])
      setSaving(false)
    }
  }

  if (picking) {
    const used = new Set(draft.items.map((item) => item.exerciseId))
    const groups = groupExercises(searchExercises(exercises, query).filter((e) => !used.has(e.id)))
    return (
      <>
        <button type="button" className="back" onClick={() => setPicking(false)}>
          ← Volver a la sesión
        </button>
        <h1>Añadir ejercicio</h1>
        <input
          type="search"
          className="search"
          placeholder="Buscar por nombre o músculo"
          aria-label="Buscar ejercicio"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {groups.length === 0 && <p className="muted">No hay ejercicios que añadir con esa búsqueda.</p>}
        {groups.map((group) => (
          <section key={group.groupId} aria-label={group.label}>
            <h2 className="group-title">{group.label}</h2>
            <ul className="exercise-list">
              {group.exercises.map((exercise) => (
                <li key={exercise.id}>
                  <button
                    type="button"
                    className="exercise-row"
                    onClick={() => {
                      setItems([...draft.items, blankItem(exercise.id)])
                      setPicking(false)
                      setQuery('')
                    }}
                  >
                    <span className="exercise-name">{exercise.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1>{isNew ? 'Nueva sesión de fuerza' : 'Editar sesión de fuerza'}</h1>

      <section className="card">
        <label className="field">
          <span className="field-label">Nombre</span>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            autoComplete="off"
            placeholder="Por ejemplo, Tren superior"
          />
        </label>
        <p className={minutes > MAX_SESSION_MINUTES ? 'message message-error' : 'muted'}>
          Duración aproximada: <strong>{minutesText(minutes)}</strong>
          {minutes > MAX_SESSION_MINUTES && ` (pasa de ${MAX_SESSION_MINUTES} min)`}
        </p>
        <p className="muted small">
          Calcula 5 min de calentamiento, unos 45 s por serie (el doble si se hace con cada lado) y 2 min de descanso tras
          cada serie. El core del descanso no suma tiempo. Es una estimación, no una medida.
        </p>
      </section>

      {draft.items.map((item, index) => {
        const exercise = byId.get(item.exerciseId)
        const coreChoices = coreOptions.some((e) => e.id === item.coreExerciseId)
          ? coreOptions
          : [...coreOptions, byId.get(item.coreExerciseId)].filter(Boolean)
        return (
          <section className="card item-card" key={item.exerciseId} aria-label={exercise?.name ?? 'Ejercicio borrado'}>
            <div className="item-head">
              <span className="item-number">{index + 1}</span>
              <span className="item-name">{exercise?.name ?? 'Ejercicio que ya no existe'}</span>
            </div>
            <p className="muted small">{itemTargetText(item, exercise, rules)}</p>

            <div className="item-row">
              <span className="field-label">Series</span>
              <div className="stepper" role="group" aria-label="Series">
                <button type="button" className="step-btn" aria-label="Quitar una serie" onClick={() => changeSets(index, -1)}>
                  −
                </button>
                <span className="step-value" aria-live="polite">
                  {item.sets}
                </span>
                <button type="button" className="step-btn" aria-label="Añadir una serie" onClick={() => changeSets(index, 1)}>
                  +
                </button>
              </div>
            </div>

            <label className="check">
              <input type="checkbox" checked={Boolean(item.perSide)} onChange={(e) => changeItem(index, { perSide: e.target.checked })} />
              <span>Se hace con cada lado por separado (pierna o brazo)</span>
            </label>

            <label className="field">
              <span className="field-label">En el descanso</span>
              <select value={item.coreExerciseId ?? ''} onChange={(e) => changeItem(index, { coreExerciseId: e.target.value || null })}>
                <option value="">Descanso puro</option>
                {coreChoices.map((core) => (
                  <option key={core.id} value={core.id}>
                    Core: {core.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="item-actions">
              <button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => setItems(moveItem(draft.items, index, -1))}>
                ↑ Subir
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={index === draft.items.length - 1}
                onClick={() => setItems(moveItem(draft.items, index, 1))}
              >
                ↓ Bajar
              </button>
              <button type="button" className="btn btn-secondary btn-danger" onClick={() => setItems(draft.items.filter((_, i) => i !== index))}>
                Quitar
              </button>
            </div>
          </section>
        )
      })}

      <div className="actions">
        <button type="button" className="btn btn-secondary" onClick={() => setPicking(true)}>
          + Añadir ejercicio
        </button>
      </div>

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
            Borrar sesión
          </button>
        )}
      </div>
    </form>
  )
}
