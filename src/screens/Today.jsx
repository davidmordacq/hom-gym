import { useState } from 'react'
import { toIsoDate, weekdayOf } from '../core/dates.js'
import { weekProgress } from '../core/history.js'
import { RANDOM_CORE, SESSION_STATUS, SESSION_TYPES } from '../core/model.js'
import { estimateMinutes, itemTargetText, minutesText, sortTemplates, suggestNextTemplateId } from '../core/templates.js'
import { durationMinutes, QUICK_TYPES, startMobilitySession, startStrengthSession } from '../core/workout.js'
import { backupStatus, backupText, snoozeUntil } from '../core/backupStatus.js'
import { setSetting } from '../storage/db.js'
import { discardSession, saveSession } from '../storage/sessions.js'
import { buildBackupFile, canShareFiles, downloadBackup, markBackupDone, shareBackup } from '../ui/backupFile.js'
import { SESSION_TYPE_LABELS } from '../ui/labels.js'
import QuickLog from './QuickLog.jsx'

const timeOf = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

/** Una sesión de fuerza del plan: propone la que toca, deja cambiarla y empezarla. */
function StrengthCard({ slot, templates, exercises, sessions, rules, restSeconds, perSideRestSeconds, blocked, doneToday, onStart }) {
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
      {doneToday && <span className="badge badge-gap today-badge">Hecha hoy ✓</span>}
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
            {template.items.length} ejercicios · {minutesText(estimateMinutes(template, exercises, { rules, restSeconds, perSideRestSeconds }))}
          </p>
          <ol className="today-list">
            {template.items.map((item) => {
              const exercise = byId.get(item.exerciseId)
              const core = item.coreExerciseId ? byId.get(item.coreExerciseId) : null
              return (
                <li key={item.exerciseId}>
                  <span className="exercise-name">{exercise?.name ?? 'Ejercicio que ya no existe'}</span>
                  <span className="muted small">{itemTargetText(item, exercise, rules)}</span>
                  <span className="muted small">
                    {item.coreExerciseId === RANDOM_CORE ? 'Descanso con core al azar' : core ? `Descanso con core: ${core.name}` : 'Descanso puro'}
                  </span>
                </li>
              )
            })}
          </ol>
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={blocked} onClick={() => onStart(template, slot.id)}>
              Empezar sesión
            </button>
          </div>
        </>
      )}
    </section>
  )
}

