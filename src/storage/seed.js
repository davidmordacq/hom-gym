// Datos de la primera vez que se abre la app (o tras borrar todo).

import { toIsoDate } from '../core/dates.js'
import {
  DEFAULT_GOALS, DEFAULT_SCALES, DEFAULT_TEMPLATES, DEFAULT_WEEK_PLAN, SCALE_LEVEL_ADDITIONS,
} from '../core/defaultData.js'
import { DEFAULT_EXERCISES, ORIGINAL_LIBRARY_IDS } from '../core/exerciseLibrary.js'
import { RANDOM_CORE } from '../core/model.js'
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
      { key: 'installedAt', value: toIsoDate() }, // desde cuándo se usa la app (el calendario no marca "no hechas" antes)
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

/**
 * Añade a las escalas que ya existen los niveles nuevos de `SCALE_LEVEL_ADDITIONS` (por ejemplo, la banda amarilla).
 * Cada nivel se ofrece UNA sola vez por dispositivo (ajuste "offeredScaleLevelIds") y nunca se duplica.
 * Devuelve true si escribió algo.
 */
export async function seedScaleLevelsIfNeeded(db) {
  const offered = new Set(await getSetting(db, 'offeredScaleLevelIds', []))
  const pending = SCALE_LEVEL_ADDITIONS.filter((addition) => !offered.has(addition.id))
  if (pending.length === 0) return false

  const scales = new Map((await getAll(db, 'scales')).map((scale) => [scale.id, scale]))
  const changed = new Map()
  for (const addition of pending) {
    const scale = changed.get(addition.scaleId) ?? scales.get(addition.scaleId)
    if (!scale || scale.levels.some((level) => level.id === addition.level.id)) continue
    const levels = [...scale.levels]
    const after = levels.findIndex((level) => level.id === addition.afterLevelId)
    levels.splice(after === -1 ? levels.length : after + 1, 0, addition.level)
    changed.set(scale.id, { ...scale, levels })
  }

  await writeAll(db, {
    scales: [...changed.values()],
    settings: [{ key: 'offeredScaleLevelIds', value: [...new Set([...offered, ...pending.map((addition) => addition.id)])] }],
  })
  return changed.size > 0
}

/**
 * Pasa las sesiones de partida (Tren superior e inferior) del core fijo de cada ejercicio al core aleatorio, una sola
 * vez por dispositivo (ajuste "coreRandomMigrated"): David pidió que el core de los descansos cambie al azar también entre
 * series del mismo ejercicio. Los ejercicios con descanso puro se quedan como están. Las sesiones propias no se tocan, y
 * lo que cambie David después no se vuelve a cambiar. Ejecutar DESPUÉS de seedTemplatesIfNeeded.
 * Devuelve true si cambió alguna sesión.
 */
export async function migrateCoreToRandomIfNeeded(db) {
  if (await getSetting(db, 'coreRandomMigrated', false)) return false
  const templates = (await getAll(db, 'templates')).filter((t) => DEFAULT_TEMPLATES.some((d) => d.id === t.id))
  const changed = []
  for (const template of templates) {
    const items = template.items.map((item) =>
      item.coreExerciseId && item.coreExerciseId !== RANDOM_CORE ? { ...item, coreExerciseId: RANDOM_CORE } : item,
    )
    if (items.some((item, i) => item !== template.items[i])) changed.push({ ...template, items })
  }
  await writeAll(db, { templates: changed, settings: [{ key: 'coreRandomMigrated', value: true }] })
  return changed.length > 0
}

/**
 * Carga las sesiones de fuerza de partida (tren superior e inferior) la primera vez.
 * Se hace UNA sola vez por dispositivo (ajuste "templatesSeeded"): si luego las cambias o las borras, no vuelven.
 * Quita de ellas los ejercicios que no existan en este dispositivo. Ejecutar DESPUÉS de seedLibraryIfNeeded.
 * Devuelve true si escribió algo.
 */
export async function seedTemplatesIfNeeded(db) {
  if (await getSetting(db, 'templatesSeeded', false)) return false
  const [exercises, existing] = await Promise.all([getAll(db, 'exercises'), getAll(db, 'templates')])
  if (exercises.length === 0) return false // sin ejercicios no hay con qué armarlas: se intentará otra vez más adelante
  const haveExercises = new Set(exercises.map((exercise) => exercise.id))
  const haveTemplates = new Set(existing.map((template) => template.id))

  const templates = DEFAULT_TEMPLATES.filter((template) => !haveTemplates.has(template.id))
    .map((template) => ({
      ...template,
      items: template.items
        .filter((item) => haveExercises.has(item.exerciseId))
        .map((item) => ({
          ...item,
          coreExerciseId: item.coreExerciseId === RANDOM_CORE || haveExercises.has(item.coreExerciseId) ? item.coreExerciseId : null,
        })),
    }))
    .filter((template) => template.items.length > 0)

  await writeAll(db, { templates, settings: [{ key: 'templatesSeeded', value: true }] })
  return templates.length > 0
}
