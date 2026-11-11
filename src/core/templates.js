// Sesiones de fuerza (plantillas): qué ejercicios lleva cada una, cuánto dura y cuál toca hoy.
// Solo lógica, sin pantallas.

import { MUSCLE_GROUPS } from './defaultData.js'
import { EXERCISE_UNITS, RANDOM_CORE, SESSION_STATUS, SESSION_TYPES } from './model.js'
import { DEFAULT_PROGRESSION_RULES, getRulesForExercise } from './progressionConfig.js'

/** Descanso entre series por defecto (2 minutos). En la entrega 1d será un ajuste. */
export const DEFAULT_REST_SECONDS = 120
/** Descanso en los ejercicios a una pierna o un brazo: mientras trabaja un lado, el otro ya descansa (David, 2026-11-11). */
export const DEFAULT_PER_SIDE_REST_SECONDS = 60
/** Una sesión no debería pasar de aquí (decisión de David: no más de 1 h). */
export const MAX_SESSION_MINUTES = 60
export const MAX_SETS_PER_EXERCISE = 10

const WARMUP_MINUTES = 5
const SECONDS_PER_REP_SET = 45 // una serie de 8-10 repeticiones
const SECONDS_PER_LONG_REP = 2.5 // en series largas: solo cuenta si pasa de los 45 s (más de 18 repeticiones)
const SECONDS_OF_PREPARATION = 10 // colocarse antes de una serie en segundos

