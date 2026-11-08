// Fechas. La semana empieza en lunes: 1 = lunes ... 7 = domingo.

/** Día de la semana de una fecha (1 = lunes ... 7 = domingo), en hora local. */
export function weekdayOf(date = new Date()) {
  const jsDay = date.getDay() // 0 = domingo ... 6 = sábado
  return jsDay === 0 ? 7 : jsDay
}

/** Fecha local como AAAA-MM-DD (sin saltos por zona horaria). */
export function toIsoDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const WEEKDAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
