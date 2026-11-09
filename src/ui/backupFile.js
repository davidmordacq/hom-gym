// Crear, descargar y compartir el archivo de copia de seguridad. Usa funciones del navegador (descarga y "compartir").

import { createBackup } from '../core/backup.js'
import { toIsoDate } from '../core/dates.js'
import { exportAll, setSetting } from '../storage/db.js'

/** Archivo de copia con todos los datos, por ejemplo "hom-gym-copia-2026-11-09.json". */
export async function buildBackupFile(db, now = new Date()) {
  const backup = createBackup(await exportAll(db), now)
  return new File([JSON.stringify(backup, null, 2)], `hom-gym-copia-${toIsoDate(now)}.json`, { type: 'application/json' })
}

/** Descarga el archivo (en el móvil va a la carpeta Descargas). */
export function downloadBackup(file) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** ¿Puede este navegador abrir el menú de "Compartir" con un archivo (Drive, correo, WhatsApp...)? */
export function canShareFiles(nav = typeof navigator === 'undefined' ? undefined : navigator) {
  try {
    return typeof File !== 'undefined' && Boolean(nav?.canShare?.({ files: [new File(['{}'], 'copia.json', { type: 'application/json' })] }))
  } catch {
    return false
  }
}

/** Abre el menú de compartir. Devuelve 'shared', 'cancelled' (cerró el menú) o lanza un error si falla de verdad. */
export async function shareBackup(file) {
  try {
    await navigator.share({ files: [file], title: 'Copia de seguridad de Hom Gym' })
    return 'shared'
  } catch (error) {
    if (error?.name === 'AbortError') return 'cancelled'
    throw error
  }
}

/** Apunta que se acaba de hacer una copia (y quita cualquier aviso pospuesto). */
export async function markBackupDone(db, now = new Date()) {
  await setSetting(db, 'lastBackupAt', now.toISOString())
  await setSetting(db, 'backupSnoozedUntil', null)
}
