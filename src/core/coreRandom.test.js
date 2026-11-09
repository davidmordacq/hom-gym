import { describe, expect, it } from 'vitest'
import { sessionStats } from './analysis.js'
import { DEFAULT_TEMPLATES } from './defaultData.js'
import { CORE_REST_POOL_IDS, DEFAULT_EXERCISES } from './exerciseLibrary.js'
import { validateTemplate, weeklyGroupFrequency } from './templates.js'
import {
  buildSet, chooseCore, coreAvoidFor, drawCore, sessionSummary, shuffle, skipExercise, skipNextSet, startStrengthSession, touchExercise,
} from './workout.js'

const exercises = DEFAULT_EXERCISES
const upper = DEFAULT_TEMPLATES[0]
const lower = DEFAULT_TEMPLATES[1]
const NOW = new Date('2026-11-09T18:00:00Z')

/** Generador "al azar" repetible para las pruebas. */
function seededRandom(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('core aleatorio en los descansos', () => {
  const pool = ['a', 'b', 'c', 'd', 'e']

  it('shuffle mezcla sin perder ni repetir elementos y sin tocar la lista original', () => {
    const original = [1, 2, 3, 4, 5, 6]
    const mixed = shuffle(original, seededRandom(1))
    expect([...mixed].sort()).toEqual(original)
    expect(original).toEqual([1, 2, 3, 4, 5, 6])
    expect(shuffle([], seededRandom(1))).toEqual([])
  })

  it('con los mismos números "al azar" sale siempre lo mismo (se puede probar)', () => {
    expect(drawCore({ pool, random: seededRandom(7) })).toEqual(drawCore({ pool, random: seededRandom(7) }))
  })

  it('salen todos los del conjunto antes de que se repita ninguno', () => {
    const random = seededRandom(3)
    let bag = []
    let last = null
    const seen = []
    for (let i = 0; i < pool.length; i++) {
      const draw = drawCore({ bag, pool, lastId: last, random })
      seen.push(draw.id)
      bag = draw.bag
      last = draw.id
    }
    expect([...seen].sort()).toEqual(pool)
  })

  it('nunca sale el mismo dos descansos seguidos, ni siquiera al rellenar la bolsa (probado con muchas semillas)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const random = seededRandom(seed)
      let bag = []
      let last = null
      for (let i = 0; i < 40; i++) {
        const draw = drawCore({ bag, pool, lastId: last, random })
        expect(draw.id, `semilla ${seed}, descanso ${i}`).not.toBe(last)
        bag = draw.bag
        last = draw.id
      }
    }
  })

  it('con dos ejercicios alterna sin repetir', () => {
    const random = seededRandom(5)
    let bag = []
    let last = null
    const seen = []
    for (let i = 0; i < 8; i++) {
      const draw = drawCore({ bag, pool: ['x', 'y'], lastId: last, random })
      seen.push(draw.id)
      bag = draw.bag
      last = draw.id
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1])
  })

  it('con un solo ejercicio siempre sale ese, y sin ninguno no sale nada', () => {
    expect(drawCore({ pool: ['solo'], lastId: 'solo' }).id).toBe('solo')
    expect(drawCore({ pool: [] })).toEqual({ id: null, bag: [] })
  })

  it('si el conjunto cambia a mitad de sesión, la bolsa descarta los que ya no están', () => {
    const draw = drawCore({ bag: ['a', 'zzz', 'b'], pool: ['a', 'b'], lastId: null, random: seededRandom(1) })
    expect(draw.id).toBe('a')
    expect(draw.bag).toEqual(['b'])
  })

  it('un conjunto con ids repetidos no sesga la elección', () => {
    const draw = drawCore({ pool: ['a', 'a', 'b'], random: seededRandom(2) })
    expect(['a', 'b']).toContain(draw.id)
    expect(draw.bag).toHaveLength(1)
  })

  it('a la larga reparte por igual entre todos (500 descansos con 5 ejercicios: 100 cada uno)', () => {
    const counts = Object.fromEntries(pool.map((id) => [id, 0]))
    const random = seededRandom(11)
    let bag = []
    let last = null
    for (let i = 0; i < 500; i++) {
      const draw = drawCore({ bag, pool, lastId: last, random })
      counts[draw.id] += 1
      bag = draw.bag
      last = draw.id
    }
    for (const id of pool) expect(counts[id]).toBe(100)
  })

  it('chooseCore: descanso puro, uno fijo o uno aleatorio', () => {
    expect(chooseCore({ mode: null, pool })).toEqual({ id: null, bag: [] })
    expect(chooseCore({ mode: '', pool })).toEqual({ id: null, bag: [] })
    expect(chooseCore({ mode: 'plank', pool, bag: ['a'] })).toEqual({ id: 'plank', bag: ['a'] }) // fijo: no toca la bolsa
    const random = chooseCore({ mode: 'random', pool, random: seededRandom(4) })
    expect(pool).toContain(random.id)
    expect(random.bag).toHaveLength(4)
  })

  it('avoid: lo que hay que evitar no sale, pero se queda en la bolsa para otro descanso', () => {
    const draw = drawCore({ bag: ['p', 'a', 'b'], pool: ['a', 'b', 'p'], avoid: ['p'], random: seededRandom(1) })
    expect(draw.id).toBe('a')
    expect(draw.bag).toEqual(['p', 'b'])
    // sin nada que evitar, sale el primero de la bolsa como siempre
    expect(drawCore({ bag: ['p', 'a'], pool: ['a', 'p'] }).id).toBe('p')
  })

  it('avoid: si la bolsa solo tiene lo que se evita, se rellena con lo demás y lo evitado sigue pendiente', () => {
    const draw = drawCore({ bag: ['p'], pool: ['a', 'b', 'p'], avoid: ['p'], random: seededRandom(1) })
    expect(['a', 'b']).toContain(draw.id)
    expect(draw.bag).toContain('p')
    expect(draw.bag).toHaveLength(2)
    expect(drawCore({ bag: ['p'], pool: ['a', 'b', 'p'], avoid: ['p'], lastId: 'a', random: seededRandom(2) }).id).toBe('b')
  })

  it('avoid: si todo el conjunto se evita no sale nada (descanso puro) y la bolsa se conserva', () => {
    expect(drawCore({ bag: ['p'], pool: ['p', 'q'], avoid: ['p', 'q'] })).toEqual({ id: null, bag: ['p'] })
  })

  it('avoid: nunca sale lo evitado en 300 descansos, y fuera de esos descansos sí sale', () => {
    const random = seededRandom(9)
    let bag = []
    let last = null
    let planksElsewhere = 0
    for (let i = 0; i < 300; i++) {
      const afterPullUp = i % 2 === 0
      const draw = drawCore({ bag, pool: ['a', 'b', 'c', 'plank'], lastId: last, avoid: afterPullUp ? ['plank'] : [], random })
      if (afterPullUp) expect(draw.id).not.toBe('plank')
      else if (draw.id === 'plank') planksElsewhere += 1
      expect(draw.id).not.toBe(last)
      bag = draw.bag
      last = draw.id
    }
    expect(planksElsewhere).toBeGreaterThan(20)
  })

  it('las planchas no salen en el descanso de dominadas ni de dominadas supinas, pero sí en el de otros ejercicios', () => {
    const byId = new Map(exercises.map((e) => [e.id, e]))
    for (const id of ['assisted-pull-up', 'assisted-chin-up']) expect(coreAvoidFor(byId.get(id)).sort(), id).toEqual(['plank', 'side-plank'])
    for (const id of ['push-up', 'close-push-up', 'banded-lateral-raise', 'banded-front-raise', 'bulgarian-split-squat', 'single-leg-rdl', 'goblet-squat']) {
      expect(coreAvoidFor(byId.get(id)), id).toEqual([])
    }
    expect(coreAvoidFor(null)).toEqual([])
    expect(coreAvoidFor({ id: 'x', muscleGroups: [] })).toEqual([])
  })

  it('en una sesión de tren superior entera, con el conjunto por defecto, ninguna plancha cae tras unas dominadas', () => {
    const byId = new Map(exercises.map((e) => [e.id, e]))
    for (let seed = 1; seed <= 100; seed++) {
      const random = seededRandom(seed)
      let bag = []
      let last = null
      for (let round = 0; round < 3; round++) {
        for (const item of upper.items) {
          for (let n = 0; n < item.sets; n++) {
            const draw = chooseCore({
              mode: item.coreExerciseId,
              pool: CORE_REST_POOL_IDS,
              bag,
              lastId: last,
              avoid: coreAvoidFor(byId.get(item.exerciseId)),
              random,
            })
            if (!draw.id) continue
            if (item.exerciseId.includes('pull-up') || item.exerciseId.includes('chin-up')) {
              expect(['plank', 'side-plank'], `semilla ${seed}`).not.toContain(draw.id)
            }
            bag = draw.bag
            last = draw.id
          }
        }
      }
    }
  })

  it('la sesión empieza con la bolsa vacía y la serie guarda qué core se propuso', () => {
    const s = startStrengthSession({ template: upper, now: NOW, id: 'c1' })
    expect(s).toMatchObject({ coreBag: [], lastCoreId: null })
    expect(buildSet({ session: s, exerciseId: 'push-up', order: 1, reps: 8, levelId: null, coreExerciseId: 'swimmer' }).coreExerciseId).toBe('swimmer')
    expect(buildSet({ session: s, exerciseId: 'push-up', order: 1, reps: 8, levelId: null }).coreExerciseId).toBeNull()
  })
})

