// Análisis y progreso: tiempo real por grupo muscular, series, repeticiones, evolución de un ejercicio y bici.
// Solo lógica, sin pantallas. Los datos entran como listas (sesiones, series, ejercicios), así que sirve igual para
// los datos reales y para los de ejemplo.

import { toIsoDate } from './dates.js'
import { MUSCLE_GROUPS, MUSCLE_REGIONS, regionOfGroup } from './defaultData.js'
import { mainMuscleGroup } from './exercises.js'
import { weekStart } from './history.js'
import { EXERCISE_UNITS, SESSION_STATUS, SESSION_TYPES } from './model.js'
import { getRulesForExercise, DEFAULT_PROGRESSION_RULES } from './progressionConfig.js'
import { difficultyRank, findLevel } from './resistance.js'
import { DEFAULT_REST_SECONDS } from './templates.js'

/**
 * Parte de un descanso que cuenta como ejercicio de core cuando se marca "core hecho" (decisión de David, 2026-11-09):
 * con 2 minutos de descanso, 1 minuto y medio es core (entre que empieza y corta para prepararse para la serie siguiente).
 */
export const CORE_REST_FRACTION = 0.75
/** Grupo al que se anota el tiempo del core de los descansos, sea el ejercicio que sea (abdominales o lumbares). */
export const CORE_REST_GROUP = 'core'

const isStrengthDone = (s) => s.type === SESSION_TYPES.STRENGTH && s.status === SESSION_STATUS.DONE
const toMs = (iso) => Date.parse(iso)

// ---- Tiempo real de una sesión de fuerza --------------------------------------------------------

/**
 * Reparte el tiempo real de una sesión entre grupos musculares y cuenta series y repeticiones.
 * Reglas (acordadas con David):
 *  - Cada ejercicio cuenta desde que termina el anterior (o desde que empieza la sesión) hasta su última serie,
 *    con sus descansos y transiciones. Lo que pasa después de la última serie no cuenta.
 *  - Todo el tiempo de un ejercicio va a su grupo muscular PRINCIPAL.
 *  - Cada "core hecho" en un descanso cuenta como CORE_REST_FRACTION del descanso para el grupo del core, y se resta
 *    del ejercicio en cuyo bloque cae ese descanso (el tiempo total no se duplica).
 * Devuelve { byGroup: { grupo: { seconds, sets, reps } }, trackedSeconds }.
 */
export function sessionStats(session, sets, exercises) {
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const mine = sets.filter((s) => s.sessionId === session.id && Number.isFinite(toMs(s.completedAt)))
  const byGroup = {}
  const add = (group, field, value) => {
    if (!group) return
    byGroup[group] ??= { seconds: 0, sets: 0, reps: 0 }
    byGroup[group][field] += value
  }

  // Series y repeticiones, al grupo principal de cada ejercicio.
  for (const set of mine) {
    const exercise = byId.get(set.exerciseId)
    const group = mainMuscleGroup(exercise)
    add(group, 'sets', 1)
    if ((exercise?.unit ?? EXERCISE_UNITS.REPS) === EXERCISE_UNITS.REPS) add(group, 'reps', set.reps)
  }

  // Bloques de tiempo: uno por ejercicio con series, en el orden en que se terminaron.
  const lastByExercise = new Map()
  for (const set of mine) lastByExercise.set(set.exerciseId, Math.max(lastByExercise.get(set.exerciseId) ?? 0, toMs(set.completedAt)))
  const startMs = toMs(session.startedAt)
  let previousEnd = Number.isFinite(startMs) ? startMs : null
  const blocks = [...lastByExercise.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([exerciseId, endMs]) => {
      const seconds = previousEnd === null ? 0 : Math.max(0, (endMs - previousEnd) / 1000)
      previousEnd = endMs
      return { exerciseId, seconds, coreSeconds: 0 }
    })

  // Core en los descansos.
  // Cada ejercicio guarda su propio descanso (los de una pierna descansan menos); las sesiones antiguas, el de la sesión.
  const restOf = (exerciseId) =>
    session.exercises?.find((e) => e.exerciseId === exerciseId)?.restSeconds ?? session.restSeconds ?? DEFAULT_REST_SECONDS
  for (const set of mine.filter((s) => s.coreAfter)) {
    const coreSeconds = Math.round(restOf(set.exerciseId) * CORE_REST_FRACTION)
    // El core de los descansos (también los ejercicios de lumbares) se anota siempre como "core".
    const coreGroup = CORE_REST_GROUP
    const lastOrder = Math.max(...mine.filter((s) => s.exerciseId === set.exerciseId).map((s) => s.order))
    const index = blocks.findIndex((b) => b.exerciseId === set.exerciseId)
    // El descanso tras la última serie de un ejercicio cae en el bloque del siguiente.
    const block = set.order === lastOrder ? blocks[index + 1] : blocks[index]
    add(coreGroup, 'sets', 1)
    if (block) {
      const taken = Math.min(coreSeconds, block.seconds - block.coreSeconds)
      block.coreSeconds += taken
      add(coreGroup, 'seconds', taken)
    } else {
      add(coreGroup, 'seconds', coreSeconds) // descanso final, después de la última serie
    }
  }

  let trackedSeconds = 0
  for (const block of blocks) {
    add(mainMuscleGroup(byId.get(block.exerciseId)), 'seconds', block.seconds - block.coreSeconds)
    trackedSeconds += block.seconds
  }
  return { byGroup, trackedSeconds }
}

