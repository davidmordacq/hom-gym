// Guardado de sesiones y series realizadas. Usa db.js; no sabe nada de reglas.

import { get, getAll, getAllByIndex, put, remove } from './db.js'

export const saveSession = (db, session) => put(db, 'sessions', session)

export const loadSession = (db, id) => get(db, 'sessions', id)

export const saveSet = (db, set) => put(db, 'sets', set)

export const deleteSet = (db, id) => remove(db, 'sets', id)

/** Series marcadas en una sesión. */
export const loadSessionSets = (db, sessionId) => getAllByIndex(db, 'sets', 'sessionId', sessionId)

/** Todas las series que se hicieron alguna vez de estos ejercicios (para saber "lo de la última vez"). */
export async function loadExerciseHistory(db, exerciseIds) {
  const lists = await Promise.all(exerciseIds.map((id) => getAllByIndex(db, 'sets', 'exerciseId', id)))
  return lists.flat()
}

/** Todas las sesiones, de la más reciente a la más antigua. */
export async function loadAllSessions(db) {
  const sessions = await getAll(db, 'sessions')
  return sessions.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.startedAt ?? '').localeCompare(String(a.startedAt ?? '')))
}

/** Borra una sesión y todas sus series (por ejemplo, una sesión empezada por error). */
export async function discardSession(db, sessionId) {
  for (const set of await loadSessionSets(db, sessionId)) await deleteSet(db, set.id)
  await remove(db, 'sessions', sessionId)
}