export const newTemplateId = (now = Date.now()) => `tpl-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/** Ejercicio nuevo dentro de una sesión. */
export const blankItem = (exerciseId) => ({ exerciseId, sets: 3, perSide: false, coreExerciseId: null })

export const blankTemplate = (order = 1) => ({ id: '', name: '', order, items: [] })

/** Las sesiones en su orden de rotación. */
export const sortTemplates = (templates) =>
  [...templates].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'es'))

/** Mueve un elemento de la lista una posición arriba (-1) o abajo (+1). Devuelve una lista nueva. */
export function moveItem(list, index, delta) {
  const target = index + delta
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list
  const copy = [...list]
  ;[copy[index], copy[target]] = [copy[target], copy[index]]
  return copy
}

const isBlank = (value) => value === '' || value === null || value === undefined

/**
 * Revisa una sesión de fuerza antes de guardarla.
 * Devuelve { errors: [textos en español], template: versión limpia }; si hay errores, `template` es null.
 */
export function validateTemplate(input, { exercises = [], templates = [] } = {}) {
  const errors = []
  const name = String(input.name ?? '').trim()
  if (!name) errors.push('Escribe un nombre para la sesión.')
  else if (templates.some((t) => t.id !== input.id && t.name.trim().toLowerCase() === name.toLowerCase())) {
    errors.push('Ya tienes otra sesión con ese nombre.')
  }

  const items = input.items ?? []
  if (items.length === 0) errors.push('Añade al menos un ejercicio.')

  const known = new Map(exercises.map((e) => [e.id, e]))
  const seen = new Set()
  const cleanItems = []
  for (const item of items) {
    const exercise = known.get(item.exerciseId)
    if (!exercise) {
      errors.push('Hay un ejercicio que ya no existe. Quítalo de la sesión.')
      continue
    }
    if (seen.has(item.exerciseId)) errors.push(`«${exercise.name}» está repetido en la sesión.`)
    seen.add(item.exerciseId)

    const sets = Number(item.sets)
    if (isBlank(item.sets) || !Number.isInteger(sets) || sets < 1 || sets > MAX_SETS_PER_EXERCISE) {
      errors.push(`«${exercise.name}»: las series deben ser un número entero de 1 a ${MAX_SETS_PER_EXERCISE}.`)
    }

    const core = item.coreExerciseId || null
    if (core && core !== RANDOM_CORE && !known.has(core)) errors.push(`«${exercise.name}»: el core elegido para el descanso ya no existe.`)

    cleanItems.push({ exerciseId: item.exerciseId, sets, perSide: Boolean(item.perSide), coreExerciseId: core })
  }

  if (errors.length > 0) return { errors: [...new Set(errors)], template: null }
  return { errors, template: { id: input.id, name, order: input.order ?? 1, items: cleanItems } }
}

/**
 * Duración aproximada de una sesión en minutos, redondeada de 5 en 5.
 * Cuenta: calentamiento (5 min), el tiempo de cada serie y el descanso tras cada serie.
 * Una serie de 8-10 repeticiones se estima en 45 s; las que se hacen con cada lado, el doble.
 * El core en el descanso no suma tiempo: se hace mientras descansas. Es una estimación, no una medida.
 */
export function estimateMinutes(
  template,
  exercises,
  { restSeconds = DEFAULT_REST_SECONDS, perSideRestSeconds = DEFAULT_PER_SIDE_REST_SECONDS, rules = DEFAULT_PROGRESSION_RULES } = {},
) {
  const known = new Map(exercises.map((e) => [e.id, e]))
  let seconds = WARMUP_MINUTES * 60
  for (const item of template.items ?? []) {
    const exercise = known.get(item.exerciseId)
    const sets = Number(item.sets) || 0
    let work = SECONDS_PER_REP_SET
    if (exercise?.unit === EXERCISE_UNITS.SECONDS) {
      work = getRulesForExercise(exercise, rules).repRange.max + SECONDS_OF_PREPARATION
    } else if (exercise) {
      // Series largas (las 50 sentadillas): unos 2,5 s por repetición en vez de los 45 s de una serie normal.
      work = Math.max(work, getRulesForExercise(exercise, rules).repRange.max * SECONDS_PER_LONG_REP)
    }
    if (item.perSide) work *= 2
    seconds += sets * (work + (item.perSide ? perSideRestSeconds : restSeconds))
  }
  return Math.round(seconds / 60 / 5) * 5
}

/** Objetivo de un ejercicio dentro de una sesión, por ejemplo "3 series de 8-10 repeticiones por lado". */
export function itemTargetText(item, exercise, rules = DEFAULT_PROGRESSION_RULES) {
  const series = `${item.sets} ${Number(item.sets) === 1 ? 'serie' : 'series'}`
  if (!exercise) return series
  const { repRange } = getRulesForExercise(exercise, rules)
  const unitWord = exercise.unit === EXERCISE_UNITS.SECONDS ? 'segundos' : 'repeticiones'
  const amount = repRange.min === repRange.max ? `${repRange.max}` : `${repRange.min}-${repRange.max}`
  return `${series} de ${amount} ${unitWord}${item.perSide ? ' por lado' : ''}`
}

/** Texto de la duración, por ejemplo "unos 55 min". */
export const minutesText = (minutes) => `unos ${minutes} min`

/**
 * Qué sesión de fuerza toca: la siguiente (en el orden de la lista) a la última que se hizo.
 * Si aún no se ha hecho ninguna, la primera. `sessions` son las sesiones realizadas (con `date`, `type`,
 * `status` y `templateId`); solo cuentan las de fuerza hechas (o movidas a otro día).
 */
export function suggestNextTemplateId(templates, sessions = []) {
  const sorted = sortTemplates(templates)
  if (sorted.length === 0) return null
  const ids = sorted.map((t) => t.id)
  const done = sessions
    .filter(
      (s) =>
        s.type === SESSION_TYPES.STRENGTH &&
        (s.status === SESSION_STATUS.DONE || s.status === SESSION_STATUS.MOVED) &&
        ids.includes(s.templateId),
    )
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.startedAt ?? '').localeCompare(String(b.startedAt ?? '')))
  if (done.length === 0) return sorted[0].id
  const last = done[done.length - 1]
  return sorted[(ids.indexOf(last.templateId) + 1) % sorted.length].id
}

/**
 * Cuántas veces por semana, de media, sale cada grupo muscular con el plan actual.
 * Los días de fuerza con sesión fija cuentan para esa sesión; los "automáticos" se reparten a partes iguales
 * entre todas las sesiones (así 3 días con 2 sesiones = 1,5 veces cada una de media).
 * El core de los descansos cuenta para el grupo "core". Devuelve { idDelGrupo: veces } solo con los grupos que salen.
 */
export function weeklyGroupFrequency({ plan, templates, exercises }) {
  if (templates.length === 0) return {}
  const known = new Map(exercises.map((e) => [e.id, e]))
  const templateIds = new Set(templates.map((t) => t.id))
  const strength = plan.filter((slot) => slot.type === SESSION_TYPES.STRENGTH)

  const fixed = new Map()
  let auto = 0
  for (const slot of strength) {
    if (slot.templateId && templateIds.has(slot.templateId)) fixed.set(slot.templateId, (fixed.get(slot.templateId) ?? 0) + 1)
    else auto += 1
  }

  const result = {}
  for (const template of templates) {
    const timesPerWeek = (fixed.get(template.id) ?? 0) + auto / templates.length
    if (timesPerWeek === 0) continue
    const groups = new Set()
    for (const item of template.items ?? []) {
      for (const group of known.get(item.exerciseId)?.muscleGroups ?? []) groups.add(group)
      // Cualquier core en el descanso (fijo o aleatorio, también lumbares) cuenta como core, no como otros músculos.
      if (item.coreExerciseId) groups.add('core')
    }
    for (const group of groups) result[group] = (result[group] ?? 0) + timesPerWeek
  }
  return result
}

/** Los grupos que salen menos veces por semana que el objetivo, de más a menos faltan. */
export function groupsBelowGoal(frequency, goals, groups = MUSCLE_GROUPS) {
  return groups
    .map((g) => ({ id: g.id, label: g.label, times: frequency[g.id] ?? 0, goal: goals?.timesPerWeekByGroup?.[g.id] ?? 0 }))
    .filter((g) => g.times < g.goal)
    .sort((a, b) => b.goal - b.times - (a.goal - a.times))
}
