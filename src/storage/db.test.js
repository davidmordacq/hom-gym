import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createBackup, parseBackup } from '../core/backup.js'
import { DEFAULT_WEEK_PLAN } from '../core/defaultData.js'
import {
  exportAll, get, getAll, getAllByIndex, getSetting, openDb, put, putMany, remove, replaceAll, setSetting, writeAll,
} from './db.js'
import { seedIfNeeded } from './seed.js'

let db
let counter = 0
beforeEach(async () => {
  counter += 1
  db = await openDb(`test-db-${counter}`) // una base distinta en cada prueba
})

describe('guardar y leer', () => {
  it('guarda, lee y borra una fila', async () => {
    await put(db, 'exercises', { id: 'a', name: 'Dominadas' })
    expect(await get(db, 'exercises', 'a')).toEqual({ id: 'a', name: 'Dominadas' })
    await remove(db, 'exercises', 'a')
    expect(await get(db, 'exercises', 'a')).toBeUndefined()
  })

  it('put con el mismo id reemplaza la fila', async () => {
    await put(db, 'exercises', { id: 'a', name: 'Antes' })
    await put(db, 'exercises', { id: 'a', name: 'Después' })
    expect(await getAll(db, 'exercises')).toEqual([{ id: 'a', name: 'Después' }])
  })

  it('guarda varias filas a la vez', async () => {
    await putMany(db, 'exercises', [{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    expect(await getAll(db, 'exercises')).toHaveLength(3)
  })

  it('busca series por ejercicio y por sesión usando los índices', async () => {
    await putMany(db, 'sets', [
      { id: '1', exerciseId: 'dominadas', sessionId: 's1', reps: 10 },
      { id: '2', exerciseId: 'remo', sessionId: 's1', reps: 9 },
      { id: '3', exerciseId: 'dominadas', sessionId: 's2', reps: 8 },
    ])
    expect(await getAllByIndex(db, 'sets', 'exerciseId', 'dominadas')).toHaveLength(2)
    expect(await getAllByIndex(db, 'sets', 'sessionId', 's1')).toHaveLength(2)
  })

  it('los ajustes tienen valor por defecto si no existen', async () => {
    expect(await getSetting(db, 'theme', 'dark')).toBe('dark')
    await setSetting(db, 'theme', 'light')
    expect(await getSetting(db, 'theme', 'dark')).toBe('light')
  })

  it('los datos siguen ahí al volver a abrir la base de datos', async () => {
    await put(db, 'exercises', { id: 'a', name: 'Dominadas' })
    db.close()
    const again = await openDb(`test-db-${counter}`)
    expect(await get(again, 'exercises', 'a')).toEqual({ id: 'a', name: 'Dominadas' })
  })
})

describe('copia de seguridad: exportar e importar', () => {
  it('exportar e importar en otra base devuelve exactamente lo mismo', async () => {
    await putMany(db, 'exercises', [{ id: 'a', name: 'Dominadas', rules: { targetSets: 4 } }])
    await put(db, 'sets', { id: '1', exerciseId: 'a', sessionId: 's1', reps: 10, levelId: 'band-green' })
    await setSetting(db, 'theme', 'light')

    const text = JSON.stringify(createBackup(await exportAll(db)))

    counter += 1
    const other = await openDb(`test-db-${counter}`)
    await replaceAll(other, parseBackup(text).data)

    expect(await exportAll(other)).toEqual(await exportAll(db))
  })

  it('importar sustituye lo que había (no mezcla)', async () => {
    await put(db, 'exercises', { id: 'viejo', name: 'Viejo' })
    await put(db, 'sets', { id: 'x', exerciseId: 'viejo', sessionId: 's', reps: 5 })
    await replaceAll(db, { exercises: [{ id: 'nuevo', name: 'Nuevo' }] })
    expect((await getAll(db, 'exercises')).map((e) => e.id)).toEqual(['nuevo'])
    expect(await getAll(db, 'sets')).toEqual([]) // lo que no venía en la copia queda vacío
  })

  it('si la copia está mal, no se pierde nada de lo que había', async () => {
    await put(db, 'exercises', { id: 'a', name: 'Dominadas' })
    await expect(replaceAll(db, { exercises: [{ name: 'sin id' }] })).rejects.toThrow(/sin "id"/)
    await expect(replaceAll(db, { exercises: 'no es una lista' })).rejects.toThrow(/lista/)
    await expect(replaceAll(db, null)).rejects.toThrow()
    expect(await getAll(db, 'exercises')).toEqual([{ id: 'a', name: 'Dominadas' }])
  })

  it('ignora almacenes desconocidos de otra versión', async () => {
    await replaceAll(db, { exercises: [{ id: 'a' }], futuro: [{ id: 'z' }] })
    expect(await getAll(db, 'exercises')).toHaveLength(1)
  })
})

describe('datos de la primera vez', () => {
  it('se cargan una sola vez', async () => {
    expect(await seedIfNeeded(db)).toBe(true)
    expect(await getAll(db, 'plan')).toHaveLength(DEFAULT_WEEK_PLAN.length)
    expect(await getSetting(db, 'theme')).toBe('dark')

    await remove(db, 'plan', 'mon-strength') // el usuario edita su plan
    expect(await seedIfNeeded(db)).toBe(false) // no se vuelve a pisar
    expect(await getAll(db, 'plan')).toHaveLength(DEFAULT_WEEK_PLAN.length - 1)
  })

  it('los datos de partida incluyen escalas, reglas y objetivos', async () => {
    await seedIfNeeded(db)
    expect((await getAll(db, 'scales')).map((s) => s.id).sort()).toEqual(['ankle-weights', 'bands', 'kg'])
    expect((await getSetting(db, 'progressionRules')).repRange).toEqual({ min: 8, max: 10 })
    expect((await getSetting(db, 'goals')).strengthSessionsPerWeek).toBe(3)
  })

  it('writeAll sin clear añade sin borrar', async () => {
    await put(db, 'exercises', { id: 'a' })
    await writeAll(db, { exercises: [{ id: 'b' }] })
    expect(await getAll(db, 'exercises')).toHaveLength(2)
  })
})
