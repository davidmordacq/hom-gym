import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SCALES } from '../core/defaultData.js'
import { DEFAULT_EXERCISES, ORIGINAL_LIBRARY_IDS } from '../core/exerciseLibrary.js'
import { get, getAll, getSetting, openDb, put, putMany, remove, replaceAll } from './db.js'
import { seedIfNeeded, seedLibraryIfNeeded } from './seed.js'

let db
let counter = 0
beforeEach(async () => {
  counter += 1
  db = await openDb(`seed-test-db-${counter}`)
})

const NEW_IDS = DEFAULT_EXERCISES.map((e) => e.id).filter((id) => !ORIGINAL_LIBRARY_IDS.includes(id))
const idsOf = async () => (await getAll(db, 'exercises')).map((e) => e.id).sort()

/** Un móvil con la entrega 1b: tiene los 30 ejercicios originales y la marca antigua, pero no la lista de ofrecidos. */
async function phoneWithDelivery1b() {
  await seedIfNeeded(db)
  await putMany(db, 'exercises', DEFAULT_EXERCISES.filter((e) => ORIGINAL_LIBRARY_IDS.includes(e.id)))
  await put(db, 'settings', { key: 'exerciseLibrarySeeded', value: true })
}

describe('la biblioteca y las ofertas', () => {
  it('los 30 originales siguen en la biblioteca y hay ejercicios nuevos', () => {
    const ids = DEFAULT_EXERCISES.map((e) => e.id)
    for (const id of ORIGINAL_LIBRARY_IDS) expect(ids).toContain(id)
    expect(ORIGINAL_LIBRARY_IDS).toHaveLength(30)
    expect(NEW_IDS.length).toBeGreaterThan(0)
  })
})

describe('seedLibraryIfNeeded', () => {
  it('en una instalación nueva carga la biblioteca entera y apunta lo ofrecido', async () => {
    await seedIfNeeded(db)
    expect(await seedLibraryIfNeeded(db)).toBe(true)
    expect(await getAll(db, 'exercises')).toHaveLength(DEFAULT_EXERCISES.length)
    expect((await getSetting(db, 'offeredExerciseIds')).sort()).toEqual(DEFAULT_EXERCISES.map((e) => e.id).sort())
  })

  it('la segunda vez no hace nada (no recupera lo que borraste)', async () => {
    await seedLibraryIfNeeded(db)
    await remove(db, 'exercises', 'crunch')
    await remove(db, 'exercises', NEW_IDS[0])
    expect(await seedLibraryIfNeeded(db)).toBe(false)
    expect(await get(db, 'exercises', 'crunch')).toBeUndefined()
    expect(await get(db, 'exercises', NEW_IDS[0])).toBeUndefined()
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

  it('un móvil con la 1b recibe solo los ejercicios nuevos', async () => {
    await phoneWithDelivery1b()
    expect(await seedLibraryIfNeeded(db)).toBe(true)
    expect(await idsOf()).toEqual(DEFAULT_EXERCISES.map((e) => e.id).sort())
    expect(await seedLibraryIfNeeded(db)).toBe(false)
  })

  it('un móvil con la 1b que borró un ejercicio original no lo recupera', async () => {
    await phoneWithDelivery1b()
    await remove(db, 'exercises', 'crunch')
    await seedLibraryIfNeeded(db)
    expect(await get(db, 'exercises', 'crunch')).toBeUndefined()
    for (const id of NEW_IDS) expect(await get(db, 'exercises', id), id).toBeDefined()
  })

  it('un móvil con la 1b que editó un original conserva su edición', async () => {
    await phoneWithDelivery1b()
    await put(db, 'exercises', { ...DEFAULT_EXERCISES.find((e) => e.id === 'crunch'), name: 'Mi abdominal' })
    await seedLibraryIfNeeded(db)
    expect((await get(db, 'exercises', 'crunch')).name).toBe('Mi abdominal')
  })

  it('añade una escala que falta solo si la necesita un ejercicio nuevo', async () => {
    await phoneWithDelivery1b()
    await remove(db, 'scales', 'ankle-weights') // ningún ejercicio nuevo la usa: no debe volver
    await remove(db, 'scales', 'kg') // los ejercicios nuevos con kg la necesitan: vuelve
    await seedLibraryIfNeeded(db)
    const ids = (await getAll(db, 'scales')).map((s) => s.id)
    expect(ids).toContain('kg')
    expect(ids).not.toContain('ankle-weights')
  })

  it('no toca una escala existente aunque la hayas cambiado', async () => {
    await put(db, 'scales', { id: 'bands', name: 'Mis bandas', levels: [{ id: 'band-red', label: 'Roja' }] })
    await seedLibraryIfNeeded(db)
    expect((await get(db, 'scales', 'bands')).name).toBe('Mis bandas')
  })

  it('tras restaurar una copia antigua (sin biblioteca ni marcas) la biblioteca vuelve a cargarse', async () => {
    await seedIfNeeded(db)
    await seedLibraryIfNeeded(db)
    await replaceAll(db, { scales: DEFAULT_SCALES.slice(0, 2), settings: [{ key: 'seeded', value: true }] })
    expect(await getAll(db, 'exercises')).toHaveLength(0)
    expect(await seedLibraryIfNeeded(db)).toBe(true)
    expect(await getAll(db, 'exercises')).toHaveLength(DEFAULT_EXERCISES.length)
    expect((await getAll(db, 'scales')).map((s) => s.id)).toEqual(expect.arrayContaining(['bands', 'kg']))
  })

  it('una copia con la lista de ofrecidos completa respeta que no haya ejercicios', async () => {
    await replaceAll(db, { settings: [{ key: 'offeredExerciseIds', value: DEFAULT_EXERCISES.map((e) => e.id) }] })
    expect(await seedLibraryIfNeeded(db)).toBe(false)
    expect(await getAll(db, 'exercises')).toHaveLength(0)
  })

  it('una copia de la 1b sin ejercicios recibe solo los nuevos', async () => {
    await replaceAll(db, { settings: [{ key: 'exerciseLibrarySeeded', value: true }] })
    await seedLibraryIfNeeded(db)
    expect(await idsOf()).toEqual([...NEW_IDS].sort())
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
