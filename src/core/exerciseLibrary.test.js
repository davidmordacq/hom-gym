import { describe, expect, it } from 'vitest'
import { DEFAULT_SCALES, MUSCLE_GROUPS } from './defaultData.js'
import { DEFAULT_EXERCISES } from './exerciseLibrary.js'
import { levelsEasyToHard } from './exercises.js'
import { RESISTANCE_TYPES } from './model.js'
import { getRulesForExercise } from './progressionConfig.js'
import { parseYoutubeId } from './youtube.js'

const groupIds = new Set(MUSCLE_GROUPS.map((g) => g.id))
const scaleIds = new Set(DEFAULT_SCALES.map((s) => s.id))

describe('biblioteca inicial de ejercicios', () => {
  it('tiene entre 30 y 40 ejercicios', () => {
    expect(DEFAULT_EXERCISES.length).toBeGreaterThanOrEqual(30)
    expect(DEFAULT_EXERCISES.length).toBeLessThanOrEqual(40)
  })

  it('no repite identificadores ni nombres', () => {
    const ids = DEFAULT_EXERCISES.map((e) => e.id)
    const names = DEFAULT_EXERCISES.map((e) => e.name)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
  })

  it.each(DEFAULT_EXERCISES.map((e) => [e.id, e]))('%s tiene datos coherentes', (_id, exercise) => {
    expect(exercise.name.trim()).not.toBe('')
    expect(exercise.muscleGroups.length).toBeGreaterThan(0)
    for (const group of exercise.muscleGroups) expect(groupIds.has(group)).toBe(true)
    expect(Object.values(RESISTANCE_TYPES)).toContain(exercise.resistanceType)
    if (exercise.scaleId !== null) expect(scaleIds.has(exercise.scaleId)).toBe(true)
    expect(parseYoutubeId(exercise.videoUrl)).not.toBeNull()
    expect(exercise.notes.length).toBeGreaterThan(10)
    // el motor de progresión debe poder usar el ejercicio con las reglas de siempre
    expect(() => getRulesForExercise(exercise)).not.toThrow()
  })

  it('no repite vídeo entre ejercicios', () => {
    const videos = DEFAULT_EXERCISES.map((e) => parseYoutubeId(e.videoUrl))
    expect(new Set(videos).size).toBe(videos.length)
  })

  it('las dominadas son el único ejercicio asistido y usan bandas', () => {
    const assisted = DEFAULT_EXERCISES.filter((e) => e.resistanceType === RESISTANCE_TYPES.ASSISTED)
    expect(assisted.map((e) => e.id)).toEqual(['assisted-pull-up'])
    expect(assisted[0].scaleId).toBe('bands')
  })

  it('cada grupo muscular tiene al menos un ejercicio como principal', () => {
    const mains = new Set(DEFAULT_EXERCISES.map((e) => e.muscleGroups[0]))
    for (const group of MUSCLE_GROUPS) expect(mains.has(group.id), group.label).toBe(true)
  })

  it('no usa material que David no tiene (banco, mancuernas, máquinas)', () => {
    const text = DEFAULT_EXERCISES.map((e) => `${e.name} ${e.notes}`.toLowerCase()).join(' ')
    expect(text).not.toMatch(/\bbanco\b|polea|máquina/)
  })
})

describe('niveles de los ejercicios de la biblioteca', () => {
  const scaleOf = (exercise) => DEFAULT_SCALES.find((s) => s.id === exercise.scaleId) ?? null

  it('las dominadas van de banda verde a azul y terminan en "Sin banda"', () => {
    const pullUp = DEFAULT_EXERCISES.find((e) => e.id === 'assisted-pull-up')
    expect(levelsEasyToHard(pullUp, scaleOf(pullUp)).map((l) => l.id)).toEqual(['band-green', 'band-blue', 'none'])
  })

  it('en los demás, de menos a más resistencia', () => {
    const squat = DEFAULT_EXERCISES.find((e) => e.id === 'goblet-squat')
    expect(levelsEasyToHard(squat, scaleOf(squat)).map((l) => l.id)).toEqual(['kg-0', 'kg-5', 'kg-10', 'kg-15', 'kg-20'])
    const row = DEFAULT_EXERCISES.find((e) => e.id === 'banded-row')
    expect(levelsEasyToHard(row, scaleOf(row)).map((l) => l.id)).toEqual(['band-blue', 'band-green'])
  })

  it('sin escala no hay niveles', () => {
    const deadBug = DEFAULT_EXERCISES.find((e) => e.id === 'dead-bug')
    expect(levelsEasyToHard(deadBug, scaleOf(deadBug))).toEqual([])
  })
})
