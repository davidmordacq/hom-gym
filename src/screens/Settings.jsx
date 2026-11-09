import { useRef, useState } from 'react'
import { parseBackup } from '../core/backup.js'
import { isArchived } from '../core/exercises.js'
import { CORE_REST_POOL_IDS } from '../core/exerciseLibrary.js'
import { backupStatus, backupText } from '../core/backupStatus.js'
import { validateGlobalRules } from '../core/progressionConfig.js'
import { buildBackupFile, canShareFiles, downloadBackup, markBackupDone, shareBackup } from '../ui/backupFile.js'
import { testAlert } from '../ui/feedback.js'
import { replaceAll, setSetting } from '../storage/db.js'
import { readSecrets, restoreSecrets } from '../storage/secrets.js'
import IntervalsCard from './IntervalsCard.jsx'
import { THEMES, applyTheme } from '../theme.js'

const VIBRATION_TEXT = {
  ok: 'El navegador ha aceptado la vibración. Si el móvil no vibra, revisa los ajustes de sonido y vibración del teléfono.',
  blocked: 'El navegador ha rechazado la vibración. Puede ser un ajuste del teléfono o del navegador.',
  unsupported: 'Este navegador no permite vibrar desde una web.',
}

const REST_STEP = 15
const REST_MIN = 30
const REST_MAX = 300

