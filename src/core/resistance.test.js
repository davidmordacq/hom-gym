import { describe, expect, it } from 'vitest'
import { NO_ASSISTANCE, difficultyRank, findLevel, getEasierLevel, getHarderLevel } from './resistance.js'

const scale = {
  id: 'bands',
  name: 'Bandas',
  levels: [
    { id: 'blue', label: 'Azul' },
    { id: 'green', label: 'Verde' },
    { id: 'black', label: 'Negra' },
  ],
}
const assisted = { resistanceType: 'assisted' }
const resisted = { resistanceType: 'resisted' }

describe('ejercicio con resistencia', () => {
  it('más difícil = nivel siguiente de la lista', () => {
    expect(getHarderLevel(resisted, scale, 'blue').id).toBe('green')
    expect(getHarderLevel(resisted, scale, 'black')).toBeNull()
  })
  it('más fácil = nivel anterior de la lista', () => {
    expect(getEasierLevel(resisted, scale, 'green').id).toBe('blue')
    expect(getEasierLevel(resisted, scale, 'blue')).toBeNull()
  })
  it('el nivel "none" no existe en ejercicios con resistencia', () => {
    expect(findLevel(resisted, scale, 'none')).toBeNull()
  })
})

describe('ejercicio con asistencia', () => {
  it('más difícil = nivel anterior (banda más suave) y, al final, sin banda', () => {
    expect(getHarderLevel(assisted, scale, 'black').id).toBe('green')
    expect(getHarderLevel(assisted, scale, 'blue')).toBe(NO_ASSISTANCE)
    expect(getHarderLevel(assisted, scale, 'none')).toBeNull()
  })
  it('más fácil = nivel siguiente (banda más dura); desde sin banda, la más suave', () => {
    expect(getEasierLevel(assisted, scale, 'blue').id).toBe('green')
    expect(getEasierLevel(assisted, scale, 'black')).toBeNull()
    expect(getEasierLevel(assisted, scale, 'none').id).toBe('blue')
  })
  it('"none" existe y es el más difícil', () => {
    expect(findLevel(assisted, scale, 'none')).toBe(NO_ASSISTANCE)
    expect(difficultyRank(assisted, scale, 'none')).toBeGreaterThan(difficultyRank(assisted, scale, 'blue'))
    expect(difficultyRank(assisted, scale, 'blue')).toBeGreaterThan(difficultyRank(assisted, scale, 'black'))
  })
})

describe('niveles desconocidos o sin escala', () => {
  it('no explotan', () => {
    expect(getHarderLevel(resisted, scale, 'rosa')).toBeNull()
    expect(getEasierLevel(assisted, scale, 'rosa')).toBeNull()
    expect(getHarderLevel(resisted, null, 'blue')).toBeNull()
    expect(findLevel(resisted, null, 'blue')).toBeNull()
  })
})
