import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES, DEFAULT_WEEK_PLAN } from './defaultData.js'
import { DEFAULT_EXERCISES } from './exerciseLibrary.js'
import { dateText, historyGroup, listHistory, sessionLine, sessionMinutes, weekEnd, weekProgress, weekStart } from './history.js'
import { buildSet, finishSession, startStrengthSession } from './workout.js'

const session = (id, date, type = 'strength', status = 'done', extra = {}) => ({ id, date, type, status, startedAt: `${date}T18:00:00Z`, ...extra })

describe('listHistory', () => {
  const sessions = [
    session('a', '2026-11-02'),
    session('b', '2026-11-04', 'bike_trainer'),
    session('c', '2026-11-09', 'strength', 'in_progress'),
    session('d', '2026-11-06', 'mobility', 'skipped'),
    session('e', '2026-11-04', 'strength', 'done', { startedAt: '2026-11-04T09:00:00Z' }),
  ]

  it('deja solo las terminadas (no las en curso), la más reciente primero', () => {
    expect(listHistory(sessions).map((s) => s.id)).toEqual(['d', 'b', 'e', 'a'])
  })

  it('en el mismo día, la que empezó más tarde va primero', () => {
    expect(listHistory(sessions).filter((s) => s.date === '2026-11-04').map((s) => s.id)).toEqual(['b', 'e'])
  })

  it('filtra por familia: la bici junta rodillo y outdoor', () => {
    expect(listHistory([...sessions, session('f', '2026-11-08', 'bike_outdoor')], 'bike').map((s) => s.id)).toEqual(['f', 'b'])
    expect(listHistory(sessions, 'mobility').map((s) => s.id)).toEqual(['d'])
    expect(listHistory(sessions, 'strength').map((s) => s.id)).toEqual(['e', 'a'])
  })

  it('no modifica la lista original', () => {
    const copy = JSON.stringify(sessions)
    listHistory(sessions)
    expect(JSON.stringify(sessions)).toBe(copy)
  })

  it('historyGroup', () => {
    expect(historyGroup('strength')).toBe('strength')
    expect(historyGroup('bike_trainer')).toBe('bike')
    expect(historyGroup('bike_outdoor')).toBe('bike')
    expect(historyGroup('mobility')).toBe('mobility')
  })
})

describe('textos', () => {
  const now = new Date(2026, 10, 9)
  it('dateText da día de la semana, día y mes (y el año si no es el actual)', () => {
    expect(dateText('2026-11-09', now)).toBe('Lunes 9 nov')
    expect(dateText('2025-12-31', now)).toBe('Miércoles 31 dic 2025')
  })

  it('sessionLine de fuerza cuenta minutos, series y repeticiones', () => {
    const base = startStrengthSession({ template: DEFAULT_TEMPLATES[0], now: new Date('2026-11-09T18:00:00Z'), id: 'x' })
    const s = finishSession(base, { now: new Date('2026-11-09T18:52:00Z') })
    const sets = [1, 2].map((order) => buildSet({ session: s, exerciseId: 'push-up', order, reps: 10, levelId: null }))
    expect(sessionLine(s, sets, DEFAULT_EXERCISES)).toBe('52 min · 2 series · 20 rep.')
    expect(sessionLine(s, [], DEFAULT_EXERCISES)).toBe('52 min · 0 series')
    expect(sessionLine(s, sets.slice(0, 1), DEFAULT_EXERCISES)).toBe('52 min · 1 serie · 10 rep.')
  })

  it('sessionLine de bici cuenta minutos, TSS y esfuerzo; una omitida lo dice', () => {
    expect(sessionLine({ ...session('b', '2026-11-08', 'bike_outdoor'), durationMin: 95, tss: 82, effort: 7 }, [], [])).toBe('95 min · TSS 82 · esfuerzo 7/10')
    expect(sessionLine({ ...session('b', '2026-11-08', 'bike_outdoor'), durationMin: 60 }, [], [])).toBe('60 min')
    expect(sessionLine(session('m', '2026-11-08', 'mobility', 'skipped'), [], [])).toBe('No la hiciste')
  })

  it('sessionMinutes usa la duración anotada, o inicio y fin', () => {
    expect(sessionMinutes({ durationMin: 45 })).toBe(45)
    expect(sessionMinutes({ startedAt: '2026-11-09T18:00:00Z', endedAt: '2026-11-09T18:30:00Z' })).toBe(30)
    expect(sessionMinutes({})).toBeNull()
  })
})

describe('semana (de lunes a domingo)', () => {
  it('weekStart y weekEnd en cualquier día de la semana, incluido el domingo', () => {
    for (const day of [9, 10, 11, 12, 13, 14, 15]) {
      expect(weekStart(new Date(2026, 10, day))).toBe('2026-11-09')
      expect(weekEnd(new Date(2026, 10, day))).toBe('2026-11-15')
    }
    expect(weekStart(new Date(2026, 10, 16))).toBe('2026-11-16')
  })

  it('la semana puede cruzar de mes y de año', () => {
    expect(weekStart(new Date(2026, 11, 31))).toBe('2026-12-28')
    expect(weekEnd(new Date(2026, 11, 31))).toBe('2027-01-03')
  })

  it('weekProgress cuenta lo previsto en el plan y lo hecho esta semana', () => {
    const sessions = [
      session('a', '2026-11-09'),
      session('b', '2026-11-10', 'bike_trainer'),
      session('c', '2026-11-08', 'strength'), // semana anterior
      session('d', '2026-11-11', 'strength', 'skipped'), // omitida: no cuenta
      session('e', '2026-11-12', 'strength', 'in_progress'), // en curso: no cuenta
    ]
    const progress = weekProgress({ plan: DEFAULT_WEEK_PLAN, sessions, today: new Date(2026, 10, 12) })
    expect(progress).toEqual({ strength: { done: 1, planned: 3 }, bike: { done: 1, planned: 4 }, mobility: { done: 0, planned: 2 } })
  })

  it('puede haber más hechas que previstas (sesiones fuera del plan)', () => {
    const sessions = [session('a', '2026-11-09'), session('b', '2026-11-10'), session('c', '2026-11-11'), session('d', '2026-11-14')]
    expect(weekProgress({ plan: DEFAULT_WEEK_PLAN, sessions, today: new Date(2026, 10, 14) }).strength).toEqual({ done: 4, planned: 3 })
  })
})
