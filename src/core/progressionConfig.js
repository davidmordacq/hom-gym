// REGLAS DE PROGRESIÓN: este es el ÚNICO sitio donde se ajustan.
// Para cambiar el comportamiento de la app, cambia estos números (y ya está).
// Cada ejercicio puede tener sus propios valores en su campo `rules`.

/**
 * @typedef {Object} ProgressionRules
 * @property {{min:number, max:number}} repRange  rango de repeticiones objetivo
 * @property {number} targetSets            series que se esperan por ejercicio
 * @property {number} sessionsToConfirmTop  sesiones seguidas llegando al tope en TODAS las series
 *                                          antes de sugerir subir de nivel
 * @property {number} stagnationSessions    sesiones seguidas sin mejorar para sugerir "mantener"
 * @property {number} regressionSessions    sesiones seguidas bajando repeticiones para sugerir descansar/reducir
 */

/** @type {ProgressionRules} */
export const DEFAULT_PROGRESSION_RULES = Object.freeze({
  repRange: Object.freeze({ min: 8, max: 10 }),
  targetSets: 3,
  sessionsToConfirmTop: 1,
  stagnationSessions: 3,
  regressionSessions: 3,
})

const isPositiveInt = (n) => Number.isInteger(n) && n >= 1

const MAX_REPS = 100
const MAX_SETS = 10

/**
 * Revisa lo que David escribe en Ajustes (rango de repeticiones y series por defecto) y lo mezcla con las demás
 * reglas actuales. Devuelve { errors: [textos], rules }; si hay errores, `rules` es null.
 */
export function validateGlobalRules(input, current = DEFAULT_PROGRESSION_RULES) {
  const errors = []
  const blank = (v) => v === '' || v === null || v === undefined
  const min = Number(input.min)
  const max = Number(input.max)
  const sets = Number(input.sets)

  if (blank(input.min) || blank(input.max) || !Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < 1) {
    errors.push('El rango de repeticiones debe ser de números enteros desde 1.')
  } else if (min > max) {
    errors.push('El mínimo de repeticiones no puede ser mayor que el máximo.')
  } else if (max > MAX_REPS) {
    errors.push(`El máximo de repeticiones no puede pasar de ${MAX_REPS}.`)
  }
  if (blank(input.sets) || !Number.isInteger(sets) || sets < 1 || sets > MAX_SETS) {
    errors.push(`Las series por defecto deben ser un número entero de 1 a ${MAX_SETS}.`)
  }
  if (errors.length > 0) return { errors, rules: null }
  return { errors, rules: { ...current, repRange: { min, max }, targetSets: sets } }
}

/**
 * Devuelve las reglas guardadas si son válidas; si están dañadas o incompletas (por ejemplo, tras restaurar una copia
 * rara), vuelve a las de fábrica para que la app no se rompa.
 */
export function sanitizeRules(stored) {
  try {
    if (!stored || typeof stored !== 'object') return DEFAULT_PROGRESSION_RULES
    getRulesForExercise(undefined, stored)
    return stored
  } catch {
    return DEFAULT_PROGRESSION_RULES
  }
}

/**
 * Devuelve las reglas que aplican a un ejercicio: las globales con los ajustes propios del ejercicio encima.
 * Lanza un error si algún valor no tiene sentido (por ejemplo, rango mínimo mayor que el máximo).
 * @param {{rules?: Partial<ProgressionRules>}} [exercise]
 * @param {ProgressionRules} [globalRules]
 * @returns {ProgressionRules}
 */
export function getRulesForExercise(exercise, globalRules = DEFAULT_PROGRESSION_RULES) {
  const own = exercise?.rules ?? {}
  const merged = {
    ...globalRules,
    ...own,
    repRange: { ...globalRules.repRange, ...(own.repRange ?? {}) },
  }

  const { repRange } = merged
  if (!isPositiveInt(repRange.min) || !isPositiveInt(repRange.max) || repRange.min > repRange.max) {
    throw new Error('Rango de repeticiones no válido: el mínimo debe ser un entero ≥ 1 y no mayor que el máximo.')
  }
  for (const key of ['targetSets', 'sessionsToConfirmTop', 'stagnationSessions', 'regressionSessions']) {
    if (!isPositiveInt(merged[key])) {
      throw new Error(`Regla "${key}" no válida: debe ser un número entero de 1 o más.`)
    }
  }
  return merged
}
