import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES, DEFAULT_WEEK_PLAN } from './defaultData.js'
import { blankSlot, groupPlanByDay, validateSlot } from './plan.js'

describe('groupPlanByDay', () => {
  it('devuelve siempre 7 días, de lunes a domingo', () => {
    const days = groupPlanByDay(DEFAULT_WEEK_PLAN)
    expect(days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('reparte las sesiones por día y ordena: fuerza, movilidad, rodillo, outdoor', () => {
    const days = groupPlanByDay(DEFAULT_WEEK_PLAN)
    expect(days[0].slots.map((s) => s.type)).toEqual(['strength'])
    expect(days[1].slots.map((s) => s.type)).toEqual(['mobility', 'bike_trainer'])
    expect(days[5].slots.map((s) => s.type)).toEqual(['bike_outdoor'])
  })

  it('un día vacío tiene lista vacía y no modifica el plan original', () => {
    const plan = [{ id: 'a', weekday: 3, type: 'strength', name: 'F', flexible: true }]
    const copy = JSON.stringify(plan)
    expect(groupPlanByDay(plan)[0].slots).toEqual([])
    expect(JSON.stringify(plan)).toBe(copy)
  })
})

describe('validateSlot', () => {
  const ok = { id: 's1', weekday: '3', type: 'strength', name: ' Fuerza ', flexible: 1, templateId: 'tpl-upper' }

  it('acepta y limpia una sesión correcta', () => {
    const { errors, slot } = validateSlot(ok, { templates: DEFAULT_TEMPLATES })
    expect(errors).toEqual([])
    expect(slot).toEqual({ id: 's1', weekday: 3, type: 'strength', name: 'Fuerza', flexible: true, templateId: 'tpl-upper' })
  })

  it('exige nombre, día válido y tipo válido', () => {
    expect(validateSlot({ ...ok, name: '' }).errors).toHaveLength(1)
    expect(validateSlot({ ...ok, weekday: 8 }).errors).toHaveLength(1)
    expect(validateSlot({ ...ok, weekday: 0 }).errors).toHaveLength(1)
    expect(validateSlot({ ...ok, type: 'yoga' }).errors).toHaveLength(1)
  })

  it('una sesión fija solo vale en fuerza y si existe; si no, queda automática', () => {
    expect(validateSlot({ ...ok, type: 'mobility' }, { templates: DEFAULT_TEMPLATES }).slot.templateId).toBeNull()
    expect(validateSlot({ ...ok, templateId: 'tpl-borrada' }, { templates: DEFAULT_TEMPLATES }).slot.templateId).toBeNull()
    expect(validateSlot({ ...ok, templateId: null }, { templates: DEFAULT_TEMPLATES }).slot.templateId).toBeNull()
  })

  it('una sesión en blanco empieza como fuerza automática, movible', () => {
    expect(blankSlot(4)).toMatchObject({ weekday: 4, type: 'strength', flexible: true, templateId: null })
  })
})
