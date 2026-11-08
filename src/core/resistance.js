// Niveles de resistencia y su dirección de dificultad.
//
// Una "escala" es una lista ordenada de MENOS a MÁS resistencia (banda más suave -> más dura).
//  - Ejercicio "resisted":  más difícil = siguiente nivel de la lista (banda más dura / más kg).
//  - Ejercicio "assisted":  más difícil = nivel ANTERIOR de la lista (banda más suave = menos ayuda).
//    Después de la banda más suave, lo más difícil es hacerlo sin banda (nivel especial 'none').

import { RESISTANCE_TYPES } from './model.js'

/** Nivel especial de los ejercicios asistidos: sin ninguna ayuda. Es el más difícil. */
export const NO_ASSISTANCE = Object.freeze({ id: 'none', label: 'Sin banda' })

const isAssisted = (exercise) => exercise.resistanceType === RESISTANCE_TYPES.ASSISTED

function indexOfLevel(scale, levelId) {
  return scale.levels.findIndex((level) => level.id === levelId)
}

/** Busca un nivel por id. Devuelve null si no existe. */
export function findLevel(exercise, scale, levelId) {
  if (!scale) return null
  if (isAssisted(exercise) && levelId === NO_ASSISTANCE.id) return NO_ASSISTANCE
  return scale.levels.find((level) => level.id === levelId) ?? null
}

/** Siguiente nivel MÁS DIFÍCIL, o null si ya estás en el máximo (o el nivel no existe). */
export function getHarderLevel(exercise, scale, levelId) {
  if (!scale) return null
  const assisted = isAssisted(exercise)
  if (assisted && levelId === NO_ASSISTANCE.id) return null
  const i = indexOfLevel(scale, levelId)
  if (i < 0) return null
  if (assisted) return i === 0 ? NO_ASSISTANCE : scale.levels[i - 1]
  return scale.levels[i + 1] ?? null
}

/** Siguiente nivel MÁS FÁCIL, o null si ya estás en el mínimo (o el nivel no existe). */
export function getEasierLevel(exercise, scale, levelId) {
  if (!scale) return null
  const assisted = isAssisted(exercise)
  if (assisted && levelId === NO_ASSISTANCE.id) return scale.levels[0] ?? null
  const i = indexOfLevel(scale, levelId)
  if (i < 0) return null
  if (assisted) return scale.levels[i + 1] ?? null
  return i === 0 ? null : scale.levels[i - 1]
}

/** Número para comparar dificultad entre niveles del mismo ejercicio: mayor = más difícil. */
export function difficultyRank(exercise, scale, levelId) {
  if (!scale) return 0
  const assisted = isAssisted(exercise)
  if (assisted && levelId === NO_ASSISTANCE.id) return 1
  const i = indexOfLevel(scale, levelId)
  if (i < 0) return -Infinity
  return assisted ? 0 - i : i
}
