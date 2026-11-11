import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES } from './defaultData.js'
import { DEFAULT_EXERCISES } from './exerciseLibrary.js'
import {
  MAX_SESSION_MINUTES, blankItem, estimateMinutes, groupsBelowGoal, itemTargetText, moveItem, sortTemplates,
  suggestNextTemplateId, validateTemplate, weeklyGroupFrequency,
} from './templates.js'

const exercises = DEFAULT_EXERCISES
const upper = DEFAULT_TEMPLATES[0]
const lower = DEFAULT_TEMPLATES[1]
const strengthSlot = (id, templateId = null) => ({ id, weekday: 1, type: 'strength', name: 'Fuerza', flexible: true, templateId })

describe('las sesiones de partida', () => {
  it('usan solo ejercicios de la biblioteca y cores que existen', () => {
    const ids = new Set(exercises.map((e) => e.id))
    for (const template of DEFAULT_TEMPLATES) {
      for (const item of template.items) {
        expect(ids.has(item.exerciseId), item.exerciseId).toBe(true)
        if (item.coreExerciseId && item.coreExerciseId !== 'random') expect(ids.has(item.coreExerciseId), item.coreExerciseId).toBe(true)
      }
    }
  })

  it('pasan la validación y no llevan ejercicios repetidos', () => {
    for (const template of DEFAULT_TEMPLATES) {
      expect(validateTemplate(template, { exercises, templates: DEFAULT_TEMPLATES }).errors).toEqual([])
    }
  })

  it('no ponen plancha entre dominadas o flexiones (decisión de David)', () => {
    const planks = ['plank', 'side-plank']
    for (const item of upper.items) expect(planks).not.toContain(item.coreExerciseId)
  })

  it('el remo con banda ya no está en el tren superior y las dos elevaciones de hombro sí', () => {
    const ids = upper.items.map((i) => i.exerciseId)
    expect(ids).not.toContain('banded-row')
    expect(ids).toContain('banded-lateral-raise')
    expect(ids).toContain('banded-front-raise')
  })
})

describe('validateTemplate', () => {
  const ok = { id: 't1', name: 'Mi sesión', order: 1, items: [blankItem('push-up')] }

  it('acepta una sesión correcta y la limpia', () => {
    const { errors, template } = validateTemplate({ ...ok, name: '  Mi sesión  ', items: [{ exerciseId: 'push-up', sets: '4', perSide: 1, coreExerciseId: '' }] }, { exercises })
    expect(errors).toEqual([])
    expect(template).toEqual({ id: 't1', name: 'Mi sesión', order: 1, items: [{ exerciseId: 'push-up', sets: 4, perSide: true, coreExerciseId: null }] })
  })

  it('pide nombre y al menos un ejercicio', () => {
    const { errors, template } = validateTemplate({ id: 't', name: ' ', items: [] }, { exercises })
    expect(template).toBeNull()
    expect(errors).toHaveLength(2)
  })

  it('rechaza nombres repetidos (sin distinguir mayúsculas), pero no contra sí misma', () => {
    const others = [{ id: 'otra', name: 'Mi Sesión', order: 2, items: [] }]
    expect(validateTemplate(ok, { exercises, templates: others }).errors[0]).toMatch(/ese nombre/)
    expect(validateTemplate(ok, { exercises, templates: [{ ...ok }] }).errors).toEqual([])
  })

  it('rechaza ejercicios repetidos, inexistentes y series fuera de rango', () => {
    expect(validateTemplate({ ...ok, items: [blankItem('push-up'), blankItem('push-up')] }, { exercises }).errors[0]).toMatch(/repetido/)
    expect(validateTemplate({ ...ok, items: [blankItem('no-existe')] }, { exercises }).errors[0]).toMatch(/ya no existe/)
    for (const sets of [0, 11, 2.5, '', 'x']) {
      expect(validateTemplate({ ...ok, items: [{ ...blankItem('push-up'), sets }] }, { exercises }).errors, String(sets)).toHaveLength(1)
    }
  })

  it('rechaza un core que no existe', () => {
    const items = [{ ...blankItem('push-up'), coreExerciseId: 'inventado' }]
    expect(validateTemplate({ ...ok, items }, { exercises }).errors[0]).toMatch(/core/)
  })
})

describe('itemTargetText', () => {
  const find = (id) => exercises.find((e) => e.id === id)
  it('dice series, repeticiones y, si toca, "por lado"', () => {
    expect(itemTargetText({ sets: 3, perSide: false }, find('push-up'))).toBe('3 series de 8-10 repeticiones')
    expect(itemTargetText({ sets: 3, perSide: true }, find('bulgarian-split-squat'))).toBe('3 series de 8-10 repeticiones por lado')
  })
  it('usa el rango propio de los ejercicios en segundos y el singular de una serie', () => {
    expect(itemTargetText({ sets: 1, perSide: false }, find('plank'))).toBe('1 serie de 30-45 segundos')
  })
  it('si el ejercicio ya no existe, solo dice las series', () => {
    expect(itemTargetText({ sets: 2 }, undefined)).toBe('2 series')
  })
})

