import { useEffect, useMemo, useState } from 'react'
import { isArchived, levelsEasyToHard } from '../core/exercises.js'
import { findLevel } from '../core/resistance.js'
import { itemTargetText } from '../core/templates.js'
import { parseYoutubeId } from '../core/youtube.js'
import {
  WARNING_SECONDS, addSetToExercise, buildSet, chooseCore, defaultLevelId, defaultReps, drawCore, durationMinutes, finishSession,
  formatClock, goToExercise, lastPerformance, lastPerformanceText, repStep, sessionSummary, setExerciseNotes, skipExercise,
  skipNextSet, touchExercise,
} from '../core/workout.js'
import { EXERCISE_UNITS, RANDOM_CORE } from '../core/model.js'
import { deleteSet, discardSession, loadExerciseHistory, loadSession, loadSessionSets, saveSession, saveSet } from '../storage/sessions.js'
import { keepScreenAwake, unlockAudio } from '../ui/feedback.js'
import { useRestTimer } from '../ui/useRestTimer.js'
import VideoPlayer from '../ui/VideoPlayer.jsx'

const MAX_VALUE = 999

/** Pantalla de la sesión de fuerza en curso: un ejercicio cada vez, series con un toque y descanso con aviso. */
export default function SessionRunner({ db, sessionId, exercises, scales, rules, restSeconds, corePool, sessions, onExit, onChanged }) {
  const [session, setSession] = useState(null)
  const [sets, setSets] = useState([])
  const [history, setHistory] = useState([])
  const [view, setView] = useState('run') // 'run' | 'finish' | 'saved'
  const [draft, setDraft] = useState({ reps: {}, level: {} })
  const [rest, setRest] = useState(null) // { exerciseId, order }: la serie tras la que se está descansando
  const [watch, setWatch] = useState(null) // { key, startedAt }: cronómetro de un ejercicio en segundos
  const [clock, setClock] = useState(Date.now())
  const [showVideo, setShowVideo] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(null)
  const timer = useRestTimer()

  const byExercise = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const scaleById = useMemo(() => new Map(scales.map((s) => [s.id, s])), [scales])
  // Ejercicios de core entre los que se elige al azar en cada descanso (solo los que existen y no están archivados).
  const validPool = useMemo(() => corePool.filter((id) => byExercise.has(id) && !isArchived(byExercise.get(id))), [corePool, byExercise])

  // Carga la sesión y lo hecho en otras sesiones.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const loaded = await loadSession(db, sessionId)
        if (!loaded) throw new Error('La sesión ya no existe.')
        const [mine, past] = await Promise.all([loadSessionSets(db, sessionId), loadExerciseHistory(db, loaded.exercises.map((e) => e.exerciseId))])
        if (cancelled) return
        setSession(loaded)
        setSets(mine)
        setHistory(past)
      } catch (e) {
        if (!cancelled) setError(`No se pudo abrir la sesión: ${e.message}`)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, sessionId])

  // Pantalla encendida mientras dura la sesión, y reloj para el tiempo transcurrido y el cronómetro.
  useEffect(() => {
    let release = () => {}
    let cancelled = false
    keepScreenAwake().then((fn) => {
      if (cancelled) fn()
      else release = fn
    })
    return () => {
      cancelled = true
      release()
    }
  }, [])
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), watch ? 250 : 15000)
    return () => clearInterval(id)
  }, [watch])

  async function persist(next) {
    setSession(next)
    try {
      await saveSession(db, next)
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`)
    }
  }

  if (!session) {
    return (
      <>
        <button type="button" className="back" onClick={onExit}>
          ← Volver
        </button>
        <p className="status">{error ?? 'Abriendo la sesión…'}</p>
      </>
    )
  }

  const summary = sessionSummary(session, sets, exercises, new Date(clock))

  // ---- Sesión guardada -------------------------------------------------------------------
  if (view === 'saved') {
    return (
      <>
        <h1>Sesión guardada</h1>
        <section className="card">
          <p className="card-title">{session.name}</p>
          <p>
            <strong>{saved?.durationMin ?? summary.durationMin} min</strong> reales · {summary.setsDone} series · {summary.totalReps}{' '}
            repeticiones
          </p>
          <p className="muted small">Queda en tu historial con la hora de inicio y de fin.</p>
        </section>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onExit}>
            Volver a Hoy
          </button>
        </div>
      </>
    )
  }

  // ---- Resumen antes de terminar -------------------------------------------------------------
  if (view === 'finish') {
    const finish = async () => {
      timer.stop()
      const done = finishSession(session, { notes: session.notes, now: new Date() })
      try {
        await saveSession(db, done)
        setSession(done)
        setSaved({ durationMin: durationMinutes(done.startedAt, done.endedAt) })
        setView('saved')
        await onChanged()
      } catch (e) {
        setError(`No se pudo guardar la sesión: ${e.message}`)
      }
    }
    const discard = async () => {
      if (!window.confirm('¿Descartar esta sesión? Se borrará todo lo que has anotado en ella. No se puede deshacer.')) return
      try {
        timer.stop()
        await discardSession(db, session.id)
        await onChanged()
        onExit()
      } catch (e) {
        setError(`No se pudo descartar: ${e.message}`)
      }
    }
    return (
      <>
        <button type="button" className="back" onClick={() => setView('run')}>
          ← Volver a la sesión
        </button>
        <h1>Terminar sesión</h1>
        <section className="card">
          <p className="card-title">{session.name}</p>
          <p>
            <strong>{summary.durationMin ?? 1} min</strong> hasta ahora · {summary.setsDone} series · {summary.totalReps} repeticiones
          </p>
          {summary.exercisesDone < summary.exercisesTotal && (
            <p className="muted small">
              Hay {summary.exercisesTotal - summary.exercisesDone} ejercicio(s) sin ninguna serie. No pasa nada: solo se guarda lo que hiciste.
            </p>
          )}
          <ul className="summary-list">
            {summary.perExercise.map((item) => {
              const exercise = byExercise.get(item.exerciseId)
              const scale = scaleById.get(exercise?.scaleId)
              return (
                <li key={item.exerciseId}>
                  <span className="exercise-name">{item.name}</span>
                  <span className="muted small">
                    {item.sets.length === 0
                      ? item.skipped
                        ? 'Saltado'
                        : 'Sin series'
                      : `${item.sets.map((s) => s.reps).join(', ')} ${item.unit === EXERCISE_UNITS.SECONDS ? 's' : 'rep.'}${
                          item.sets.at(-1).levelId && exercise ? ` · ${findLevel(exercise, scale, item.sets.at(-1).levelId)?.label ?? ''}` : ''
                        }`}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
        <section className="card">
          <label className="field">
            <span className="field-label">¿Cómo ha ido? Notas de la sesión (opcional)</span>
            <textarea rows={4} value={session.notes} onChange={(e) => setSession({ ...session, notes: e.target.value })} />
          </label>
        </section>
        {error && <p className="message message-error">{error}</p>}
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={finish}>
            Terminar y guardar
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setView('run')}>
            Seguir entrenando
          </button>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-secondary btn-danger" onClick={discard}>
            Descartar sesión
          </button>
        </div>
      </>
    )
  }

  // ---- Ejercicio actual --------------------------------------------------------------------------
  const entry = session.exercises[session.cursor]
  const exercise = byExercise.get(entry.exerciseId)
  const scale = exercise ? scaleById.get(exercise.scaleId) ?? null : null
  const isSeconds = exercise?.unit === EXERCISE_UNITS.SECONDS
  const doneSets = sets.filter((s) => s.exerciseId === entry.exerciseId).sort((a, b) => a.order - b.order)
  const rowCount = Math.max(entry.targetSets, doneSets.length)
  const activeOrder = doneSets.length + 1
  const last = exercise ? lastPerformance(entry.exerciseId, history, sessions, { excludeSessionId: session.id }) : null
  const levels = exercise ? levelsEasyToHard(exercise, scale) : []
  const level = draft.level[entry.exerciseId] !== undefined ? draft.level[entry.exerciseId] : defaultLevelId({ exercise, scale, last, doneSets })
  const key = `${entry.exerciseId}:${activeOrder}`
  // Sin datos de la última vez, la serie nueva aparece con lo que acabas de hacer en la anterior.
  const fallbackReps = last ? undefined : doneSets.at(-1)?.reps
  const value = draft.reps[key] ?? fallbackReps ?? (exercise ? defaultReps(activeOrder, last, exercise, rules) : 1)
  const step = repStep(exercise)
  const isLastExercise = session.cursor === session.exercises.length - 1
  const videoId = exercise ? parseYoutubeId(exercise.videoUrl) : null
  const watching = watch?.key === key
  const elapsed = watching ? Math.floor((clock - watch.startedAt) / 1000) : 0
  const elapsedMinutes = durationMinutes(session.startedAt, new Date(clock).toISOString()) ?? 1

  const setValue = (next) => setDraft((d) => ({ ...d, reps: { ...d.reps, [key]: Math.min(MAX_VALUE, Math.max(1, next)) } }))
  const chooseLevel = (id) => setDraft((d) => ({ ...d, level: { ...d.level, [entry.exerciseId]: id } }))

  async function markSet() {
    unlockAudio() // el sonido solo se permite tras un toque
    if (levels.length > 0 && !level) {
      setError('Elige primero la banda o el peso con el que has hecho la serie.')
      return
    }
    setError(null)
    const now = new Date()
    // El core del descanso que sigue a esta serie: ninguno, uno fijo o uno distinto al azar (sin repetir seguidos).
    const draw = chooseCore({ mode: entry.coreExerciseId, pool: validPool, bag: session.coreBag ?? [], lastId: session.lastCoreId ?? null })
    const set = buildSet({ session, exerciseId: entry.exerciseId, order: activeOrder, reps: value, levelId: level, coreExerciseId: draw.id, now })
    try {
      await saveSet(db, set)
      setSets((current) => [...current.filter((s) => s.id !== set.id), set])
      await persist({ ...touchExercise(session, entry.exerciseId, now), coreBag: draw.bag, lastCoreId: draw.id ?? session.lastCoreId ?? null })
      setRest({ exerciseId: entry.exerciseId, order: activeOrder })
      timer.start(restSeconds)
      setWatch(null)
    } catch (e) {
      setError(`No se pudo guardar la serie: ${e.message}`)
    }
  }

  async function undoLastSet() {
    const lastSet = doneSets.at(-1)
    if (!lastSet) return
    try {
      await deleteSet(db, lastSet.id)
      setSets((current) => current.filter((s) => s.id !== lastSet.id))
      setDraft((d) => ({
        reps: { ...d.reps, [`${entry.exerciseId}:${lastSet.order}`]: lastSet.reps },
        level: { ...d.level, [entry.exerciseId]: lastSet.levelId },
      }))
      timer.stop()
      setRest(null)
      setError(null)
    } catch (e) {
      setError(`No se pudo deshacer: ${e.message}`)
    }
  }

  async function toggleCore() {
    const target = sets.find((s) => s.exerciseId === rest.exerciseId && s.order === rest.order)
    if (!target) return
    const updated = { ...target, coreAfter: !target.coreAfter }
    try {
      await saveSet(db, updated)
      setSets((current) => current.map((s) => (s.id === updated.id ? updated : s)))
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`)
    }
  }

  const goTo = (index) => {
    setError(null)
    setShowVideo(false)
    return persist(goToExercise(session, index, new Date()))
  }

  // Saltar la serie que toca (el ejercicio se queda con una menos) o el ejercicio entero (pasa al siguiente).
  const skipSet = () => {
    setError(null)
    return persist(skipNextSet(session, entry.exerciseId, doneSets.length))
  }
  const skipCurrentExercise = () => {
    setError(null)
    setShowVideo(false)
    const marked = doneSets.length === 0 ? skipExercise(session, entry.exerciseId) : session // con series hechas, solo se pasa de ejercicio
    return persist(goToExercise(marked, session.cursor + 1, new Date()))
  }

  // Descanso: el core de la última serie marcada (el que se eligió al marcarla; en sesiones antiguas, el fijo del ejercicio).
  const restEntry = rest ? session.exercises.find((e) => e.exerciseId === rest.exerciseId) : null
  const restSet = rest ? sets.find((s) => s.exerciseId === rest.exerciseId && s.order === rest.order) : null
  const fixedCore = restEntry?.coreExerciseId && restEntry.coreExerciseId !== RANDOM_CORE ? restEntry.coreExerciseId : null
  const restCoreId = restSet?.coreExerciseId ?? fixedCore
  const restCore = restCoreId ? byExercise.get(restCoreId) : null
  const canReroll = restEntry?.coreExerciseId === RANDOM_CORE && restSet && !restSet.coreAfter && validPool.length > 1

  // "Otro": si no apetece el core que ha salido, se saca otro de la bolsa (el anterior vuelve a quedar disponible).
  async function rerollCore() {
    const draw = drawCore({ bag: session.coreBag ?? [], pool: validPool, lastId: restSet.coreExerciseId })
    const updated = { ...restSet, coreExerciseId: draw.id }
    try {
      await saveSet(db, updated)
      setSets((current) => current.map((s) => (s.id === updated.id ? updated : s)))
      await persist({ ...session, coreBag: [...draw.bag, restSet.coreExerciseId], lastCoreId: draw.id })
    } catch (e) {
      setError(`No se pudo cambiar el core: ${e.message}`)
    }
  }
  const remaining = timer.remaining
  const restPhase = remaining === null ? null : remaining === 0 ? 'done' : remaining <= WARNING_SECONDS ? 'warning' : 'running'

  return (
    <>
      <div className="run-header">
        <button type="button" className="back" onClick={onExit}>
          ← Salir
        </button>
        <span className="muted small">
          {session.name} · {elapsedMinutes} min
        </span>
      </div>

      <div className="progress-dots" role="group" aria-label="Ejercicios de la sesión">
        {session.exercises.map((e, i) => {
          const finished = sets.some((s) => s.exerciseId === e.exerciseId)
          return (
            <button
              key={e.exerciseId}
              type="button"
              aria-label={`Ejercicio ${i + 1}: ${byExercise.get(e.exerciseId)?.name ?? ''}`}
              aria-current={i === session.cursor ? 'step' : undefined}
              className={`dot${finished ? ' dot-done' : ''}${i === session.cursor ? ' dot-current' : ''}`}
              onClick={() => goTo(i)}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      <p className="muted small">
        Ejercicio {session.cursor + 1} de {session.exercises.length}
      </p>
      <h1>{exercise?.name ?? 'Ejercicio que ya no existe'}</h1>

      {exercise && (
        <section className="card">
          <p>
            <strong>Objetivo:</strong> {itemTargetText({ sets: entry.targetSets, perSide: entry.perSide }, exercise, rules)}.
          </p>
          <p className="muted">Última vez: {lastPerformanceText(last, exercise, scale)}</p>
          {entry.perSide && <p className="muted small">Se hace con cada lado: anota las del lado más flojo.</p>}
          {(videoId || exercise.notes) && (
            <button type="button" className="btn btn-secondary video-toggle" onClick={() => setShowVideo((v) => !v)}>
              {showVideo ? 'Ocultar cómo se hace' : 'Ver cómo se hace'}
            </button>
          )}
          {showVideo && (
            <div className="video-box">
              {videoId && <VideoPlayer videoId={videoId} title={exercise.name} channel={exercise.videoChannel} />}
              {exercise.notes && <p className="muted small">{exercise.notes}</p>}
            </div>
          )}
        </section>
      )}

      {levels.length > 0 && (
        <section className="card">
          <span className="field-label">{scale?.name ?? 'Material'} (de más fácil a más difícil)</span>
          <div className="chips" role="group" aria-label="Material de esta serie">
            {levels.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`chip${level === l.id ? ' chip-on' : ''}`}
                aria-pressed={level === l.id}
                onClick={() => chooseLevel(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
          {!level && <p className="muted small">Primera vez: elige con qué lo haces. La próxima vez ya aparecerá marcado.</p>}
        </section>
      )}

      <section className="card" aria-label="Series">
        {Array.from({ length: rowCount }, (_, i) => i + 1).map((order) => {
          const done = doneSets.find((s) => s.order === order)
          if (done) {
            const doneLevel = done.levelId && exercise ? findLevel(exercise, scale, done.levelId) : null
            return (
              <div className="set-row set-done" key={order}>
                <span className="set-number">Serie {order}</span>
                <span className="set-result">
                  ✓ {done.reps} {isSeconds ? 's' : 'rep.'}
                  {doneLevel ? ` · ${doneLevel.label}` : ''}
                  {done.coreAfter ? ` · core ✓${done.coreExerciseId && byExercise.get(done.coreExerciseId) ? ` ${byExercise.get(done.coreExerciseId).name}` : ''}` : ''}
                </span>
              </div>
            )
          }
          if (order !== activeOrder) {
            return (
              <div className="set-row set-pending" key={order}>
                <span className="set-number">Serie {order}</span>
                <span className="muted">Pendiente</span>
              </div>
            )
          }
          return (
            <div className="set-row set-active" key={order}>
              <span className="set-number">Serie {order}</span>
              <div className="stepper" role="group" aria-label={`Serie ${order}`}>
                <button type="button" className="step-btn" aria-label={`Quitar ${step}`} onClick={() => setValue(value - step)}>
                  −
                </button>
                <span className="step-value" aria-live="polite">
                  {watching ? elapsed : value}
                  <small>{isSeconds ? ' s' : ''}</small>
                </span>
                <button type="button" className="step-btn" aria-label={`Añadir ${step}`} onClick={() => setValue(value + step)}>
                  +
                </button>
              </div>
            </div>
          )
        })}

        {activeOrder <= rowCount && (
          <div className="set-actions">
            {isSeconds &&
              (watching ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setValue(Math.max(1, elapsed))
                    setWatch(null)
                  }}
                >
                  ■ Parar ({elapsed} s)
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    unlockAudio()
                    setWatch({ key, startedAt: Date.now() })
                  }}
                >
                  ▶ Empezar cronómetro
                </button>
              ))}
            <button type="button" className="btn btn-primary big-check" onClick={markSet} disabled={watching}>
              ✓ Serie hecha
            </button>
            <button type="button" className="btn btn-secondary skip-set" onClick={skipSet}>
              Saltar esta serie
            </button>
          </div>
        )}
        {activeOrder > rowCount && <p className="muted">Series completadas. Puedes añadir otra o pasar al siguiente ejercicio.</p>}
      </section>

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      <section className="card">
        <label className="field">
          <span className="field-label">Sensaciones de este ejercicio (opcional)</span>
          <textarea
            rows={2}
            value={entry.notes}
            onChange={(e) => setSession(setExerciseNotes(session, entry.exerciseId, e.target.value))}
            onBlur={() => saveSession(db, session).catch((e) => setError(`No se pudo guardar la nota: ${e.message}`))}
          />
        </label>
      </section>

      <div className="nav-grid">
        <button type="button" className="btn btn-secondary" disabled={session.cursor === 0} onClick={() => goTo(session.cursor - 1)}>
          ← Ejercicio anterior
        </button>
        <button type="button" className="btn btn-secondary" disabled={doneSets.length === 0} onClick={undoLastSet}>
          Deshacer última serie
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => persist(addSetToExercise(session, entry.exerciseId))}>
          + Añadir serie
        </button>
        {isLastExercise ? (
          <button type="button" className="btn btn-primary" onClick={() => setView('finish')}>
            Terminar sesión
          </button>
        ) : activeOrder <= rowCount ? (
          <button type="button" className="btn btn-secondary" onClick={skipCurrentExercise}>
            Saltar ejercicio →
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => goTo(session.cursor + 1)}>
            Siguiente ejercicio →
          </button>
        )}
      </div>
      {!isLastExercise && (
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={() => setView('finish')}>
            Terminar sesión ahora
          </button>
        </div>
      )}

      {restPhase && (
        <div className={`rest-card rest-${restPhase}`} role="timer" aria-live="off">
          <div className="rest-main">
            <span className="rest-label">
              {restPhase === 'done' ? '¡A por la siguiente!' : restPhase === 'warning' ? '¡Prepárate!' : 'Descanso'}
            </span>
            <span className="rest-clock">{formatClock(remaining)}</span>
          </div>
          {restCore && (
            <div className="rest-core-row">
              <button type="button" className={`chip rest-core${restSet?.coreAfter ? ' chip-on' : ''}`} aria-pressed={Boolean(restSet?.coreAfter)} onClick={toggleCore}>
                {restSet?.coreAfter ? '✓ ' : ''}Core: {restCore.name}
              </button>
              {canReroll && (
                <button type="button" className="chip" onClick={rerollCore}>
                  Otro
                </button>
              )}
            </div>
          )}
          {!restCore && restPhase !== 'done' && <span className="muted small">Descanso puro</span>}
          <button
            type="button"
            className="btn btn-secondary rest-skip"
            onClick={() => {
              timer.stop()
              setRest(null)
            }}
          >
            {restPhase === 'done' ? 'Cerrar' : 'Saltar descanso'}
          </button>
        </div>
      )}
    </>
  )
}
