import { describe, expect, it } from 'vitest'
import { evaluateExercise, groupSetsBySession, summarizeSession } from './progression.js'
import { getRulesForExercise } from './progressionConfig.js'

// Escala de prueba: de banda más suave a más dura.
const bands = {
  id: 'bands',
  name: 'Bandas',
  levels: [
    { id: 'blue', label: 'Azul' },
    { id: 'green', label: 'Verde' },
    { id: 'black', label: 'Negra' },
  ],
}

const pullups = { id: 'dominadas', name: 'Dominadas', resistanceType: 'assisted', scaleId: 'bands' }
const row = { id: 'remo', name: 'Remo con banda', resistanceType: 'resisted', scaleId: 'bands' }

let counter = 0
/** Crea una sesión: session('2025-01-01', 'green', [10, 8, 8, 7]) */
function session(date, levelId, reps) {
  counter += 1
  return {
    sessionId: `s${counter}`,
    date,
    sets: reps.map((r, i) => ({ order: i + 1, reps: r, levelId })),
  }
}

/** Crea varias sesiones del mismo nivel con fechas consecutivas. */
function run(levelId, repsList, startDay = 1) {
  return repsList.map((reps, i) => session(`2025-01-${String(startDay + i).padStart(2, '0')}`, levelId, reps))
}

const evaluate = (exercise, sessions, rules) => evaluateExercise({ exercise, scale: bands, sessions, rules })

describe('sin historial', () => {
  it('recomienda empezar', () => {
    const result = evaluate(pullups, [])
    expect(result.action).toBe('start')
    expect(result.repRange).toEqual({ min: 8, max: 10 })
  })
})

describe('subir de nivel (tope del rango en todas las series)', () => {
  it('ejemplo real: dominadas con banda verde 10, 8, 8, 7 -> sigue intentando llegar al tope', () => {
    const result = evaluate(pullups, [session('2025-01-01', 'green', [10, 8, 8, 7])], {
      ...getRulesForExercise(), targetSets: 4,
    })
    expect(result.action).toBe('add_reps')
  })

  it('con asistencia: 10 en todas las series con banda verde -> banda MÁS SUAVE (azul)', () => {
    const result = evaluate(pullups, [session('2025-01-01', 'green', [10, 10, 10])])
    expect(result.action).toBe('increase_load')
    expect(result.nextLevelId).toBe('blue')
  })

  it('con resistencia: 10 en todas las series con banda verde -> banda MÁS DURA (negra)', () => {
    const result = evaluate(row, [session('2025-01-01', 'green', [10, 10, 10])])
    expect(result.action).toBe('increase_load')
    expect(result.nextLevelId).toBe('black')
  })

  it('con asistencia: tope con la banda más suave -> sin banda', () => {
    const result = evaluate(pullups, [session('2025-01-01', 'blue', [10, 10, 10])])
    expect(result.action).toBe('increase_load')
    expect(result.nextLevelId).toBe('none')
  })

  it('con asistencia: tope sin banda -> ya es el nivel máximo', () => {
    const result = evaluate(pullups, [session('2025-01-01', 'none', [10, 10, 10])])
    expect(result.action).toBe('max_level')
    expect(result.nextLevelId).toBeNull()
  })

  it('con resistencia: tope con la banda más dura -> nivel máximo', () => {
    const result = evaluate(row, [session('2025-01-01', 'black', [10, 10, 10])])
    expect(result.action).toBe('max_level')
  })

  it('superar el tope también cuenta (12, 11, 10)', () => {
    const result = evaluate(row, [session('2025-01-01', 'green', [12, 11, 10])])
    expect(result.action).toBe('increase_load')
  })

  it('una serie por debajo del tope impide subir (10, 10, 9)', () => {
    const result = evaluate(row, [session('2025-01-01', 'green', [10, 10, 9])])
    expect(result.action).toBe('add_reps')
  })

  it('hacer menos series de las previstas no cuenta como tope (10, 10 con 3 series)', () => {
    const result = evaluate(row, [session('2025-01-01', 'green', [10, 10])])
    expect(result.action).toBe('add_reps')
  })

  it('las series extra por encima de las previstas se ignoran', () => {
    const result = evaluate(row, [session('2025-01-01', 'green', [10, 10, 10, 4])])
    expect(result.action).toBe('increase_load')
  })

  it('un ejercicio sin escala de resistencia en el tope -> nivel máximo', () => {
    const noScale = { id: 'plancha', name: 'Plancha', resistanceType: 'resisted', scaleId: null }
    const sessions = [{ sessionId: 'x', date: '2025-01-01', sets: [10, 10, 10].map((r, i) => ({ order: i + 1, reps: r, levelId: null })) }]
    const result = evaluateExercise({ exercise: noScale, scale: null, sessions })
    expect(result.action).toBe('max_level')
  })
})

