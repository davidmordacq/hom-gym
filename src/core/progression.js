// MOTOR DE PROGRESIÓN: a partir del historial de un ejercicio, recomienda qué hacer la próxima vez.
// Es lógica pura (sin pantalla ni base de datos) para poder probarla a fondo.
// Los números (rango, series, sesiones) NO están aquí: viven en progressionConfig.js.

import { PROGRESSION_ACTIONS as A } from './model.js'
import { getRulesForExercise } from './progressionConfig.js'
import { NO_ASSISTANCE, difficultyRank, findLevel, getEasierLevel, getHarderLevel } from './resistance.js'

const sum = (numbers) => numbers.reduce((total, n) => total + n, 0)
const isValidReps = (reps) => Number.isFinite(reps) && reps >= 0

/**
 * Agrupa las series sueltas de UN ejercicio en sesiones.
 * @param {import('./model.js').SetLog[]} setLogs
 * @returns {{sessionId:string, date:string, sets:import('./model.js').SetLog[]}[]}
 */
export function groupSetsBySession(setLogs) {
  const bySession = new Map()
  for (const set of setLogs) {
    if (!bySession.has(set.sessionId)) {
      bySession.set(set.sessionId, { sessionId: set.sessionId, date: set.date, sets: [] })
    }
    bySession.get(set.sessionId).sets.push(set)
  }
  return [...bySession.values()]
}

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)

/**
 * Resume una sesión de un ejercicio.
 * - Nivel de trabajo: el más usado en la sesión (si hay empate, el más difícil).
 * - Solo cuentan las primeras `targetSets` series de ese nivel; las que faltan cuentan como 0 repeticiones.
 * - "allAtTop": hizo todas las series previstas y todas llegaron al tope del rango (o lo superaron).
 * Devuelve null si la sesión no tiene ninguna serie válida.
 */
