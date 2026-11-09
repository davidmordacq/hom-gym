import { describe, expect, it } from 'vitest'
import { DEFAULT_SCALES, DEFAULT_TEMPLATES } from './defaultData.js'
import { DEFAULT_EXERCISES } from './exerciseLibrary.js'
import { suggestNextTemplateId } from './templates.js'
import {
  WARNING_SECONDS, activeMillis, addSetToExercise, buildSet, finishMobilitySession, pauseSession, resumeSession, startMobilitySession, crossedEnd, crossedWarning, defaultLevelId, defaultReps, durationMinutes,
  finishSession, formatClock, goToExercise, lastPerformance, lastPerformanceText, repStep, restRemaining, sessionSummary,
  setExerciseNotes, setId, startStrengthSession, toQuickDraft, touchExercise, validateQuickLog,
} from './workout.js'

const upper = DEFAULT_TEMPLATES[0]
const exercise = (id) => DEFAULT_EXERCISES.find((e) => e.id === id)
const bands = DEFAULT_SCALES.find((s) => s.id === 'bands')
const at = (iso) => new Date(iso)
const NOW = at('2026-11-09T18:00:00Z')

describe('startStrengthSession', () => {
  const session = startStrengthSession({ template: upper, now: NOW, id: 's1' })

  it('empieza en curso, con la hora de inicio y el primer ejercicio abierto', () => {
    expect(session).toMatchObject({ id: 's1', type: 'strength', status: 'in_progress', templateId: 'tpl-upper', name: 'Tren superior', cursor: 0, endedAt: null, slotId: null })
    expect(session.startedAt).toBe('2026-11-09T18:00:00.000Z')
    expect(session.exercises[0].startedAt).toBe(session.startedAt)
    expect(session.exercises[1].startedAt).toBeNull()
  })

  it('guarda una copia de los ejercicios: cambiar la sesión tipo después no la altera', () => {
    const copy = JSON.parse(JSON.stringify(upper))
    const s = startStrengthSession({ template: copy, now: NOW, id: 's2' })
    copy.items[0].sets = 9
    copy.items.pop()
    expect(s.exercises).toHaveLength(upper.items.length)
    expect(s.exercises[0]).toMatchObject({ exerciseId: 'assisted-pull-up', targetSets: 3, coreExerciseId: 'random' })
  })

  it('la fecha es la del día local en que empieza, y puede venir de un hueco del plan', () => {
    expect(startStrengthSession({ template: upper, now: new Date(2026, 10, 7, 23, 50), slotId: 'sat' }).date).toBe('2026-11-07')
    expect(startStrengthSession({ template: upper, now: NOW, slotId: 'mon-strength' }).slotId).toBe('mon-strength')
  })
})

describe('movimiento por la sesión', () => {
  const base = startStrengthSession({ template: upper, now: NOW, id: 's1' })

  it('goToExercise apunta la primera entrada y no se sale de la lista', () => {
    const later = at('2026-11-09T18:10:00Z')
    const s = goToExercise(base, 2, later)
    expect(s.cursor).toBe(2)
    expect(s.exercises[2].startedAt).toBe(later.toISOString())
    expect(goToExercise(s, -5, later).cursor).toBe(0)
    expect(goToExercise(s, 99, later).cursor).toBe(base.exercises.length - 1)
    // volver a entrar no cambia la primera hora de entrada
    expect(goToExercise(s, 2, at('2026-11-09T18:30:00Z')).exercises[2].startedAt).toBe(later.toISOString())
  })

  it('touchExercise apunta la última serie marcada de ese ejercicio', () => {
    const t = at('2026-11-09T18:05:00Z')
    const s = touchExercise(base, 'push-up', t)
    expect(s.exercises[1]).toMatchObject({ startedAt: t.toISOString(), endedAt: t.toISOString() })
    expect(s.exercises[0].endedAt).toBeNull()
  })

  it('añadir serie, notas y terminar no tocan lo demás', () => {
    expect(addSetToExercise(base, 'push-up').exercises[1].targetSets).toBe(4)
    expect(addSetToExercise(base, 'push-up').exercises[0].targetSets).toBe(3)
    expect(setExerciseNotes(base, 'push-up', 'fácil').exercises[1].notes).toBe('fácil')
    const done = finishSession(base, { notes: '  buena sesión ', now: at('2026-11-09T19:00:00Z') })
    expect(done).toMatchObject({ status: 'done', endedAt: '2026-11-09T19:00:00.000Z', notes: 'buena sesión' })
    expect(base.status).toBe('in_progress') // el original no cambia
  })

  it('buildSet crea la serie con un id fijo para poder volver a marcarla', () => {
    const set = buildSet({ session: base, exerciseId: 'push-up', order: 2, reps: 9, levelId: null, coreAfter: true, now: NOW })
    expect(set).toMatchObject({ id: 's1:push-up:2', sessionId: 's1', exerciseId: 'push-up', date: base.date, order: 2, reps: 9, levelId: null, coreAfter: true })
    expect(set.id).toBe(setId('s1', 'push-up', 2))
    expect(set.completedAt).toBe(NOW.toISOString())
  })
})

