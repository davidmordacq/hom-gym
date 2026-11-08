import { describe, expect, it } from 'vitest'
import { toIsoDate, weekdayOf } from './dates.js'

describe('día de la semana (1 = lunes ... 7 = domingo)', () => {
  it('lunes es 1 y domingo es 7', () => {
    expect(weekdayOf(new Date(2025, 0, 6))).toBe(1) // lunes 6 enero 2025
    expect(weekdayOf(new Date(2025, 0, 7))).toBe(2)
    expect(weekdayOf(new Date(2025, 0, 11))).toBe(6)
    expect(weekdayOf(new Date(2025, 0, 12))).toBe(7) // domingo
  })
})

describe('fecha ISO local', () => {
  it('rellena con ceros', () => {
    expect(toIsoDate(new Date(2025, 0, 5))).toBe('2025-01-05')
    expect(toIsoDate(new Date(2025, 11, 31))).toBe('2025-12-31')
  })
  it('usa la fecha local, no la UTC (23:30 sigue siendo el mismo día)', () => {
    expect(toIsoDate(new Date(2025, 5, 15, 23, 30))).toBe('2025-06-15')
  })
})