// ---- Periodos y cubos (semanas o meses) --------------------------------------------------------

export const RANGES = Object.freeze([
  { id: '4w', label: 'Últimas 4 semanas', days: 28 },
  { id: '3m', label: 'Últimos 3 meses', days: 91 },
  { id: '6m', label: 'Últimos 6 meses', days: 182 },
  { id: '1y', label: 'Último año', days: 365 },
  { id: 'all', label: 'Todo el historial', days: null },
])

export const GRAINS = Object.freeze([
  { id: 'week', label: 'Por semana' },
  { id: 'month', label: 'Por mes' },
])

const parseIso = (iso) => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}
const addDays = (iso, days) => {
  const date = parseIso(iso)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** Fechas de inicio y fin (incluidas) de un periodo que termina hoy. `earliest` solo se usa para "Todo". */
export function rangeBounds(rangeId, today = new Date(), earliest = null) {
  const to = toIsoDate(today)
  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[1]
  const from = range.days ? addDays(to, -(range.days - 1)) : (earliest && earliest < to ? earliest : to)
  return { from, to }
}

const monthStart = (iso) => `${iso.slice(0, 7)}-01`
const bucketStart = (iso, grain) => (grain === 'month' ? monthStart(iso) : weekStart(parseIso(iso)))

/** Texto corto de un cubo: "9 nov" (semana que empieza ese lunes) o "nov" / "nov 25" (mes). */
export function bucketLabel(startIso, grain, now = new Date()) {
  const date = parseIso(startIso)
  if (grain === 'month') {
    const month = date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
    return date.getFullYear() === now.getFullYear() ? month : `${month} ${String(date.getFullYear()).slice(2)}`
  }
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
}

/** Todos los cubos (también los vacíos) entre dos fechas, de más antiguo a más reciente. */
export function makeBuckets(from, to, grain, now = new Date()) {
  const buckets = []
  let start = bucketStart(from, grain)
  while (start <= to) {
    buckets.push({ key: start, label: bucketLabel(start, grain, now) })
    if (grain === 'month') {
      const next = parseIso(start)
      next.setMonth(next.getMonth() + 1)
      start = toIsoDate(next)
    } else {
      start = addDays(start, 7)
    }
  }
  return buckets
}

// ---- Resumen por cubo -------------------------------------------------------------------------

/**
 * Suma por periodo (semana o mes) el tiempo, las series y las repeticiones de cada grupo muscular.
 * Devuelve { buckets: [{ key, label, groups: { g: { seconds, sets, reps } } }], totals: { g: {...} } }.
 */
export function summarize({ sessions, sets, exercises, from, to, grain = 'week', now = new Date() }) {
  const buckets = makeBuckets(from, to, grain, now).map((b) => ({ ...b, groups: {} }))
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  const totals = {}
  const setsBySession = new Map()
  for (const set of sets) {
    if (!setsBySession.has(set.sessionId)) setsBySession.set(set.sessionId, [])
    setsBySession.get(set.sessionId).push(set)
  }
  const sum = (target, group, stats) => {
    target[group] ??= { seconds: 0, sets: 0, reps: 0 }
    target[group].seconds += stats.seconds
    target[group].sets += stats.sets
    target[group].reps += stats.reps
  }
  for (const session of sessions) {
    if (!isStrengthDone(session) || session.date < from || session.date > to) continue
    const bucket = byKey.get(bucketStart(session.date, grain))
    if (!bucket) continue
    const stats = sessionStats(session, setsBySession.get(session.id) ?? [], exercises)
    for (const [group, value] of Object.entries(stats.byGroup)) {
      sum(bucket.groups, group, value)
      sum(totals, group, value)
    }
  }
  return { buckets, totals }
}

/** Series que se pueden dibujar: las 3 regiones, o los grupos musculares. */
export function seriesFor(by) {
  if (by === 'region') return MUSCLE_REGIONS.map((r) => ({ id: r.id, label: r.label }))
  return MUSCLE_GROUPS.map((g) => ({ id: g.id, label: g.label }))
}

const METRIC_FIELD = { hours: 'seconds', sets: 'sets', reps: 'reps' }

/** Valor de una medida: las horas se dan en horas (no en segundos). */
const metricValue = (stats, metric) => (stats ? (metric === 'hours' ? stats.seconds / 3600 : stats[METRIC_FIELD[metric]]) : 0)

/**
 * Convierte el resumen en filas para dibujar: una por cubo, con un valor por serie.
 * `by`: 'region' | 'group'; `metric`: 'hours' | 'sets' | 'reps'; `include`: ids de series a mostrar (vacío = todas).
 * Devuelve { series, rows: [{ key, label, values: { id: n }, total }], totals: { id: n } }.
 */
export function chartRows(summary, { by = 'region', metric = 'hours', include = null } = {}) {
  const all = seriesFor(by)
  const series = include && include.length > 0 ? all.filter((s) => include.includes(s.id)) : all
  const idOf = (group) => (by === 'region' ? regionOfGroup(group) : group)
  const collect = (groups) => {
    const values = Object.fromEntries(series.map((s) => [s.id, 0]))
    for (const [group, stats] of Object.entries(groups)) {
      const id = idOf(group)
      if (id in values) values[id] += metricValue(stats, metric)
    }
    return values
  }
  const rows = summary.buckets.map((b) => {
    const values = collect(b.groups)
    return { key: b.key, label: b.label, values, total: Object.values(values).reduce((a, n) => a + n, 0) }
  })
  return { series, rows, totals: collect(summary.totals) }
}

/** Totales de todo el periodo por grupo muscular (horas, series, repeticiones), de más a menos horas. */
export function groupTable(summary) {
  return MUSCLE_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    hours: (summary.totals[g.id]?.seconds ?? 0) / 3600,
    sets: summary.totals[g.id]?.sets ?? 0,
    reps: summary.totals[g.id]?.reps ?? 0,
  })).sort((a, b) => b.hours - a.hours || b.sets - a.sets)
}

