import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { get, getAll, getSetting, openDb, put, remove } from './db.js'
import { disconnectIntervals, fetchActivities, ignoreImportedSession, saveIntervalsCredentials, syncIntervals } from './intervalsSync.js'

let db
let counter = 0
beforeEach(async () => {
  counter += 1
  db = await openDb(`intervals-test-db-${counter}`)
})

const NOW = new Date('2026-11-09T12:00:00Z')
const ride = (id, extra = {}) => ({ id, type: 'Ride', name: `Salida ${id}`, start_date_local: '2026-11-08T08:30:12', moving_time: 3600, icu_training_load: 55.4, trainer: false, ...extra })
const respond = (body, status = 200) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })

/** Un "fetch" falso que apunta las llamadas que recibe. */
function fake(body, status) {
  const calls = []
  const impl = respond(body, status)
  return { calls, impl: async (url, options) => (calls.push({ url, options }), impl()) }
}

describe('fetchActivities', () => {
  it('pide la lista con la clave en la cabecera y devuelve las actividades', async () => {
    const f = fake([ride('i1')])
    const result = await fetchActivities({ key: 'abc', oldest: '2026-10-01', newest: '2026-11-10', fetchImpl: f.impl })
    expect(result).toHaveLength(1)
    expect(f.calls[0].url).toBe('https://intervals.icu/api/v1/athlete/0/activities?oldest=2026-10-01&newest=2026-11-10')
    expect(f.calls[0].options.headers.Authorization).toBe(`Basic ${btoa('API_KEY:abc')}`)
  })

  it('traduce los errores a mensajes claros en español', async () => {
    const msg = async (status, body = {}) => fetchActivities({ key: 'x', oldest: '2026-10-01', fetchImpl: respond(body, status) }).catch((e) => e.message)
    expect(await msg(401)).toMatch(/no acepta esa clave/)
    expect(await msg(403)).toMatch(/no acepta esa clave/)
    expect(await msg(404)).toMatch(/no encuentra ese atleta/)
    expect(await msg(422)).toMatch(/no encuentra ese atleta/)
    expect(await msg(500)).toMatch(/error \(500\)/)
    expect(await msg(200, { no: 'es una lista' })).toMatch(/inesperada/)
  })

  it('sin conexión da un mensaje claro y sin detalles técnicos', async () => {
    const offline = async () => {
      throw new TypeError('Failed to fetch')
    }
    const error = await fetchActivities({ key: 'x', oldest: '2026-10-01', fetchImpl: offline }).catch((e) => e)
    expect(error.message).toMatch(/Comprueba tu conexión/)
    expect(error.message).not.toMatch(/Failed to fetch/)
  })

  it('una respuesta que no es JSON se explica', async () => {
    const broken = async () => ({ ok: true, status: 200, json: async () => { throw new Error('mal') } })
    expect((await fetchActivities({ key: 'x', oldest: '2026-10-01', fetchImpl: broken }).catch((e) => e)).message).toMatch(/no se entiende/)
  })
})

