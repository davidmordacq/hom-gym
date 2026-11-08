import { describe, expect, it } from 'vitest'
import { DEFAULT_SCALES } from './defaultData.js'
import { blankExercise, groupExercises, newExerciseId, searchExercises, validateExercise } from './exercises.js'

const scales = DEFAULT_SCALES
const valid = () => ({
  ...blankExercise(),
  id: 'x',
  name: '  Curl de bíceps  ',
  muscleGroups: ['biceps'],
  scaleId: 'bands',
  videoUrl: 'https://youtu.be/XANUniwN1Jg?si=zzz',
  videoChannel: ' Canal ',
  notes: '  consejo  ',
})

describe('validateExercise', () => {
  it('acepta un ejercicio correcto y lo deja limpio', () => {
    const { errors, exercise } = validateExercise(valid(), { scales })
    expect(errors).toEqual([])
    expect(exercise).toMatchObject({
      id: 'x',
      name: 'Curl de bíceps',
      muscleGroups: ['biceps'],
      scaleId: 'bands',
      videoUrl: 'https://www.youtube.com/watch?v=XANUniwN1Jg',
      videoChannel: 'Canal',
      notes: 'consejo',
    })
  })

  it('el vídeo es opcional', () => {
    const { errors, exercise } = validateExercise({ ...valid(), videoUrl: '  ', videoChannel: 'Canal' }, { scales })
    expect(errors).toEqual([])
    expect(exercise.videoUrl).toBeNull()
    expect(exercise.videoChannel).toBe('') // sin vídeo no se guarda un canal huérfano
  })

  it('la escala es opcional', () => {
    const { errors, exercise } = validateExercise({ ...valid(), scaleId: '' }, { scales })
    expect(errors).toEqual([])
    expect(exercise.scaleId).toBeNull()
  })

  it('pide un nombre', () => {
    expect(validateExercise({ ...valid(), name: '   ' }, { scales }).errors).toEqual(['Escribe un nombre para el ejercicio.'])
  })

  it('pide al menos un grupo muscular y descarta los inventados', () => {
    expect(validateExercise({ ...valid(), muscleGroups: [] }, { scales }).errors).toEqual(['Elige al menos un grupo muscular.'])
    expect(validateExercise({ ...valid(), muscleGroups: ['cejas'] }, { scales }).errors).toEqual(['Elige al menos un grupo muscular.'])
    expect(validateExercise({ ...valid(), muscleGroups: ['biceps', 'cejas'] }, { scales }).exercise.muscleGroups).toEqual(['biceps'])
  })

  it('rechaza un tipo desconocido', () => {
    expect(validateExercise({ ...valid(), resistanceType: 'otro' }, { scales }).errors).toEqual(['Elige el tipo de ejercicio.'])
  })

  it('rechaza una escala que no existe', () => {
    expect(validateExercise({ ...valid(), scaleId: 'fantasma' }, { scales }).errors).toEqual([
      'La escala de resistencia elegida ya no existe.',
    ])
  })

  it('un ejercicio con ayuda necesita escala', () => {
    const assisted = { ...valid(), resistanceType: 'assisted' }
    expect(validateExercise({ ...assisted, scaleId: null }, { scales }).errors).toEqual([
      'Un ejercicio con ayuda necesita una escala (por ejemplo, bandas).',
    ])
    expect(validateExercise(assisted, { scales }).errors).toEqual([])
  })

  it('rechaza un enlace que no es de YouTube', () => {
    const { errors, exercise } = validateExercise({ ...valid(), videoUrl: 'https://vimeo.com/123' }, { scales })
    expect(errors).toEqual(['El enlace del vídeo no es de YouTube. Pega la dirección completa del vídeo.'])
    expect(exercise).toBeNull()
  })

  it('junta todos los errores a la vez', () => {
    const { errors } = validateExercise({ ...blankExercise(), videoUrl: 'hola' }, { scales })
    expect(errors).toHaveLength(3)
  })
})

describe('newExerciseId', () => {
  it('genera identificadores distintos', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newExerciseId()))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^custom-/)
  })
})

describe('groupExercises', () => {
  const list = [
    { id: 'a', name: 'Remo', muscleGroups: ['back'] },
    { id: 'b', name: 'Sentadilla', muscleGroups: ['quads', 'glutes'] },
    { id: 'c', name: 'Dominadas', muscleGroups: ['back', 'biceps'] },
    { id: 'd', name: 'Flexiones', muscleGroups: ['chest'] },
  ]

  it('agrupa por grupo principal, en el orden de los grupos, y por nombre dentro', () => {
    const groups = groupExercises(list)
    expect(groups.map((g) => g.label)).toEqual(['Pecho', 'Espalda', 'Cuádriceps'])
    expect(groups[1].exercises.map((e) => e.name)).toEqual(['Dominadas', 'Remo'])
  })

  it('un ejercicio sin grupo va a "Otros" al final', () => {
    const groups = groupExercises([...list, { id: 'z', name: 'Raro', muscleGroups: [] }])
    expect(groups.at(-1).label).toBe('Otros')
  })
})

describe('searchExercises', () => {
  const list = [
    { id: 'a', name: 'Sentadilla con lastre', muscleGroups: ['quads', 'glutes'] },
    { id: 'b', name: 'Dominadas con banda', muscleGroups: ['back', 'biceps'] },
    { id: 'c', name: 'Curl de bíceps', muscleGroups: ['biceps'] },
  ]

  it('ignora mayúsculas y acentos', () => {
    expect(searchExercises(list, 'BICEPS').map((e) => e.id)).toEqual(['b', 'c'])
    expect(searchExercises(list, 'dominada').map((e) => e.id)).toEqual(['b'])
  })

  it('busca también por grupo muscular', () => {
    expect(searchExercises(list, 'glúteos').map((e) => e.id)).toEqual(['a'])
  })

  it('un texto vacío devuelve todo', () => {
    expect(searchExercises(list, '   ')).toHaveLength(3)
  })
})
