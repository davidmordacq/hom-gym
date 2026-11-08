import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SCALES } from '../core/defaultData.js'
import { DEFAULT_EXERCISES } from '../core/exerciseLibrary.js'
import { get, getAll, getSetting, openDb, put, remove, replaceAll, setSetting } from './db.js'
import { seedIfNeeded, seedLibraryIfNeeded } from './seed.js'

let db
let counter = 0
beforeEach(async () => {
  counter += 1
  db = await openDb(`seed-test-db-${counter}`)
})

describe('seedLibraryIfNeeded', () => {
  it('carga la biblioteca la primera vez y marca que ya lo hizo', async () => {
    await seedIfNeeded(db)
    expect(await seedLibraryIfNeeded(db)).toBe(true)
    expect(await getAll(db, 'exercises')).toHaveLength(DEFAULT_EXERCISES.length)
    expect(await getSetting(db, 'exerciseLibrarySeeded')).toBe(true)
  })

  it('no vuelve a cargarla la segunda vez (no recupera lo que borraste)', async () => {
    await seedLibraryIfNeeded(db)
    await remove(db, 'exercises', 'crunch')
    expect(await seedLibraryIfNeeded(db)).toBe(false)
    expect(await get(db, 'exercises', 'crunch')).toBeUndefined()
  })

  it('no pisa un ejercicio que ya existe con el mismo id (respeta tus cambios)', async () => {
    await put(db, 'exercises', { ...DEFAULT_EXERCISES[0], name: 'Mi sentadilla' })
    await seedLibraryIfNeeded(db)
    expect((await get(db, 'exercises', DEFAULT_EXERCISES[0].id)).name).toBe('Mi sentadilla')
    expect(await getAll(db, 'exercises')).toHaveLength(DEFAULT_EXERCISES.length)
  })

  it('conserva los ejercicios que creaste tú', async () => {
    await put(db, 'exercises', { id: 'custom-1', name: 'Mío', muscleGroups: ['core'], resistanceType: 'resisted', scaleId: null })
    await seedLibraryIfNeeded(db)
    expect(await get(db, 'exercises', 'custom-1')).toBeDefined()
  })

  it('añade las escalas que falten sin tocar las que ya hay', async () => {
    // una app antigua: solo las escalas de bandas y kg, y una de ellas modificada
    await put(db, 'scales', { id: 'bands', name: 'Mis bandas', levels: [{ id: 'band-red', label: 'Roja' }] })
    await seedLibraryIfNeeded(db)
    const scales = await getAll(db, 'scales')
    expect(scales.map((s) => s.id).sort()).toEqual(DEFAULT_SCALES.map((s) => s.id).sort())
    expect((await get(db, 'scales', 'bands')).name).toBe('Mis bandas')
  })

  it('tras restaurar una copia antigua (sin biblioteca) la biblioteca vuelve a cargarse', async () => {
    await seedIfNeeded(db)
    await seedLibraryIfNeeded(db)
    // copia antigua: sin ejercicios y sin la marca
    await replaceAll(db, { scales: DEFAULT_SCALES.slice(0, 2), settings: [{ key: 'seeded', value: true }] })
    expect(await getAll(db, 'exercises')).toHaveLength(0)
    expect(await seedLibraryIfNeeded(db)).toBe(true)
    expect(await getAll(db, 'exercises')).toHaveLength(DEFAULT_EXERCISES.length)
    expect(await getAll(db, 'scales')).toHaveLength(DEFAULT_SCALES.length)
  })

  it('si la copia ya traía la marca, respeta que no haya ejercicios', async () => {
    await replaceAll(db, { settings: [{ key: 'exerciseLibrarySeeded', value: true }] })
    expect(await seedLibraryIfNeeded(db)).toBe(false)
    expect(await getAll(db, 'exercises')).toHaveLength(0)
  })

  it('puede ejecutarse dos veces a la vez sin duplicar nada', async () => {
    await Promise.all([seedLibraryIfNeeded(db), seedLibraryIfNeeded(db)])
    expect(await getAll(db, 'exercises')).toHaveLength(DEFAULT_EXERCISES.length)
  })
})

describe('seedIfNeeded (primera vez)', () => {
  it('incluye ya la escala de tobilleras', async () => {
    await seedIfNeeded(db)
    expect((await getAll(db, 'scales')).map((s) => s.id)).toContain('ankle-weights')
  })
})