// ---- Progreso de un ejercicio -------------------------------------------------------------------

/**
 * Evolución de un ejercicio: una entrada por sesión terminada en la que se hizo, de más antigua a más reciente.
 * Cada una lleva las repeticiones (o segundos) de cada serie, su media, la mejor serie, el nivel (banda o kg) de la
 * última serie y su dificultad (`rank`, mayor = más difícil; así se ve si subió de nivel aunque bajen las repeticiones).
 */
export function exerciseProgress({ exercise, scale, sessions, sets, rules = DEFAULT_PROGRESSION_RULES }) {
  const finished = new Map(sessions.filter(isStrengthDone).map((s) => [s.id, s]))
  const bySession = new Map()
  for (const set of sets) {
    if (set.exerciseId !== exercise.id || !finished.has(set.sessionId)) continue
    if (!bySession.has(set.sessionId)) bySession.set(set.sessionId, [])
    bySession.get(set.sessionId).push(set)
  }
  const entries = [...bySession.entries()]
    .map(([sessionId, list]) => {
      const ordered = [...list].sort((a, b) => a.order - b.order)
      const reps = ordered.map((s) => s.reps)
      const levelId = ordered.at(-1).levelId ?? null
      const level = levelId && scale ? findLevel(exercise, scale, levelId) : null
      return {
        sessionId,
        date: finished.get(sessionId).date,
        startedAt: finished.get(sessionId).startedAt ?? '',
        reps,
        avg: reps.reduce((a, n) => a + n, 0) / reps.length,
        best: Math.max(...reps),
        total: reps.reduce((a, n) => a + n, 0),
        levelId,
        levelLabel: level?.label ?? null,
        rank: levelId && scale ? difficultyRank(exercise, scale, levelId) : 0,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt))

  const changes = []
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].levelId !== entries[i - 1].levelId && entries[i].levelId) {
      changes.push({
        date: entries[i].date,
        from: entries[i - 1].levelLabel,
        to: entries[i].levelLabel,
        harder: entries[i].rank > entries[i - 1].rank,
      })
    }
  }
  const { repRange } = getRulesForExercise(exercise, rules)
  return {
    entries,
    changes,
    repRange,
    unit: exercise.unit ?? EXERCISE_UNITS.REPS,
    first: entries[0] ?? null,
    last: entries.at(-1) ?? null,
    bestSet: entries.length ? Math.max(...entries.map((e) => e.best)) : null,
  }
}

