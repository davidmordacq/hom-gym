// Reglas para crear y editar ejercicios (validación y orden de los niveles). Solo lógica, sin pantallas.

import { MUSCLE_GROUPS, regionOfGroup } from './defaultData.js'
import { EXERCISE_UNITS, RESISTANCE_TYPES } from './model.js'
import { getRulesForExercise } from './progressionConfig.js'
import { NO_ASSISTANCE, difficultyRank } from './resistance.js'
import { parseYoutubeId, youtubeWatchUrl } from './youtube.js'

/** Ejercicio vacío para el formulario de "Añadir". */
export function blankExercise() {
  return toDraft({
    id: '',
    name: '',
    muscleGroups: [],
    resistanceType: RESISTANCE_TYPES.RESISTED,
    scaleId: null,
    videoUrl: '',
    videoChannel: '',
    notes: '',
  })
}

/**
 * Convierte un ejercicio guardado en los datos que edita el formulario.
 * `rangeMin` y `rangeMax` son el rango objetivo propio del ejercicio (vacío = usa el de los ajustes generales).
 */
export function toDraft(exercise) {
  return {
    ...exercise,
    unit: exercise.unit ?? EXERCISE_UNITS.REPS,
    videoUrl: exercise.videoUrl ?? '',
    rangeMin: exercise.rules?.repRange?.min ?? '',
    rangeMax: exercise.rules?.repRange?.max ?? '',
  }
}

/**
 * Grupo muscular al que se anota un ejercicio en el análisis: el principal (el primero de su lista).
 * Decisión de David (2026-11-09): un ejercicio que trabaja varios músculos cuenta solo para el principal.
 */
export const mainMuscleGroup = (exercise) => exercise?.muscleGroups?.[0] ?? null

/** ¿Es un ejercicio de pierna (su músculo principal es del tren inferior)? Descansan menos: ver `restSecondsFor`. */
export const isLegExercise = (exercise) => regionOfGroup(mainMuscleGroup(exercise)) === 'lower'

/**
 * Dónde se usa un ejercicio: series registradas, sesiones (hechas o en curso) que lo llevan y sesiones de fuerza tipo.
 * `blocked` es true si tiene historial o está en una sesión en curso: borrarlo haría que ese historial dejara de contar
 * (saldría como "ejercicio que ya no existe"), así que en ese caso solo se puede archivar.
 */
export function exerciseUsage({ exerciseId, sets = [], sessions = [], templates = [] }) {
  const mine = sets.filter((s) => s.exerciseId === exerciseId)
  const uses = (entry) => entry.exerciseId === exerciseId || entry.coreExerciseId === exerciseId
  const usedBy = sessions.filter((s) => (s.exercises ?? []).some(uses))
  const inTemplates = templates.filter((t) => (t.items ?? []).some(uses)).map((t) => t.name)
  const sessionIds = new Set([...mine.map((s) => s.sessionId), ...usedBy.map((s) => s.id)])
  return {
    sets: mine.length,
    // Con series, las sesiones donde se hicieron; si no hay series, las sesiones que lo llevaban previsto.
    sessions: mine.length > 0 ? new Set(mine.map((s) => s.sessionId)).size : sessionIds.size,
    templates: inTemplates,
    blocked: mine.length > 0 || usedBy.length > 0,
  }
}

/**
 * Quita un ejercicio de las sesiones de fuerza tipo (y lo quita como core del descanso donde estuviera).
 * Devuelve solo las sesiones tipo que cambian, para guardarlas.
 */
export function removeExerciseFromTemplates(templates, exerciseId) {
  const changed = []
  for (const template of templates) {
    const items = (template.items ?? [])
      .filter((item) => item.exerciseId !== exerciseId)
      .map((item) => (item.coreExerciseId === exerciseId ? { ...item, coreExerciseId: null } : item))
    const touched = items.length !== (template.items ?? []).length || items.some((item, i) => item !== template.items[i])
    if (touched) changed.push({ ...template, items })
  }
  return changed
}

/** Archiva o restaura un ejercicio: archivado no sale en las listas ni se puede añadir a sesiones, pero conserva su historial. */
export function setArchived(exercise, archived) {
  const { archived: previous, ...rest } = exercise // eslint-disable-line no-unused-vars
  return archived ? { ...rest, archived: true } : rest
}

export const isArchived = (exercise) => Boolean(exercise?.archived)

/** Identificador nuevo para un ejercicio creado por el usuario. */
export const newExerciseId = (now = Date.now()) => `custom-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`

const isBlank = (value) => value === '' || value === null || value === undefined

/**
 * Revisa un ejercicio (o lo que escribe el formulario) antes de guardarlo.
 * Devuelve { errors: [textos en español], exercise: versión limpia lista para guardar }.
 * Si hay errores, `exercise` es null.
 */
