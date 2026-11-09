// Calendario: qué estaba previsto cada día y qué se cumplió de verdad. Solo lógica, sin pantallas.

import { toIsoDate, weekdayOf } from './dates.js'
import { mainMuscleGroup } from './exercises.js'
import { historyGroup, weekEnd, weekStart } from './history.js'
import { SESSION_STATUS, SESSION_TYPES } from './model.js'

/**
 * Qué se ve de cada sesión en un día:
 *  - done: hecha (estaba prevista)
 *  - extra: hecha sin estar prevista ese día
 *  - missed: prevista y no hecha (ya pasó el día) o marcada como "no la hice"
 *  - planned: prevista y aún por hacer (hoy o futuro)
 *  - running: empezada y sin terminar
 */
export const ENTRY_KINDS = Object.freeze({ DONE: 'done', EXTRA: 'extra', MISSED: 'missed', PLANNED: 'planned', RUNNING: 'running' })

const parseIso = (iso) => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}
const addDays = (iso, days) => {
  const date = parseIso(iso)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}
const asIso = (value) => (typeof value === 'string' ? value : toIsoDate(value))

/** Semanas (de lunes a domingo, 7 fechas ISO cada una) que cubren un mes. `month` va de 0 (enero) a 11. */
export function monthWeeks(year, month) {
  const first = new Date(year, month, 1)
  const lastIso = toIsoDate(new Date(year, month + 1, 0))
  const weeks = []
  let start = weekStart(first)
  while (start <= lastIso) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)))
    start = addDays(start, 7)
  }
  return weeks
}

/**
 * Las sesiones de un día: las previstas en el plan emparejadas con lo que se hizo (primero por tipo exacto y, si no,
 * por familia: una bici outdoor puede cubrir un rodillo). Lo que sobra de hecho es "extra".
 * Antes de `trackingFrom` (el día en que empezó a usarse la app) no se inventan sesiones "no hechas".
 */
export function dayEntries({ date, plan, sessions, today, trackingFrom = null }) {
  const todayIso = asIso(today)
  const planned = plan.filter((slot) => slot.weekday === weekdayOf(parseIso(date))).sort((a, b) => a.id.localeCompare(b.id))
  const unused = sessions.filter((s) => s.date === date)
  const take = (predicate) => {
    const index = unused.findIndex(predicate)
    return index === -1 ? null : unused.splice(index, 1)[0]
  }
  const entries = []

  for (const slot of planned) {
    const sameType = (status) => (s) => s.type === slot.type && s.status === status
    const sameGroup = (status) => (s) => historyGroup(s.type) === historyGroup(slot.type) && s.status === status
    const done = take(sameType(SESSION_STATUS.DONE)) ?? take(sameGroup(SESSION_STATUS.DONE))
    if (done) {
      entries.push({ kind: ENTRY_KINDS.DONE, type: done.type, name: done.name, session: done, slot })
      continue
    }
    const running = take(sameGroup(SESSION_STATUS.IN_PROGRESS))
    if (running) {
      entries.push({ kind: ENTRY_KINDS.RUNNING, type: running.type, name: running.name, session: running, slot })
      continue
    }
    const skipped = take(sameGroup(SESSION_STATUS.SKIPPED))
    if (skipped) {
      entries.push({ kind: ENTRY_KINDS.MISSED, type: slot.type, name: slot.name, session: skipped, slot })
      continue
    }
    if (date >= todayIso) entries.push({ kind: ENTRY_KINDS.PLANNED, type: slot.type, name: slot.name, session: null, slot })
    else if (trackingFrom && date >= trackingFrom) entries.push({ kind: ENTRY_KINDS.MISSED, type: slot.type, name: slot.name, session: null, slot })
  }

  for (const s of unused) {
    const kind =
      s.status === SESSION_STATUS.DONE ? ENTRY_KINDS.EXTRA : s.status === SESSION_STATUS.IN_PROGRESS ? ENTRY_KINDS.RUNNING : ENTRY_KINDS.MISSED
    entries.push({ kind, type: s.type, name: s.name, session: s, slot: null })
  }
  return entries
}

