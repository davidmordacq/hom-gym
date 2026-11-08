// Datos de la primera vez que se abre la app (o tras borrar todo).

import { DEFAULT_GOALS, DEFAULT_SCALES, DEFAULT_WEEK_PLAN } from '../core/defaultData.js'
import { DEFAULT_EXERCISES } from '../core/exerciseLibrary.js'
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
 * Carga la biblioteca inicial de ejercicios (y las escalas que falten) una sola vez.
 * Va aparte de seedIfNeeded porque la app ya estaba en uso antes de que existiera la biblioteca.
 * Nunca pisa nada: si un ejercicio o una escala con el mismo id ya existe, se respeta tal cual está.
 * Si luego borras un ejercicio de la biblioteca, no vuelve a aparecer solo.
 */
export async function seedLibraryIfNeeded(db) {
  if (await getSetting(db, 'exerciseLibrarySeeded', false)) return false
  const [scales, exercises] = await Promise.all([getAll(db, 'scales'), getAll(db, 'exercises')])
  const haveScales = new Set(scales.map((scale) => scale.id))
  const haveExercises = new Set(exercises.map((exercise) => exercise.id))
  await writeAll(db, {
    scales: DEFAULT_SCALES.filter((scale) => !haveScales.has(scale.id)),
    exercises: DEFAULT_EXERCISES.filter((exercise) => !haveExercises.has(exercise.id)),
    settings: [{ key: 'exerciseLibrarySeeded', value: true }],
  })
  return true
}
