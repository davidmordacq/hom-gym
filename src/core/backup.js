// Copia de seguridad: se guarda como un archivo JSON que puedes descargar y volver a cargar.

import { DATA_SCHEMA_VERSION } from './model.js'

/**
 * Ajustes que NUNCA entran en la copia de seguridad, porque son claves personales (la copia se guarda en Drive,
 * se envía por correo...). Al restaurar una copia se conservan los que ya hubiera en el dispositivo.
 */
export const SECRET_SETTING_KEYS = Object.freeze(['intervalsApiKey'])

/** Quita de los datos los ajustes secretos (no modifica el original). */
export function stripSecrets(data) {
  if (!data || !Array.isArray(data.settings)) return data
  return { ...data, settings: data.settings.filter((row) => !SECRET_SETTING_KEYS.includes(row.key)) }
}

/** Empaqueta todos los datos de la app en el formato de copia de seguridad (sin claves personales). */
export function createBackup(data, now = new Date()) {
  return { schemaVersion: DATA_SCHEMA_VERSION, exportedAt: now.toISOString(), data: stripSecrets(data) }
}

/** Lee el texto de un archivo de copia de seguridad. Lanza un error con mensaje claro si no sirve. */
export function parseBackup(text) {
  let backup
  try {
    backup = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es una copia de seguridad válida (no se puede leer).')
  }
  if (!backup || typeof backup.schemaVersion !== 'number' || typeof backup.data !== 'object' || backup.data === null) {
    throw new Error('El archivo no parece una copia de seguridad de esta app.')
  }
  if (backup.schemaVersion > DATA_SCHEMA_VERSION) {
    throw new Error('Esta copia de seguridad es de una versión más reciente de la app. Actualiza la app e inténtalo de nuevo.')
  }
  return backup
}
