import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES } from '../core/defaultData.js'
import { get, getAll, getSetting, openDb, put } from './db.js'
import { migrateCoreToRandomIfNeeded, seedIfNeeded, seedLibraryIfNeeded, seedTemplatesIfNeeded } from './seed.js'

let db
let counter = 0
beforeEach(async () => {
  counter += 1
  db = await openDb(`seed-core-test-db-${counter}`)
})

/** Las sesiones de partida como estaban antes del cambio: con un core fijo en cada ejercicio. */
const OLD_UPPER = {
  ...DEFAULT_TEMPLATES[0],
  items: DEFAULT_TEMPLATES[0].items.map((item, i) => ({ ...item, coreExerciseId: i === 5 ? null : ['dead-bug', 'reverse-crunch', 'bird-dog', 'leg-raise', 'crunch'][i] })),
}

describe('migrateCoreToRandomIfNeeded', () => {
  it('en un móvil con las sesiones antiguas, los core fijos pasan a aleatorio y el descanso puro se queda', async () => {
    await put(db, 'templates', OLD_UPPER)
    expect(await migrateCoreToRandomIfNeeded(db)).toBe(true)
    const upper = await get(db, 'templates', 'tpl-upper')
    expect(upper.items.map((i) => i.coreExerciseId)).toEqual(['random', 'random', 'random', 'random', 'random', null])
    expect(await getSetting(db, 'coreRandomMigrated')).toBe(true)
  })

  it('solo una vez: si David cambia después un core a fijo, no se vuelve a pisar', async () => {
    await put(db, 'templates', OLD_UPPER)
    await migrateCoreToRandomIfNeeded(db)
    const upper = await get(db, 'templates', 'tpl-upper')
    await put(db, 'templates', { ...upper, items: upper.items.map((i, k) => (k === 0 ? { ...i, coreExerciseId: 'plank' } : i)) })
    expect(await migrateCoreToRandomIfNeeded(db)).toBe(false)
    expect((await get(db, 'templates', 'tpl-upper')).items[0].coreExerciseId).toBe('plank')
  })

  it('no toca las sesiones que creó David', async () => {
    const mine = { id: 'tpl-mia', name: 'Mía', order: 3, items: [{ exerciseId: 'push-up', sets: 3, perSide: false, coreExerciseId: 'plank' }] }
    await put(db, 'templates', mine)
    await migrateCoreToRandomIfNeeded(db)
    expect(await get(db, 'templates', 'tpl-mia')).toEqual(mine)
  })

  it('una instalación nueva ya trae el core aleatorio y no cambia nada', async () => {
    await seedIfNeeded(db)
    await seedLibraryIfNeeded(db)
    await seedTemplatesIfNeeded(db)
    expect(await migrateCoreToRandomIfNeeded(db)).toBe(false)
    const upper = await get(db, 'templates', 'tpl-upper')
    expect(upper.items.filter((i) => i.coreExerciseId === 'random')).toHaveLength(5)
  })

  it('sin sesiones no hace nada pero apunta que ya se ha comprobado', async () => {
    expect(await migrateCoreToRandomIfNeeded(db)).toBe(false)
    expect(await getAll(db, 'templates')).toHaveLength(0)
    expect(await getSetting(db, 'coreRandomMigrated')).toBe(true)
  })
})