export function summarizeSession(session, exercise, scale, rules) {
  const valid = session.sets.filter((set) => isValidReps(set.reps))
  if (valid.length === 0) return null

  const counts = new Map()
  for (const set of valid) {
    const key = set.levelId ?? null
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let levelId = null
  let bestCount = -1
  for (const [key, count] of counts) {
    const harder = count === bestCount && difficultyRank(exercise, scale, key) > difficultyRank(exercise, scale, levelId)
    if (count > bestCount || harder) {
      levelId = key
      bestCount = count
    }
  }

  const atLevel = valid
    .filter((set) => (set.levelId ?? null) === levelId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const reps = atLevel.slice(0, rules.targetSets).map((set) => set.reps)
  const allAtTop = reps.length >= rules.targetSets && reps.every((r) => r >= rules.repRange.max)

  return { sessionId: session.sessionId, date: session.date, levelId, reps, totalReps: sum(reps), allAtTop }
}

/**
 * Recomienda qué hacer la próxima vez con un ejercicio.
 *
 * @param {Object} input
 * @param {import('./model.js').Exercise} input.exercise
 * @param {import('./model.js').ResistanceScale|null} input.scale  escala de resistencia del ejercicio
 * @param {{sessionId:string, date:string, sets:{order:number, reps:number, levelId:string|null}[]}[]} input.sessions
 *        historial del ejercicio, una entrada por sesión (en cualquier orden: se ordena por fecha)
 * @param {import('./progressionConfig.js').ProgressionRules} [input.rules]  reglas globales (por defecto las de la app)
 * @returns {{action:string, message:string, currentLevelId:string|null, nextLevelId:string|null,
 *            repRange:{min:number,max:number}, targetSets:number, sessionsAtLevel:number, last:object|null}}
 */
export function evaluateExercise({ exercise, scale, sessions, rules }) {
  const r = getRulesForExercise(exercise, rules)
  const { repRange, targetSets } = r
  const labelOf = (levelId) => findLevel(exercise, scale, levelId)?.label ?? 'este nivel'
  const rangeText = `${repRange.min}-${repRange.max}`

  const summaries = [...sessions]
    .sort(byDate)
    .map((session) => summarizeSession(session, exercise, scale, r))
    .filter(Boolean)

  const result = (action, message, extra = {}) => ({
    action,
    message,
    currentLevelId: null,
    nextLevelId: null,
    repRange,
    targetSets,
    sessionsAtLevel: 0,
    last: null,
    ...extra,
  })

  if (summaries.length === 0) {
    return result(
      A.START,
      `Sin historial todavía. Empieza con un nivel que te permita hacer ${rangeText} repeticiones en ${targetSets} series.`,
    )
  }

  const last = summaries.at(-1)
  const currentLevelId = last.levelId

  // Sesiones seguidas con este mismo nivel (las anteriores a un cambio de nivel no cuentan).
  let first = summaries.length - 1
  while (first > 0 && summaries[first - 1].levelId === currentLevelId) first--
  const streak = summaries.slice(first)
  const info = { currentLevelId, sessionsAtLevel: streak.length, last }

  if (scale && !findLevel(exercise, scale, currentLevelId)) {
    return result(
      A.UNKNOWN_LEVEL,
      'La resistencia que registraste ya no está en tu lista. Elige un nivel actual para este ejercicio.',
      info,
    )
  }

  const currentLabel = labelOf(currentLevelId)

  // 1) ¿Toca subir de nivel? Gana siempre sobre las demás reglas.
  let topSessions = 0
  for (let i = streak.length - 1; i >= 0 && streak[i].allAtTop; i--) topSessions++
  if (topSessions >= r.sessionsToConfirmTop) {
    const harder = getHarderLevel(exercise, scale, currentLevelId)
    if (harder) {
      const how =
        exercise.resistanceType === 'assisted' && harder.id !== NO_ASSISTANCE.id
          ? ' (banda más suave = menos ayuda)'
          : ''
      return result(
        A.INCREASE_LOAD,
        `Has llegado a ${repRange.max} repeticiones en las ${targetSets} series con ${currentLabel}. ` +
          `Sube a: ${harder.label}${how}. Al principio bajarán las repeticiones: vuelve a llegar al rango ${rangeText}.`,
        { ...info, nextLevelId: harder.id },
      )
    }
    return result(
      A.MAX_LEVEL,
      scale
        ? `Has llegado al tope con ${currentLabel}, que es el nivel más difícil que tienes. ` +
            'Añade más resistencia a tu lista o prueba una variante más difícil del ejercicio.'
        : 'Has llegado al tope de repeticiones. Este ejercicio no tiene niveles de resistencia: ' +
            'prueba una variante más difícil o añade resistencia.',
      info,
    )
  }

  // 2) ¿Se estanca o retrocede? Solo cuenta con el mismo nivel.
  const totals = streak.map((s) => s.totalReps)
  const n = totals.length
  const belowRange = last.totalReps / targetSets < repRange.min

  const reduceOrRest = (reason) => {
    const easier = getEasierLevel(exercise, scale, currentLevelId)
    if (easier) {
      return result(
        A.DECREASE_LOAD,
        `${reason} Baja un nivel: ${easier.label}, y vuelve a trabajar en el rango ${rangeText}.`,
        { ...info, nextLevelId: easier.id },
      )
    }
    return result(
      A.REST,
      `${reason} Ya estás en el nivel más fácil: descansa unos días o haz una semana más ligera antes de volver.`,
      info,
    )
  }

  const R = r.regressionSessions
  const regressing = n >= R + 1 && totals.slice(-(R + 1)).every((t, i, arr) => i === 0 || t < arr[i - 1])
  if (regressing) {
    if (belowRange) {
      return reduceOrRest(`Tus repeticiones llevan ${R} sesiones bajando y ya estás por debajo de ${repRange.min}.`)
    }
    return result(
      A.REST,
      `Tus repeticiones llevan ${R} sesiones bajando. Descansa unos días o haz una semana más ligera y vuelve con ${currentLabel}.`,
      info,
    )
  }

  const S = r.stagnationSessions
  const stagnant = n >= S + 1 && Math.max(...totals.slice(-S)) <= Math.max(...totals.slice(0, n - S))
  if (stagnant) {
    if (belowRange) {
      return reduceOrRest(`Llevas ${S} sesiones sin mejorar y por debajo de ${repRange.min} repeticiones.`)
    }
    return result(
      A.KEEP,
      `Llevas ${S} sesiones sin mejorar con ${currentLabel}. Mantén el nivel y cuida el descanso y la técnica.`,
      info,
    )
  }

  // 3) Progreso normal: seguir intentando llegar al tope.
  return result(
    A.ADD_REPS,
    `Sigue con ${currentLabel}: objetivo ${repRange.max} repeticiones en las ${targetSets} series ` +
      `(última sesión: ${last.reps.join(', ')}).`,
    info,
  )
}
