import { describe, expect, it } from 'vitest'
import { DEFAULT_SCALES } from './defaultData.js'
import { DEFAULT_EXERCISES } from './exerciseLibrary.js'
import {
  BIKE_FILTERS, CORE_REST_FRACTION, bikeSummary, bucketLabel, chartRows, exerciseProgress, exercisesWithHistory,
  formatHours, formatMetric, groupTable, makeBuckets, rangeBounds, sessionStats, summarize,
} from './analysis.js'

const exercises = DEFAULT_EXERCISES
const bands = DEFAULT_SCALES.find((s) => s.id === 'bands')
const ex = (id) => exercises.find((e) => e.id === id)
const at = (time, day = '2026-11-09') => `${day}T${time}Z`

const session = (id, date, extra = {}) => ({
  id, type: 'strength', status: 'done', date, startedAt: at('18:00:00', date), endedAt: at('19:00:00', date), restSeconds: 120,
  exercises: [
    { exerciseId: 'push-up', coreExerciseId: 'reverse-crunch' },
    { exerciseId: 'assisted-pull-up', coreExerciseId: 'dead-bug' },
  ],
  ...extra,
})
const set = (sessionId, exerciseId, order, reps, time, extra = {}) => ({
  id: `${sessionId}:${exerciseId}:${order}`, sessionId, exerciseId, order, reps, levelId: null, completedAt: at(time), coreAfter: false, ...extra,
})