describe('saltar serie y saltar ejercicio', () => {
  const base = startStrengthSession({ template: upper, now: NOW, id: 'k1' })
  const target = (s, id) => s.exercises.find((e) => e.exerciseId === id)

  it('saltar la serie que toca deja el ejercicio con una serie menos', () => {
    expect(target(skipNextSet(base, 'push-up', 0), 'push-up').targetSets).toBe(2)
    expect(target(skipNextSet(skipNextSet(base, 'push-up', 1), 'push-up', 1), 'push-up').targetSets).toBe(1)
  })

  it('nunca baja de las series ya hechas', () => {
    expect(target(skipNextSet(base, 'push-up', 3), 'push-up').targetSets).toBe(3)
    const thrice = skipNextSet(skipNextSet(skipNextSet(base, 'push-up', 2), 'push-up', 2), 'push-up', 2)
    expect(target(thrice, 'push-up').targetSets).toBe(2)
  })

  it('saltar una serie no toca a los demás ejercicios ni cambia el original', () => {
    const after = skipNextSet(base, 'push-up', 0)
    expect(target(after, 'assisted-pull-up').targetSets).toBe(3)
    expect(target(base, 'push-up').targetSets).toBe(3)
  })

  it('saltar un ejercicio lo marca como saltado y hacer una serie después lo desmarca', () => {
    const skipped = skipExercise(base, 'push-up')
    expect(target(skipped, 'push-up').skipped).toBe(true)
    expect(target(skipped, 'assisted-pull-up').skipped).toBeUndefined()
    expect(target(touchExercise(skipped, 'push-up', NOW), 'push-up').skipped).toBe(false)
  })

  it('el resumen distingue "saltado" de "sin series" y no marca como saltado el que sí tiene series', () => {
    const skipped = skipExercise(skipExercise(base, 'push-up'), 'assisted-pull-up')
    const sets = [buildSet({ session: skipped, exerciseId: 'assisted-pull-up', order: 1, reps: 8, levelId: 'band-green' })]
    const summary = sessionSummary(skipped, sets, DEFAULT_EXERCISES)
    expect(summary.perExercise.find((e) => e.exerciseId === 'push-up').skipped).toBe(true)
    expect(summary.perExercise.find((e) => e.exerciseId === 'assisted-pull-up').skipped).toBe(false)
    expect(summary.perExercise.find((e) => e.exerciseId === 'close-push-up').skipped).toBe(false)
  })
})