describe('reglas ajustables', () => {
  it('sessionsToConfirmTop = 2 exige dos sesiones seguidas en el tope', () => {
    const rules = { ...getRulesForExercise(), sessionsToConfirmTop: 2 }
    const one = evaluate(row, run('green', [[10, 10, 10]]), rules)
    expect(one.action).toBe('add_reps')
    const two = evaluate(row, run('green', [[10, 10, 10], [10, 10, 10]]), rules)
    expect(two.action).toBe('increase_load')
  })

  it('con sessionsToConfirmTop = 2, un tope seguido de otro nivel no suma', () => {
    const rules = { ...getRulesForExercise(), sessionsToConfirmTop: 2 }
    const sessions = [
      session('2025-01-01', 'green', [10, 10, 10]),
      session('2025-01-02', 'black', [10, 10, 10]),
    ]
    expect(evaluate(row, sessions, rules).action).toBe('add_reps')
  })

  it('un ejercicio puede tener su propio rango y series', () => {
    const custom = { ...row, rules: { repRange: { min: 5, max: 6 }, targetSets: 2 } }
    const result = evaluate(custom, [session('2025-01-01', 'green', [6, 6])])
    expect(result.action).toBe('increase_load')
    expect(result.repRange).toEqual({ min: 5, max: 6 })
    expect(result.targetSets).toBe(2)
  })

  it('las reglas globales cambian el comportamiento de todos los ejercicios', () => {
    const rules = { ...getRulesForExercise(), repRange: { min: 6, max: 8 } }
    const result = evaluate(row, [session('2025-01-01', 'green', [8, 8, 8])], rules)
    expect(result.action).toBe('increase_load')
  })
})

describe('retroceso y estancamiento', () => {
  it('las repeticiones bajan varias sesiones seguidas pero dentro del rango -> descansar', () => {
    const sessions = run('green', [[9, 9, 9], [9, 9, 8], [9, 8, 8], [8, 8, 8]])
    expect(evaluate(row, sessions).action).toBe('rest')
  })

  it('bajan y ya están por debajo del rango -> reducir un nivel', () => {
    const sessions = run('green', [[8, 8, 8], [8, 7, 7], [7, 7, 7], [7, 6, 6]])
    const result = evaluate(row, sessions)
    expect(result.action).toBe('decrease_load')
    expect(result.nextLevelId).toBe('blue')
  })

  it('con asistencia, reducir significa una banda MÁS DURA', () => {
    const sessions = run('blue', [[8, 8, 8], [8, 7, 7], [7, 7, 7], [7, 6, 6]])
    const result = evaluate(pullups, sessions)
    expect(result.action).toBe('decrease_load')
    expect(result.nextLevelId).toBe('green')
  })

  it('bajan por debajo del rango en el nivel más fácil -> descansar', () => {
    const sessions = run('blue', [[8, 8, 8], [8, 7, 7], [7, 7, 7], [7, 6, 6]])
    expect(evaluate(row, sessions).action).toBe('rest')
  })

  it('no hay retroceso con solo dos sesiones bajando', () => {
    const sessions = run('green', [[9, 9, 9], [9, 9, 8], [9, 8, 8]])
    expect(evaluate(row, sessions).action).toBe('add_reps')
  })

  it('sin mejorar durante varias sesiones dentro del rango -> mantener', () => {
    const sessions = run('green', [[9, 9, 8], [9, 9, 8], [9, 9, 8], [9, 9, 8]])
    expect(evaluate(row, sessions).action).toBe('keep')
  })

  it('sin mejorar y por debajo del rango -> reducir', () => {
    const sessions = run('green', [[7, 7, 7], [7, 7, 7], [7, 7, 7], [7, 7, 7]])
    const result = evaluate(row, sessions)
    expect(result.action).toBe('decrease_load')
    expect(result.nextLevelId).toBe('blue')
  })

  it('una mejora dentro de la ventana evita el estancamiento', () => {
    const sessions = run('green', [[9, 9, 8], [9, 9, 8], [9, 9, 9], [9, 9, 8]])
    expect(evaluate(row, sessions).action).toBe('add_reps')
  })

  it('tras subir de nivel, repeticiones bajas al principio son normales', () => {
    const sessions = [
      ...run('green', [[10, 10, 10]], 1),
      ...run('black', [[6, 6, 5]], 2),
    ]
    expect(evaluate(row, sessions).action).toBe('add_reps')
  })

  it('el historial de otro nivel no cuenta para el estancamiento', () => {
    const sessions = [
      ...run('green', [[9, 9, 9], [9, 9, 9], [9, 9, 9]], 1),
      ...run('black', [[7, 7, 7]], 4),
    ]
    expect(evaluate(row, sessions).action).toBe('add_reps')
  })

  it('stagnationSessions y regressionSessions son ajustables', () => {
    const rules = { ...getRulesForExercise(), stagnationSessions: 2 }
    const sessions = run('green', [[9, 9, 8], [9, 9, 8], [9, 9, 8]])
    expect(evaluate(row, sessions, rules).action).toBe('keep')
    expect(evaluate(row, sessions).action).toBe('add_reps')
  })
})

