import { describe, expect, it } from 'vitest'
import { DEFAULT_SCALES, MUSCLE_GROUPS, MUSCLE_REGIONS, regionOfGroup } from './defaultData.js'
import { DEFAULT_EXERCISES } from './exerciseLibrary.js'
import { DEFAULT_PROGRESSION_RULES } from './progressionConfig.js'
import { blankExercise, groupExercises, mainMuscleGroup, newExerciseId, searchExercises, targetText, toDraft, validateExercise } from './exercises.js'

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

describe('unidad y rango propio del ejercicio', () => {
  it('por defecto se mide en repeticiones y no guarda reglas propias', () => {
    const { exercise } = validateExercise(valid(), { scales })
    expect(exercise.unit).toBe('reps')
    expect(exercise.rules).toBeUndefined()
    expect(exercise).not.toHaveProperty('rangeMin')
    expect(exercise).not.toHaveProperty('rangeMax')
  })

  it('un ejercicio en segundos guarda su rango en las reglas del ejercicio', () => {
    const { errors, exercise } = validateExercise({ ...valid(), unit: 'seconds', rangeMin: '30', rangeMax: 45 }, { scales })
    expect(errors).toEqual([])
    expect(exercise.unit).toBe('seconds')
    expect(exercise.rules).toEqual({ repRange: { min: 30, max: 45 } })
  })

  it('en segundos el rango es obligatorio', () => {
    expect(validateExercise({ ...valid(), unit: 'seconds' }, { scales }).errors).toEqual([
      'Un ejercicio en segundos necesita su rango objetivo (por ejemplo, de 30 a 45 segundos).',
    ])
  })

  it('en repeticiones el rango propio es opcional pero, si se pone, debe ser coherente', () => {
    expect(validateExercise({ ...valid(), rangeMin: 5, rangeMax: 8 }, { scales }).exercise.rules).toEqual({ repRange: { min: 5, max: 8 } })
    const half = 'Rellena los dos números del rango objetivo (mínimo y máximo) o deja los dos vacíos.'
    expect(validateExercise({ ...valid(), rangeMin: 5 }, { scales }).errors).toEqual([half])
    expect(validateExercise({ ...valid(), rangeMax: 8 }, { scales }).errors).toEqual([half])
    const bad = 'El rango objetivo debe ser de números enteros desde 1, con el mínimo no mayor que el máximo.'
    expect(validateExercise({ ...valid(), rangeMin: 10, rangeMax: 8 }, { scales }).errors).toEqual([bad])
    expect(validateExercise({ ...valid(), rangeMin: 0, rangeMax: 8 }, { scales }).errors).toEqual([bad])
    expect(validateExercise({ ...valid(), rangeMin: 5.5, rangeMax: 8 }, { scales }).errors).toEqual([bad])
    expect(validateExercise({ ...valid(), rangeMin: 'a', rangeMax: 8 }, { scales }).errors).toEqual([bad])
  })

  it('al vaciar el rango se quita, pero se conservan las demás reglas propias', () => {
    const stored = { ...valid(), rules: { targetSets: 4, repRange: { min: 5, max: 8 } } }
    const draft = { ...toDraft(stored), rangeMin: '', rangeMax: '' }
    const { exercise } = validateExercise(draft, { scales })
    expect(exercise.rules).toEqual({ targetSets: 4 })
    const { exercise: cleared } = validateExercise({ ...toDraft({ ...valid(), rules: { repRange: { min: 5, max: 8 } } }), rangeMin: '', rangeMax: '' }, { scales })
    expect(cleared.rules).toBeUndefined()
  })

  it('toDraft y validateExercise son inversos: abrir y guardar sin cambios no altera el ejercicio', () => {
    const stored = { ...valid(), id: 'p', unit: 'seconds', rules: { repRange: { min: 30, max: 45 } } }
    const clean = validateExercise(toDraft(stored), { scales }).exercise
    expect(clean.rules).toEqual({ repRange: { min: 30, max: 45 } })
    expect(validateExercise(toDraft(clean), { scales }).exercise).toEqual(clean)
  })

  it('rechaza una unidad desconocida', () => {
    expect(validateExercise({ ...valid(), unit: 'minutos' }, { scales }).errors).toEqual([
      'Elige si el ejercicio se mide en repeticiones o en segundos.',
    ])
  })
})

describe('targetText', () => {
  it('dice el objetivo con el rango general o el propio', () => {
    expect(targetText({ unit: 'reps' }, DEFAULT_PROGRESSION_RULES)).toBe('3 series de 8-10 repeticiones')
    expect(targetText({ unit: 'seconds', rules: { repRange: { min: 30, max: 45 } } }, DEFAULT_PROGRESSION_RULES)).toBe(
      '3 series de 30-45 segundos',
    )
    expect(targetText({ rules: { targetSets: 4, repRange: { min: 5 } } }, { ...DEFAULT_PROGRESSION_RULES, repRange: { min: 8, max: 10 } })).toBe(
      '4 series de 5-10 repeticiones',
    )
  })
})

describe('región y grupo principal (análisis)', () => {
  it('un ejercicio se anota en su grupo principal: el primero de la lista', () => {
    expect(mainMuscleGroup({ muscleGroups: ['triceps', 'chest', 'shoulders'] })).toBe('triceps')
    expect(mainMuscleGroup({ muscleGroups: [] })).toBeNull()
    expect(mainMuscleGroup(undefined)).toBeNull()
  })

  it('cada grupo muscular pertenece a una sola región: superior, inferior o core', () => {
    for (const group of MUSCLE_GROUPS) {
      const regions = MUSCLE_REGIONS.filter((r) => r.groups.includes(group.id))
      expect(regions, group.id).toHaveLength(1)
    }
    expect(MUSCLE_REGIONS.flatMap((r) => r.groups).sort()).toEqual(MUSCLE_GROUPS.map((g) => g.id).sort())
  })

  it('regionOfGroup', () => {
    expect(regionOfGroup('chest')).toBe('upper')
    expect(regionOfGroup('back')).toBe('upper')
    expect(regionOfGroup('glutes')).toBe('lower')
    expect(regionOfGroup('calves')).toBe('lower')
    expect(regionOfGroup('core')).toBe('core')
    expect(regionOfGroup('nada')).toBeNull()
  })

  it('todos los ejercicios de la biblioteca tienen grupo principal con región', () => {
    for (const exercise of DEFAULT_EXERCISES) expect(regionOfGroup(mainMuscleGroup(exercise)), exercise.id).not.toBeNull()
  })
})
