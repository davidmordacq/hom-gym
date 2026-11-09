import { useRef, useState } from 'react'
import { createBackup, parseBackup } from '../core/backup.js'
import { toIsoDate } from '../core/dates.js'
import { exportAll, replaceAll, setSetting } from '../storage/db.js'
import { THEMES, applyTheme } from '../theme.js'

const REST_STEP = 15
const REST_MIN = 30
const REST_MAX = 300

const formatRest = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export default function Settings({ db, theme, persisted, restSeconds, onChanged }) {
  const [message, setMessage] = useState(null)
  const fileInput = useRef(null)

  async function changeTheme(newTheme) {
    applyTheme(newTheme)
    await setSetting(db, 'theme', newTheme)
    await onChanged()
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

  async function exportBackup() {
    try {
      const backup = createBackup(await exportAll(db))
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `hom-gym-copia-${toIsoDate()}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage({ kind: 'ok', text: 'Copia de seguridad descargada. Guárdala en un sitio seguro (por ejemplo, Google Drive).' })
    } catch (error) {
      setMessage({ kind: 'error', text: `No se pudo crear la copia: ${error.message}` })
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
      await replaceAll(db, backup.data)
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
        <h2>Copia de seguridad</h2>
        <p className="muted">
          Tus datos están guardados solo en este dispositivo. Descarga una copia de vez en cuando; con ella puedes
          recuperarlo todo o pasarlo a otro dispositivo.
        </p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={exportBackup}>
            Descargar copia
          </button>
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

      <p className="muted small">Hom Gym · Fase 1, entrega 1d</p>
    </>
  )
}