describe('lastPerformance (lo de la última vez)', () => {
  const session = (id, date, status = 'done', extra = {}) => ({ id, type: 'strength', status, date, startedAt: `${date}T18:00:00Z`, ...extra })
  const set = (sessionId, order, reps, levelId = 'band-green', exerciseId = 'assisted-pull-up') => ({ sessionId, exerciseId, order, reps, levelId })

  it('devuelve la sesión terminada más reciente con ese ejercicio, series en orden', () => {
    const sessions = [session('a', '2026-11-02'), session('b', '2026-11-04')]
    const sets = [set('a', 1, 8), set('b', 2, 9, 'band-blue'), set('b', 1, 10, 'band-green')]
    expect(lastPerformance('assisted-pull-up', sets, sessions)).toEqual({
      sessionId: 'b', date: '2026-11-04', reps: [10, 9], levelIds: ['band-green', 'band-blue'], levelId: 'band-blue',
    })
  })

  it('ignora sesiones en curso, la sesión excluida (la de hoy) y otros ejercicios', () => {
    const sessions = [session('a', '2026-11-02'), session('b', '2026-11-04', 'in_progress'), session('c', '2026-11-06')]
    const sets = [set('a', 1, 8), set('b', 1, 99), set('c', 1, 77), set('a', 1, 5, 'x', 'push-up')]
    expect(lastPerformance('assisted-pull-up', sets, sessions, { excludeSessionId: 'c' }).sessionId).toBe('a')
    expect(lastPerformance('assisted-pull-up', sets, sessions).sessionId).toBe('c')
  })

  it('manda la fecha, no el orden en que vengan los datos', () => {
    const sessions = [session('new', '2026-11-09'), session('old', '2026-11-01')]
    const sets = [set('new', 1, 10), set('old', 1, 5)]
    expect(lastPerformance('assisted-pull-up', sets, sessions).sessionId).toBe('new')
  })

  it('sin historial devuelve null', () => {
    expect(lastPerformance('assisted-pull-up', [], [])).toBeNull()
    expect(lastPerformance('push-up', [set('a', 1, 8)], [session('a', '2026-11-02')])).toBeNull()
  })

  it('el texto cuenta fecha, material y series, o dice que es la primera vez', () => {
    const last = { date: '2026-11-08', reps: [10, 9, 8], levelId: 'band-green' }
    const text = lastPerformanceText(last, exercise('assisted-pull-up'), bands)
    expect(text).toContain('Banda verde (media)')
    expect(text).toContain('10, 9, 8 repeticiones')
    expect(text).toMatch(/^8 nov/)
    expect(lastPerformanceText({ date: '2026-11-08', reps: [30, 28], levelId: null }, exercise('side-plank'), null)).toContain('30, 28 segundos')
    expect(lastPerformanceText(null, exercise('push-up'), null)).toMatch(/Primera vez/)
  })
})