describe('sessionStats: el tiempo real se reparte por ejercicio y grupo principal', () => {
  it('cada ejercicio cuenta desde el fin del anterior hasta su última serie', () => {
    const s = session('s1', '2026-11-09')
    const sets = [
      set('s1', 'push-up', 1, 10, '18:01:00'), set('s1', 'push-up', 2, 9, '18:04:00'), set('s1', 'push-up', 3, 8, '18:07:00'),
      set('s1', 'assisted-pull-up', 1, 7, '18:10:00'), set('s1', 'assisted-pull-up', 2, 6, '18:13:00'),
    ]
    const { byGroup, trackedSeconds } = sessionStats(s, sets, exercises)
    expect(byGroup.chest.seconds).toBe(420) // 18:00 → 18:07
    expect(byGroup.back.seconds).toBe(360) // 18:07 → 18:13
    expect(trackedSeconds).toBe(780)
    expect(byGroup.chest).toMatchObject({ sets: 3, reps: 27 })
    expect(byGroup.back).toMatchObject({ sets: 2, reps: 13 })
    expect(byGroup.core).toBeUndefined()
  })

  it('lo que pasa después de la última serie no cuenta', () => {
    const s = session('s1', '2026-11-09', { endedAt: at('19:30:00') })
    const { trackedSeconds } = sessionStats(s, [set('s1', 'push-up', 1, 10, '18:05:00')], exercises)
    expect(trackedSeconds).toBe(300)
  })

  it('un ejercicio sin series no cuenta; el tiempo lo absorbe el siguiente que sí tiene', () => {
    const s = session('s1', '2026-11-09')
    const { byGroup } = sessionStats(s, [set('s1', 'assisted-pull-up', 1, 7, '18:06:00')], exercises)
    expect(byGroup.back.seconds).toBe(360)
    expect(byGroup.chest).toBeUndefined()
  })

  it('el orden lo marca la hora de la última serie, no el orden de la lista', () => {
    const s = session('s1', '2026-11-09')
    const sets = [set('s1', 'assisted-pull-up', 1, 7, '18:05:00'), set('s1', 'push-up', 1, 10, '18:09:00')]
    const { byGroup } = sessionStats(s, sets, exercises)
    expect(byGroup.back.seconds).toBe(300)
    expect(byGroup.chest.seconds).toBe(240)
  })

  describe('core en los descansos (75 % del descanso, restado del ejercicio)', () => {
    const sets = [
      set('s1', 'push-up', 1, 10, '18:01:00', { coreAfter: true }),
      set('s1', 'push-up', 2, 9, '18:04:00', { coreAfter: true }),
      set('s1', 'push-up', 3, 8, '18:07:00', { coreAfter: true }), // tras la última serie: cae en el bloque siguiente
      set('s1', 'assisted-pull-up', 1, 7, '18:10:00', { coreAfter: true }),
      set('s1', 'assisted-pull-up', 2, 6, '18:13:00'),
    ]

    it('con 2 minutos de descanso, el core cuenta 1 minuto y medio', () => {
      expect(CORE_REST_FRACTION).toBe(0.75)
      expect(Math.round(120 * CORE_REST_FRACTION)).toBe(90)
    })

    it('se cuenta para el core y se resta del ejercicio cuyo bloque contiene ese descanso', () => {
      const { byGroup, trackedSeconds } = sessionStats(session('s1', '2026-11-09'), sets, exercises)
      // bloque de flexiones: 420 s con 2 descansos con core (180); bloque de dominadas: 360 s con 2 (180)
      expect(byGroup.chest.seconds).toBe(240)
      expect(byGroup.back.seconds).toBe(180)
      expect(byGroup.core.seconds).toBe(360)
      expect(byGroup.core.sets).toBe(4)
      // el tiempo total no se duplica
      expect(byGroup.chest.seconds + byGroup.back.seconds + byGroup.core.seconds).toBe(trackedSeconds)
    })

    it('el core no suma repeticiones', () => {
      expect(sessionStats(session('s1', '2026-11-09'), sets, exercises).byGroup.core.reps).toBe(0)
    })

    it('usa el descanso que había al empezar la sesión (60 s → 45 s de core)', () => {
      const { byGroup } = sessionStats(session('s1', '2026-11-09', { restSeconds: 60 }), [set('s1', 'push-up', 1, 10, '18:05:00', { coreAfter: true }), set('s1', 'push-up', 2, 9, '18:08:00')], exercises)
      expect(byGroup.core.seconds).toBe(45)
      expect(byGroup.chest.seconds).toBe(480 - 45)
    })

    it('un ejercicio con su propio descanso (a una pierna, 60 s) cuenta 45 s de core aunque la sesión sea de 2 min', () => {
      const own = session('s1', '2026-11-09', {
        exercises: [{ exerciseId: 'push-up', coreExerciseId: 'dead-bug', restSeconds: 60 }, { exerciseId: 'assisted-pull-up', coreExerciseId: 'dead-bug' }],
      })
      const { byGroup } = sessionStats(own, [set('s1', 'push-up', 1, 10, '18:05:00', { coreAfter: true }), set('s1', 'push-up', 2, 9, '18:08:00')], exercises)
      expect(byGroup.core.seconds).toBe(45)
    })

    it('si la sesión es antigua y no guardó el descanso, supone 2 minutos', () => {
      const old = session('s1', '2026-11-09')
      delete old.restSeconds
      const { byGroup } = sessionStats(old, [set('s1', 'push-up', 1, 10, '18:05:00', { coreAfter: true }), set('s1', 'push-up', 2, 9, '18:08:00')], exercises)
      expect(byGroup.core.seconds).toBe(90)
    })

    it('nunca resta más de lo que dura el bloque', () => {
      const { byGroup } = sessionStats(session('s1', '2026-11-09'), [set('s1', 'push-up', 1, 10, '18:00:30', { coreAfter: true }), set('s1', 'push-up', 2, 9, '18:00:40')], exercises)
      expect(byGroup.core.seconds).toBe(40) // el bloque entero dura 40 s
      expect(byGroup.chest.seconds).toBe(0)
    })

    it('el core del descanso final (sin ejercicio después) cuenta entero y no resta a nadie', () => {
      const { byGroup } = sessionStats(session('s1', '2026-11-09'), [set('s1', 'push-up', 1, 10, '18:02:00', { coreAfter: true })], exercises)
      expect(byGroup.core.seconds).toBe(90)
      expect(byGroup.chest.seconds).toBe(120)
    })
  })

  it('sin hora de inicio válida no se inventa tiempo, pero sí se cuentan series y repeticiones', () => {
    const { byGroup } = sessionStats(session('s1', '2026-11-09', { startedAt: null }), [set('s1', 'push-up', 1, 10, '18:05:00')], exercises)
    expect(byGroup.chest).toEqual({ seconds: 0, sets: 1, reps: 10 })
  })

  it('los ejercicios en segundos (plancha) cuentan series pero no repeticiones', () => {
    const s = session('s1', '2026-11-09', { exercises: [{ exerciseId: 'plank', coreExerciseId: null }] })
    const { byGroup } = sessionStats(s, [set('s1', 'plank', 1, 40, '18:02:00')], exercises)
    expect(byGroup.core).toMatchObject({ sets: 1, reps: 0, seconds: 120 })
  })

  it('ignora las series de otras sesiones', () => {
    const { byGroup } = sessionStats(session('s1', '2026-11-09'), [set('otra', 'push-up', 1, 10, '18:05:00')], exercises)
    expect(byGroup).toEqual({})
  })
})

