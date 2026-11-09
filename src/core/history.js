// Historial y resumen de la semana. Solo lógica, sin pantallas.

import { toIsoDate } from './dates.js'
import { SESSION_STATUS, SESSION_TYPES } from './model.js'
import { durationMinutes, sessionSummary } from './workout.js'

export const HISTORY_FILTERS = Object.freeze([
  { id: 'all', label: 'Todas' },
  { id: 'strength', label: 'Fuerza' },
  { id: 'bike', label: 'Bici' },
  { id: 'mobility', label: 'Movilidad' },
])

/** Familia de una sesión para filtrar: fuerza, bici (rodillo u outdoor) o movilidad. */
export function historyGroup(type) {
  if (type === SESSION_TYPES.STRENGTH) return 'strength'
  if (type === SESSION_TYPES.MOBILITY) return 'mobility'
  return 'bike'
}

const FINISHED = new Set([SESSION_STATUS.DONE, SESSION_STATUS.SKIPPED, SESSION_STATUS.MOVED])

/** Sesiones terminadas (las que están en curso no cuentan), de la más reciente a la más antigua, con filtro opcional. */
export function listHistory(sessions, filter = 'all') {
  return sessions
    .filter((s) => FINISHED.has(s.status) && (filter === 'all' || historyGroup(s.type) === filter))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.startedAt ?? '').localeCompare(String(a.startedAt ?? '')) || String(b.id).localeCompare(String(a.id)))
}

/** "Lunes 9 nov" (sin año si es de este año). */
export function dateText(isoDate, now = new Date()) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const weekday = date.toLocaleDateString('es-ES', { weekday: 'long' })
  const rest = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
  const text = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${rest}`
  return year === now.getFullYear() ? text : `${text} ${year}`
}

/** Minutos reales de una sesión (de fuerza: inicio a fin; de bici o movilidad: la duración anotada). */
export const sessionMinutes = (session) => session.durationMin ?? durationMinutes(session.startedAt, session.endedAt)

/** Línea de resumen de una sesión para la lista, por ejemplo "52 min · 15 series · 123 rep." */
export function sessionLine(session, sets, exercises) {
  if (session.status === SESSION_STATUS.SKIPPED) return 'No la hiciste'
  const parts = []
  const minutes = sessionMinutes(session)
  if (minutes) parts.push(`${minutes} min`)
  if (session.type === SESSION_TYPES.STRENGTH) {
    const summary = sessionSummary(session, sets, exercises)
    parts.push(`${summary.setsDone} ${summary.setsDone === 1 ? 'serie' : 'series'}`)
    if (summary.totalReps > 0) parts.push(`${summary.totalReps} rep.`)
  } else {
    if (session.tss) parts.push(`TSS ${session.tss}`)
    if (session.effort) parts.push(`esfuerzo ${session.effort}/10`)
  }
  return parts.join(' · ')
}

/** Lunes (AAAA-MM-DD) de la semana de una fecha. */
export function weekStart(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return toIsoDate(monday)
}

/** Domingo (AAAA-MM-DD) de la semana de una fecha. */
export function weekEnd(date = new Date()) {
  const [year, month, day] = weekStart(date).split('-').map(Number)
  return toIsoDate(new Date(year, month - 1, day + 6))
}

/**
 * Cómo va esta semana: sesiones hechas frente a las previstas en el plan, por familia.
 * Las hechas cuentan aunque no estuvieran en el plan (puede haber más hechas que previstas).
 */
export function weekProgress({ plan, sessions, today = new Date() }) {
  const from = weekStart(today)
  const to = weekEnd(today)
  const result = { strength: { done: 0, planned: 0 }, bike: { done: 0, planned: 0 }, mobility: { done: 0, planned: 0 } }
  for (const slot of plan) result[historyGroup(slot.type)].planned += 1
  for (const s of sessions) {
    if (s.status === SESSION_STATUS.DONE && s.date >= from && s.date <= to) result[historyGroup(s.type)].done += 1
  }
  return result
}
