import { describe, expect, it } from 'vitest'
import { tryVibrate } from './feedback.js'

describe('tryVibrate', () => {
  it('dice "ok" si el navegador acepta la vibración y le pasa el patrón', () => {
    const calls = []
    const nav = { vibrate: (pattern) => (calls.push(pattern), true) }
    expect(tryVibrate([300, 150, 300], nav)).toBe('ok')
    expect(calls).toEqual([[300, 150, 300]])
  })

  it('dice "blocked" si el navegador la rechaza o falla', () => {
    expect(tryVibrate([100], { vibrate: () => false })).toBe('blocked')
    expect(
      tryVibrate([100], {
        vibrate: () => {
          throw new Error('no permitido')
        },
      }),
    ).toBe('blocked')
  })

  it('dice "unsupported" si no existe la vibración o no hay navegador', () => {
    expect(tryVibrate([100], {})).toBe('unsupported')
    expect(tryVibrate([100], undefined)).toBe('unsupported')
    expect(tryVibrate([100], null)).toBe('unsupported')
  })
})