describe('valores con los que aparece cada serie', () => {
  const last = { reps: [10, 9, 8], levelId: 'band-green' }

  it('las repeticiones salen de lo de la última vez serie a serie; si hay más series, repite la última', () => {
    expect(defaultReps(1, last, exercise('push-up'))).toBe(10)
    expect(defaultReps(3, last, exercise('push-up'))).toBe(8)
    expect(defaultReps(5, last, exercise('push-up'))).toBe(8)
  })

  it('la primera vez salen el mínimo del rango (8) o, en la plancha, 30 s', () => {
    expect(defaultReps(1, null, exercise('push-up'))).toBe(8)
    expect(defaultReps(1, null, exercise('plank'))).toBe(30)
  })

  it('el nivel sale de la serie anterior de hoy, o de la última vez; si es la primera vez, hay que elegirlo', () => {
    const pull = exercise('assisted-pull-up')
    expect(defaultLevelId({ exercise: pull, scale: bands, last, doneSets: [] })).toBe('band-green')
    expect(defaultLevelId({ exercise: pull, scale: bands, last, doneSets: [{ levelId: 'band-blue' }] })).toBe('band-blue')
    expect(defaultLevelId({ exercise: pull, scale: bands, last: null, doneSets: [] })).toBeNull()
  })

  it('"sin banda" es un nivel válido en dominadas, y un nivel que ya no existe no se propone', () => {
    const pull = exercise('assisted-pull-up')
    expect(defaultLevelId({ exercise: pull, scale: bands, last: { levelId: 'none' }, doneSets: [] })).toBe('none')
    expect(defaultLevelId({ exercise: pull, scale: bands, last: { levelId: 'band-red' }, doneSets: [] })).toBeNull()
  })

  it('un ejercicio sin escala nunca pide nivel', () => {
    expect(defaultLevelId({ exercise: exercise('side-plank'), scale: null, last, doneSets: [] })).toBeNull()
  })

  it('los segundos suben de 5 en 5 y las repeticiones de 1 en 1', () => {
    expect(repStep(exercise('plank'))).toBe(5)
    expect(repStep(exercise('push-up'))).toBe(1)
  })
})

describe('temporizador de descanso', () => {
  it('restRemaining cuenta segundos enteros hacia arriba y nunca baja de 0', () => {
    expect(restRemaining(120_000, 0)).toBe(120)
    expect(restRemaining(120_000, 100)).toBe(120)
    expect(restRemaining(120_000, 1_100)).toBe(119)
    expect(restRemaining(120_000, 120_000)).toBe(0)
    expect(restRemaining(120_000, 999_999)).toBe(0)
  })

  it('el aviso salta una sola vez al cruzar los 15 segundos', () => {
    expect(WARNING_SECONDS).toBe(15)
    expect(crossedWarning(16, 15)).toBe(true)
    expect(crossedWarning(20, 12)).toBe(true) // si el reloj se retrasa y se salta el 15 exacto
    expect(crossedWarning(15, 14)).toBe(false)
    expect(crossedWarning(100, 99)).toBe(false)
    expect(crossedWarning(5, 0)).toBe(false) // si ya estaba por debajo, no vuelve a avisar
  })

  it('un descanso corto (menos de 15 s) no da el aviso, solo el final', () => {
    expect(crossedWarning(10, 9)).toBe(false)
    expect(crossedEnd(1, 0)).toBe(true)
    expect(crossedEnd(0, 0)).toBe(false)
    expect(crossedEnd(5, 4)).toBe(false)
  })

  it('formatClock da minutos y segundos', () => {
    expect(formatClock(120)).toBe('2:00')
    expect(formatClock(75)).toBe('1:15')
    expect(formatClock(9)).toBe('0:09')
    expect(formatClock(-3)).toBe('0:00')
  })
})

