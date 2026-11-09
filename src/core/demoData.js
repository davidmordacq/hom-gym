// Datos de EJEMPLO para ver cómo quedan las gráficas sin tener historial. Nunca se guardan: solo se dibujan.
// Son inventados y siempre iguales (no hay azar real), para que se pueda comprobar el diseño y probar los cálculos.

import { toIsoDate } from './dates.js'
import { levelsEasyToHard } from './exercises.js'
import { weekStart } from './history.js'
import { EXERCISE_UNITS, SESSION_STATUS, SESSION_TYPES } from './model.js'
import { sortTemplates } from './templates.js'
import { setId } from './workout.js'

/** Generador de números "al azar" repetible (siempre da la misma secuencia). */
function seeded(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WORK_SECONDS = 45
const REST_SECONDS = 120

/** Repeticiones y nivel de la sesión número `k` (0, 1, 2...) de un ejercicio: sube repeticiones y, al llegar al tope, de nivel. */
function planFor(exercise, scale, k) {
  const levels = scale ? levelsEasyToHard(exercise, scale).map((l) => l.id) : []
  const levelId = levels.length > 0 ? levels[Math.min(Math.floor(k / 5), levels.length - 1)] : null
  if (exercise.unit === EXERCISE_UNITS.SECONDS) {
    const top = Math.min(60, 30 + 3 * k)
    return { levelId, reps: [top, top - 3, top - 5] }
  }
  const top = Math.min(10, 7 + (k % 5))
  return { levelId, reps: [top, top - 1, top - 1] }
}

/**
 * Doce semanas de entrenos de ejemplo: fuerza lunes, miércoles y viernes alternando las sesiones, rodillo martes y jueves,
 * bici outdoor sábado y domingo, con alguna sesión que no se hace.
 * Devuelve { sessions, sets } con el mismo formato que los datos reales.
 */
export function buildDemoData({ today = new Date(), exercises, scales, templates, weeks = 12 }) {
  const random = seeded(2026)
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const scaleById = new Map(scales.map((s) => [s.id, s]))
  const sorted = sortTemplates(templates)
  const todayIso = toIsoDate(today)
  const [y, m, d] = weekStart(today).split('-').map(Number)
  const sessions = []
  const sets = []
  const occurrences = new Map()
  let strengthCount = 0
  let counter = 0

  for (let week = -(weeks - 1); week <= 0; week++) {
    for (let weekday = 0; weekday < 7; weekday++) {
      const day = new Date(y, m - 1, d + week * 7 + weekday)
      const date = toIsoDate(day)
      if (date > todayIso) continue
      const id = `demo-${(counter += 1)}`
      const skip = random() < 0.1

      if ([0, 2, 4].includes(weekday) && sorted.length > 0) {
        if (skip && weekday === 4) continue // algún viernes sin entrenar
        const template = sorted[strengthCount % sorted.length]
        strengthCount += 1
        let t = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 18, 0, 0).getTime()
        const startedAt = new Date(t).toISOString()
        for (const item of template.items) {
          const exercise = byId.get(item.exerciseId)
          if (!exercise) continue
          const k = occurrences.get(item.exerciseId) ?? 0
          occurrences.set(item.exerciseId, k + 1)
          const plan = planFor(exercise, scaleById.get(exercise.scaleId), k)
          t += 30_000 // colocarse
          for (let order = 1; order <= item.sets; order++) {
            t += (item.perSide ? 2 : 1) * WORK_SECONDS * 1000
            sets.push({
              id: setId(id, item.exerciseId, order), sessionId: id, exerciseId: item.exerciseId, date, order,
              reps: plan.reps[Math.min(order - 1, plan.reps.length - 1)], levelId: plan.levelId,
              completedAt: new Date(t).toISOString(), coreAfter: Boolean(item.coreExerciseId) && random() < 0.85,
            })
            t += REST_SECONDS * 1000
          }
        }
        sessions.push({
          id, type: SESSION_TYPES.STRENGTH, status: SESSION_STATUS.DONE, date, name: template.name, templateId: template.id,
          slotId: null, startedAt, endedAt: new Date(t + 30_000).toISOString(), restSeconds: REST_SECONDS, notes: '',
          exercises: template.items.map((item) => ({ exerciseId: item.exerciseId, targetSets: item.sets, perSide: item.perSide, coreExerciseId: item.coreExerciseId, notes: '' })),
        })
      } else if (weekday === 1 || weekday === 3) {
        const minutes = 60 + Math.round(random() * 15)
        sessions.push({
          id, type: SESSION_TYPES.BIKE_TRAINER, status: skip ? SESSION_STATUS.SKIPPED : SESSION_STATUS.DONE, date, name: 'Bici en rodillo',
          slotId: null, templateId: null, startedAt: null, endedAt: null, durationMin: skip ? null : minutes,
          tss: skip ? null : Math.round(minutes * (0.8 + random() * 0.2)), effort: null, notes: '',
        })
      } else if (weekday >= 5) {
        const minutes = 90 + Math.round(random() * 90)
        sessions.push({
          id, type: SESSION_TYPES.BIKE_OUTDOOR, status: skip ? SESSION_STATUS.SKIPPED : SESSION_STATUS.DONE, date, name: 'Bici outdoor',
          slotId: null, templateId: null, startedAt: null, endedAt: null, durationMin: skip ? null : minutes,
          tss: skip ? null : Math.round(minutes * (0.9 + random() * 0.4)), effort: null, notes: '',
        })
      }
    }
  }
  return { sessions, sets }
}