const formatRest = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export default function Settings({ db, theme, persisted, restSeconds, rules, lastBackupAt, intervals, exercises, corePool, onChanged }) {
  const [message, setMessage] = useState(null)
  const [goal, setGoal] = useState({ min: rules.repRange.min, max: rules.repRange.max, sets: rules.targetSets })
  const [goalErrors, setGoalErrors] = useState([])
  const [goalSaved, setGoalSaved] = useState(false)
  const [alertResult, setAlertResult] = useState(null)
  const fileInput = useRef(null)

  async function changeTheme(newTheme) {
    applyTheme(newTheme)
    await setSetting(db, 'theme', newTheme)
    await onChanged()
  }

  // Ejercicios que se pueden elegir como core de los descansos: los de core, los lumbares de la lista por defecto y los ya marcados.
  const poolCandidates = exercises
    .filter((e) => !isArchived(e) && (e.muscleGroups.includes('core') || CORE_REST_POOL_IDS.includes(e.id) || corePool.includes(e.id)))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  async function togglePool(id) {
    const next = corePool.includes(id) ? corePool.filter((x) => x !== id) : [...corePool, id]
    try {
      await setSetting(db, 'corePool', next)
      await onChanged()
    } catch (error) {
      setMessage({ kind: 'error', text: `No se pudo guardar el cambio: ${error.message}` })
    }
  }

  async function changeRest(delta) {
    const next = Math.min(REST_MAX, Math.max(REST_MIN, restSeconds + delta))
    if (next === restSeconds) return
    try {
      await setSetting(db, 'restSeconds', next)
      await onChanged()
    } catch (error) {
      setMessage({ kind: 'error', text: `No se pudo guardar el descanso: ${error.message}` })
    }
  }

  async function saveGoal(event) {
    event.preventDefault()
    setGoalSaved(false)
    const result = validateGlobalRules(goal, rules)
    setGoalErrors(result.errors)
    if (!result.rules) return
    try {
      await setSetting(db, 'progressionRules', result.rules)
      await onChanged()
      setGoalSaved(true)
    } catch (error) {
      setGoalErrors([`No se pudo guardar: ${error.message}`])
    }
  }

  async function exportBackup() {
    try {
      downloadBackup(await buildBackupFile(db))
      await markBackupDone(db)
      await onChanged()
      setMessage({
        kind: 'ok',
        text: 'Copia descargada: la tienes en la carpeta Descargas de este dispositivo. Guárdala también fuera (por ejemplo, en Google Drive).',
      })
    } catch (error) {
      setMessage({ kind: 'error', text: `No se pudo crear la copia: ${error.message}` })
    }
  }

  async function shareBackupNow() {
    try {
      const result = await shareBackup(await buildBackupFile(db))
      if (result === 'shared') {
        await markBackupDone(db)
        await onChanged()
        setMessage({ kind: 'ok', text: 'Copia compartida. Comprueba que ha llegado a donde la enviaste.' })
      }
    } catch (error) {
      setMessage({ kind: 'error', text: `No se pudo compartir la copia: ${error.message}` })
    }
  }

  async function importBackup(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    try {
      const backup = parseBackup(await file.text())
      const when = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString('es-ES') : 'fecha desconocida'
      const ok = window.confirm(
        `Vas a sustituir TODOS tus datos actuales por los de la copia del ${when}. Esto no se puede deshacer. ¿Continuar?`,
      )
      if (!ok) return
      const secrets = await readSecrets(db) // la copia no lleva las claves personales: se conservan las de este dispositivo
      await replaceAll(db, backup.data)
      await restoreSecrets(db, secrets)
      await onChanged()
      setMessage({ kind: 'ok', text: 'Copia restaurada correctamente.' })
    } catch (error) {
      setMessage({ kind: 'error', text: `No se pudo restaurar: ${error.message} No se ha cambiado nada.` })
    }
  }

  return (
    <>
      <h1>Ajustes</h1>

      <section className="card">
        <h2>Tema</h2>
        <div className="segmented" role="group" aria-label="Tema de color">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`seg${theme === t.id ? ' seg-active' : ''}`}
              aria-pressed={theme === t.id}
              onClick={() => changeTheme(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Descanso entre series</h2>
        <div className="item-row">
          <span className="muted">Cuenta atrás tras cada serie. Avisa cuando quedan 15 s.</span>
          <div className="stepper" role="group" aria-label="Descanso entre series">
            <button type="button" className="step-btn" aria-label="Menos descanso" onClick={() => changeRest(-REST_STEP)}>
              −
            </button>
            <span className="step-value" aria-live="polite">
              {formatRest(restSeconds)}
            </span>
            <button type="button" className="step-btn" aria-label="Más descanso" onClick={() => changeRest(REST_STEP)}>
              +
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Probar el aviso del descanso</h2>
        <p className="muted small">Suena igual que a los 15 segundos de descanso. Sirve para comprobar el sonido y la vibración.</p>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={() => setAlertResult(testAlert())}>
            Probar aviso
          </button>
        </div>
        {alertResult && (
          <p className="message" role="status">
            {VIBRATION_TEXT[alertResult.vibration]}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Core y lumbares en los descansos</h2>
        <p className="muted small">
          En los ejercicios con «core al azar», la app elige en cada descanso uno de estos, sin repetir el mismo dos descansos seguidos
          y pasando por todos antes de repetir. Marca los que quieras usar.
        </p>
        <ul className="pool-list">
          {poolCandidates.map((exercise) => (
            <li key={exercise.id}>
              <label className="check">
                <input type="checkbox" checked={corePool.includes(exercise.id)} onChange={() => togglePool(exercise.id)} />
                <span>
                  {exercise.name}
                  {exercise.muscleGroups[0] === 'back' ? <span className="muted small"> · lumbares</span> : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {corePool.length < 2 && (
          <p className="message message-error">
            {corePool.length === 0
              ? 'Sin ningún ejercicio marcado, los descansos con core al azar quedarán como descanso puro.'
              : 'Con un solo ejercicio marcado, el core no podrá cambiar entre descansos.'}
          </p>
        )}
        <p className="muted small">
          Las planchas (frontal y lateral) salen en los descansos de todos los ejercicios menos en los de espalda (dominadas), porque
          trabajan algo los dorsales y los hombros y podrían restarte fuerza en la siguiente serie.
        </p>
      </section>

      <form className="card" onSubmit={saveGoal} noValidate>
        <h2>Objetivo por defecto</h2>
        <p className="muted small">
          Repeticiones y series que se esperan en cada ejercicio. Cada ejercicio puede tener su propio rango (en Ejercicios, Editar).
          Tus sesiones ya creadas conservan sus series.
        </p>
        <div className="field">
          <span className="field-label">Repeticiones por serie, de mínimo a máximo</span>
          <div className="range">
            <input type="number" inputMode="numeric" min="1" aria-label="Mínimo de repeticiones" value={goal.min} onChange={(e) => setGoal({ ...goal, min: e.target.value })} />
            <span aria-hidden="true">a</span>
            <input type="number" inputMode="numeric" min="1" aria-label="Máximo de repeticiones" value={goal.max} onChange={(e) => setGoal({ ...goal, max: e.target.value })} />
          </div>
        </div>
        <label className="field">
          <span className="field-label">Series por ejercicio</span>
          <input type="number" inputMode="numeric" min="1" max="10" value={goal.sets} onChange={(e) => setGoal({ ...goal, sets: e.target.value })} />
        </label>
        {goalErrors.length > 0 && (
          <ul className="message message-error errors" role="alert">
            {goalErrors.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        )}
        {goalSaved && (
          <p className="message message-ok" role="status">
            Guardado.
          </p>
        )}
        <div className="actions">
          <button type="submit" className="btn btn-primary">
            Guardar objetivo
          </button>
        </div>
      </form>

      <section className="card">
        <h2>Copia de seguridad</h2>
        <p className="muted">
          Tus datos están guardados solo en este dispositivo. Descarga una copia de vez en cuando; con ella puedes
          recuperarlo todo o pasarlo a otro dispositivo.
        </p>
        <p className="small">
          <strong>{backupText(backupStatus({ lastBackupAt, sessionCount: 1 }))}</strong> La app te lo recordará al abrirla si pasa una
          semana.
        </p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={exportBackup}>
            Descargar copia
          </button>
          {canShareFiles() && (
            <button type="button" className="btn btn-secondary" onClick={shareBackupNow}>
              Compartir copia
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()}>
            Restaurar copia
          </button>
        </div>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importBackup} />
        {message && (
          <p className={`message message-${message.kind}`} role="status">
            {message.text}
          </p>
        )}
        <p className="muted small">
          {persisted
            ? 'El navegador ha protegido tus datos contra borrados automáticos.'
            : 'El navegador no garantiza que tus datos se conserven si falta espacio: haz copias con frecuencia.'}
        </p>
      </section>

      <IntervalsCard
        db={db}
        connected={intervals.connected}
        lastSyncAt={intervals.lastSyncAt}
        lastResult={intervals.lastResult}
        onChanged={onChanged}
      />

      <p className="muted small">Hom Gym · Fase 1, entrega 1e</p>
    </>
  )
}