describe('duración y resumen', () => {
  it('durationMinutes redondea a minutos, mínimo 1, y da null si falta un dato', () => {
    expect(durationMinutes('2026-11-09T18:00:00Z', '2026-11-09T18:52:40Z')).toBe(53)
    expect(durationMinutes('2026-11-09T18:00:00Z', '2026-11-09T18:00:10Z')).toBe(1)
    expect(durationMinutes(null, '2026-11-09T18:00:00Z')).toBeNull()
    expect(durationMinutes('2026-11-09T18:00:00Z', null)).toBeNull()
  })

  it('sessionSummary cuenta series, repeticiones (no segundos) y ejercicios hechos', () => {
    const template = { id: 't', name: 'T', order: 1, items: [
      { exerciseId: 'push-up', sets: 3, perSide: false, coreExerciseId: null },
      { exerciseId: 'plank', sets: 3, perSide: false, coreExerciseId: null },
      { exerciseId: 'crunch', sets: 3, perSide: false, coreExerciseId: null },
    ] }
    const s = finishSession(startStrengthSession({ template, now: NOW, id: 'x' }), { now: at('2026-11-09T18:45:00Z') })
    const sets = [
      buildSet({ session: s, exerciseId: 'push-up', order: 1, reps: 10, levelId: null }),
      buildSet({ session: s, exerciseId: 'push-up', order: 2, reps: 9, levelId: null }),
      buildSet({ session: s, exerciseId: 'plank', order: 1, reps: 40, levelId: 'kg-0' }),
      { ...buildSet({ session: { id: 'otra', date: 'x' }, exerciseId: 'push-up', order: 1, reps: 50, levelId: null }) },
    ]
    const summary = sessionSummary(s, sets, DEFAULT_EXERCISES)
    expect(summary).toMatchObject({ durationMin: 45, exercisesTotal: 3, exercisesDone: 2, setsDone: 3, totalReps: 19 })
    expect(summary.perExercise[0].sets.map((x) => x.reps)).toEqual([10, 9])
    expect(summary.perExercise[2].sets).toEqual([])
  })

  it('una sesión aún en curso usa la hora actual para la duración', () => {
    const s = startStrengthSession({ template: upper, now: NOW, id: 'y' })
    expect(sessionSummary(s, [], DEFAULT_EXERCISES, at('2026-11-09T18:30:00Z')).durationMin).toBe(30)
  })
})

describe('la rotación cuenta todas las sesiones de fuerza hechas, vengan o no del plan', () => {
  it('una sesión empezada por tu cuenta (sin hueco) cambia la sugerencia', () => {
    const adHoc = finishSession(startStrengthSession({ template: upper, now: new Date(2026, 10, 7, 10, 0), id: 'sab' }), { now: new Date(2026, 10, 7, 11, 0) })
    expect(adHoc.slotId).toBeNull()
    expect(suggestNextTemplateId(DEFAULT_TEMPLATES, [adHoc])).toBe('tpl-lower')
  })

  it('una sesión en curso todavía no cuenta', () => {
    const running = startStrengthSession({ template: upper, now: NOW, id: 'r' })
    expect(suggestNextTemplateId(DEFAULT_TEMPLATES, [running])).toBe('tpl-upper')
  })
})

