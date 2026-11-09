import { describe, expect, it } from 'vitest'
import { niceScale, pickLabelIndexes, sequentialBlue, timePositions } from './chartMath.js'

describe('niceScale', () => {
  it('da un máximo redondo que incluye el dato más alto', () => {
    for (const value of [0.3, 1.4, 3.7, 7, 12, 55, 99, 140, 1234]) {
      const scale = niceScale(value)
      expect(scale.max, String(value)).toBeGreaterThanOrEqual(value)
      expect(scale.values[0]).toBe(0)
      expect(scale.values.at(-1)).toBeCloseTo(scale.max, 6)
      expect(scale.values.length).toBeLessThanOrEqual(7)
    }
  })

  it('pasos redondos: 1,4 → 1,5 de 0,5 en 0,5; 55 → 60 de 20 en 20 o 15', () => {
    expect(niceScale(1.4).step).toBe(0.5)
    expect(niceScale(1.4).max).toBe(1.5)
    expect(niceScale(7).max).toBe(8)
    expect(niceScale(100).max).toBe(100)
  })

  it('sin datos (todo 0) o con valores no válidos, escala de 0 a 1', () => {
    for (const v of [0, -3, NaN, undefined]) expect(niceScale(v).max).toBe(1)
  })

  it('sin errores de decimales en las marcas', () => {
    expect(niceScale(0.9).values.every((v) => Number.isFinite(v) && String(v).length < 8)).toBe(true)
  })
})

describe('pickLabelIndexes', () => {
  it('con pocas etiquetas muestra todas', () => {
    expect(pickLabelIndexes(5, 8)).toEqual([0, 1, 2, 3, 4])
  })
  it('con muchas, reparte y siempre incluye la última', () => {
    const picked = pickLabelIndexes(13, 6)
    expect(picked.length).toBeLessThanOrEqual(7)
    expect(picked.at(-1)).toBe(12)
    expect(new Set(picked).size).toBe(picked.length)
    expect([...picked].sort((a, b) => a - b)).toEqual(picked)
  })
  it('sin datos, ninguna', () => {
    expect(pickLabelIndexes(0)).toEqual([])
  })
})

describe('timePositions', () => {
  it('reparte según el tiempo real: dos fechas a los extremos y una a mitad de camino', () => {
    expect(timePositions(['2026-11-01', '2026-11-06', '2026-11-11'])).toEqual([0, 0.5, 1])
    expect(timePositions(['2026-11-01', '2026-11-02', '2026-11-11'])[1]).toBeCloseTo(0.1, 5)
  })
  it('una sola fecha va al centro y sin fechas no hay nada', () => {
    expect(timePositions(['2026-11-01'])).toEqual([0.5])
    expect(timePositions([])).toEqual([])
  })
  it('dos sesiones el mismo día quedan juntas', () => {
    expect(timePositions(['2026-11-01', '2026-11-01'])).toEqual([0.5, 0.5])
  })
})

describe('sequentialBlue', () => {
  it('el más fácil es más claro que el más difícil', () => {
    const light = Number(/(\d+)%\)$/.exec(sequentialBlue(0, 5))[1])
    const dark = Number(/(\d+)%\)$/.exec(sequentialBlue(4, 5))[1])
    expect(light).toBeGreaterThan(dark)
  })
  it('un solo nivel no falla', () => {
    expect(sequentialBlue(0, 1)).toMatch(/^hsl/)
  })
})
