import { describe, expect, it } from 'vitest'
import { ENTRY_KINDS, calendarMonth, dayEntries, monthWeeks, trackingStart, weekGroupsWorked, weeklyStreak } from './calendar.js'
import { DEFAULT_EXERCISES } from './exerciseLibrary.js'

const plan = [
  { id: 'mon', weekday: 1, type: 'strength', name: 'Fuerza' },
  { id: 'wed', weekday: 3, type: 'strength', name: 'Fuerza' },
  { id: 'sat', weekday: 6, type: 'bike_outdoor', name: 'Bici outdoor' },
]
const session = (id, date, type = 'strength', status = 'done', extra = {}) => ({ id, date, type, status, name: type, ...extra })
const kinds = (entries) => entries.map((e) => e.kind)

// 12 de noviembre de 2026 es jueves. Su semana va del lunes 9 al domingo 15.
const TODAY = '2026-11-12'

describe('monthWeeks', () => {
  it('noviembre de 2026 empieza en domingo: 6 semanas, la primera desde el lunes 26 de octubre', () => {
    const weeks = monthWeeks(2026, 10)
    expect(weeks).toHaveLength(6)
    expect(weeks[0][0]).toBe('2026-10-26')
    expect(weeks[0][6]).toBe('2026-11-01')
    expect(weeks[5][6]).toBe('2026-12-06')
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })

  it('febrero de 2027 empieza en lunes y tiene 4 semanas justas', () => {
    const weeks = monthWeeks(2027, 1)
    expect(weeks).toHaveLength(4)
    expect(weeks[0][0]).toBe('2027-02-01')
    expect(weeks[3][6]).toBe('2027-02-28')
  })

  it('cubre todos los días del mes sin saltarse ninguno', () => {
    const days = monthWeeks(2026, 11).flat()
    for (let d = 1; d <= 31; d++) expect(days).toContain(`2026-12-${String(d).padStart(2, '0')}`)
  })
})

describe('dayEntries', () => {
  const entries = (date, sessions = [], extra = {}) => dayEntries({ date, plan, sessions, today: TODAY, trackingFrom: '2026-11-01', ...extra })

  it('una sesión prevista y hecha se ve como hecha', () => {
    const e = entries('2026-11-09', [session('a', '2026-11-09')])
    expect(kinds(e)).toEqual(['done'])
    expect(e[0].session.id).toBe('a')
  })

  it('prevista, ya pasó el día y no se hizo: no hecha (gris)', () => {
    expect(kinds(entries('2026-11-09'))).toEqual(['missed'])
  })

  it('prevista para hoy o para el futuro: por hacer', () => {
    expect(kinds(entries('2026-11-12', [], { plan: [{ id: 'thu', weekday: 4, type: 'strength', name: 'F' }] }))).toEqual(['planned'])
    expect(kinds(entries('2026-11-14'))).toEqual(['planned']) // sábado
  })

  it('antes del día en que empezó a usarse la app no se inventan sesiones no hechas', () => {
    expect(kinds(entries('2026-10-26'))).toEqual([]) // lunes anterior al 1 de noviembre
    expect(kinds(entries('2026-10-26', [], { trackingFrom: null }))).toEqual([])
  })

  it('una sesión hecha sin estar prevista ese día es "extra"', () => {
    expect(kinds(entries('2026-11-10', [session('x', '2026-11-10')]))).toEqual(['extra']) // martes
  })

  it('una bici de otro tipo cubre la prevista de la misma familia', () => {
    const e = entries('2026-11-07', [session('r', '2026-11-07', 'bike_trainer')])
    expect(kinds(e)).toEqual(['done'])
    expect(e[0].type).toBe('bike_trainer') // se ve lo que se hizo de verdad
  })

  it('una fuerza no cubre una bici prevista: la bici queda no hecha y la fuerza es extra', () => {
    expect(kinds(entries('2026-11-07', [session('f', '2026-11-07')]))).toEqual(['missed', 'extra'])
  })

  it('"No la hice" marcada a mano se ve como no hecha, también en el futuro inmediato (hoy)', () => {
    const e = entries('2026-11-07', [session('s', '2026-11-07', 'bike_outdoor', 'skipped')])
    expect(kinds(e)).toEqual(['missed'])
    expect(e[0].session.id).toBe('s')
  })

  it('una sesión sin terminar se ve en curso', () => {
    expect(kinds(entries('2026-11-09', [session('r', '2026-11-09', 'strength', 'in_progress')]))).toEqual(['running'])
  })

  it('dos sesiones el mismo día: una cumple lo previsto y la otra es extra; con una sola previsión no se duplica', () => {
    expect(kinds(entries('2026-11-09', [session('a', '2026-11-09'), session('b', '2026-11-09')]))).toEqual(['done', 'extra'])
  })

  it('un día sin plan ni sesiones no tiene nada', () => {
    expect(entries('2026-11-10')).toEqual([]) // martes sin plan ni sesiones
  })
})