describe('validateQuickLog (bici y movilidad)', () => {
  const ok = { type: 'bike_outdoor', date: '2026-11-08', status: 'done', durationMin: '95', tss: '82', effort: '7', notes: ' salida larga ', name: 'Bici outdoor' }
  const run = (input) => validateQuickLog(input, { now: NOW, id: 'q1' })

  it('acepta un registro de bici y lo deja limpio', () => {
    const { errors, session } = run(ok)
    expect(errors).toEqual([])
    expect(session).toEqual({
      id: 'q1', type: 'bike_outdoor', status: 'done', date: '2026-11-08', name: 'Bici outdoor', slotId: null, templateId: null,
      startedAt: null, endedAt: null, durationMin: 95, tss: 82, effort: 7, notes: 'salida larga',
    })
  })

  it('TSS y esfuerzo son opcionales', () => {
    const { session } = run({ ...ok, tss: '', effort: '' })
    expect(session).toMatchObject({ tss: null, effort: null, durationMin: 95 })
  })

  it('la movilidad no lleva TSS aunque llegue', () => {
    expect(run({ ...ok, type: 'mobility', tss: '50' }).session.tss).toBeNull()
  })

  it('una sesión que no hiciste solo necesita el día y el tipo', () => {
    const { errors, session } = run({ type: 'bike_trainer', date: '2026-11-04', status: 'skipped', durationMin: '', notes: 'lluvia' })
    expect(errors).toEqual([])
    expect(session).toMatchObject({ status: 'skipped', durationMin: null, tss: null, notes: 'lluvia' })
  })

  it('pide duración válida, fecha válida y no futura, TSS y esfuerzo en rango', () => {
    for (const bad of [{ durationMin: '' }, { durationMin: '0' }, { durationMin: '1.5' }, { durationMin: '2000' }]) expect(run({ ...ok, ...bad }).errors, JSON.stringify(bad)).toHaveLength(1)
    for (const date of ['', '2026-13-01', '2026-02-30', 'ayer']) expect(run({ ...ok, date }).errors, date).toHaveLength(1)
    expect(run({ ...ok, date: '2026-11-10' }).errors[0]).toMatch(/futura/)
    expect(run({ ...ok, date: '2026-11-09' }).errors).toEqual([]) // hoy vale
    expect(run({ ...ok, tss: '-5' }).errors).toHaveLength(1)
    expect(run({ ...ok, tss: '5000' }).errors).toHaveLength(1)
    expect(run({ ...ok, effort: '11' }).errors).toHaveLength(1)
    expect(run({ ...ok, effort: '0' }).errors).toHaveLength(1)
    expect(run({ ...ok, type: 'strength' }).errors).toHaveLength(1)
  })
})

describe('editar un registro de bici o movilidad', () => {
  const saved = validateQuickLog({ type: 'bike_outdoor', date: '2026-11-08', status: 'done', durationMin: '95', tss: '82', effort: '7', notes: 'larga', name: 'Bici outdoor', slotId: 'sat-outdoor' }, { now: NOW, id: 'q1' }).session

  it('toQuickDraft devuelve texto para el formulario, vacío donde no hay dato', () => {
    expect(toQuickDraft(saved)).toMatchObject({ id: 'q1', type: 'bike_outdoor', date: '2026-11-08', status: 'done', durationMin: 95, tss: 82, effort: 7, notes: 'larga', slotId: 'sat-outdoor' })
    const skipped = validateQuickLog({ type: 'mobility', date: '2026-11-04', status: 'skipped' }, { now: NOW, id: 'q2' }).session
    expect(toQuickDraft(skipped)).toMatchObject({ status: 'skipped', durationMin: '', tss: '', effort: '' })
  })

  it('guardar de nuevo lo editado conserva el id y el hueco del plan, y cambia lo corregido', () => {
    const edited = validateQuickLog({ ...toQuickDraft(saved), tss: '90' }, { now: NOW }).session
    expect(edited.id).toBe('q1')
    expect(edited.slotId).toBe('sat-outdoor')
    expect(edited.tss).toBe(90)
    expect(edited.durationMin).toBe(95)
  })

  it('un registro nuevo (sin id) recibe uno nuevo', () => {
    const fresh = validateQuickLog({ type: 'mobility', date: '2026-11-08', status: 'done', durationMin: 20 }, { now: NOW }).session
    expect(fresh.id).toMatch(/^ses-/)
  })
})

