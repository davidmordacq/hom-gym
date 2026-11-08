// Datos de la primera vez que se abre la app (o tras borrar todo).

import { DEFAULT_GOALS, DEFAULT_SCALES, DEFAULT_WEEK_PLAN } from '../core/defaultData.js'
import { DEFAULT_PROGRESSION_RULES } from '../core/progressionConfig.js'
import { getSetting, writeAll } from './db.js'

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