describe('estimateMinutes', () => {
  it('coincide con las cuentas explicadas a David: 6 ejercicios de 3 series con descanso de 2 min ≈ 55 min', () => {
    expect(estimateMinutes(upper, exercises)).toBe(55)
  })

  it('a una pierna: series el doble de largas pero descanso de 1 min; las 50 sentadillas cuentan unos 2 min: tren inferior en 45 min', () => {
    // 5 min + 1 × (125 + 120) s + 4 × 3 × (90 + 60) s + 1 × 3 × (45 + 120) s = 5 + 4,08 + 30 + 8,25 = 47,3 → 45
    expect(estimateMinutes(lower, exercises)).toBe(45)
    // con el descanso largo de antes en los ejercicios a una pierna saldría a 60 min
    expect(estimateMinutes(lower, exercises, { perSideRestSeconds: 120 })).toBe(60)
    const sinLados = { items: lower.items.map((i) => ({ ...i, perSide: false })) }
    // con el mismo descanso (1 min) en todas, hacerlo con cada lado alarga la sesión
    expect(estimateMinutes(sinLados, exercises, { restSeconds: 60 })).toBeLessThan(estimateMinutes(lower, exercises))
  })

  it('una serie larga (50 repeticiones) cuenta más que una normal, y una de 10 sigue contando 45 s', () => {
    const one = (id, sets) => ({ items: [{ exerciseId: id, sets, perSide: false }] })
    const long = estimateMinutes(one('bodyweight-squat', 4), exercises)
    const normal = estimateMinutes(one('goblet-squat', 4), exercises)
    expect(long).toBeGreaterThan(normal)
  })

  it('más descanso, más tiempo', () => {
    expect(estimateMinutes(upper, exercises, { restSeconds: 60 })).toBeLessThan(estimateMinutes(upper, exercises))
  })

  it('los ejercicios en segundos usan su rango máximo', () => {
    const plank = { items: [{ exerciseId: 'plank', sets: 3, perSide: false }] }
    // 5 min + 3 × (45 + 10 + 120) s = 5 + 8,75 = 13,75 → 15
    expect(estimateMinutes(plank, exercises)).toBe(15)
  })

  it('una sesión vacía solo cuenta el calentamiento', () => {
    expect(estimateMinutes({ items: [] }, exercises)).toBe(5)
  })

  it('el límite de una sesión es 1 hora', () => {
    expect(MAX_SESSION_MINUTES).toBe(60)
  })
})

describe('suggestNextTemplateId (rotación)', () => {
  const templates = [lower, upper] // desordenadas a propósito: manda `order`
  const done = (templateId, date, extra = {}) => ({ id: `${date}-${templateId}`, type: 'strength', status: 'done', templateId, date, ...extra })

  it('sin historial propone la primera', () => {
    expect(suggestNextTemplateId(templates, [])).toBe('tpl-upper')
  })

  it('propone la siguiente a la última que hiciste y vuelve al principio', () => {
    expect(suggestNextTemplateId(templates, [done('tpl-upper', '2026-11-02')])).toBe('tpl-lower')
    expect(suggestNextTemplateId(templates, [done('tpl-upper', '2026-11-02'), done('tpl-lower', '2026-11-04')])).toBe('tpl-upper')
  })

  it('la rotación sale sola: superior, inferior, superior y la semana siguiente al revés', () => {
    const history = []
    const order = []
    for (const date of ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09', '2026-11-11', '2026-11-13']) {
      const next = suggestNextTemplateId(templates, history)
      order.push(next)
      history.push(done(next, date))
    }
    expect(order).toEqual(['tpl-upper', 'tpl-lower', 'tpl-upper', 'tpl-lower', 'tpl-upper', 'tpl-lower'])
  })

  it('si repites una sesión (porque quisiste), la siguiente cuenta desde la última hecha', () => {
    const history = [done('tpl-upper', '2026-11-02'), done('tpl-upper', '2026-11-04')]
    expect(suggestNextTemplateId(templates, history)).toBe('tpl-lower')
  })

  it('manda la fecha, no el orden de la lista', () => {
    const history = [done('tpl-lower', '2026-11-04'), done('tpl-upper', '2026-11-02')]
    expect(suggestNextTemplateId(templates, history)).toBe('tpl-upper')
  })

  it('ignora sesiones omitidas, pendientes, de bici o de sesiones borradas', () => {
    const history = [
      done('tpl-upper', '2026-11-02'),
      done('tpl-lower', '2026-11-04', { status: 'skipped' }),
      done('tpl-lower', '2026-11-05', { status: 'pending' }),
      done('tpl-lower', '2026-11-06', { type: 'bike_trainer' }),
      done('tpl-borrada', '2026-11-07'),
    ]
    expect(suggestNextTemplateId(templates, history)).toBe('tpl-lower')
  })

  it('una sesión movida de día cuenta como hecha', () => {
    expect(suggestNextTemplateId(templates, [done('tpl-upper', '2026-11-02', { status: 'moved' })])).toBe('tpl-lower')
  })

  it('con una sola sesión siempre propone esa; sin sesiones, nada', () => {
    expect(suggestNextTemplateId([upper], [done('tpl-upper', '2026-11-02')])).toBe('tpl-upper')
    expect(suggestNextTemplateId([], [])).toBeNull()
  })
})

