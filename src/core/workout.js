// Sesión en curso: crear la sesión, "lo de la última vez", temporizador de descanso y resumen.
// Solo lógica, sin pantallas.

import { toIsoDate } from './dates.js'
import { levelsEasyToHard } from './exercises.js'
import { EXERCISE_UNITS, SESSION_STATUS, SESSION_TYPES } from './model.js'
import { DEFAULT_PROGRESSION_RULES, getRulesForExercise } from './progressionConfig.js'
import { findLevel } from './resistance.js'

/** Segundos que quedan de descanso cuando suena el aviso para prepararse. */
export const WARNING_SECONDS = 15

export const newSessionId = (now = Date.now()) => `ses-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
export const setId = (sessionId, exerciseId, order) => `${sessionId}:${exerciseId}:${order}`

/** Cuánto sube o baja el número de un ejercicio con cada toque en − / +. */
export const repStep = (exercise) => (exercise?.unit === EXERCISE_UNITS.SECONDS ? 5 : 1)

/** Crea una sesión de fuerza nueva a partir de una sesión tipo. Guarda una COPIA de sus ejercicios. */
export function startStrengthSession({ template, slotId = null, now = new Date(), id = newSessionId(now.getTime()) }) {
  const startedAt = now.toISOString()
  return {
    id,
    type: SESSION_TYPES.STRENGTH,
    status: SESSION_STATUS.IN_PROGRESS,
    date: toIsoDate(now),
    name: template.name,
    templateId: template.id,
    slotId,
    startedAt,
    endedAt: null,
    cursor: 0,
    notes: '',
    exercises: template.items.map((item, i) => ({
      exerciseId: item.exerciseId,
      targetSets: item.sets,
      perSide: Boolean(item.perSide),
      coreExerciseId: item.coreExerciseId ?? null,
      notes: '',
      startedAt: i === 0 ? startedAt : null,
      endedAt: null,
    })),
  }
}

/** Pasa a otro ejercicio. Apunta cuándo se entró en él por primera vez. */
export function goToExercise(session, index, now = new Date()) {
  const last = session.exercises.length - 1
  const cursor = Math.min(Math.max(index, 0), last)
  const exercises = session.exercises.map((entry, i) =>
    i === cursor && !entry.startedAt ? { ...entry, startedAt: now.toISOString() } : entry,
  )
  return { ...session, cursor, exercises }
}

/** Apunta que se acaba de marcar una serie de ese ejercicio (para saber cuánto duró cada ejercicio). */
export function touchExercise(session, exerciseId, now = new Date()) {
  return {
    ...session,
    exercises: session.exercises.map((entry) =>
      entry.exerciseId === exerciseId ? { ...entry, startedAt: entry.startedAt ?? now.toISOString(), endedAt: now.toISOString() } : entry,
    ),
  }
}

/** Una serie más en este ejercicio. */
export function addSetToExercise(session, exerciseId) {
  return {
    ...session,
    exercises: session.exercises.map((entry) => (entry.exerciseId === exerciseId ? { ...entry, targetSets: entry.targetSets + 1 } : entry)),
  }
}

export function setExerciseNotes(session, exerciseId, notes) {
  return { ...session, exercises: session.exercises.map((entry) => (entry.exerciseId === exerciseId ? { ...entry, notes } : entry)) }
}

/** Cierra la sesión: queda hecha, con la hora de fin real. */
export function finishSession(session, { notes = session.notes, now = new Date() } = {}) {
  return { ...session, status: SESSION_STATUS.DONE, endedAt: now.toISOString(), notes: String(notes ?? '').trim() }
}

/** Serie lista para guardar. */
export function buildSet({ session, exerciseId, order, reps, levelId, coreAfter = false, now = new Date() }) {
  return {
    id: setId(session.id, exerciseId, order),
    sessionId: session.id,
    exerciseId,
    date: session.date,
    order,
    reps,
    levelId: levelId ?? null,
    completedAt: now.toISOString(),
    coreAfter: Boolean(coreAfter),
  }
}

const compareSessions = (a, b) =>
  String(a.date).localeCompare(String(b.date)) || String(a.startedAt ?? '').localeCompare(String(b.startedAt ?? ''))

/**
 * Lo que hiciste la última vez en un ejercicio: la sesión terminada más reciente en la que lo hiciste.
 * Devuelve { sessionId, date, reps: [..], levelIds: [..], levelId } (levelId = el de la última serie) o null.
 */
export function lastPerformance(exerciseId, sets, sessions, { excludeSessionId = null } = {}) {
  const finished = new Map(
    sessions
      .filter((s) => s.status === SESSION_STATUS.DONE && s.type === SESSION_TYPES.STRENGTH && s.id !== excludeSessionId)
      .map((s) => [s.id, s]),
  )
  const bySession = new Map()
  for (const set of sets) {
    if (set.exerciseId !== exerciseId || !finished.has(set.sessionId)) continue
    if (!bySession.has(set.sessionId)) bySession.set(set.sessionId, [])
    bySession.get(set.sessionId).push(set)
  }
  if (bySession.size === 0) return null
  const latest = [...bySession.keys()].sort((a, b) => compareSessions(finished.get(a), finished.get(b))).at(-1)
  const list = bySession.get(latest).sort((a, b) => a.order - b.order)
  return {
    sessionId: latest,
    date: finished.get(latest).date,
    reps: list.map((s) => s.reps),
    levelIds: list.map((s) => s.levelId),
    levelId: list.at(-1).levelId,
  }
}

/** Texto de "lo de la última vez", por ejemplo "8 nov · Banda verde · 10, 9, 8 repeticiones". */
export function lastPerformanceText(last, exercise, scale) {
  if (!last) return 'Primera vez con este ejercicio.'
  const [year, month, day] = last.date.split('-').map(Number)
  const when = new Date(year, month - 1, day).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
  const parts = [when]
  const level = last.levelId ? findLevel(exercise, scale, last.levelId) : null
  if (level) parts.push(level.label)
  parts.push(`${last.reps.join(', ')} ${exercise.unit === EXERCISE_UNITS.SECONDS ? 'segundos' : 'repeticiones'}`)
  return parts.join(' · ')
}

/** Repeticiones (o segundos) con que aparece una serie sin marcar: lo de la última vez en esa serie, o el mínimo del rango. */
export function defaultReps(order, last, exercise, rules = DEFAULT_PROGRESSION_RULES) {
  return last?.reps?.[order - 1] ?? last?.reps?.at(-1) ?? getRulesForExercise(exercise, rules).repRange.min
}

/**
 * Nivel (banda o kg) que aparece marcado: el de la última serie de hoy; si no hay, el de la última vez.
 * Si es la primera vez (o el nivel ya no existe) devuelve null y David debe elegirlo. Sin escala, siempre null.
 */
export function defaultLevelId({ exercise, scale, last, doneSets = [] }) {
  if (!scale) return null
  const valid = new Set(levelsEasyToHard(exercise, scale).map((level) => level.id))
  const today = doneSets.at(-1)?.levelId
  if (today && valid.has(today)) return today
  if (last?.levelId && valid.has(last.levelId)) return last.levelId
  return null
}

// ---- Temporizador de descanso -------------------------------------------------------------------

/** Segundos enteros que faltan hasta `endAt` (milisegundos), nunca menos de 0. */
export const restRemaining = (endAt, now = Date.now()) => Math.max(0, Math.ceil((endAt - now) / 1000))

/** "1:45". */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** ¿Se acaba de cruzar el aviso de "quedan 15 s"? (una sola vez por descanso). */
export const crossedWarning = (previous, current, warning = WARNING_SECONDS) => previous > warning && current <= warning && current > 0

/** ¿Se acaba de llegar a 0? */
export const crossedEnd = (previous, current) => previous > 0 && current === 0

// ---- Resumen y duración ---------------------------------------------------------------------------

/** Minutos entre dos momentos ISO (mínimo 1), o null si falta alguno. */
export function durationMinutes(startedAt, endedAt) {
  if (!startedAt || !endedAt) return null
  const ms = new Date(endedAt) - new Date(startedAt)
  return Number.isFinite(ms) ? Math.max(1, Math.round(ms / 60000)) : null
}

/** Resumen de una sesión de fuerza: duración real, series y lo hecho en cada ejercicio. */
export function sessionSummary(session, sets, exercises, now = new Date()) {
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const mine = sets.filter((s) => s.sessionId === session.id)
  const perExercise = session.exercises.map((entry) => {
    const exercise = byId.get(entry.exerciseId)
    const logged = mine.filter((s) => s.exerciseId === entry.exerciseId).sort((a, b) => a.order - b.order)
    return {
      exerciseId: entry.exerciseId,
      name: exercise?.name ?? 'Ejercicio que ya no existe',
      unit: exercise?.unit ?? EXERCISE_UNITS.REPS,
      sets: logged,
    }
  })
  return {
    durationMin: durationMinutes(session.startedAt, session.endedAt ?? now.toISOString()),
    exercisesTotal: perExercise.length,
    exercisesDone: perExercise.filter((e) => e.sets.length > 0).length,
    setsDone: mine.length,
    totalReps: mine
      .filter((s) => (byId.get(s.exerciseId)?.unit ?? EXERCISE_UNITS.REPS) === EXERCISE_UNITS.REPS)
      .reduce((sum, s) => sum + s.reps, 0),
    perExercise,
  }
}

// ---- Bici y movilidad: registro sencillo ----------------------------------------------------------

export const QUICK_TYPES = Object.freeze([SESSION_TYPES.BIKE_TRAINER, SESSION_TYPES.BIKE_OUTDOOR, SESSION_TYPES.MOBILITY])
const isBike = (type) => type === SESSION_TYPES.BIKE_TRAINER || type === SESSION_TYPES.BIKE_OUTDOOR
const isBlank = (v) => v === '' || v === null || v === undefined

/** Revisa un registro de bici o movilidad. Devuelve { errors, session }; si hay errores, `session` es null. */
export function validateQuickLog(input, { now = new Date(), id = newSessionId(now.getTime()) } = {}) {
  const errors = []
  if (!QUICK_TYPES.includes(input.type)) errors.push('Elige el tipo de sesión.')

  const date = String(input.date ?? '')
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const real = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
  if (!real || toIsoDate(real) !== date) errors.push('Elige una fecha válida.')
  else if (date > toIsoDate(now)) errors.push('La fecha no puede ser futura.')

  const done = input.status !== SESSION_STATUS.SKIPPED
  let durationMin = null
  let tss = null
  let effort = null
  if (done) {
    const minutes = Number(input.durationMin)
    if (isBlank(input.durationMin) || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      errors.push('Escribe la duración en minutos (un número entero entre 1 y 1440).')
    } else durationMin = minutes

    if (isBike(input.type) && !isBlank(input.tss)) {
      const value = Number(input.tss)
      if (!Number.isFinite(value) || value < 0 || value > 1000) errors.push('El TSS debe ser un número entre 0 y 1000.')
      else tss = value
    }
    if (!isBlank(input.effort)) {
      const value = Number(input.effort)
      if (!Number.isInteger(value) || value < 1 || value > 10) errors.push('El esfuerzo va de 1 a 10.')
      else effort = value
    }
  }

  if (errors.length > 0) return { errors, session: null }
  return {
    errors,
    session: {
      id,
      type: input.type,
      status: done ? SESSION_STATUS.DONE : SESSION_STATUS.SKIPPED,
      date,
      name: String(input.name ?? '').trim() || input.type,
      slotId: input.slotId ?? null,
      templateId: null,
      startedAt: null,
      endedAt: null,
      durationMin,
      tss,
      effort,
      notes: String(input.notes ?? '').trim(),
    },
  }
}