describe('calendarMonth', () => {
  it('resume el mes: hechas, no hechas, extra, por hacer y porcentaje', () => {
    const sessions = [
      session('a', '2026-11-02'), // lunes previsto: hecha
      session('b', '2026-11-04'), // miércoles previsto: hecha
      // lunes 9: no hecha; miércoles 11: no hecha
      session('c', '2026-11-10'), // martes: extra
    ]
    const { weeks, stats } = calendarMonth({ year: 2026, month: 10, plan, sessions, today: TODAY, trackingFrom: '2026-11-01' })
    // previstas: lunes 2, 9, 16, 23, 30; miércoles 4, 11, 18, 25; sábados 7, 14, 21, 28
    expect(stats).toEqual({ done: 2, missed: 2 + 1, extra: 1, planned: 8, percent: 40 })
    expect(weeks.flat().find((d) => d.date === TODAY).isToday).toBe(true)
    expect(weeks[0][0].inMonth).toBe(false) // 26 de octubre
  })

  it('un mes futuro o sin nada que cumplir no tiene porcentaje', () => {
    const { stats } = calendarMonth({ year: 2027, month: 0, plan, sessions: [], today: TODAY, trackingFrom: '2026-11-01' })
    expect(stats.percent).toBeNull()
    expect(stats.done + stats.missed).toBe(0)
    expect(stats.planned).toBeGreaterThan(0)
  })

  it('los días de otro mes que se ven en la rejilla no suman al resumen', () => {
    const sessions = [session('o', '2026-10-26')]
    const { stats } = calendarMonth({ year: 2026, month: 10, plan, sessions, today: TODAY, trackingFrom: '2026-10-01' })
    expect(stats.done).toBe(0)
  })
})