describe('periodos y cubos', () => {
  const now = new Date(2026, 10, 9)

  it('rangeBounds: 4 semanas son 28 días contando hoy', () => {
    expect(rangeBounds('4w', now)).toEqual({ from: '2026-10-13', to: '2026-11-09' })
    expect(rangeBounds('1y', now).from).toBe('2025-11-10')
  })

  it('rangeBounds "todo" empieza en la primera sesión (o hoy si no hay ninguna)', () => {
    expect(rangeBounds('all', now, '2026-09-01').from).toBe('2026-09-01')
    expect(rangeBounds('all', now, null).from).toBe('2026-11-09')
    expect(rangeBounds('all', now, '2027-01-01').from).toBe('2026-11-09')
  })

  it('un periodo desconocido usa 3 meses', () => {
    expect(rangeBounds('xx', now).from).toBe(rangeBounds('3m', now).from)
  })

  it('makeBuckets por semana: lunes de cada semana, incluida la que contiene el primer día', () => {
    expect(makeBuckets('2026-11-04', '2026-11-10', 'week', now).map((b) => b.key)).toEqual(['2026-11-02', '2026-11-09'])
    expect(makeBuckets('2026-11-02', '2026-11-15', 'week', now).map((b) => b.key)).toEqual(['2026-11-02', '2026-11-09'])
    expect(makeBuckets('2026-11-09', '2026-11-09', 'week', now).map((b) => b.key)).toEqual(['2026-11-09'])
  })

  it('makeBuckets por mes cruza años y devuelve también los meses vacíos', () => {
    expect(makeBuckets('2026-10-15', '2027-01-02', 'month', now).map((b) => b.key)).toEqual(['2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01'])
  })

  it('las etiquetas son cortas: "9 nov"; el mes lleva el año si no es el actual', () => {
    expect(bucketLabel('2026-11-09', 'week', now)).toBe('9 nov')
    expect(bucketLabel('2026-11-01', 'month', now)).toBe('nov')
    expect(bucketLabel('2025-12-01', 'month', now)).toBe('dic 25')
  })
})

