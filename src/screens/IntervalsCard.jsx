import { useState } from 'react'
import { describeFetchError, disconnectIntervals, saveIntervalsCredentials, syncIntervals } from '../storage/intervalsSync.js'

const whenText = (iso) =>
  new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')

/** Ajustes: conectar con Intervals.icu para traer las salidas de bici (tiempo y TSS) sin teclearlas. */
export default function IntervalsCard({ db, connected, lastSyncAt, lastResult, onChanged }) {
  const [key, setKey] = useState('')
  const [athleteId, setAthleteId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  async function run(work) {
    setBusy(true)
    setMessage(null)
    try {
      await work()
    } catch (error) {
      setMessage({ kind: 'error', text: describeFetchError(error) })
    } finally {
      setBusy(false)
      await onChanged()
    }
  }

  const connect = (event) =>
    run(async () => {
      event.preventDefault()
      await saveIntervalsCredentials(db, { key, athleteId })
      try {
        const result = await syncIntervals(db)
        setKey('')
        setAthleteId('')
        setMessage({ kind: 'ok', text: `Conectado. ${result.summary}.` })
      } catch (error) {
        await disconnectIntervals(db) // una clave que no funciona no se queda guardada
        throw error
      }
    })

  const sync = (fullYear) =>
    run(async () => {
      const result = await syncIntervals(db, { fullYear })
      setMessage({ kind: 'ok', text: `${result.summary}.` })
    })

  const disconnect = () =>
    run(async () => {
      if (!window.confirm('¿Quitar la clave de Intervals.icu de este dispositivo? Las salidas ya importadas se quedan.')) return
      await disconnectIntervals(db)
      setMessage({ kind: 'ok', text: 'Clave quitada de este dispositivo.' })
    })

  return (
    <section className="card">
      <h2>Bici desde Intervals.icu</h2>
      {connected ? (
        <>
          <p>
            <strong>Conectado.</strong> {lastSyncAt ? `Última sincronización: ${whenText(lastSyncAt)}.` : 'Aún no se ha sincronizado.'}
          </p>
          {lastResult && <p className={`message${lastResult.ok ? '' : ' message-error'}`}>{lastResult.text}</p>}
          <p className="muted small">Se sincroniza sola al abrir la app (como mucho cada 6 horas). Las salidas de menos de 10 minutos se ignoran.</p>
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => sync(false)}>
              {busy ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => sync(true)}>
              Traer el último año
            </button>
            <button type="button" className="btn btn-secondary btn-danger" disabled={busy} onClick={disconnect}>
              Quitar clave
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={connect} noValidate>
          <p className="muted small">
            Trae tus salidas de bici con su tiempo y su TSS, sin teclearlas (Intervals.icu ya recibe las de Strava). Para conectar:
            en intervals.icu entra en Settings, baja a «Developer Settings», genera tu clave de la API y pégala aquí.
          </p>
          <label className="field">
            <span className="field-label">Clave de la API</span>
            <input type="password" autoComplete="off" autoCapitalize="off" spellCheck="false" value={key} onChange={(e) => setKey(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">ID de atleta (opcional: déjalo vacío)</span>
            <input type="text" autoComplete="off" autoCapitalize="off" spellCheck="false" placeholder="i12345" value={athleteId} onChange={(e) => setAthleteId(e.target.value)} />
          </label>
          <p className="muted small">
            La clave se guarda solo en este dispositivo y no va en las copias de seguridad. Da acceso a tu cuenta de Intervals.icu: no la compartas con nadie.
          </p>
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !key.trim()}>
              {busy ? 'Conectando…' : 'Conectar y traer mis salidas'}
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className={`message message-${message.kind}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  )
}
