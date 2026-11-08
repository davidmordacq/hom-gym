// Plan semanal: sesiones previstas en cada día. Solo lógica, sin pantallas.

import { SESSION_TYPES } from './model.js'

const TYPE_ORDER = [SESSION_TYPES.STRENGTH, SESSION_TYPES.MOBILITY, SESSION_TYPES.BIKE_TRAINER, SESSION_TYPES.BIKE_OUTDOOR]

export const newSlotId = (now = Date.now()) => `slot-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/** Sesión nueva para un día (el formulario la rellena). */
export const blankSlot = (weekday = 1) => ({
  id: '',
  weekday,
  type: SESSION_TYPES.STRENGTH,
  name: '',
  flexible: true,
  templateId: null,
})

/** Reparte el plan por días (1 = lunes ... 7 = domingo). Dentro de cada día: fuerza, movilidad, rodillo, outdoor. */
export function groupPlanByDay(plan) {
  const rank = (slot) => {
    const i = TYPE_ORDER.indexOf(slot.type)
    return i === -1 ? TYPE_ORDER.length : i
  }
  return Array.from({ length: 7 }, (_, i) => ({
    weekday: i + 1,
    slots: plan
      .filter((slot) => slot.weekday === i + 1)
      .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id)),
  }))
}

/**
 * Revisa una sesión del plan antes de guardarla.
 * Devuelve { errors, slot }; si hay errores, `slot` es null.
 * Solo las sesiones de fuerza pueden llevar una sesión de fuerza fija (`templateId`); null = automática.
 */
export function validateSlot(input, { templates = [] } = {}) {
  const errors = []
  const name = String(input.name ?? '').trim()
  if (!name) errors.push('Escribe un nombre para la sesión.')

  const weekday = Number(input.weekday)
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) errors.push('Elige el día de la semana.')

  if (!Object.values(SESSION_TYPES).includes(input.type)) errors.push('Elige el tipo de sesión.')

  if (errors.length > 0) return { errors, slot: null }

  const templateId = input.type === SESSION_TYPES.STRENGTH && templates.some((t) => t.id === input.templateId) ? input.templateId : null
  return {
    errors,
    slot: { id: input.id, weekday, type: input.type, name, flexible: Boolean(input.flexible), templateId },
  }
}
