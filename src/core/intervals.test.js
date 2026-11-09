import { describe, expect, it } from 'vitest'
import { activitiesUrl, authHeader, autoSyncDue, importSummaryText, mapActivity, planImport, syncRange } from './intervals.js'

const ride = (extra = {}) => ({
  id: 'i100', type: 'Ride', name: 'Larga por la sierra', start_date_local: '2026-11-08T08:30:12', moving_time: 15302,
  elapsed_time: 18234, icu_training_load: 202.4, trainer: false, distance: 120688, ...extra,
})

describe('activitiesUrl y authHeader', () => {
  it('pide el rango de fechas al atleta "0" (el dueño de la clave) por defecto', () => {
    expect(activitiesUrl({ oldest: '2026-10-01', newest: '2026-11-10' })).toBe(
      'https://intervals.icu/api/v1/athlete/0/activities?oldest=2026-10-01&newest=2026-11-10',
    )
    expect(activitiesUrl({ oldest: '2026-10-01' })).toBe('https://intervals.icu/api/v1/athlete/0/activities?oldest=2026-10-01')
  })
  it('un identificador de atleta propio se usa tal cual (y se protege)', () => {
    expect(activitiesUrl({ athleteId: ' i12345 ', oldest: '2026-10-01' })).toContain('/athlete/i12345/activities')
    expect(activitiesUrl({ athleteId: '', oldest: '2026-10-01' })).toContain('/athlete/0/activities')
    expect(activitiesUrl({ athleteId: 'a/b?x', oldest: '2026-10-01' })).toContain('/athlete/a%2Fb%3Fx/activities')
  })
  it('la cabecera usa el usuario API_KEY y la clave como contraseña', () => {
    expect(authHeader(' miclave ', (t) => `b64(${t})`)).toBe('Basic b64(API_KEY:miclave)')
    expect(authHeader('abc')).toBe(`Basic ${btoa('API_KEY:abc')}`)
  })
})

describe('syncRange', () => {
  const now = new Date('2026-11-09T12:00:00Z')
  it('la primera vez pide 90 días', () => {
    expect(syncRange({ now })).toEqual({ oldest: '2026-08-11', newest: '2026-11-10' })
  })
  it('después repasa desde 14 días antes de la última sincronización', () => {
    expect(syncRange({ now, lastSyncAt: '2026-11-08T10:00:00Z' }).oldest).toBe('2026-10-25')
  })
  it('"último año" pide 365 días', () => {
    expect(syncRange({ now, fullYear: true, lastSyncAt: '2026-11-08T10:00:00Z' }).oldest).toBe('2025-11-09')
  })
  it('una fecha de última sincronización rota se trata como la primera vez', () => {
    expect(syncRange({ now, lastSyncAt: 'ayer' }).oldest).toBe('2026-08-11')
  })
})

