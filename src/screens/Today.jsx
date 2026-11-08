import { useState } from 'react'
import { weekdayOf } from '../core/dates.js'
import { SESSION_TYPES } from '../core/model.js'
import { estimateMinutes, itemTargetText, minutesText, sortTemplates, suggestNextTemplateId } from '../core/templates.js'
import { SESSION_TYPE_LABELS } from '../ui/labels.js'

/** Una sesión de fuerza del día: propone la que toca y deja cambiarla. */
function StrengthCard({ slot, templates, exercises, sessions, rules }) {
  const [chosen, setChosen] = useState(null)
  const sorted = sortTemplates(templates)
  const suggested = suggestNextTemplateId(templates, sessions)
  const fixed = slot.templateId && templates.some((t) => t.id === slot.templateId) ? slot.templateId : null
  const proposed = fixed ?? suggested
  const currentId = chosen ?? proposed
  const template = templates.find((t) => t.id === currentId)
  const byId = new Map(exercises.map((e) => [e.id, e]))

  return (
    <section className="card">
      <span className="badge">{SESSION_TYPE_LABELS[slot.type]}</span>
      <p className="card-title">{slot.name}</p>

      {!template ? (
        <p className="muted">Aún no hay ninguna sesión de fuerza. Crea una en la pestaña Semana.</p>
      ) : (
        <>
          {sorted.length > 1 && (
            <label className="field">
              <span className="field-label">Sesión de hoy</span>
              <select value={currentId} onChange={(e) => setChosen(e.target.value)}>
                {sorted.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.id === proposed ? (fixed ? ' (fijada en el plan)' : ' (la que toca)') : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="muted small">
            {template.items.length} ejercicios · {minutesText(estimateMinutes(template, exercises, { rules }))}
          </p>
          <ol className="today-list">
            {template.items.map((item) => {
              const exercise = byId.get(item.exerciseId)
              const core = item.coreExerciseId ? byId.get(item.coreExerciseId) : null
              return (
                <li key={item.exerciseId}>
                  <span className="exercise-name">{exercise?.name ?? 'Ejercicio que ya no existe'}</span>
                  <span className="muted small">{itemTargetText(item, exercise, rules)}</span>
                  <span className="muted small">{core ? `Descanso con core: ${core.name}` : 'Descanso puro'}</span>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}

export default function Today({ plan, templates, exercises, sessions, rules }) {
  const now = new Date()
  const rawDate = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const todayText = rawDate.charAt(0).toUpperCase() + rawDate.slice(1) // "Domingo, 8 de noviembre"
  const slots = plan.filter((slot) => slot.weekday === weekdayOf(now))

  return (
    <>
      <h1>Hoy</h1>
      <p className="muted day-text">{todayText}</p>

      {slots.length === 0 ? (
        <section className="card">
          <p>No tienes nada previsto para hoy.</p>
        </section>
      ) : (
        slots.map((slot) =>
          slot.type === SESSION_TYPES.STRENGTH ? (
            <StrengthCard key={slot.id} slot={slot} templates={templates} exercises={exercises} sessions={sessions} rules={rules} />
          ) : (
            <section className="card" key={slot.id}>
              <span className="badge">{SESSION_TYPE_LABELS[slot.type] ?? slot.type}</span>
              <p className="card-title">{slot.name}</p>
            </section>
          ),
        )
      )}

      <p className="muted small">El botón para empezar el entreno llega en la entrega 1d.</p>
    </>
  )
}
