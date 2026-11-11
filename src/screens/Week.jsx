import { useMemo, useState } from 'react'
import { WEEKDAY_NAMES, weekdayOf } from '../core/dates.js'
import { MUSCLE_GROUPS } from '../core/defaultData.js'
import { SESSION_TYPES } from '../core/model.js'
import { blankSlot, groupPlanByDay, newSlotId } from '../core/plan.js'
import {
  MAX_SESSION_MINUTES, blankTemplate, estimateMinutes, groupsBelowGoal, minutesText, newTemplateId, sortTemplates,
  weeklyGroupFrequency,
} from '../core/templates.js'
import { put, remove } from '../storage/db.js'
import { SESSION_TYPE_LABELS } from '../ui/labels.js'
import CalendarView from './CalendarView.jsx'
import SlotForm from './SlotForm.jsx'
import TemplateEditor from './TemplateEditor.jsx'

const formatTimes = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 })

export default function Week({ db, plan, templates, sessions, exercises, rules, restSeconds, perSideRestSeconds, goals, installedAt, onChanged }) {
  // view: { mode: 'week' } | { mode: 'slot', id (null = nueva), weekday } | { mode: 'template', id (null = nueva) }
  const [view, setView] = useState({ mode: 'week' })
  const [section, setSection] = useState('calendar') // dentro de la vista 'week': calendario o plan
  const [error, setError] = useState(null)

  const sortedTemplates = useMemo(() => sortTemplates(templates), [templates])
  const days = useMemo(() => groupPlanByDay(plan), [plan])
  const frequency = useMemo(() => weeklyGroupFrequency({ plan, templates, exercises }), [plan, templates, exercises])
  const below = useMemo(() => groupsBelowGoal(frequency, goals), [frequency, goals])
  const today = weekdayOf(new Date())

  async function guarded(work) {
    setError(null)
    try {
      await work()
      return true
    } catch (e) {
      setError(`No se pudo guardar el cambio: ${e.message}`)
      return false
    }
  }

  if (view.mode === 'slot') {
    const editing = view.id ? plan.find((slot) => slot.id === view.id) : null
    return (
      <SlotForm
        initial={editing ?? blankSlot(view.weekday)}
        templates={sortedTemplates}
        isNew={!editing}
        onSave={async (slot) => {
          await put(db, 'plan', slot.id ? slot : { ...slot, id: newSlotId() })
          await onChanged()
          setView({ mode: 'week' })
        }}
        onDelete={async () => {
          if (!window.confirm(`¿Quitar «${editing.name}» del plan? Lo ya registrado no se borra.`)) return
          if (await guarded(() => remove(db, 'plan', editing.id))) {
            await onChanged()
            setView({ mode: 'week' })
          }
        }}
        onCancel={() => setView({ mode: 'week' })}
      />
    )
  }

  if (view.mode === 'template') {
    const editing = view.id ? templates.find((t) => t.id === view.id) : null
    const nextOrder = Math.max(0, ...templates.map((t) => t.order ?? 0)) + 1
    return (
      <TemplateEditor
        initial={editing ?? blankTemplate(nextOrder)}
        templates={templates}
        exercises={exercises}
        rules={rules}
        restSeconds={restSeconds}
        perSideRestSeconds={perSideRestSeconds}
        isNew={!editing}
        onSave={async (template) => {
          await put(db, 'templates', template.id ? template : { ...template, id: newTemplateId() })
          await onChanged()
          setView({ mode: 'week' })
        }}
        onDelete={async () => {
          const used = plan.filter((slot) => slot.templateId === editing.id).length
          const extra = used > 0 ? ` ${used} día(s) del plan la tenían fija y pasarán a «automática».` : ''
          if (!window.confirm(`¿Borrar la sesión «${editing.name}»?${extra} Esta acción no se puede deshacer.`)) return
          const ok = await guarded(async () => {
            await remove(db, 'templates', editing.id)
            for (const slot of plan.filter((s) => s.templateId === editing.id)) await put(db, 'plan', { ...slot, templateId: null })
          })
          if (ok) {
            await onChanged()
            setView({ mode: 'week' })
          }
        }}
        onCancel={() => setView({ mode: 'week' })}
      />
    )
  }

  const templateName = (id) => templates.find((t) => t.id === id)?.name

  return (
    <>
      <h1>Semana</h1>
      <div className="segmented progress-seg" role="group" aria-label="Vista de la semana">
        {[
          { id: 'calendar', label: 'Calendario' },
          { id: 'plan', label: 'Plan' },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            className={`seg${section === option.id ? ' seg-active' : ''}`}
            aria-pressed={section === option.id}
            onClick={() => setSection(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {section === 'calendar' && (
        <CalendarView db={db} plan={plan} sessions={sessions} exercises={exercises} goals={goals} installedAt={installedAt} />
      )}

      {section === 'plan' && (
      <>
      <section aria-label="Sesiones de fuerza">
        <h2 className="group-title">Sesiones de fuerza</h2>
        {sortedTemplates.length === 0 && (
          <section className="card">
            <p>Aún no tienes ninguna sesión de fuerza. Crea la primera con «Nueva sesión de fuerza».</p>
          </section>
        )}
        {sortedTemplates.map((template) => {
          const minutes = estimateMinutes(template, exercises, { rules, restSeconds, perSideRestSeconds })
          return (
            <section className="card" key={template.id}>
              <p className="card-title">{template.name}</p>
              <p className="muted small">
                {template.items.length} ejercicios · {minutesText(minutes)}
                {minutes > MAX_SESSION_MINUTES ? ` · pasa de ${MAX_SESSION_MINUTES} min` : ''}
              </p>
              <div className="actions">
                <button type="button" className="btn btn-secondary" onClick={() => setView({ mode: 'template', id: template.id })}>
                  Editar «{template.name}»
                </button>
              </div>
            </section>
          )
        })}
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={() => setView({ mode: 'template', id: null })}>
            + Nueva sesión de fuerza
          </button>
        </div>
        <p className="muted small">
          En los días con fuerza «automática», Hoy te propone la siguiente sesión de esta lista a la última que hiciste (y
          puedes cambiarla).
        </p>
      </section>

      {error && <p className="message message-error">{error}</p>}

      {days.map(({ weekday, slots }) => (
        <section className="card" key={weekday} aria-label={WEEKDAY_NAMES[weekday]}>
          <h2>
            {WEEKDAY_NAMES[weekday]}
            {weekday === today && <span className="badge badge-gap today-badge">Hoy</span>}
          </h2>
          {slots.length === 0 && <p className="muted small">Sin sesiones.</p>}
          <ul className="slot-list">
            {slots.map((slot) => (
              <li key={slot.id} className="slot-row">
                <div className="slot-info">
                  <span className="badge">{SESSION_TYPE_LABELS[slot.type] ?? slot.type}</span>
                  <span className="slot-name">{slot.name}</span>
                  {slot.type === SESSION_TYPES.STRENGTH && (
                    <span className="muted small">
                      {slot.templateId && templateName(slot.templateId)
                        ? `Siempre: ${templateName(slot.templateId)}`
                        : 'Automática (la siguiente)'}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary slot-edit"
                  aria-label={`Editar ${slot.name} del ${WEEKDAY_NAMES[weekday]}`}
                  onClick={() => setView({ mode: 'slot', id: slot.id, weekday })}
                >
                  Editar
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-secondary add-slot" onClick={() => setView({ mode: 'slot', id: null, weekday })}>
            + Añadir sesión
          </button>
        </section>
      ))}

      {Object.keys(frequency).length > 0 && (
        <section className="card">
          <h2>Veces por semana de cada grupo (de media)</h2>
          <ul className="freq-list">
            {MUSCLE_GROUPS.filter((g) => frequency[g.id] !== undefined).map((g) => {
              const goal = goals?.timesPerWeekByGroup?.[g.id]
              const low = goal !== undefined && frequency[g.id] < goal
              return (
                <li key={g.id} className={low ? 'freq-low' : undefined}>
                  <span>{g.label}</span>
                  <span>
                    {formatTimes(frequency[g.id])}
                    {low ? ` (objetivo ${goal})` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
          {below.length > 0 && (
            <p className="muted small">
              Con este plan, {below.map((g) => g.label.toLowerCase()).join(', ')} sale{below.length > 1 ? 'n' : ''} menos veces
              que tu objetivo. Es solo un aviso: tú decides si te vale. Los días «automáticos» se reparten a partes iguales entre
              las sesiones, así que con 3 días y 2 sesiones cada una sale 1,5 veces por semana de media.
            </p>
          )}
        </section>
      )}
      </>
      )}
    </>
  )
}
