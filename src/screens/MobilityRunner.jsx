import { useEffect, useState } from 'react'
import { finishMobilitySession, formatClock } from '../core/workout.js'
import { discardSession, loadSession, saveSession } from '../storage/sessions.js'
import { keepScreenAwake } from '../ui/feedback.js'

/** Sesión de movilidad en curso: reloj desde que empieza y botón de terminar. Sin ejercicios: se hace a tu manera. */
export default function MobilityRunner({ db, sessionId, onExit, onChanged }) {
  const [session, setSession] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadSession(db, sessionId)
      .then((loaded) => {
        if (cancelled) return
        if (!loaded) setError('La sesión ya no existe.')
        else setSession(loaded)
      })
      .catch((e) => !cancelled && setError(`No se pudo abrir la sesión: ${e.message}`))
    return () => {
      cancelled = true
    }
  }, [db, sessionId])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

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

  if (finished) {
    return (
      <>
        <h1>Movilidad guardada</h1>
        <section className="card">
          <p className="card-title">{session.name}</p>
          <p>
            <strong>{session.durationMin} min</strong> reales
          </p>
          <p className="muted small">Queda en tu historial y en el calendario.</p>
        </section>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onExit}>
            Volver a Hoy
          </button>
        </div>
      </>
    )
  }

  const seconds = Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 1000))
  const minutes = Math.floor(seconds / 60)

  async function finish() {
    try {
      const done = finishMobilitySession(session, { notes: session.notes, now: new Date() })
      await saveSession(db, done)
      setSession(done)
      setFinished(true)
      await onChanged()
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`)
    }
  }

  async function discard() {
    if (!window.confirm('¿Descartar esta sesión de movilidad? No se guardará. No se puede deshacer.')) return
    try {
      await discardSession(db, session.id)
      await onChanged()
      onExit()
    } catch (e) {
      setError(`No se pudo descartar: ${e.message}`)
    }
  }

  return (
    <>
      <div className="run-header">
        <button type="button" className="back" onClick={onExit}>
          ← Salir
        </button>
        <span className="muted small">{session.name}</span>
      </div>
      <h1>Movilidad</h1>
      <section className="card mobility-clock" aria-live="off">
        <span className="rest-clock" role="timer">
          {formatClock(seconds)}
        </span>
        <span className="muted small">{minutes} min desde que empezaste</span>
      </section>
      <p className="muted small">Hazla a tu manera. Cuando termines, pulsa «Terminar» y se guarda el tiempo real.</p>

      <section className="card">
        <label className="field">
          <span className="field-label">Notas (opcional)</span>
          <textarea rows={3} value={session.notes} onChange={(e) => setSession({ ...session, notes: e.target.value })} onBlur={() => saveSession(db, session).catch(() => {})} />
        </label>
      </section>

      {error && <p className="message message-error">{error}</p>}
      <div className="actions">
        <button type="button" className="btn btn-primary big-check" onClick={finish}>
          Terminar
        </button>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-secondary btn-danger" onClick={discard}>
          Descartar
        </button>
      </div>
    </>
  )
}