/**
 * Un mes para dibujar: semanas con sus días (cada uno con sus sesiones) y el resumen del mes.
 * Resumen: hechas (previstas cumplidas), no hechas, extra (sin estar previstas) y por hacer; `percent` es
 * hechas / (hechas + no hechas), o null si todavía no había nada que cumplir.
 */
export function calendarMonth({ year, month, plan, sessions, today, trackingFrom = null }) {
  const todayIso = asIso(today)
  const stats = { done: 0, missed: 0, extra: 0, planned: 0, percent: null }
  const weeks = monthWeeks(year, month).map((week) =>
    week.map((date) => {
      const inMonth = parseIso(date).getMonth() === month
      const entries = dayEntries({ date, plan, sessions, today: todayIso, trackingFrom })
      if (inMonth) {
        for (const e of entries) {
          if (e.kind === ENTRY_KINDS.DONE) stats.done += 1
          else if (e.kind === ENTRY_KINDS.MISSED) stats.missed += 1
          else if (e.kind === ENTRY_KINDS.EXTRA) stats.extra += 1
          else if (e.kind === ENTRY_KINDS.PLANNED) stats.planned += 1
        }
      }
      return { date, inMonth, isToday: date === todayIso, isFuture: date > todayIso, entries }
    }),
  )
  if (stats.done + stats.missed > 0) stats.percent = Math.round((stats.done / (stats.done + stats.missed)) * 100)
  return { weeks, stats }
}

/**
 * Semanas seguidas con todo lo previsto cumplido (ninguna sesión sin hacer ni por hacer), contando hacia atrás desde la
 * semana actual si ya está completa, o desde la anterior. Para al llegar a una semana con algo sin hacer, sin plan, o
 * anterior al día en que empezó a usarse la app.
 */
export function weeklyStreak({ plan, sessions, today, trackingFrom = null }) {
  const todayIso = asIso(today)
  const firstWeek = trackingFrom ? weekStart(parseIso(trackingFrom)) : null
  if (!firstWeek) return 0
  const check = (start) => {
    let plannedCount = 0
    let problems = 0
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i)
      for (const e of dayEntries({ date, plan, sessions, today: todayIso, trackingFrom })) {
        if (e.slot) plannedCount += 1
        if (e.kind === ENTRY_KINDS.MISSED || e.kind === ENTRY_KINDS.PLANNED || e.kind === ENTRY_KINDS.RUNNING) problems += 1
      }
    }
    return plannedCount > 0 && problems === 0
  }
  let start = weekStart(parseIso(todayIso))
  let streak = 0
  if (check(start)) streak += 1
  start = addDays(start, -7)
  while (start >= firstWeek && streak < 520 && check(start)) {
    streak += 1
    start = addDays(start, -7)
  }
  return streak
}

/**
 * Cuántas sesiones de esta semana (de fuerza, hechas) han trabajado cada grupo muscular. Cuenta todos los músculos de
 * cada ejercicio con series y el core hecho en los descansos. Devuelve { grupo: sesiones }.
 */
export function weekGroupsWorked({ sessions, sets, exercises, today }) {
  const from = weekStart(parseIso(asIso(today)))
  const to = weekEnd(parseIso(asIso(today)))
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const counts = {}
  for (const session of sessions) {
    if (session.type !== SESSION_TYPES.STRENGTH || session.status !== SESSION_STATUS.DONE || session.date < from || session.date > to) continue
    const groups = new Set()
    const entries = new Map((session.exercises ?? []).map((e) => [e.exerciseId, e]))
    for (const set of sets) {
      if (set.sessionId !== session.id) continue
      for (const g of byId.get(set.exerciseId)?.muscleGroups ?? []) groups.add(g)
      if (set.coreAfter) {
        const core = mainMuscleGroup(byId.get(entries.get(set.exerciseId)?.coreExerciseId))
        if (core) groups.add(core)
      }
    }
    for (const g of groups) counts[g] = (counts[g] ?? 0) + 1
  }
  return counts
}

/** Día en que se empezó a usar la app: el más antiguo entre la fecha de instalación y la primera sesión; null si no hay ninguno. */
export function trackingStart(installedAt, sessions) {
  const all = [...sessions.map((s) => s.date).filter(Boolean), ...(installedAt ? [installedAt] : [])].sort()
  return all[0] ?? null
}