describe('mapActivity', () => {
  it('convierte una salida: minutos de movimiento, carga como TSS, nombre y fecha local', () => {
    const { session } = mapActivity(ride())
    expect(session).toMatchObject({
      id: 'intervals-i100', type: 'bike_outdoor', status: 'done', date: '2026-11-08', name: 'Larga por la sierra', durationMin: 255,
      tss: 202, source: 'intervals', externalId: 'i100', notes: '', slotId: null,
    })
  })

  it('rodillo si Intervals lo marca así o si es una salida virtual', () => {
    expect(mapActivity(ride({ trainer: true })).session.type).toBe('bike_trainer')
    expect(mapActivity(ride({ type: 'VirtualRide', trainer: false })).session.type).toBe('bike_trainer')
    expect(mapActivity(ride({ type: 'GravelRide' })).session.type).toBe('bike_outdoor')
    expect(mapActivity(ride({ type: 'MountainBikeRide' })).session.type).toBe('bike_outdoor')
  })

  it('sin carga de entrenamiento, el TSS queda vacío (no 0)', () => {
    expect(mapActivity(ride({ icu_training_load: null })).session.tss).toBeNull()
    expect(mapActivity(ride({ icu_training_load: undefined })).session.tss).toBeNull()
    expect(mapActivity(ride({ icu_training_load: 0 })).session.tss).toBe(0)
  })

  it('si falta el tiempo de movimiento usa el tiempo total; sin nombre pone uno', () => {
    expect(mapActivity(ride({ moving_time: undefined, elapsed_time: 3600 })).session.durationMin).toBe(60)
    expect(mapActivity(ride({ name: '  ' })).session.name).toBe('Bici outdoor')
    expect(mapActivity(ride({ name: null, trainer: true })).session.name).toBe('Bici en rodillo')
  })

  it('ignora lo que no es bici, lo muy corto y lo que no se entiende', () => {
    expect(mapActivity(ride({ type: 'Run' }))).toEqual({ skipped: 'notBike' })
    expect(mapActivity(ride({ type: 'WeightTraining' }))).toEqual({ skipped: 'notBike' })
    expect(mapActivity(ride({ moving_time: 374 }))).toEqual({ skipped: 'tooShort' }) // 6 minutos
    expect(mapActivity(ride({ moving_time: 569 }))).toEqual({ skipped: 'tooShort' }) // 9,48 min se redondea a 9
    expect(mapActivity(ride({ moving_time: 570 })).session.durationMin).toBe(10) // 9,5 min se redondea a 10
    expect(mapActivity(ride({ start_date_local: 'mal' }))).toEqual({ skipped: 'invalid' })
    expect(mapActivity(ride({ moving_time: 'x', elapsed_time: undefined }))).toEqual({ skipped: 'invalid' })
    expect(mapActivity({ type: 'Ride' })).toEqual({ skipped: 'invalid' })
    expect(mapActivity(null)).toEqual({ skipped: 'invalid' })
  })

  it('un identificador numérico también vale', () => {
    expect(mapActivity(ride({ id: 987654321 })).session.id).toBe('intervals-987654321')
  })
})