describe('sesión de movilidad con inicio y fin', () => {
  const started = startMobilitySession({ now: new Date('2026-11-09T07:00:00Z'), id: 'm1' })

  it('empieza en curso, con la hora de inicio y sin duración todavía', () => {
    expect(started).toMatchObject({ id: 'm1', type: 'mobility', status: 'in_progress', name: 'Movilidad', slotId: null, endedAt: null, durationMin: null })
    expect(started.startedAt).toBe('2026-11-09T07:00:00.000Z')
  })

  it('si viene de un hueco del plan, lo recuerda y usa su nombre', () => {
    const s = startMobilitySession({ slot: { id: 'tue-mobility', name: 'Movilidad por la mañana' }, now: NOW, id: 'm2' })
    expect(s).toMatchObject({ slotId: 'tue-mobility', name: 'Movilidad por la mañana' })
  })

  it('al terminar queda hecha con los minutos reales', () => {
    const done = finishMobilitySession(started, { notes: ' cadera y hombros ', now: new Date('2026-11-09T07:16:20Z') })
    expect(done).toMatchObject({ status: 'done', durationMin: 16, endedAt: '2026-11-09T07:16:20.000Z', notes: 'cadera y hombros' })
    expect(started.status).toBe('in_progress') // el original no cambia
  })

  it('una sesión de menos de un minuto cuenta 1 minuto', () => {
    expect(finishMobilitySession(started, { now: new Date('2026-11-09T07:00:10Z') }).durationMin).toBe(1)
  })

  it('cuenta para el historial y para el calendario como una sesión de movilidad hecha', () => {
    const done = finishMobilitySession(started, { now: new Date('2026-11-09T07:15:00Z') })
    expect(done.type).toBe('mobility')
    expect(done.status).toBe('done')
    expect(done.durationMin).toBe(15)
  })
})

describe('pausa en la sesión de movilidad', () => {
  const t = (time) => new Date(`2026-11-09T${time}Z`)
  const started = startMobilitySession({ now: t('07:00:00'), id: 'p1' })

  it('el tiempo de sesión no cuenta lo que se pasa en pausa', () => {
    const paused = pauseSession(started, t('07:05:00'))
    expect(activeMillis(paused, t('07:05:00'))).toBe(5 * 60_000)
    expect(activeMillis(paused, t('07:12:00'))).toBe(5 * 60_000) // sigue en pausa: el reloj no avanza
    const resumed = resumeSession(paused, t('07:12:00'))
    expect(resumed).toMatchObject({ pausedAt: null, pausedMs: 7 * 60_000 })
    expect(activeMillis(resumed, t('07:20:00'))).toBe(13 * 60_000) // 20 min en total menos 7 de pausa
  })

  it('varias pausas se suman', () => {
    let s = pauseSession(started, t('07:02:00'))
    s = resumeSession(s, t('07:03:00'))
    s = pauseSession(s, t('07:06:00'))
    s = resumeSession(s, t('07:10:00'))
    expect(s.pausedMs).toBe(5 * 60_000)
    expect(activeMillis(s, t('07:15:00'))).toBe(10 * 60_000)
  })

  it('pausar dos veces o continuar sin pausa no cambia nada', () => {
    const paused = pauseSession(started, t('07:05:00'))
    expect(pauseSession(paused, t('07:09:00'))).toBe(paused) // conserva la primera hora de pausa
    expect(resumeSession(started, t('07:09:00'))).toBe(started)
  })

  it('al terminar se guarda el tiempo sin pausas', () => {
    let s = pauseSession(started, t('07:10:00'))
    s = resumeSession(s, t('07:20:00'))
    const done = finishMobilitySession(s, { now: t('07:30:00') })
    expect(done).toMatchObject({ status: 'done', durationMin: 20, pausedAt: null })
    expect(done.endedAt).toBe('2026-11-09T07:30:00.000Z')
  })

  it('si se termina estando en pausa, esa pausa tampoco cuenta', () => {
    const paused = pauseSession(started, t('07:15:00'))
    const done = finishMobilitySession(paused, { now: t('07:40:00') })
    expect(done.durationMin).toBe(15)
    expect(done.pausedAt).toBeNull()
  })

  it('una sesión sin pausas se calcula como antes, y el original no cambia', () => {
    expect(finishMobilitySession(started, { now: t('07:15:00') }).durationMin).toBe(15)
    pauseSession(started, t('07:05:00'))
    expect(started.pausedAt).toBeUndefined()
  })

  it('con datos rotos no devuelve NaN', () => {
    expect(activeMillis({ startedAt: 'mal' }, t('07:00:00'))).toBe(0)
  })
})