describe('weeklyGroupFrequency', () => {
  it('con 3 días automáticos y 2 sesiones, cada grupo sale 1,5 veces de media', () => {
    const plan = [strengthSlot('a'), strengthSlot('b'), strengthSlot('c')]
    const frequency = weeklyGroupFrequency({ plan, templates: DEFAULT_TEMPLATES, exercises })
    expect(frequency.chest).toBe(1.5)
    expect(frequency.quads).toBe(1.5)
    expect(frequency.core).toBe(3) // el core de los descansos sale en las dos sesiones
  })

  it('del core del descanso solo cuenta el grupo principal (el perro pájaro no cuenta como espalda)', () => {
    const template = { id: 't', name: 'T', order: 1, items: [{ exerciseId: 'push-up', sets: 3, perSide: false, coreExerciseId: 'bird-dog' }] }
    const frequency = weeklyGroupFrequency({ plan: [strengthSlot('a', 't')], templates: [template], exercises })
    expect(frequency.core).toBe(1)
    expect(frequency.back).toBeUndefined()
  })

  it('una sesión fija cuenta entera', () => {
    const plan = [strengthSlot('a', 'tpl-upper'), strengthSlot('b', 'tpl-upper'), strengthSlot('c', 'tpl-lower')]
    const frequency = weeklyGroupFrequency({ plan, templates: DEFAULT_TEMPLATES, exercises })
    expect(frequency.chest).toBe(2)
    expect(frequency.quads).toBe(1)
  })

  it('sin días de fuerza o sin sesiones no sale nada; una sesión fija que ya no existe pasa a automática', () => {
    expect(weeklyGroupFrequency({ plan: [], templates: DEFAULT_TEMPLATES, exercises })).toEqual({})
    expect(weeklyGroupFrequency({ plan: [strengthSlot('a')], templates: [], exercises })).toEqual({})
    const plan = [strengthSlot('a', 'tpl-borrada'), strengthSlot('b')]
    expect(weeklyGroupFrequency({ plan, templates: DEFAULT_TEMPLATES, exercises }).chest).toBe(1)
  })

  it('ignora las sesiones que no son de fuerza', () => {
    const plan = [{ id: 'x', weekday: 2, type: 'bike_trainer', name: 'Rodillo', flexible: false }]
    expect(weeklyGroupFrequency({ plan, templates: DEFAULT_TEMPLATES, exercises })).toEqual({})
  })
})

describe('groupsBelowGoal', () => {
  const goals = { timesPerWeekByGroup: { chest: 2, core: 2, quads: 2 } }
  it('lista los grupos por debajo del objetivo', () => {
    const below = groupsBelowGoal({ chest: 1.5, core: 3, quads: 2 }, goals)
    expect(below.map((g) => g.id)).toEqual(['chest'])
    expect(below[0]).toMatchObject({ times: 1.5, goal: 2 })
  })
  it('un grupo que no sale cuenta como 0', () => {
    expect(groupsBelowGoal({}, goals).map((g) => g.id).sort()).toEqual(['chest', 'core', 'quads'])
  })
})

describe('moveItem', () => {
  it('sube y baja un elemento sin cambiar la lista original', () => {
    const list = ['a', 'b', 'c']
    expect(moveItem(list, 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(list, 1, 1)).toEqual(['a', 'c', 'b'])
    expect(list).toEqual(['a', 'b', 'c'])
  })
  it('en los extremos no hace nada', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})

describe('sortTemplates', () => {
  it('ordena por posición', () => {
    expect(sortTemplates([lower, upper]).map((t) => t.id)).toEqual(['tpl-upper', 'tpl-lower'])
  })
})
