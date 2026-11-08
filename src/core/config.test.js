import { describe, expect, it } from 'vitest'
import { createBackup, parseBackup } from './backup.js'
import { DEFAULT_GOALS, DEFAULT_SCALES, DEFAULT_WEEK_PLAN, MUSCLE_GROUPS } from './defaultData.js'
import { DATA_SCHEMA_VERSION } from './model.js'
import { DEFAULT_PROGRESSION_RULES, getRulesForExercise } from './progressionConfig.js'

describe('reglas de progresión', () => {
  it('por defecto: rango 8-10', () => {
    expect(DEFAULT_PROGRESSION_RULES.repRange).toEqual({ min: 8, max: 10 })
  })

  it('un ejercicio puede cambiar solo parte del rango', () => {
    const rules = getRulesForExercise({ rules: { repRange: { max: 12 } } })
    expect(rules.repRange).toEqual({ min: 8, max: 12 })
  })

  it('no modifica las reglas globales', () => {
    getRulesForExercise({ rules: { repRange: { max: 12 }, targetSets: 5 } })
    expect(DEFAULT_PROGRESSION_RULES.repRange.max).toBe(10)
    expect(DEFAULT_PROGRESSION_RULES.targetSets).toBe(3)
  })

  it('rechaza valores sin sentido', () => {
    expect(() => getRulesForExercise({ rules: { repRange: { min: 12, max: 8 } } })).toThrow()
    expect(() => getRulesForExercise({ rules: { targetSets: 0 } })).toThrow()
    expect(() => getRulesForExercise({ rules: { sessionsToConfirmTop: 1.5 } })).toThrow()
  })
})

describe('copia de seguridad', () => {
  it('guardar y volver a leer devuelve los mismos datos', () => {
    const data = { exercises: [{ id: 'a' }], sets: [{ reps: 10 }] }
    const text = JSON.stringify(createBackup(data, new Date('2025-01-01T10:00:00Z')))
    const backup = parseBackup(text)
    expect(backup.data).toEqual(data)
    expect(backup.exportedAt).toBe('2025-01-01T10:00:00.000Z')
    expect(backup.schemaVersion).toBe(DATA_SCHEMA_VERSION)
  })

  it('rechaza archivos que no son una copia válida', () => {
    expect(() => parseBackup('esto no es json')).toThrow(/válida/)
    expect(() => parseBackup('{"hola": 1}')).toThrow(/no parece/)
    expect(() => parseBackup('null')).toThrow(/no parece/)
  })

  it('rechaza copias de una versión más nueva', () => {
    const text = JSON.stringify({ schemaVersion: DATA_SCHEMA_VERSION + 1, data: {} })
    expect(() => parseBackup(text)).toThrow(/más reciente/)
  })
})

describe('datos de partida', () => {
  it('los ids de niveles no se repiten dentro de una escala', () => {
    for (const scale of DEFAULT_SCALES) {
      const ids = scale.levels.map((l) => l.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).not.toContain('none') // reservado para "sin banda"
    }
  })

  it('el plan semanal usa días 1-7 y ids únicos, y permite varias sesiones por día', () => {
    const ids = DEFAULT_WEEK_PLAN.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(DEFAULT_WEEK_PLAN.every((s) => s.weekday >= 1 && s.weekday <= 7)).toBe(true)
    const tuesday = DEFAULT_WEEK_PLAN.filter((s) => s.weekday === 2)
    expect(tuesday.length).toBeGreaterThan(1)
  })

  it('los objetivos cubren todos los grupos musculares', () => {
    for (const group of MUSCLE_GROUPS) {
      expect(DEFAULT_GOALS.timesPerWeekByGroup[group.id]).toBeGreaterThanOrEqual(2)
    }
  })
})
