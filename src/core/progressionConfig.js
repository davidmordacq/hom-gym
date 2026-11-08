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
