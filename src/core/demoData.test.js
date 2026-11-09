import { describe, expect, it } from 'vitest'
import { bikeSummary, chartRows, exerciseProgress, rangeBounds, summarize } from './analysis.js'
import { DEFAULT_SCALES, DEFAULT_TEMPLATES } from './defaultData.js'
import { buildDemoData } from './demoData.js'
import { DEFAULT_EXERCISES } from './exerciseLibrary.js'

const today = new Date(2026, 10, 9)
const build = () => buildDemoData({ today, exercises: DEFAULT_EXERCISES, scales: DEFAULT_SCALES, templates: DEFAULT_TEMPLATES })

describe('datos de ejemplo', () => {
  const { sessions, sets } = build()

  it('siempre salen iguales', () => {
    expect(build()).toEqual({ sessions, sets })
  })

  it('hay fuerza, rodillo y outdoor, ninguna sesión en el futuro y todas las series pertenecen a una sesión', () => {
    const types = new Set(sessions.map((s) => s.type))
    expect([...types].sort()).toEqual(['bike_outdoor', 'bike_trainer', 'strength'])
    expect(sessions.every((s) => s.date <= '2026-11-09')).toBe(true)
    const ids = new Set(sessions.map((s) => s.id))
    expect(sets.every((s) => ids.has(s.sessionId))).toBe(true)
    expect(new Set(sessions.map((s) => s.id)).size).toBe(sessions.length)
    expect(new Set(sets.map((s) => s.id)).size).toBe(sets.length)
  })

  it('unas 30 sesiones de fuerza en 12 semanas, alternando tren superior e inferior', () => {
    const strength = sessions.filter((s) => s.type === 'strength').sort((a, b) => a.date.localeCompare(b.date))
    expect(strength.length).toBeGreaterThanOrEqual(28)
    expect(strength.length).toBeLessThanOrEqual(36)
    expect(strength.slice(0, 4).map((s) => s.templateId)).toEqual(['tpl-upper', 'tpl-lower', 'tpl-upper', 'tpl-lower'])
  })

  it('las series tienen hora, y el análisis da horas razonables por semana (no NaN)', () => {
    expect(sets.every((s) => Number.isFinite(Date.parse(s.completedAt)))).toBe(true)
    const { from, to } = rangeBounds('3m', today)
    const rows = chartRows(summarize({ sessions, sets, exercises: DEFAULT_EXERCISES, from, to, grain: 'week', now: today }), { by: 'region', metric: 'hours' })
    for (const row of rows.rows) {
      expect(Number.isFinite(row.total)).toBe(true)
      expect(row.total).toBeLessThan(4) // menos de 4 h de fuerza por semana
    }
    expect(rows.totals.upper).toBeGreaterThan(5)
    expect(rows.totals.lower).toBeGreaterThan(5)
    expect(rows.totals.core).toBeGreaterThan(0)
  })

  it('las dominadas suben de banda con el tiempo, hasta quedarse sin banda', () => {
    const pull = DEFAULT_EXERCISES.find((e) => e.id === 'assisted-pull-up')
    const scale = DEFAULT_SCALES.find((s) => s.id === 'bands')
    const progress = exerciseProgress({ exercise: pull, scale, sessions, sets })
    expect(progress.entries.length).toBeGreaterThan(10)
    expect(progress.changes.length).toBeGreaterThanOrEqual(2)
    expect(progress.changes.every((c) => c.harder)).toBe(true)
  })

  it('la bici suma tiempo y TSS', () => {
    const { from, to } = rangeBounds('3m', today)
    const totals = bikeSummary({ sessions, from, to, now: today }).totals
    expect(totals.minutes).toBeGreaterThan(1000)
    expect(totals.tss).toBeGreaterThan(500)
  })

  it('sin sesiones tipo no hay fuerza pero sí bici', () => {
    const none = buildDemoData({ today, exercises: DEFAULT_EXERCISES, scales: DEFAULT_SCALES, templates: [] })
    expect(none.sessions.some((s) => s.type === 'strength')).toBe(false)
    expect(none.sessions.length).toBeGreaterThan(0)
  })
})