/** Aviso semanal de copia de seguridad (una web no puede hacerla sola: avisa al abrir la app). */
function BackupReminder({ db, status, onChanged }) {
  const [message, setMessage] = useState(null)

  async function save() {
    try {
      downloadBackup(await buildBackupFile(db))
      await markBackupDone(db)
      await onChanged()
    } catch (e) {
      setMessage(`No se pudo crear la copia: ${e.message}`)
    }
  }
  async function share() {
    try {
      if ((await shareBackup(await buildBackupFile(db))) === 'shared') {
        await markBackupDone(db)
        await onChanged()
      }
    } catch (e) {
      setMessage(`No se pudo compartir la copia: ${e.message}`)
    }
  }
  async function later() {
    try {
      await setSetting(db, 'backupSnoozedUntil', snoozeUntil())
      await onChanged()
    } catch (e) {
      setMessage(`No se pudo posponer: ${e.message}`)
    }
  }

  return (
    <section className="card backup-card">
      <h2>Toca hacer una copia de seguridad</h2>
      <p>{backupText(status)} Tus datos solo están en este dispositivo.</p>
      {message && <p className="message message-error">{message}</p>}
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={save}>
          Descargar copia
        </button>
        {canShareFiles() && (
          <button type="button" className="btn btn-secondary" onClick={share}>
            Compartir copia
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={later}>
          Mañana
        </button>
      </div>
    </section>
  )
}

export default function Today({ db, plan, templates, exercises, sessions, rules, restSeconds, perSideRestSeconds, lastBackupAt, backupSnoozedUntil, onOpenSession, onChanged }) {
  const [logging, setLogging] = useState(null) // { type, slot }
  const [error, setError] = useState(null)
  const now = new Date()
  const todayIso = toIsoDate(now)
  const rawDate = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const todayText = rawDate.charAt(0).toUpperCase() + rawDate.slice(1) // "Domingo, 8 de noviembre"
  const slots = plan.filter((slot) => slot.weekday === weekdayOf(now))
  const running = sessions.find((s) => s.status === SESSION_STATUS.IN_PROGRESS) ?? null
  const doneToday = sessions.filter((s) => s.date === todayIso && (s.status === SESSION_STATUS.DONE || s.status === SESSION_STATUS.SKIPPED))
  const slotDoneToday = (slot) => doneToday.some((s) => s.slotId === slot.id && s.status === SESSION_STATUS.DONE)
  const sortedTemplates = sortTemplates(templates)
  const suggested = suggestNextTemplateId(templates, sessions)
  const week = weekProgress({ plan, sessions, today: now })
  const backup = backupStatus({
    lastBackupAt,
    sessionCount: sessions.filter((s) => s.status !== SESSION_STATUS.IN_PROGRESS).length,
    snoozedUntil: backupSnoozedUntil,
  })

  async function start(template, slotId = null) {
    setError(null)
    try {
      const session = startStrengthSession({ template, slotId, restSeconds, perSideRestSeconds, exercises })
      await saveSession(db, session)
      await onChanged()
      onOpenSession(session.id)
    } catch (e) {
      setError(`No se pudo empezar la sesión: ${e.message}`)
    }
  }

  async function startMobility(slot = null) {
    setError(null)
    try {
      const session = startMobilitySession({ slot })
      await saveSession(db, session)
      await onChanged()
      onOpenSession(session.id)
    } catch (e) {
      setError(`No se pudo empezar la sesión: ${e.message}`)
    }
  }

  async function discardRunning() {
    if (!window.confirm(`¿Descartar la sesión «${running.name}»? Se borrará todo lo que anotaste en ella. No se puede deshacer.`)) return
    try {
      await discardSession(db, running.id)
      await onChanged()
    } catch (e) {
      setError(`No se pudo descartar: ${e.message}`)
    }
  }

  if (logging) {
    return (
      <QuickLog
        type={logging.type}
        slot={logging.slot}
        onSave={async (session) => {
          await saveSession(db, session)
          await onChanged()
          setLogging(null)
        }}
        onCancel={() => setLogging(null)}
      />
    )
  }

  return (
    <>
      <h1>Hoy</h1>
      <p className="muted day-text">{todayText}</p>

      <p className="week-line" aria-label="Esta semana">
        <span className="muted small">Esta semana:</span>{' '}
        {[
          ['Fuerza', week.strength],
          ['Bici', week.bike],
          ['Movilidad', week.mobility],
        ]
          .filter(([, w]) => w.planned > 0 || w.done > 0)
          .map(([label, w]) => (
            <span className="badge badge-gap" key={label}>
              {label} {w.done}/{w.planned}
            </span>
          ))}
      </p>

      {backup.due && <BackupReminder db={db} status={backup} onChanged={onChanged} />}

      {running && (
        <section className="card running-card">
          <span className="badge">En curso</span>
          <p className="card-title">{running.name}</p>
          <p className="muted small">Empezó a las {timeOf(running.startedAt)}.</p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => onOpenSession(running.id)}>
              Continuar sesión
            </button>
            <button type="button" className="btn btn-secondary btn-danger" onClick={discardRunning}>
              Descartar
            </button>
          </div>
        </section>
      )}

      {error && <p className="message message-error">{error}</p>}

      {slots.length === 0 ? (
        <section className="card">
          <p>No tienes nada previsto para hoy. Aun así, puedes empezar cualquier sesión aquí abajo.</p>
        </section>
      ) : (
        slots.map((slot) =>
          slot.type === SESSION_TYPES.STRENGTH ? (
            <StrengthCard
              key={slot.id}
              slot={slot}
              templates={templates}
              exercises={exercises}
              sessions={sessions}
              rules={rules}
              restSeconds={restSeconds}
              perSideRestSeconds={perSideRestSeconds}
              blocked={Boolean(running)}
              doneToday={slotDoneToday(slot)}
              onStart={start}
            />
          ) : (
            <section className="card" key={slot.id}>
              <span className="badge">{SESSION_TYPE_LABELS[slot.type] ?? slot.type}</span>
              {slotDoneToday(slot) && <span className="badge badge-gap today-badge">Hecha hoy ✓</span>}
              <p className="card-title">{slot.name}</p>
              <div className="actions">
                {slot.type === SESSION_TYPES.MOBILITY && (
                  <button type="button" className="btn btn-primary" disabled={Boolean(running)} onClick={() => startMobility(slot)}>
                    Empezar
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setLogging({ type: slot.type, slot })}>
                  {slot.type === SESSION_TYPES.MOBILITY ? 'Registrar ya hecha' : 'Registrar'}
                </button>
              </div>
            </section>
          ),
        )
      )}

      <section className="card" aria-label="Otra sesión">
        <h2>Otra sesión</h2>
        <p className="muted small">Empieza la que quieras, aunque hoy ya hayas entrenado o no estuviera en el plan.</p>
        {running && <p className="muted small">Primero termina o descarta la sesión en curso.</p>}
        {sortedTemplates.length > 0 && (
          <div className="stack">
            {sortedTemplates.map((template) => (
              <button key={template.id} type="button" className="btn btn-secondary" disabled={Boolean(running)} onClick={() => start(template)}>
                Empezar {template.name}
                {template.id === suggested ? ' (la que toca)' : ''}
              </button>
            ))}
          </div>
        )}
        <div className="stack">
          <button type="button" className="btn btn-secondary" disabled={Boolean(running)} onClick={() => startMobility()}>
            Empezar movilidad
          </button>
          {QUICK_TYPES.map((type) => (
            <button key={type} type="button" className="btn btn-secondary" onClick={() => setLogging({ type, slot: null })}>
              Registrar {SESSION_TYPE_LABELS[type].toLowerCase()}
              {type === SESSION_TYPES.MOBILITY ? ' ya hecha' : ''}
            </button>
          ))}
        </div>
      </section>

      {doneToday.length > 0 && (
        <section className="card" aria-label="Hecho hoy">
          <h2>Hecho hoy</h2>
          <ul className="summary-list">
            {doneToday.map((s) => {
              const minutes = s.durationMin ?? durationMinutes(s.startedAt, s.endedAt)
              return (
                <li key={s.id}>
                  <span className="exercise-name">{s.name}</span>
                  <span className="muted small">
                    {s.status === SESSION_STATUS.SKIPPED ? 'No la hiciste' : minutes ? `${minutes} min` : 'Hecha'}
                    {s.tss ? ` · TSS ${s.tss}` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}
