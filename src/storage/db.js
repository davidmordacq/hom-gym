// Guardado local de datos (IndexedDB, la base de datos que lleva dentro el navegador).
// Los datos viven en este dispositivo. Para pasarlos a otro, se usa la copia de seguridad (exportar/importar).
// Este archivo no sabe nada de ejercicios ni de reglas: solo guarda y lee filas.

export const DB_NAME = 'hom-gym'
const DB_VERSION = 1

/** "Tablas" de la app y el campo que identifica cada fila. */
export const STORE_KEYS = Object.freeze({
  scales: 'id', // escalas de resistencia (bandas, kg...)
  exercises: 'id', // ejercicios
  templates: 'id', // sesiones tipo (fuerza A, B, C...)
  plan: 'id', // sesiones previstas en la semana
  sessions: 'id', // sesiones realizadas
  sets: 'id', // series realizadas
  settings: 'key', // ajustes (tema, reglas, objetivos...)
})

const STORE_NAMES = Object.keys(STORE_KEYS)

/** Abre (o crea) la base de datos. */
export function openDb(name = DB_NAME) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const [store, keyPath] of Object.entries(STORE_KEYS)) {
        if (db.objectStoreNames.contains(store)) continue
        const objectStore = db.createObjectStore(store, { keyPath })
        if (store === 'sets') {
          objectStore.createIndex('exerciseId', 'exerciseId')
          objectStore.createIndex('sessionId', 'sessionId')
        }
        if (store === 'sessions') objectStore.createIndex('date', 'date')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('La base de datos está bloqueada por otra pestaña de la app. Ciérrala e inténtalo de nuevo.'))
  })
}

const isRequest = (value) => typeof value?.readyState === 'string'

/**
 * Ejecuta un trabajo dentro de una transacción (todo o nada).
 * `work` puede devolver una petición, un valor, o una función que se evalúa al terminar.
 */
function run(db, stores, mode, work) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode)
    let out
    try {
      out = work(tx)
    } catch (error) {
      try {
        tx.abort()
      } catch {
        // la transacción ya estaba cerrada
      }
      reject(error)
      return
    }
    tx.oncomplete = () => resolve(typeof out === 'function' ? out() : isRequest(out) ? out.result : out)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('La operación se canceló y no se guardó nada.'))
  })
}

export const getAll = (db, store) => run(db, store, 'readonly', (tx) => tx.objectStore(store).getAll())

export const get = (db, store, key) => run(db, store, 'readonly', (tx) => tx.objectStore(store).get(key))

export const getAllByIndex = (db, store, index, value) =>
  run(db, store, 'readonly', (tx) => tx.objectStore(store).index(index).getAll(value))

export const put = (db, store, value) => run(db, store, 'readwrite', (tx) => tx.objectStore(store).put(value))

export const putMany = (db, store, values) =>
  run(db, store, 'readwrite', (tx) => {
    const objectStore = tx.objectStore(store)
    for (const value of values) objectStore.put(value)
  })

export const remove = (db, store, key) => run(db, store, 'readwrite', (tx) => tx.objectStore(store).delete(key))

/** Lee TODO el contenido: { scales: [...], exercises: [...], ... } en una sola lectura coherente. */
export function exportAll(db) {
  return run(db, STORE_NAMES, 'readonly', (tx) => {
    const requests = STORE_NAMES.map((name) => tx.objectStore(name).getAll())
    return () => Object.fromEntries(STORE_NAMES.map((name, i) => [name, requests[i].result]))
  })
}

/** Comprueba que los datos de una copia de seguridad tienen sentido antes de tocar nada. */
function validateData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Los datos de la copia de seguridad no tienen el formato esperado.')
  }
  for (const [store, rows] of Object.entries(data)) {
    const keyPath = STORE_KEYS[store]
    if (!keyPath) continue // almacenes desconocidos (de otra versión): se ignoran
    if (!Array.isArray(rows)) throw new Error(`En la copia de seguridad, "${store}" debería ser una lista.`)
    for (const row of rows) {
      if (!row || typeof row !== 'object' || row[keyPath] === undefined || row[keyPath] === null) {
        throw new Error(`En la copia de seguridad hay una fila de "${store}" sin "${keyPath}".`)
      }
    }
  }
}

/**
 * Escribe datos en varios almacenes dentro de una sola transacción.
 * Con `clear: true` borra antes TODO lo que había (los almacenes que no vengan en `data` quedan vacíos).
 * Si algo falla, no se cambia nada.
 */
export async function writeAll(db, data, { clear = false } = {}) {
  validateData(data) // al ser async, un error aquí llega como promesa rechazada, no como excepción suelta
  return run(db, STORE_NAMES, 'readwrite', (tx) => {
    for (const store of STORE_NAMES) {
      const objectStore = tx.objectStore(store)
      if (clear) objectStore.clear()
      for (const row of data[store] ?? []) objectStore.put(row)
    }
  })
}

/** Sustituye todos los datos por los de una copia de seguridad. */
export const replaceAll = (db, data) => writeAll(db, data, { clear: true })

export async function getSetting(db, key, fallback = null) {
  const row = await get(db, 'settings', key)
  return row ? row.value : fallback
}

export const setSetting = (db, key, value) => put(db, 'settings', { key, value })
