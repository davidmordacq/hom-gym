// Cuándo avisar de que toca hacer una copia de seguridad. Solo lógica, sin pantallas.
// Una web instalada no puede hacer copias sola en segundo plano; lo que sí puede es avisar al abrir la app.

export const BACKUP_EVERY_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/** Días completos entre un momento ISO y ahora (null si no hay fecha). */
export function daysSince(iso, now = new Date()) {
  if (!iso) return null
  const ms = now.getTime() - Date.parse(iso)
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / DAY_MS)) : null
}

/**
 * ¿Toca avisar? Solo si hay datos que perder (`sessionCount` > 0), han pasado `everyDays` días desde la última copia
 * (o nunca se hizo) y no se pospuso el aviso hasta más adelante (`snoozedUntil`, momento ISO).
 * Devuelve { due, never, days }.
 */
export function backupStatus({ lastBackupAt, sessionCount, snoozedUntil = null, now = new Date(), everyDays = BACKUP_EVERY_DAYS }) {
  const days = daysSince(lastBackupAt, now)
  const never = days === null
  const snoozed = snoozedUntil && Date.parse(snoozedUntil) > now.getTime()
  const due = sessionCount > 0 && !snoozed && (never || days >= everyDays)
  return { due, never, days }
}

/** Texto del aviso o del último estado de la copia. */
export function backupText({ never, days }) {
  if (never) return 'Todavía no has hecho ninguna copia de seguridad.'
  if (days === 0) return 'Tu última copia es de hoy.'
  return `Tu última copia es de hace ${days} ${days === 1 ? 'día' : 'días'}.`
}

/** Momento hasta el que se pospone el aviso: mañana a la misma hora. */
export const snoozeUntil = (now = new Date()) => new Date(now.getTime() + DAY_MS).toISOString()