describe('syncIntervals', () => {
  async function connected(extra = {}) {
    await saveIntervalsCredentials(db, { key: 'MI-CLAVE', ...extra })
  }

  it('sin clave guardada no hace nada y lo dice', async () => {
    const f = fake([])
    await expect(syncIntervals(db, { now: NOW, fetchImpl: f.impl })).rejects.toThrow(/Falta la clave/)
    expect(f.calls).toHaveLength(0)
  })

  it('trae las salidas, las guarda como sesiones de bici y apunta cuándo se hizo', async () => {
    await connected()
    const f = fake([ride('i1'), ride('i2', { trainer: true, start_date_local: '2026-11-04T07:00:00' }), ride('i3', { type: 'Run' }), ride('i4', { moving_time: 300 })])
    const result = await syncIntervals(db, { now: NOW, fetchImpl: f.impl })
    expect(result).toMatchObject({ added: 2, updated: 0 })
    expect(result.summary).toMatch(/2 salidas nuevas/)
    const sessions = await getAll(db, 'sessions')
    expect(sessions.map((s) => [s.id, s.type, s.durationMin, s.tss]).sort()).toEqual([
      ['intervals-i1', 'bike_outdoor', 60, 55],
      ['intervals-i2', 'bike_trainer', 60, 55],
    ])
    expect(await getSetting(db, 'intervalsLastSyncAt')).toBe(NOW.toISOString())
    expect(await getSetting(db, 'intervalsLastResult')).toMatchObject({ ok: true })
  })

  it('sincronizar otra vez no duplica nada, y repasa desde unos días antes de la última sincronización', async () => {
    await connected()
    const f = fake([ride('i1')])
    await syncIntervals(db, { now: NOW, fetchImpl: f.impl })
    const second = await syncIntervals(db, { now: new Date('2026-11-10T09:00:00Z'), fetchImpl: f.impl })
    expect(second).toMatchObject({ added: 0, unchanged: 1 })
    expect(await getAll(db, 'sessions')).toHaveLength(1)
    expect(f.calls[0].url).toContain('oldest=2026-08-11') // la primera vez: 90 días
    expect(f.calls[1].url).toContain('oldest=2026-10-26') // la segunda: 14 días antes de la primera sincronización
  })

  it('"último año" pide un año entero', async () => {
    await connected()
    const f = fake([])
    await syncIntervals(db, { now: NOW, fullYear: true, fetchImpl: f.impl })
    expect(f.calls[0].url).toContain('oldest=2025-11-09')
  })

  it('usa el ID de atleta guardado', async () => {
    await connected({ athleteId: 'i12345' })
    const f = fake([])
    await syncIntervals(db, { now: NOW, fetchImpl: f.impl })
    expect(f.calls[0].url).toContain('/athlete/i12345/activities')
  })

  it('actualiza lo que cambió en Intervals y conserva las notas que escribiste', async () => {
    await connected()
    await syncIntervals(db, { now: NOW, fetchImpl: fake([ride('i1')]).impl })
    await put(db, 'sessions', { ...(await get(db, 'sessions', 'intervals-i1')), notes: 'mi nota' })
    const result = await syncIntervals(db, { now: NOW, fetchImpl: fake([ride('i1', { icu_training_load: 90 })]).impl })
    expect(result.updated).toBe(1)
    expect(await get(db, 'sessions', 'intervals-i1')).toMatchObject({ tss: 90, notes: 'mi nota' })
  })

  it('una salida importada que borraste a propósito no vuelve', async () => {
    await connected()
    await syncIntervals(db, { now: NOW, fetchImpl: fake([ride('i1')]).impl })
    await remove(db, 'sessions', 'intervals-i1')
    await ignoreImportedSession(db, 'intervals-i1')
    await ignoreImportedSession(db, 'intervals-i1') // dos veces no la repite
    expect(await getSetting(db, 'intervalsIgnoredIds')).toEqual(['intervals-i1'])
    const result = await syncIntervals(db, { now: NOW, fetchImpl: fake([ride('i1')]).impl })
    expect(result.added).toBe(0)
    expect(await getAll(db, 'sessions')).toHaveLength(0)
  })

  it('avisa si una nueva parece ya anotada a mano, y no toca la tuya', async () => {
    await connected()
    await put(db, 'sessions', { id: 'mano', type: 'bike_outdoor', status: 'done', date: '2026-11-08', durationMin: 62, tss: 50, notes: '' })
    const result = await syncIntervals(db, { now: NOW, fetchImpl: fake([ride('i1')]).impl })
    expect(result.possibleDuplicates).toBe(1)
    expect(result.summary).toMatch(/ya las tenías|ya la tenías/)
    expect(await get(db, 'sessions', 'mano')).toBeDefined()
  })

  it('si falla, no guarda nada, lanza un mensaje claro y lo apunta; la siguiente vez vuelve a pedir lo mismo', async () => {
    await connected()
    await expect(syncIntervals(db, { now: NOW, fetchImpl: respond({}, 401) })).rejects.toThrow(/no acepta esa clave/)
    expect(await getAll(db, 'sessions')).toHaveLength(0)
    expect(await getSetting(db, 'intervalsLastSyncAt')).toBeNull()
    expect(await getSetting(db, 'intervalsLastResult')).toMatchObject({ ok: false })
  })

  it('el mensaje de error de red no enseña detalles técnicos', async () => {
    await connected()
    const offline = async () => {
      throw new TypeError('NetworkError when attempting to fetch resource')
    }
    await expect(syncIntervals(db, { now: NOW, fetchImpl: offline })).rejects.toThrow(/Comprueba tu conexión/)
  })
})

describe('guardar y quitar la clave', () => {
  it('guarda la clave sin espacios y el ID (o "0" si se deja vacío)', async () => {
    await saveIntervalsCredentials(db, { key: '  abc123  ', athleteId: '  ' })
    expect(await getSetting(db, 'intervalsApiKey')).toBe('abc123')
    expect(await getSetting(db, 'intervalsAthleteId')).toBe('0')
    await saveIntervalsCredentials(db, { key: 'abc123', athleteId: ' i77 ' })
    expect(await getSetting(db, 'intervalsAthleteId')).toBe('i77')
  })

  it('no guarda una clave vacía', async () => {
    await expect(saveIntervalsCredentials(db, { key: '   ' })).rejects.toThrow(/Escribe tu clave/)
    expect(await getSetting(db, 'intervalsApiKey')).toBeNull()
  })

  it('quitar la conexión borra la clave pero deja las salidas ya importadas', async () => {
    await saveIntervalsCredentials(db, { key: 'abc' })
    await syncIntervals(db, { now: NOW, fetchImpl: fake([ride('i1')]).impl })
    await disconnectIntervals(db)
    expect(await getSetting(db, 'intervalsApiKey')).toBeNull()
    expect(await getAll(db, 'sessions')).toHaveLength(1)
  })
})