/** Ejercicios que tienen al menos una serie en sesiones terminadas, de más a menos sesiones. */
export function exercisesWithHistory({ exercises, sessions, sets }) {
  const finished = new Set(sessions.filter(isStrengthDone).map((s) => s.id))
  const counts = new Map()
  for (const set of sets) {
    if (!finished.has(set.sessionId)) continue
    if (!counts.has(set.exerciseId)) counts.set(set.exerciseId, new Set())
    counts.get(set.exerciseId).add(set.sessionId)
  }
  return exercises
    .filter((e) => counts.has(e.id))
    .map((e) => ({ exercise: e, sessions: counts.get(e.id).size }))
    .sort((a, b) => b.sessions - a.sessions || a.exercise.name.localeCompare(b.exercise.name, 'es'))
}

// ---- Bici ---------------------------------------------------------------------------------------

export const BIKE_FILTERS = Object.freeze([
  { id: 'all', label: 'Todas' },
  { id: SESSION_TYPES.BIKE_TRAINER, label: 'Rodillo' },
  { id: SESSION_TYPES.BIKE_OUTDOOR, label: 'Outdoor' },
])

/**
 * Bici por periodo: minutos, TSS y salidas hechas (las "no hechas" no cuentan). `type`: 'all' o el tipo de bici.
 * Devuelve { rows: [{ key, label, minutes, tss, count }], totals: { minutes, tss, count, avgTss } }.
 */
export function bikeSummary({ sessions, from, to, grain = 'week', type = 'all', now = new Date() }) {
  const buckets = makeBuckets(from, to, grain, now).map((b) => ({ ...b, minutes: 0, tss: 0, count: 0 }))
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  const totals = { minutes: 0, tss: 0, count: 0, avgTss: 0 }
  for (const s of sessions) {
    const bike = s.type === SESSION_TYPES.BIKE_TRAINER || s.type === SESSION_TYPES.BIKE_OUTDOOR
    if (!bike || s.status !== SESSION_STATUS.DONE || s.date < from || s.date > to) continue
    if (type !== 'all' && s.type !== type) continue
    const bucket = byKey.get(bucketStart(s.date, grain))
    if (!bucket) continue
    for (const target of [bucket, totals]) {
      target.minutes += s.durationMin ?? 0
      target.tss += s.tss ?? 0
      target.count += 1
    }
  }
  totals.avgTss = totals.count > 0 ? totals.tss / totals.count : 0
  return { rows: buckets.map(({ key, label, minutes, tss, count }) => ({ key, label, minutes, tss, count })), totals }
}

// ---- Formato -------------------------------------------------------------------------------------

/** Número con coma decimal y como mucho `digits` decimales: 1,5 · 12 · 0,3. */
export const formatNumber = (n, digits = 1) => n.toLocaleString('es-ES', { maximumFractionDigits: digits })

/** "1,5 h" o, si es menos de una hora, "40 min". */
export function formatHours(hours) {
  if (hours > 0 && hours < 1) return `${Math.round(hours * 60)} min`
  return `${formatNumber(hours, 1)} h`
}

/** Valor de una medida con su unidad, para etiquetas. */
export function formatMetric(value, metric) {
  if (metric === 'hours') return formatHours(value)
  return `${formatNumber(value, 0)} ${metric === 'sets' ? (Math.round(value) === 1 ? 'serie' : 'series') : 'rep.'}`
}

/** Fecha corta de un día ISO: "9 nov". */
export const shortDate = (iso) => parseIso(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
