// Ajustes secretos (claves personales): se guardan solo en este dispositivo y no viajan en las copias de seguridad.

import { SECRET_SETTING_KEYS } from '../core/backup.js'
import { getSetting, setSetting } from './db.js'

/** Lee los ajustes secretos que haya guardados: { clave: valor }. */
export async function readSecrets(db) {
  const found = {}
  for (const key of SECRET_SETTING_KEYS) {
    const value = await getSetting(db, key, null)
    if (value !== null) found[key] = value
  }
  return found
}

/** Vuelve a guardar los secretos (por ejemplo, tras restaurar una copia, que los borra porque no los lleva). */
export async function restoreSecrets(db, secrets) {
  for (const [key, value] of Object.entries(secrets)) await setSetting(db, key, value)
}
