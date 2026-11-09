import { useCallback, useEffect, useMemo, useState } from 'react'
import { HISTORY_FILTERS, dateText, listHistory, sessionLine, sessionMinutes } from '../core/history.js'
import { SESSION_STATUS, SESSION_TYPES } from '../core/model.js'
import { findLevel } from '../core/resistance.js'
import { toQuickDraft, sessionSummary } from '../core/workout.js'
import { getAll } from '../storage/db.js'
import { ignoreImportedSession } from '../storage/intervalsSync.js'
import { discardSession, saveSession } from '../storage/sessions.js'
import { SESSION_TYPE_LABELS } from '../ui/labels.js'
import QuickLog from './QuickLog.jsx'

const PAGE = 30
const timeOf = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

/** Historial: lista de sesiones hechas y detalle de cada una (con sus series, tiempos y notas). */
export default function History({ db, sessions, exercises, scales, onChanged }) {
  const [filter, setFilter] = useState('all')
  const [visible, setVisible] = useState(PAGE)
  const [view, setView] = useState({ mode: 'list' }) // { mode: 'list' } | { mode: 'detail', id } | { mode: 'edit', id }
  const [sets, setSets] = useState([])
  const [error, setError] = useState(null)

  const reloadSets = useCallback(async () => {
    try {
      setSets(await getAll(db, 'sets'))
    } catch (e) {
      setError(`No se pudieron leer las series: ${e.message}`)
    }
  }, [db])
  useEffect(() => {
    reloadSets()
  }, [reloadSets, sessions])

  const items = useMemo(() => listHistory(sessions, filter), [sessions, filter])
  const setsBySession = useMemo(() => {
    const map = new Map()
    for (const set of sets) {
      if (!map.has(set.sessionId)) map.set(set.sessionId, [])
      map.get(set.sessionId).push(set)
    }
    return map
  }, [sets])
  const byExercise = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const scaleById = useMemo(() => new Map(scales.map((s) => [s.id, s])), [scales])

  const selected = view.id ? sessions.find((s) => s.id === view.id) : null

  async function remove(session) {
    const imported = session.source === 'intervals'
    const warning = imported
      ? 'No volverá a importarse de Intervals.icu. No se puede deshacer.'
      : 'Se borrarán también sus series. No se puede deshacer.'
    if (!window.confirm(`¿Borrar «${session.name}» del ${dateText(session.date)}? ${warning}`)) return
    try {
      if (imported) await ignoreImportedSession(db, session.id) // así la siguiente sincronización no la trae otra vez
      await discardSession(db, session.id)
      await onChanged()
      setView({ mode: 'list' })
    } catch (e) {
      setError(`No se pudo borrar: ${e.message}`)
    }
  }

  if (view.mode === 'edit' && selected) {
    return (
      <QuickLog
        type={selected.type}
        initial={toQuickDraft(selected)}
        onSave={async (session) => {
          await saveSession(db, session)
          await onChanged()
          setView({ mode: 'detail', id: session.id })
        }}
        onCancel={() => setView({ mode: 'detail', id: selected.id })}
      />
    )
  }

  if (view.mode === 'detail') {
    if (!selected) {
      return (
        <>
          <button type="button" className="back" onClick={() => setView({ mode: 'list' })}>
            ← Historial
          </button>
          <p className="muted">Esta sesión ya no existe.</p>
        </>
      )
    }
    const isStrength = selected.type === SESSION_TYPES.STRENGTH
    const skipped = selected.status === SESSION_STATUS.SKIPPED
    const minutes = sessionMinutes(selected)
    const summary = isStrength ? sessionSummary(selected, setsBySession.get(selected.id) ?? [], exercises) : null
    return (
      <>
        <button type="button" className="back" onClick={() => setView({ mode: 'list' })}>
          ← Historial
        </button>
        <h1>{selected.name}</h1>
        <p className="muted day-text">
          <span className="badge badge-gap">{SESSION_TYPE_LABELS[selected.type] ?? selected.type}</span>
          {dateText(selected.date)}
        </p>

        <section className="card">
          {skipped ? (
            <p>No la hiciste.</p>
          ) : (
            <>
              {minutes && (
                <p>
                  <strong>{minutes} min</strong>
                  {isStrength && selected.startedAt && selected.endedAt ? ` · de ${timeOf(selected.startedAt)} a ${timeOf(selected.endedAt)}` : ''}
                </p>
              )}
              {isStrength && (
                <p className="muted">
                  {summary.setsDone} series · {summary.totalReps} repeticiones · {summary.exercisesDone} de {summary.exercisesTotal} ejercicios
                </p>
              )}
              {!isStrength && selected.tss ? (
                <p>
                  <strong>TSS {selected.tss}</strong>
                </p>
              ) : null}
              {!isStrength && selected.effort ? <p className="muted">Esfuerzo {selected.effort} de 10</p> : null}
            </>
          )}
          {selected.notes && <p className="muted">«{selected.notes}»</p>}
          {selected.source === 'intervals' && (
            <p className="muted small">Importada de Intervals.icu. Para corregirla, cámbiala allí y vuelve a sincronizar.</p>
          )}
        </section>

        {isStrength &&
          summary.perExercise.map((item, i) => {
            const exercise = byExercise.get(item.exerciseId)
            const scale = scaleById.get(exercise?.scaleId)
            const note = selected.exercises[i]?.notes
            return (
              <section className="card" key={item.exerciseId}>
                <p className="card-title">{item.name}</p>
                {item.sets.length === 0 ? (
                  <p className="muted small">{item.skipped ? 'Saltado.' : 'Sin series.'}</p>
                ) : (
                  <ul className="summary-list">
                    {item.sets.map((set) => (
                      <li key={set.id}>
                        <span>
                          Serie {set.order}: <strong>{set.reps}</strong> {item.unit === 'seconds' ? 's' : 'rep.'}
                          {set.levelId && exercise ? ` · ${findLevel(exercise, scale, set.levelId)?.label ?? set.levelId}` : ''}
                          {set.coreAfter ? ` · core ✓${byExercise.get(set.coreExerciseId) ? ` ${byExercise.get(set.coreExerciseId).name}` : ''}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {note && <p className="muted small">«{note}»</p>}
              </section>
            )
          })}

        {error && <p className="message message-error">{error}</p>}
        <div className="actions">
          {!isStrength && selected.source !== 'intervals' && (
            <button type="button" className="btn btn-primary" onClick={() => setView({ mode: 'edit', id: selected.id })}>
              Editar
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-danger" onClick={() => remove(selected)}>
            Borrar sesión
          </button>
        </div>
      </>
    )
  }

  const shown = items.slice(0, visible)
  return (
    <>
      <h1>Historial</h1>
      <div className="segmented history-filter" role="group" aria-label="Filtrar por tipo">
        {HISTORY_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`seg${filter === f.id ? ' seg-active' : ''}`}
            aria-pressed={filter === f.id}
            onClick={() => {
              setFilter(f.id)
              setVisible(PAGE)
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="message message-error">{error}</p>}

      {items.length === 0 ? (
        <section className="card">
          <p>{filter === 'all' ? 'Aún no has terminado ninguna sesión. Cuando lo hagas, aparecerá aquí.' : 'No hay sesiones de este tipo todavía.'}</p>
        </section>
      ) : (
        <ul className="exercise-list history-list">
          {shown.map((session) => (
            <li key={session.id}>
              <button type="button" className="exercise-row" onClick={() => setView({ mode: 'detail', id: session.id })}>
                <span className="exercise-name">
                  {dateText(session.date)} · {session.name}
                </span>
                <span className="muted small">{sessionLine(session, setsBySession.get(session.id) ?? [], exercises)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > visible && (
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={() => setVisible(visible + PAGE)}>
            Ver más ({items.length - visible} más)
          </button>
        </div>
      )}
    </>
  )
}