describe('datos de entrada', () => {
  it('ordena las sesiones por fecha aunque lleguen desordenadas', () => {
    const sessions = [
      session('2025-01-03', 'green', [10, 10, 10]),
      session('2025-01-01', 'green', [8, 8, 8]),
      session('2025-01-02', 'green', [9, 9, 9]),
    ]
    const result = evaluate(row, sessions)
    expect(result.last.date).toBe('2025-01-03')
    expect(result.action).toBe('increase_load')
  })

  it('si una sesión mezcla niveles, manda el más usado', () => {
    const mixed = {
      sessionId: 'mixed',
      date: '2025-01-01',
      sets: [
        { order: 1, reps: 10, levelId: 'black' },
        { order: 2, reps: 10, levelId: 'green' },
        { order: 3, reps: 10, levelId: 'green' },
      ],
    }
    expect(evaluate(row, [mixed]).last.levelId).toBe('green')
  })

  it('en caso de empate manda el nivel más difícil', () => {
    const tie = {
      sessionId: 'tie',
      date: '2025-01-01',
      sets: [
        { order: 1, reps: 10, levelId: 'green' },
        { order: 2, reps: 10, levelId: 'black' },
      ],
    }
    expect(evaluate(row, [tie]).last.levelId).toBe('black')
    // en ejercicios asistidos, lo más difícil es la banda más suave
    const tieAssisted = { ...tie, sets: tie.sets.map((s) => ({ ...s, levelId: s.levelId === 'green' ? 'blue' : 'green' })) }
    expect(evaluate(pullups, [tieAssisted]).last.levelId).toBe('blue')
  })

  it('ignora series con repeticiones no válidas', () => {
    const dirty = {
      sessionId: 'dirty',
      date: '2025-01-01',
      sets: [
        { order: 1, reps: 10, levelId: 'green' },
        { order: 2, reps: NaN, levelId: 'green' },
        { order: 3, reps: undefined, levelId: 'green' },
        { order: 4, reps: 10, levelId: 'green' },
        { order: 5, reps: 10, levelId: 'green' },
      ],
    }
    expect(evaluate(row, [dirty]).action).toBe('increase_load')
  })

  it('una sesión sin ninguna serie válida se ignora', () => {
    const empty = { sessionId: 'e', date: '2025-01-01', sets: [{ order: 1, reps: NaN, levelId: 'green' }] }
    expect(evaluate(row, [empty]).action).toBe('start')
  })

  it('avisa si el nivel registrado ya no existe en la lista', () => {
    const result = evaluate(row, [session('2025-01-01', 'banda-borrada', [10, 10, 10])])
    expect(result.action).toBe('unknown_level')
  })

  it('una serie de 0 repeticiones (fallo) es válida y cuenta', () => {
    const result = evaluate(row, [session('2025-01-01', 'green', [10, 10, 0])])
    expect(result.action).toBe('add_reps')
    expect(result.last.totalReps).toBe(20)
  })
})

describe('summarizeSession y groupSetsBySession', () => {
  it('las series que faltan cuentan como 0 repeticiones', () => {
    const rules = getRulesForExercise()
    const summary = summarizeSession(session('2025-01-01', 'green', [10, 10]), row, bands, rules)
    expect(summary.totalReps).toBe(20)
    expect(summary.allAtTop).toBe(false)
  })

  it('agrupa series sueltas por sesión', () => {
    const grouped = groupSetsBySession([
      { sessionId: 'a', date: '2025-01-01', order: 1, reps: 10, levelId: 'green' },
      { sessionId: 'b', date: '2025-01-03', order: 1, reps: 9, levelId: 'green' },
      { sessionId: 'a', date: '2025-01-01', order: 2, reps: 9, levelId: 'green' },
    ])
    expect(grouped).toHaveLength(2)
    expect(grouped[0].sets).toHaveLength(2)
    expect(grouped[1].sessionId).toBe('b')
  })
})
