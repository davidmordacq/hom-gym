// Sincronizar las salidas de bici desde Intervals.icu: pide la lista, la convierte y guarda lo nuevo.
// La clave se guarda solo en este dispositivo (ajuste "intervalsApiKey"), nunca en las copias de seguridad.

import { activitiesUrl, authHeader, importSummaryText, planImport, syncRange } from '../core/intervals.js'
import { getAll, getSetting, putMany, setSetting } from './db.js'

/** Mensaje en español para un fallo al hablar con Intervals.icu. */
export function describeFetchError(error) {
  if (error?.userMessage) return error.userMessage
  return 'No se pudo conectar con Intervals.icu. Comprueba tu conexión a internet.'
}

const failure = (message) => Object.assign(new Error(message), { userMessage: message })

/** Pide a Intervals las actividades entre dos fechas. `fetchImpl` permite probarlo sin red. */
export async function fetchActivities({ key, athleteId = '0', oldest, newest, fetchImpl = (...args) => fetch(...args) }) {
  let response
  try {
    response = await fetchImpl(activitiesUrl({ athleteId, oldest, newest }), { headers: { Authorization: authHeader(key), Accept: 'application/json' } })
  } catch {
    throw failure('No se pudo conectar con Intervals.icu. Comprueba tu conexión a internet.')
  }
  if (response.status === 401 || response.status === 403) {
    throw failure('Intervals.icu no acepta esa clave. Revisa que la hayas copiado entera (Ajustes → Developer Settings → API Key).')
  }
  if (response.status === 404 || response.status === 422) {
    throw failure('Intervals.icu no encuentra ese atleta. Si has escrito un ID de atleta, comprueba que es el tuyo (empieza por «i»); si no, déjalo vacío.')
  }
  if (!response.ok) throw failure(`Intervals.icu ha respondido con un error (${response.status}). Inténtalo más tarde.`)
  let body
  try {
    body = await response.json()
  } catch {
    throw failure('Intervals.icu ha enviado una respuesta que no se entiende.')
  }
  if (!Array.isArray(body)) throw failure('Intervals.icu ha enviado una respuesta inesperada.')
  return body
}

/**
 * Trae y guarda las salidas de bici. Devuelve el resultado del reparto (nuevas, actualizadas...) y apunta cuándo y cómo
 * fue. Lanza un error con un mensaje en español si algo falla (y apunta también ese error).
 */
export async function syncIntervals(db, { fullYear = false, now = new Date(), fetchImpl } = {}) {
  const key = await getSetting(db, 'intervalsApiKey', null)
  if (!key) throw failure('Falta la clave de Intervals.icu.')
  const athleteId = await getSetting(db, 'intervalsAthleteId', '0')
  const lastSyncAt = await getSetting(db, 'intervalsLastSyncAt', null)
  const { oldest, newest } = syncRange({ lastSyncAt, now, fullYear })

  try {
    const activities = await fetchActivities({ key, athleteId, oldest, newest, fetchImpl })
    const existing = await getAll(db, 'sessions')
    const ignoredIds = await getSetting(db, 'intervalsIgnoredIds', [])
    const result = planImport({ activities, existing, ignoredIds })
    if (result.toSave.length > 0) await putMany(db, 'sessions', result.toSave)
    const summary = importSummaryText(result)
    await setSetting(db, 'intervalsLastSyncAt', now.toISOString())
    await setSetting(db, 'intervalsLastResult', { ok: true, text: summary, at: now.toISOString() })
    return { ...result, summary }
  } catch (error) {
    const message = describeFetchError(error)
    await setSetting(db, 'intervalsLastResult', { ok: false, text: message, at: now.toISOString() }).catch(() => {})
    throw failure(message)
  }
}

/** Quita la conexión: borra la clave y el ID de este dispositivo (las salidas ya importadas se quedan). */
export async function disconnectIntervals(db) {
  await setSetting(db, 'intervalsApiKey', null)
  await setSetting(db, 'intervalsAthleteId', '0')
  await setSetting(db, 'intervalsLastResult', null)
}

/** Guarda la clave (y el ID de atleta, opcional). */
export async function saveIntervalsCredentials(db, { key, athleteId = '' }) {
  const cleanKey = String(key ?? '').trim()
  if (!cleanKey) throw failure('Escribe tu clave de la API de Intervals.icu.')
  await setSetting(db, 'intervalsApiKey', cleanKey)
  await setSetting(db, 'intervalsAthleteId', String(athleteId ?? '').trim() || '0')
}

/** Apunta una salida importada que David borró a propósito, para que no vuelva en la siguiente sincronización. */
export async function ignoreImportedSession(db, sessionId) {
  const ignored = await getSetting(db, 'intervalsIgnoredIds', [])
  if (!ignored.includes(sessionId)) await setSetting(db, 'intervalsIgnoredIds', [...ignored, sessionId])
}
