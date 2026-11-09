import { describe, expect, it } from 'vitest'
import { DEFAULT_PROGRESSION_RULES, getRulesForExercise, sanitizeRules, validateGlobalRules } from './progressionConfig.js'

describe('validateGlobalRules (Ajustes: objetivo por defecto)', () => {
  it('acepta un rango y unas series válidos y deja intactas las demás reglas', () => {
    const { errors, rules } = validateGlobalRules({ min: '6', max: '8', sets: '4' })
    expect(errors).toEqual([])
    expect(rules).toEqual({ ...DEFAULT_PROGRESSION_RULES, repRange: { min: 6, max: 8 }, targetSets: 4 })
    expect(getRulesForExercise(undefined, rules).repRange).toEqual({ min: 6, max: 8 })
  })

  it('mantiene los valores propios que ya hubiera en las reglas actuales', () => {
    const current = { ...DEFAULT_PROGRESSION_RULES, stagnationSessions: 5 }
    expect(validateGlobalRules({ min: 8, max: 12, sets: 3 }, current).rules.stagnationSessions).toBe(5)
  })

  it('un rango de un solo valor (mínimo = máximo) es válido', () => {
    expect(validateGlobalRules({ min: 5, max: 5, sets: 3 }).errors).toEqual([])
  })

  it('rechaza mínimo mayor que máximo, vacíos, decimales, cero y negativos', () => {
    expect(validateGlobalRules({ min: 10, max: 8, sets: 3 }).errors[0]).toMatch(/mínimo/)
    for (const bad of [{ min: '', max: 10 }, { min: 8, max: '' }, { min: 8.5, max: 10 }, { min: 0, max: 10 }, { min: -1, max: 10 }, { min: 'a', max: 10 }]) {
      expect(validateGlobalRules({ ...bad, sets: 3 }).rules, JSON.stringify(bad)).toBeNull()
    }
  })

  it('rechaza series fuera de 1 a 10 y repeticiones por encima de 100', () => {
    for (const sets of [0, 11, 2.5, '', 'x']) expect(validateGlobalRules({ min: 8, max: 10, sets }).errors, String(sets)).toHaveLength(1)
    expect(validateGlobalRules({ min: 8, max: 101, sets: 3 }).errors[0]).toMatch(/100/)
  })

  it('puede dar los dos errores a la vez', () => {
    expect(validateGlobalRules({ min: 10, max: 8, sets: 0 }).errors).toHaveLength(2)
  })
})

describe('sanitizeRules (reglas guardadas dañadas)', () => {
  it('devuelve las guardadas si son válidas', () => {
    const stored = { ...DEFAULT_PROGRESSION_RULES, repRange: { min: 6, max: 8 } }
    expect(sanitizeRules(stored)).toBe(stored)
  })

  it('vuelve a las de fábrica si faltan, están rotas o no son un objeto', () => {
    for (const bad of [null, undefined, 'x', 5, {}, { repRange: { min: 10, max: 2 }, targetSets: 3 }, { ...DEFAULT_PROGRESSION_RULES, targetSets: 0 }, { ...DEFAULT_PROGRESSION_RULES, repRange: null }]) {
      expect(sanitizeRules(bad), JSON.stringify(bad)).toBe(DEFAULT_PROGRESSION_RULES)
    }
  })
})
