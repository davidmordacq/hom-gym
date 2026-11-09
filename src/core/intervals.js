// Traer las salidas de bici desde Intervals.icu. Solo lógica (convertir y comparar), sin red ni pantallas.
// Intervals recibe las salidas de Strava y calcula la carga de entrenamiento (`icu_training_load`), que usamos como TSS.

import { toIsoDate } from './dates.js'
import { historyGroup } from './history.js'
import { SESSION_STATUS, SESSION_TYPES } from './model.js'

export const INTERVALS_BASE = 'https://intervals.icu'
/** Las salidas de menos de esto no se importan (pruebas, arranques en falso). */
export const INTERVALS_MIN_MINUTES = 10
export const INTERVALS_SOURCE = 'intervals'
/** Al volver a sincronizar se repasan los últimos días por si se corrigió alguna salida en Intervals. */
export const RESYNC_DAYS = 14
export const FIRST_SYNC_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

/** Dirección de la lista de actividades. `athleteId` "0" significa "el dueño de la clave". */
export function activitiesUrl({ athleteId = '0', oldest, newest }) {
  const id = encodeURIComponent(String(athleteId || '0').trim() || '0')
  const query = new URLSearchParams({ oldest, ...(newest ? { newest } : {}) })
  return `${INTERVALS_BASE}/api/v1/athlete/${id}/activities?${query}`
}

/** Cabecera de acceso: usuario "API_KEY" y la clave como contraseña. */
export function authHeader(key, encode = (text) => btoa(text)) {
  return `Basic ${encode(`API_KEY:${String(key).trim()}`)}`
}

/** Fechas de inicio y fin (AAAA-MM-DD) de lo que se pide: el último año, o desde unos días antes de la última sincronización. */
export function syncRange({ lastSyncAt = null, now = new Date(), fullYear = false } = {}) {
  const day = (offset) => toIsoDate(new Date(now.getTime() + offset * DAY_MS))
  const last = lastSyncAt ? Date.parse(lastSyncAt) : NaN
  if (fullYear) return { oldest: day(-365), newest: day(1) }
  if (Number.isFinite(last)) return { oldest: toIsoDate(new Date(last - RESYNC_DAYS * DAY_MS)), newest: day(1) }
  return { oldest: day(-FIRST_SYNC_DAYS), newest: day(1) }
}

export const AUTO_SYNC_HOURS = 6

/** ¿Toca sincronizar sola al abrir la app? Si nunca se sincronizó, o han pasado 6 horas o más. */
export function autoSyncDue(lastSyncAt, now = new Date(), hours = AUTO_SYNC_HOURS) {
  const last = lastSyncAt ? Date.parse(lastSyncAt) : NaN
  return !Number.isFinite(last) || now.getTime() - last >= hours * 60 * 60 * 1000
}

const isRide = (type) => typeof type === 'string' && /Ride$/.test(type)

/**
 * Convierte una actividad de Intervals en una sesión de bici de la app.
 * Devuelve { session } o { skipped: 'notBike' | 'tooShort' | 'invalid' }.
 * Rodillo si Intervals lo marca como rodillo (`trainer`) o es una salida virtual; si no, outdoor.
 */
export function mapActivity(activity, { minMinutes = INTERVALS_MIN_MINUTES } = {}) {
  if (!activity || activity.id === undefined || activity.id === null) return { skipped: 'invalid' }
  if (!isRide(activity.type)) return { skipped: 'notBike' }
  const date = String(activity.start_date_local ?? '').slice(0, 10)
  const seconds = Number(activity.moving_time ?? activity.elapsed_time)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(seconds)) return { skipped: 'invalid' }
  const minutes = Math.round(seconds / 60)
  if (minutes < minMinutes) return { skipped: 'tooShort' }

  const trainer = activity.trainer === true || activity.type === 'VirtualRide'
  const load = Number(activity.icu_training_load)
  const type = trainer ? SESSION_TYPES.BIKE_TRAINER : SESSION_TYPES.BIKE_OUTDOOR
  return {
    session: {
      id: `intervals-${activity.id}`,
      type,
      status: SESSION_STATUS.DONE,
      date,
      name: String(activity.name ?? '').trim() || (trainer ? 'Bici en rodillo' : 'Bici outdoor'),
      slotId: null,
      templateId: null,
      startedAt: String(activity.start_date_local),
      endedAt: null,
      durationMin: minutes,
      tss: Number.isFinite(load) && activity.icu_training_load !== null ? Math.round(load) : null,
      effort: null,
      notes: '',
      source: INTERVALS_SOURCE,
      externalId: String(activity.id),
    },
  }
}

