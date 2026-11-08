// Datos de la primera vez que se abre la app (o tras borrar todo).

import { DEFAULT_GOALS, DEFAULT_SCALES, DEFAULT_WEEK_PLAN } from '../core/defaultData.js'
import { DEFAULT_EXERCISES, ORIGINAL_LIBRARY_IDS } from '../core/exerciseLibrary.js'
import { DEFAULT_PROGRESSION_RULES } from '../core/progressionConfig.js'
import { getAll, getSetting, writeAll } from './db.js'

/** Carga los datos de partida si es la primera vez. Devuelve true si los cargó. */
export async function seedIfNeeded(db) {
  if (await getSetting(db, 'seeded', false)) return false
  await writeAll(db, {
    scales: DEFAULT_SCALES,
    plan: DEFAULT_WEEK_PLAN,
    settings: [
      { key: 'goals', value: DEFAULT_GOALS },
      { key: 'progressionRules', value: DEFAULT_PROGRESSION_RULES },
      { key: 'theme', value: 'dark' },
      { key: 'seeded', value: true },
    ],
  })
  return true
}

/**
 * Ofrece los ejercicios de la biblioteca que este dispositivo aún no ha recibido (y las escalas que necesiten).
 * Se ejecuta cada vez que se abre la app, de modo que los ejercicios que se añadan a la biblioteca en una
 * versión nueva llegan solos.
 *
 * Reglas:
 *  - Un ejercicio se ofrece UNA sola vez (se apunta en el ajuste "offeredExerciseIds"). Si luego lo borras,
 *    no vuelve a aparecer.
 *  - Nunca pisa nada: si ya existe un ejercicio o una escala con el mismo id, se respeta tal cual está.
 *  - Un móvil que se instaló con la entrega 1b (tiene la marca antigua "exerciseLibrarySeeded" pero no la
 *    lista de ofrecidos) recibe solo los ejercicios posteriores a los 30 originales.
 * Devuelve true si escribió algo.
 */
export async function seedLibraryIfNeeded(db) {
  const stored = await getSetting(db, 'offeredExerciseIds', null)
  const offered = new Set(
    stored ?? ((await getSetting(db, 'exerciseLibrarySeeded', false)) ? ORIGINAL_LIBRARY_IDS : []),
  )
  const toOffer = DEFAULT_EXERCISES.filter((exercise) => !offered.has(exercise.id))
  if (toOffer.length === 0 && stored !== null) return false

  const [scales, exercises] = await Promise.all([getAll(db, 'scales'), getAll(db, 'exercises')])
  const haveScales = new Set(scales.map((scale) => scale.id))
  const haveExercises = new Set(exercises.map((exercise) => exercise.id))
  const neededScales = new Set(toOffer.map((exercise) => exercise.scaleId).filter(Boolean))

  await writeAll(db, {
    scales: DEFAULT_SCALES.filter((scale) => neededScales.has(scale.id) && !haveScales.has(scale.id)),
    exercises: toOffer.filter((exercise) => !haveExercises.has(exercise.id)),
    settings: [
      { key: 'offeredExerciseIds', value: [...new Set([...offered, ...toOffer.map((exercise) => exercise.id)])] },
      { key: 'exerciseLibrarySeeded', value: true },
    ],
  })
  return true
}