describe('weeklyStreak', () => {
  const duo = [plan[0], plan[1]] // lunes y miércoles de fuerza
  const week = (monday, days = [0, 2]) => days.map((d, i) => session(`${monday}-${i}`, addDays(monday, d)))
  const addDays = (iso, n) => {
    const d = new Date(`${iso}T12:00:00`)
    d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  it('cuenta las semanas seguidas con todo lo previsto cumplido, hacia atrás', () => {
    const sessions = [...week('2026-10-19'), ...week('2026-10-26'), ...week('2026-11-02')]
    expect(weeklyStreak({ plan: duo, sessions, today: TODAY, trackingFrom: '2026-10-19' })).toBe(3) // la semana actual no cuenta (el lunes quedó sin hacer), pero las tres anteriores sí
  })

  it('la semana actual cuenta solo si ya está completa', () => {
    const base = [...week('2026-10-26'), ...week('2026-11-02')]
    expect(weeklyStreak({ plan: duo, sessions: base, today: TODAY, trackingFrom: '2026-10-26' })).toBe(2)
    expect(weeklyStreak({ plan: duo, sessions: [...base, ...week('2026-11-09')], today: TODAY, trackingFrom: '2026-10-26' })).toBe(3)
  })

  it('una semana con una sesión sin hacer corta la racha', () => {
    const sessions = [...week('2026-10-19'), ...week('2026-10-26', [0]), ...week('2026-11-02')]
    expect(weeklyStreak({ plan: duo, sessions, today: TODAY, trackingFrom: '2026-10-19' })).toBe(1)
  })

  it('no cuenta semanas anteriores al día en que empezó a usarse la app', () => {
    const sessions = [...week('2026-10-19'), ...week('2026-10-26'), ...week('2026-11-02')]
    expect(weeklyStreak({ plan: duo, sessions, today: TODAY, trackingFrom: '2026-11-02' })).toBe(1)
  })

  it('sin plan o sin día de inicio, la racha es 0', () => {
    expect(weeklyStreak({ plan: [], sessions: [], today: TODAY, trackingFrom: '2026-10-19' })).toBe(0)
    expect(weeklyStreak({ plan: duo, sessions: [], today: TODAY, trackingFrom: null })).toBe(0)
  })

  it('una sesión extra no rompe la racha', () => {
    const sessions = [...week('2026-11-02'), session('extra', '2026-11-03')]
    expect(weeklyStreak({ plan: duo, sessions, today: TODAY, trackingFrom: '2026-11-02' })).toBe(1)
  })
})

describe('weekGroupsWorked', () => {
  const exercises = DEFAULT_EXERCISES
  const mk = (id, date, exerciseIds, extra = {}) => ({
    session: session(id, date, 'strength', 'done', { exercises: exerciseIds.map((exerciseId) => ({ exerciseId, coreExerciseId: 'dead-bug' })), ...extra }),
    sets: exerciseIds.map((exerciseId) => ({ sessionId: id, exerciseId, order: 1, reps: 8, coreAfter: false })),
  })

  it('cuenta en cuántas sesiones de esta semana salió cada músculo (todos los músculos del ejercicio)', () => {
    const a = mk('a', '2026-11-09', ['push-up'])
    const b = mk('b', '2026-11-11', ['push-up', 'bulgarian-split-squat'])
    const counts = weekGroupsWorked({ sessions: [a.session, b.session], sets: [...a.sets, ...b.sets], exercises, today: TODAY })
    expect(counts.chest).toBe(2)
    expect(counts.triceps).toBe(2)
    expect(counts.quads).toBe(1)
    expect(counts.core).toBeUndefined()
  })

  it('el core hecho en un descanso cuenta como core', () => {
    const a = mk('a', '2026-11-09', ['push-up'])
    a.sets[0].coreAfter = true
    expect(weekGroupsWorked({ sessions: [a.session], sets: a.sets, exercises, today: TODAY }).core).toBe(1)
  })

  it('no cuenta otras semanas, sesiones sin terminar ni series de otras sesiones', () => {
    const old = mk('old', '2026-11-08', ['push-up']) // domingo anterior
    const running = mk('run', '2026-11-10', ['push-up'], { status: 'in_progress' })
    const other = { sessionId: 'otra', exerciseId: 'push-up', order: 1, reps: 8 }
    expect(weekGroupsWorked({ sessions: [old.session, running.session], sets: [...old.sets, ...running.sets, other], exercises, today: TODAY })).toEqual({})
  })
})

describe('trackingStart', () => {
  it('es el día más antiguo entre la instalación y la primera sesión', () => {
    expect(trackingStart('2026-11-08', [session('a', '2026-11-02'), session('b', '2026-11-09')])).toBe('2026-11-02')
    expect(trackingStart('2026-10-01', [session('a', '2026-11-02')])).toBe('2026-10-01')
  })
  it('sin fecha de instalación usa la primera sesión; sin nada, null', () => {
    expect(trackingStart(null, [session('a', '2026-11-02')])).toBe('2026-11-02')
    expect(trackingStart(null, [])).toBeNull()
  })
  it('ENTRY_KINDS tiene los cinco estados', () => {
    expect(Object.values(ENTRY_KINDS).sort()).toEqual(['done', 'extra', 'missed', 'planned', 'running'])
  })
})