export function validateExercise(input, { scales = [], groups = MUSCLE_GROUPS } = {}) {
  const errors = []

  const name = String(input.name ?? '').trim()
  if (!name) errors.push('Escribe un nombre para el ejercicio.')

  const validGroups = new Set(groups.map((g) => g.id))
  const muscleGroups = (input.muscleGroups ?? []).filter((id) => validGroups.has(id))
  if (muscleGroups.length === 0) errors.push('Elige al menos un grupo muscular.')

  if (!Object.values(RESISTANCE_TYPES).includes(input.resistanceType)) {
    errors.push('Elige el tipo de ejercicio.')
  }

  const unit = input.unit ?? EXERCISE_UNITS.REPS
  if (!Object.values(EXERCISE_UNITS).includes(unit)) errors.push('Elige si el ejercicio se mide en repeticiones o en segundos.')

  const scaleId = input.scaleId || null
  if (scaleId && !scales.some((scale) => scale.id === scaleId)) {
    errors.push('La escala de resistencia elegida ya no existe.')
  }
  if (input.resistanceType === RESISTANCE_TYPES.ASSISTED && !scaleId) {
    errors.push('Un ejercicio con ayuda necesita una escala (por ejemplo, bandas).')
  }

  // Rango objetivo propio: opcional en repeticiones (si no, vale el de los ajustes), obligatorio en segundos.
  let repRange = null
  const noMin = isBlank(input.rangeMin)
  const noMax = isBlank(input.rangeMax)
  if (noMin !== noMax) {
    errors.push('Rellena los dos números del rango objetivo (mínimo y máximo) o deja los dos vacíos.')
  } else if (!noMin) {
    const min = Number(input.rangeMin)
    const max = Number(input.rangeMax)
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || min > max) {
      errors.push('El rango objetivo debe ser de números enteros desde 1, con el mínimo no mayor que el máximo.')
    } else {
      repRange = { min, max }
    }
  } else if (unit === EXERCISE_UNITS.SECONDS) {
    errors.push('Un ejercicio en segundos necesita su rango objetivo (por ejemplo, de 30 a 45 segundos).')
  }

  let videoUrl = null
  const rawVideo = String(input.videoUrl ?? '').trim()
  if (rawVideo) {
    const id = parseYoutubeId(rawVideo)
    if (id) videoUrl = youtubeWatchUrl(id)
    else errors.push('El enlace del vídeo no es de YouTube. Pega la dirección completa del vídeo.')
  }

  if (errors.length > 0) return { errors, exercise: null }

  const { rangeMin, rangeMax, rules: ownRules, ...rest } = input // eslint-disable-line no-unused-vars
  const { repRange: oldRange, ...otherRules } = ownRules ?? {} // eslint-disable-line no-unused-vars
  const rules = repRange ? { ...otherRules, repRange } : otherRules

  const exercise = {
    ...rest,
    name,
    muscleGroups,
    unit,
    scaleId,
    videoUrl,
    videoChannel: videoUrl ? String(input.videoChannel ?? '').trim() : '',
    notes: String(input.notes ?? '').trim(),
  }
  if (Object.keys(rules).length > 0) exercise.rules = rules
  return { errors, exercise }
}

/**
 * Niveles de un ejercicio ordenados del MÁS FÁCIL al MÁS DIFÍCIL (incluye "Sin banda" en los asistidos).
 * Devuelve [] si el ejercicio no usa escala.
 */
export function levelsEasyToHard(exercise, scale) {
  if (!scale) return []
  const levels = [...scale.levels]
  if (exercise.resistanceType === RESISTANCE_TYPES.ASSISTED) levels.push(NO_ASSISTANCE)
  return levels.sort((a, b) => difficultyRank(exercise, scale, a.id) - difficultyRank(exercise, scale, b.id))
}

/** Texto del objetivo de un ejercicio, por ejemplo "3 series de 8-10 repeticiones". */
export function targetText(exercise, globalRules) {
  const { repRange, targetSets } = getRulesForExercise(exercise, globalRules)
  const unitWord = exercise.unit === EXERCISE_UNITS.SECONDS ? 'segundos' : 'repeticiones'
  const amount = repRange.min === repRange.max ? `${repRange.max}` : `${repRange.min}-${repRange.max}`
  return `${targetSets} series de ${amount} ${unitWord}`
}

/** Ordena los ejercicios por grupo muscular principal (el primero de su lista) y luego por nombre. */
export function groupExercises(exercises, groups = MUSCLE_GROUPS) {
  const order = new Map(groups.map((g, i) => [g.id, i]))
  const byGroup = new Map()
  for (const exercise of exercises) {
    const main = exercise.muscleGroups?.[0] ?? 'other'
    if (!byGroup.has(main)) byGroup.set(main, [])
    byGroup.get(main).push(exercise)
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
    .map(([groupId, list]) => ({
      groupId,
      label: groups.find((g) => g.id === groupId)?.label ?? 'Otros',
      exercises: [...list].sort((x, y) => x.name.localeCompare(y.name, 'es')),
    }))
}

/** Quita acentos y mayúsculas para buscar "dominadas" y encontrar "Dominadas". */
const normalize = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Filtra por texto (nombre o grupo muscular). Un texto vacío devuelve todo. */
export function searchExercises(exercises, query, groups = MUSCLE_GROUPS) {
  const q = normalize(query.trim())
  if (!q) return exercises
  return exercises.filter((exercise) => {
    const haystack = [exercise.name, ...(exercise.muscleGroups ?? []).map((id) => groups.find((g) => g.id === id)?.label ?? '')]
    return normalize(haystack.join(' ')).includes(q)
  })
}