describe('planImport', () => {
  const manual = (extra = {}) => ({ id: 'manual-1', type: 'bike_outdoor', status: 'done', date: '2026-11-08', durationMin: 250, tss: 200, notes: 'mía', ...extra })

  it('las salidas nuevas se añaden y se cuentan', () => {
    const r = planImport({ activities: [ride(), ride({ id: 'i101', start_date_local: '2026-11-07T08:00:00' })], existing: [] })
    expect(r).toMatchObject({ added: 2, updated: 0, unchanged: 0, possibleDuplicates: 0 })
    expect(r.toSave.map((s) => s.id)).toEqual(['intervals-i100', 'intervals-i101'])
  })

  it('sincronizar dos veces no duplica: lo ya importado y sin cambios no se vuelve a guardar', () => {
    const first = planImport({ activities: [ride()], existing: [] })
    const again = planImport({ activities: [ride()], existing: first.toSave })
    expect(again).toMatchObject({ added: 0, updated: 0, unchanged: 1, toSave: [] })
  })

  it('si la salida cambió en Intervals se actualiza y se conservan tus notas', () => {
    const [saved] = planImport({ activities: [ride()], existing: [] }).toSave
    const withNotes = { ...saved, notes: 'viento fuerte' }
    const r = planImport({ activities: [ride({ icu_training_load: 230, name: 'Larga corregida' })], existing: [withNotes] })
    expect(r).toMatchObject({ added: 0, updated: 1 })
    expect(r.toSave[0]).toMatchObject({ tss: 230, name: 'Larga corregida', notes: 'viento fuerte', id: 'intervals-i100' })
  })

  it('una salida que borraste a propósito no vuelve', () => {
    const r = planImport({ activities: [ride()], existing: [], ignoredIds: ['intervals-i100'] })
    expect(r).toMatchObject({ added: 0, toSave: [] })
    expect(r.skipped.ignored).toBe(1)
  })

  it('cuenta lo que se ignora por tipo, por corto o por no entenderse', () => {
    const r = planImport({ activities: [ride({ id: 'a', type: 'Run' }), ride({ id: 'b', moving_time: 300 }), {}, ride({ id: 'd' })], existing: [] })
    expect(r.skipped).toEqual({ notBike: 1, tooShort: 1, invalid: 1, ignored: 0 })
    expect(r.added).toBe(1)
  })

  it('la misma salida repetida en la respuesta solo cuenta una vez', () => {
    expect(planImport({ activities: [ride(), ride()], existing: [] }).added).toBe(1)
  })

  it('avisa de las nuevas que parecen estar ya anotadas a mano, sin tocar las tuyas', () => {
    const r = planImport({ activities: [ride()], existing: [manual()] })
    expect(r.possibleDuplicates).toBe(1)
    expect(r.toSave).toHaveLength(1)
    expect(r.toSave.every((s) => s.source === 'intervals')).toBe(true)
  })

  it('no se considera repetida si el día, el tipo o la duración son muy distintos', () => {
    expect(planImport({ activities: [ride()], existing: [manual({ date: '2026-11-07' })] }).possibleDuplicates).toBe(0)
    expect(planImport({ activities: [ride()], existing: [manual({ type: 'mobility' })] }).possibleDuplicates).toBe(0)
    expect(planImport({ activities: [ride()], existing: [manual({ durationMin: 60 })] }).possibleDuplicates).toBe(0)
    expect(planImport({ activities: [ride()], existing: [manual({ status: 'skipped' })] }).possibleDuplicates).toBe(0)
    expect(planImport({ activities: [ride()], existing: [manual({ source: 'intervals' })] }).possibleDuplicates).toBe(0)
  })

  it('una bici outdoor anotada a mano y una importada de rodillo ese día cuentan como parecidas (misma familia)', () => {
    expect(planImport({ activities: [ride({ trainer: true })], existing: [manual()] }).possibleDuplicates).toBe(1)
  })

  it('una respuesta vacía no hace nada', () => {
    expect(planImport({ activities: [], existing: [] })).toMatchObject({ added: 0, updated: 0, unchanged: 0, toSave: [] })
  })
})

describe('importSummaryText', () => {
  const base = { added: 0, updated: 0, unchanged: 0, skipped: { tooShort: 0 }, possibleDuplicates: 0 }
  it('cuenta lo nuevo y lo actualizado con singular y plural', () => {
    expect(importSummaryText({ ...base, added: 3, updated: 1 })).toBe('3 salidas nuevas, 1 actualizada')
    expect(importSummaryText({ ...base, added: 1 })).toBe('1 salida nueva')
  })
  it('sin novedades lo dice', () => {
    expect(importSummaryText(base)).toBe('Todo al día, no hay salidas nuevas')
  })
  it('menciona las cortas ignoradas y las posibles repetidas', () => {
    const text = importSummaryText({ ...base, added: 2, skipped: { tooShort: 1 }, possibleDuplicates: 2 })
    expect(text).toContain('1 ignorada por durar menos de 10 min')
    expect(text).toContain('2 parece que ya las tenías anotadas a mano')
  })
})

describe('autoSyncDue (sincronizar al abrir la app)', () => {
  const now = new Date('2026-11-09T12:00:00Z')
  it('si nunca se sincronizó, toca', () => {
    expect(autoSyncDue(null, now)).toBe(true)
    expect(autoSyncDue('ayer', now)).toBe(true)
  })
  it('toca a partir de 6 horas', () => {
    expect(autoSyncDue('2026-11-09T06:00:00Z', now)).toBe(true)
    expect(autoSyncDue('2026-11-09T06:00:01Z', now)).toBe(false)
    expect(autoSyncDue('2026-11-09T11:59:00Z', now)).toBe(false)
    expect(autoSyncDue('2026-11-05T12:00:00Z', now)).toBe(true)
  })
})
