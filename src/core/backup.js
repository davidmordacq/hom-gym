// Copia de seguridad: se guarda como un archivo JSON que puedes descargar y volver a cargar.

import { DATA_SCHEMA_VERSION } from './model.js'

/** Empaqueta todos los datos de la app en el formato de copia de seguridad. */
export function createBackup(data, now = new Date()) {
  return { schemaVersion: DATA_SCHEMA_VERSION, exportedAt: now.toISOString(), data }
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