const CHANGING_FIELDS = ['type', 'date', 'name', 'durationMin', 'tss']

/** ¿Una salida anotada a mano se parece a una importada? (mismo día, misma familia y duración parecida). */
function looksTheSame(manual, imported) {
  if (manual.source || manual.status !== SESSION_STATUS.DONE || manual.date !== imported.date) return false
  if (historyGroup(manual.type) !== historyGroup(imported.type) || !manual.durationMin) return false
  return Math.abs(manual.durationMin - imported.durationMin) <= Math.max(10, imported.durationMin * 0.2)
}

/**
 * Decide qué guardar: salidas nuevas, salidas ya importadas que cambiaron en Intervals (se conservan tus notas) y
 * cuáles no se tocan. `ignoredIds` son salidas que borraste a propósito (no vuelven).
 * Devuelve { toSave, added, updated, unchanged, skipped: { notBike, tooShort, invalid, ignored }, possibleDuplicates }.
 * `possibleDuplicates` cuenta las nuevas que parecen estar ya anotadas a mano (no se borra nada).
 */
export function planImport({ activities, existing, ignoredIds = [], minMinutes = INTERVALS_MIN_MINUTES }) {
  const byId = new Map(existing.map((s) => [s.id, s]))
  const ignored = new Set(ignoredIds)
  const skipped = { notBike: 0, tooShort: 0, invalid: 0, ignored: 0 }
  const toSave = []
  let added = 0
  let updated = 0
  let unchanged = 0
  let possibleDuplicates = 0
  const seen = new Set()

  for (const activity of activities) {
    const { session, skipped: reason } = mapActivity(activity, { minMinutes })
    if (reason) {
      skipped[reason] += 1
      continue
    }
    if (seen.has(session.id)) continue // la misma salida repetida en la respuesta
    seen.add(session.id)
    if (ignored.has(session.id)) {
      skipped.ignored += 1
      continue
    }
    const current = byId.get(session.id)
    if (!current) {
      toSave.push(session)
      added += 1
      if (existing.some((s) => looksTheSame(s, session))) possibleDuplicates += 1
    } else if (CHANGING_FIELDS.some((field) => current[field] !== session[field])) {
      toSave.push({ ...session, notes: current.notes ?? '' })
      updated += 1
    } else {
      unchanged += 1
    }
  }
  return { toSave, added, updated, unchanged, skipped, possibleDuplicates }
}

/** Resumen para David, por ejemplo "3 salidas nuevas, 1 actualizada". */
export function importSummaryText(result) {
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
  const parts = []
  if (result.added > 0) parts.push(plural(result.added, 'salida nueva', 'salidas nuevas'))
  if (result.updated > 0) parts.push(plural(result.updated, 'actualizada', 'actualizadas'))
  let text = parts.length > 0 ? parts.join(', ') : 'Todo al día, no hay salidas nuevas'
  if (result.skipped.tooShort > 0) text += ` · ${plural(result.skipped.tooShort, 'ignorada por durar menos de', 'ignoradas por durar menos de')} ${INTERVALS_MIN_MINUTES} min`
  if (result.possibleDuplicates > 0) {
    text += ` · ${plural(result.possibleDuplicates, 'parece que ya la tenías anotada a mano', 'parece que ya las tenías anotadas a mano')}: revisa el historial y borra la tuya`
  }
  return text
}