describe('summarize y chartRows', () => {
  const now = new Date(2026, 10, 9)
  const s1 = session('s1', '2026-11-02') // semana del 2 nov
  const s2 = session('s2', '2026-11-09') // semana del 9 nov
  const sessions = [s1, s2, session('old', '2026-09-01'), session('run', '2026-11-09', { status: 'in_progress' }), { id: 'b', type: 'bike_trainer', status: 'done', date: '2026-11-09', durationMin: 60 }]
  const sets = [
    set('s1', 'push-up', 1, 10, '18:30:00'), set('s1', 'push-up', 2, 10, '18:33:00'),
    { ...set('s2', 'assisted-pull-up', 1, 8, '18:10:00'), completedAt: at('18:10:00', '2026-11-09') },
    { ...set('s2', 'push-up', 1, 5, '18:20:00'), completedAt: at('18:20:00', '2026-11-09'), coreAfter: true },
    { ...set('s1', 'push-up', 1, 99, '18:30:00'), id: 'x', sessionId: 'old' },
    { ...set('run', 'push-up', 1, 99, '18:30:00') },
  ]
  // s1 empezó 18:00 el 2 nov y sus series llevan fecha 9 nov: se corrigen para que cuadren
  sets[0].completedAt = at('18:30:00', '2026-11-02')
  sets[1].completedAt = at('18:33:00', '2026-11-02')
  const summary = summarize({ sessions, sets, exercises, from: '2026-10-13', to: '2026-11-09', grain: 'week', now })

  it('reparte en cubos semanales (4 semanas, también las vacías) y solo cuenta sesiones de fuerza hechas del periodo', () => {
    expect(summary.buckets.map((b) => b.key)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'])
    expect(summary.buckets[0].groups).toEqual({})
    expect(summary.totals.chest.sets).toBe(3) // 2 de s1 + 1 de s2; no las de "old", "run" ni la bici
    expect(summary.totals.chest.reps).toBe(25)
  })

  it('una semana tiene lo suyo', () => {
    expect(summary.buckets[3].groups.chest).toMatchObject({ sets: 2, reps: 20, seconds: 33 * 60 })
    expect(summary.buckets[4].groups.back).toMatchObject({ sets: 1, reps: 8, seconds: 600 })
  })

  it('por mes junta todo el mes', () => {
    const month = summarize({ sessions, sets, exercises, from: '2026-10-13', to: '2026-11-09', grain: 'month', now })
    expect(month.buckets.map((b) => b.key)).toEqual(['2026-10-01', '2026-11-01'])
    expect(month.buckets[1].groups.chest.sets).toBe(3)
  })

  it('chartRows por región da horas por superior, inferior y core', () => {
    const rows = chartRows(summary, { by: 'region', metric: 'hours' })
    expect(rows.series.map((x) => x.id)).toEqual(['upper', 'lower', 'core'])
    expect(rows.rows).toHaveLength(5)
    const last = rows.rows[4]
    // semana del 9 nov: dominadas 600 s + flexiones 600 s, de los que 90 son core (flexiones, descanso final)
    expect(last.values.core).toBeCloseTo(90 / 3600, 5)
    expect(last.values.upper).toBeCloseTo((1200 - 0) / 3600, 5)
    expect(last.values.lower).toBe(0)
    expect(last.total).toBeCloseTo(last.values.upper + last.values.core, 5)
  })

  it('las series y las repeticiones se cuentan en el grupo principal (los músculos secundarios no cuentan)', () => {
    const rows = chartRows(summary, { by: 'group', metric: 'sets' })
    expect(rows.totals.chest).toBe(3)
    expect(rows.totals.triceps).toBe(0)
    expect(rows.totals.core).toBe(1) // la serie de core hecha en el descanso
    expect(chartRows(summary, { by: 'group', metric: 'reps' }).totals.chest).toBe(25)
  })

  it('include deja solo las series elegidas', () => {
    const rows = chartRows(summary, { by: 'group', metric: 'sets', include: ['chest', 'back'] })
    expect(rows.series.map((x) => x.id)).toEqual(['chest', 'back'])
    expect(Object.keys(rows.rows[4].values)).toEqual(['chest', 'back'])
  })

  it('groupTable ordena de más a menos horas e incluye todos los grupos', () => {
    const table = groupTable(summary)
    expect(table).toHaveLength(10)
    expect(table[0].id).toBe('chest')
    expect(table.find((g) => g.id === 'quads')).toMatchObject({ hours: 0, sets: 0, reps: 0 })
  })

  it('un periodo sin sesiones da ceros, no errores', () => {
    const empty = summarize({ sessions: [], sets: [], exercises, from: '2026-11-02', to: '2026-11-09', grain: 'week', now })
    const rows = chartRows(empty, { by: 'region', metric: 'hours' })
    expect(rows.rows.every((r) => r.total === 0)).toBe(true)
    expect(rows.totals).toEqual({ upper: 0, lower: 0, core: 0 })
  })
})

describe('exerciseProgress (el progreso de un ejercicio)', () => {
  const pull = ex('assisted-pull-up')
  const mk = (id, date, band, reps) => ({
    s: session(id, date),
    sets: reps.map((r, i) => set(id, 'assisted-pull-up', i + 1, r, `18:0${i + 1}:00`, { levelId: band })),
  })
  const a = mk('a', '2026-11-02', 'band-yellow', [8, 8, 8])
  const b = mk('b', '2026-11-04', 'band-yellow', [10, 10, 10])
  const c = mk('c', '2026-11-09', 'band-green', [7, 7, 6])
  const sessions = [c.s, a.s, b.s, { ...session('run', '2026-11-10', { status: 'in_progress' }) }]
  const sets = [...c.sets, ...a.sets, ...b.sets, set('run', 'assisted-pull-up', 1, 99, '18:01:00', { levelId: 'band-blue' }), set('a', 'push-up', 1, 5, '18:09:00')]
  const result = exerciseProgress({ exercise: pull, scale: bands, sessions, sets })

  it('una entrada por sesión terminada, de más antigua a más reciente, con media y mejor serie', () => {
    expect(result.entries.map((e) => e.date)).toEqual(['2026-11-02', '2026-11-04', '2026-11-09'])
    expect(result.entries[0]).toMatchObject({ reps: [8, 8, 8], avg: 8, best: 8, total: 24, levelLabel: 'Banda amarilla (muy dura)' })
    expect(result.entries[2].avg).toBeCloseTo(20 / 3, 5)
    expect(result.bestSet).toBe(10)
  })

  it('la dificultad sube al pasar de banda amarilla a verde (menos ayuda) aunque bajen las repeticiones', () => {
    expect(result.entries[2].rank).toBeGreaterThan(result.entries[1].rank)
    expect(result.entries[2].avg).toBeLessThan(result.entries[1].avg)
  })

  it('detecta los cambios de nivel y si fueron a más difícil', () => {
    expect(result.changes).toEqual([{ date: '2026-11-09', from: 'Banda amarilla (muy dura)', to: 'Banda verde (media)', harder: true }])
    const easier = exerciseProgress({
      exercise: pull, scale: bands, sessions: [a.s, c.s],
      sets: [...a.sets.map((s) => ({ ...s, levelId: 'band-green' })), ...c.sets.map((s) => ({ ...s, levelId: 'band-yellow' }))],
    })
    expect(easier.changes[0].harder).toBe(false)
  })

  it('"sin banda" es lo más difícil', () => {
    const none = exerciseProgress({ exercise: pull, scale: bands, sessions: [a.s, c.s], sets: [...a.sets, ...c.sets.map((s) => ({ ...s, levelId: 'none' }))] })
    expect(none.entries[1].levelLabel).toBe('Sin banda')
    expect(none.entries[1].rank).toBeGreaterThan(none.entries[0].rank)
  })

  it('lleva el rango objetivo y los extremos', () => {
    expect(result.repRange).toEqual({ min: 8, max: 10 })
    expect(result.first.date).toBe('2026-11-02')
    expect(result.last.date).toBe('2026-11-09')
    expect(result.unit).toBe('reps')
  })

  it('sin historial no falla', () => {
    const empty = exerciseProgress({ exercise: ex('banded-row'), scale: null, sessions, sets })
    expect(empty).toMatchObject({ entries: [], changes: [], first: null, last: null, bestSet: null })
  })

  it('un ejercicio sin niveles no tiene nivel ni cambios', () => {
    const s = session('p1', '2026-11-02')
    const r = exerciseProgress({ exercise: ex('push-up'), scale: null, sessions: [s], sets: [set('p1', 'push-up', 1, 10, '18:05:00')] })
    expect(r.entries[0]).toMatchObject({ levelId: null, levelLabel: null, rank: 0 })
    expect(r.changes).toEqual([])
  })

  it('exercisesWithHistory lista los ejercicios con series terminadas, el que más sesiones tiene primero', () => {
    const list = exercisesWithHistory({ exercises, sessions, sets })
    expect(list.map((x) => x.exercise.id)).toEqual(['assisted-pull-up', 'push-up'])
    expect(list[0].sessions).toBe(3)
    expect(list[1].sessions).toBe(1)
  })
})

describe('bikeSummary', () => {
  const now = new Date(2026, 10, 9)
  const bike = (id, date, type, minutes, tss, status = 'done') => ({ id, type, status, date, durationMin: minutes, tss })
  const sessions = [
    bike('a', '2026-11-03', 'bike_trainer', 60, 55),
    bike('b', '2026-11-07', 'bike_outdoor', 120, 110),
    bike('c', '2026-11-09', 'bike_outdoor', 90, null),
    bike('d', '2026-11-05', 'bike_trainer', 60, 50, 'skipped'),
    bike('e', '2026-09-01', 'bike_outdoor', 300, 300),
    { id: 'm', type: 'mobility', status: 'done', date: '2026-11-04', durationMin: 20 },
  ]

  it('suma minutos, TSS y salidas por semana, sin contar las no hechas ni la movilidad', () => {
    const r = bikeSummary({ sessions, from: '2026-10-26', to: '2026-11-09', grain: 'week', now })
    expect(r.rows.map((x) => [x.key, x.minutes, x.tss, x.count])).toEqual([['2026-10-26', 0, 0, 0], ['2026-11-02', 180, 165, 2], ['2026-11-09', 90, 0, 1]])
    expect(r.totals).toMatchObject({ minutes: 270, tss: 165, count: 3 })
    expect(r.totals.avgTss).toBe(55)
  })

  it('filtra por rodillo o outdoor', () => {
    expect(BIKE_FILTERS.map((f) => f.id)).toEqual(['all', 'bike_trainer', 'bike_outdoor'])
    const t = bikeSummary({ sessions, from: '2026-10-26', to: '2026-11-09', type: 'bike_trainer', now }).totals
    expect(t).toMatchObject({ minutes: 60, tss: 55, count: 1 })
  })

  it('sin salidas, los promedios son 0 (no NaN)', () => {
    expect(bikeSummary({ sessions: [], from: '2026-11-02', to: '2026-11-09', now }).totals).toEqual({ minutes: 0, tss: 0, count: 0, avgTss: 0 })
  })
})

describe('formato', () => {
  it('formatHours', () => {
    expect(formatHours(1.5)).toBe('1,5 h')
    expect(formatHours(0.5)).toBe('30 min')
    expect(formatHours(0)).toBe('0 h')
    expect(formatHours(12)).toBe('12 h')
  })
  it('formatMetric', () => {
    expect(formatMetric(3, 'sets')).toBe('3 series')
    expect(formatMetric(1, 'sets')).toBe('1 serie')
    expect(formatMetric(120, 'reps')).toBe('120 rep.')
    expect(formatMetric(2.25, 'hours')).toBe('2,3 h')
  })
})
