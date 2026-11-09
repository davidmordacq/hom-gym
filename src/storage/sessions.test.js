import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES } from '../core/defaultData.js'
import { buildSet, finishSession, lastPerformance, startStrengthSession } from '../core/workout.js'
import { get, getAll, openDb } from './db.js'
import { deleteSet, discardSession, loadAllSessions, loadExerciseHistory, loadSession, loadSessionSets, saveSession, saveSet } from './sessions.js'

let db
let counter = 0
beforeEach(async () => {
  counter += 1
  db = await openDb(`sessions-test-db-${counter}`)
})

const upper = DEFAULT_TEMPLATES[0]
const mk = (id, now) => startStrengthSession({ template: upper, id, now })

describe('guardar y leer sesiones', () => {
  it('guarda una sesión en curso y la recupera igual (por si se cierra la app)', async () => {
    const session = mk('s1', new Date(2026, 10, 9, 18, 0))
    await saveSession(db, session)
    expect(await loadSession(db, 's1')).toEqual(session)
  })

  it('cada serie se guarda al marcarla; marcar de nuevo la misma serie la sobrescribe; se puede deshacer', async () => {
    const session = mk('s1', new Date(2026, 10, 9, 18, 0))
    await saveSession(db, session)
    await saveSet(db, buildSet({ session, exerciseId: 'push-up', order: 1, reps: 8, levelId: null }))
    await saveSet(db, buildSet({ session, exerciseId: 'push-up', order: 1, reps: 10, levelId: null }))
    await saveSet(db, buildSet({ session, exerciseId: 'push-up', order: 2, reps: 9, levelId: null }))
    const sets = await loadSessionSets(db, 's1')
    expect(sets.map((s) => s.reps).sort()).toEqual([10, 9])
    await deleteSet(db, 's1:push-up:2')
    expect(await loadSessionSets(db, 's1')).toHaveLength(1)
  })

  it('discardSession borra la sesión y sus series, pero no las de otras', async () => {
    const a = mk('a', new Date(2026, 10, 9, 18, 0))
    const b = mk('b', new Date(2026, 10, 10, 18, 0))
    for (const s of [a, b]) {
      await saveSession(db, s)
      await saveSet(db, buildSet({ session: s, exerciseId: 'push-up', order: 1, reps: 8, levelId: null }))
    }
    await discardSession(db, 'a')
    expect(await get(db, 'sessions', 'a')).toBeUndefined()
    expect((await getAll(db, 'sets')).map((s) => s.sessionId)).toEqual(['b'])
  })

  it('loadAllSessions devuelve la más reciente primero', async () => {
    await saveSession(db, mk('old', new Date(2026, 10, 2, 18, 0)))
    await saveSession(db, mk('new', new Date(2026, 10, 9, 18, 0)))
    expect((await loadAllSessions(db)).map((s) => s.id)).toEqual(['new', 'old'])
  })
})

describe('"lo de la última vez" con datos guardados', () => {
  it('recupera lo de la última sesión terminada, no lo de la que está en curso', async () => {
    const first = finishSession(mk('s1', new Date(2026, 10, 2, 18, 0)), { now: new Date(2026, 10, 2, 19, 0) })
    await saveSession(db, first)
    for (const [order, reps] of [[1, 10], [2, 9], [3, 8]]) {
      await saveSet(db, buildSet({ session: first, exerciseId: 'assisted-pull-up', order, reps, levelId: 'band-green' }))
    }
    const second = mk('s2', new Date(2026, 10, 9, 18, 0))
    await saveSession(db, second)
    await saveSet(db, buildSet({ session: second, exerciseId: 'assisted-pull-up', order: 1, reps: 99, levelId: 'band-blue' }))

    const history = await loadExerciseHistory(db, ['assisted-pull-up', 'push-up'])
    expect(history).toHaveLength(4)
    const last = lastPerformance('assisted-pull-up', history, await loadAllSessions(db), { excludeSessionId: 's2' })
    expect(last.reps).toEqual([10, 9, 8])
    expect(last.levelId).toBe('band-green')
    expect(lastPerformance('assisted-pull-up', history, await loadAllSessions(db))?.sessionId).toBe('s1') // la en curso no cuenta
  })
})