describe('core de los descansos con ejercicios de lumbares', () => {
  it('el tiempo del core del descanso se anota siempre como core, sea el ejercicio que sea (abdominal o lumbar)', () => {
    const s = {
      id: 's1', type: 'strength', status: 'done', date: '2026-11-09', startedAt: '2026-11-09T18:00:00Z', restSeconds: 120,
      exercises: [{ exerciseId: 'push-up', coreExerciseId: 'random' }],
    }
    const set = (order, time, extra = {}) => ({ sessionId: 's1', exerciseId: 'push-up', order, reps: 9, completedAt: `2026-11-09T${time}Z`, ...extra })
    const sets = [
      set(1, '18:01:00', { coreAfter: true, coreExerciseId: 'swimmer' }),
      set(2, '18:04:00', { coreAfter: true, coreExerciseId: 'russian-twist' }),
      set(3, '18:07:00'),
    ]
    const { byGroup } = sessionStats(s, sets, exercises)
    expect(byGroup.core).toMatchObject({ seconds: 180, sets: 2 })
    expect(byGroup.back).toBeUndefined() // el nadador no cuenta como espalda
    expect(byGroup.chest.seconds).toBe(420 - 180)
  })
})

describe('core aleatorio en las sesiones', () => {
  const strengthSlot = (id, templateId) => ({ id, weekday: 1, type: 'strength', name: 'Fuerza', flexible: true, templateId })

  it('"random" es un valor válido para el core de un ejercicio', () => {
    const t = { id: 'x', name: 'X', order: 1, items: [{ exerciseId: 'push-up', sets: 3, perSide: false, coreExerciseId: 'random' }] }
    const { errors, template } = validateTemplate(t, { exercises })
    expect(errors).toEqual([])
    expect(template.items[0].coreExerciseId).toBe('random')
  })

  it('un core fijo que no existe sigue siendo un error', () => {
    const t = { id: 'x', name: 'X', order: 1, items: [{ exerciseId: 'push-up', sets: 3, perSide: false, coreExerciseId: 'inventado' }] }
    expect(validateTemplate(t, { exercises }).errors[0]).toMatch(/core/)
  })

  it('con core aleatorio, el core cuenta como grupo trabajado', () => {
    const t = { id: 't', name: 'T', order: 1, items: [{ exerciseId: 'push-up', sets: 3, perSide: false, coreExerciseId: 'random' }] }
    const f = weeklyGroupFrequency({ plan: [strengthSlot('a', 't')], templates: [t], exercises })
    expect(f.core).toBe(1)
    expect(f.back).toBeUndefined()
  })

  it('las sesiones de partida usan core aleatorio donde antes tenían uno fijo, y descanso puro donde no tenían', () => {
    for (const template of DEFAULT_TEMPLATES) {
      for (const item of template.items) expect([null, 'random']).toContain(item.coreExerciseId)
    }
    expect(upper.items.filter((i) => i.coreExerciseId === 'random')).toHaveLength(5)
    expect(lower.items.filter((i) => i.coreExerciseId === 'random')).toHaveLength(4)
  })
})
