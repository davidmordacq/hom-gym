import { useEffect, useMemo, useState } from 'react'
import {
  BIKE_FILTERS, GRAINS, RANGES, bikeSummary, chartRows, exerciseProgress, exercisesWithHistory, formatHours, formatMetric, formatNumber,
  groupTable, rangeBounds, shortDate, summarize,
} from '../core/analysis.js'
import { MUSCLE_GROUPS, MUSCLE_REGIONS } from '../core/defaultData.js'
import { buildDemoData } from '../core/demoData.js'
import { levelsEasyToHard } from '../core/exercises.js'
import { SESSION_STATUS, SESSION_TYPES } from '../core/model.js'
import { getAll } from '../storage/db.js'
import { ChartLegend, DotsLine, StackedBars } from '../ui/charts.jsx'
import { DEFAULT_GROUPS, GROUP_COLORS, MAX_GROUPS_SHOWN, REGION_COLORS, levelColor } from '../ui/palette.js'

const VIEWS = [
  { id: 'summary', label: 'Resumen' },
  { id: 'exercise', label: 'Ejercicio' },
  { id: 'bike', label: 'Bici' },
]
const METRICS = [
  { id: 'hours', label: 'Horas' },
  { id: 'sets', label: 'Series' },
  { id: 'reps', label: 'Repeticiones' },
]
const BIKE_METRICS = [
  { id: 'tss', label: 'TSS' },
  { id: 'hours', label: 'Horas' },
  { id: 'count', label: 'Salidas' },
]

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="segmented progress-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className={`seg${value === o.id ? ' seg-active' : ''}`} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Periodo y agrupación (semana o mes), comunes al resumen y a la bici. */
function PeriodControls({ range, setRange, grain, setGrain }) {
  return (
    <>
      <label className="field">
        <span className="field-label">Periodo</span>
        <select value={range} onChange={(e) => setRange(e.target.value)}>
          {RANGES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <Segmented label="Agrupar" options={GRAINS} value={grain} onChange={setGrain} />
    </>
  )
}

/** Por defecto, periodos largos se agrupan por mes y los cortos por semana (hasta que David elija). */
const defaultGrain = (range) => (['6m', '1y', 'all'].includes(range) ? 'month' : 'week')

function useBounds(range, sessions, kinds) {
  return useMemo(() => {
    const dates = sessions.filter((s) => kinds(s) && s.status === SESSION_STATUS.DONE).map((s) => s.date).sort()
    return rangeBounds(range, new Date(), dates[0] ?? null)
  }, [range, sessions, kinds])
}
const isStrength = (s) => s.type === SESSION_TYPES.STRENGTH
const isBike = (s) => s.type === SESSION_TYPES.BIKE_TRAINER || s.type === SESSION_TYPES.BIKE_OUTDOOR

// ---- Resumen ---------------------------------------------------------------------------------------------

function Summary({ sessions, sets, exercises }) {
  const [range, setRange] = useState('3m')
  const [grainChoice, setGrain] = useState(null)
  const [metric, setMetric] = useState('hours')
  const [by, setBy] = useState('region')
  const [groups, setGroups] = useState(DEFAULT_GROUPS)
  const grain = grainChoice ?? defaultGrain(range)
  const { from, to } = useBounds(range, sessions, isStrength)

  const summary = useMemo(() => summarize({ sessions, sets, exercises, from, to, grain }), [sessions, sets, exercises, from, to, grain])
  const shownGroups = MUSCLE_GROUPS.filter((g) => groups.includes(g.id)).slice(0, MAX_GROUPS_SHOWN).map((g) => g.id)
  const chart = useMemo(() => chartRows(summary, { by, metric, include: by === 'group' ? shownGroups : null }), [summary, by, metric, shownGroups.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const colored = chart.series.map((s) => ({ ...s, color: (by === 'region' ? REGION_COLORS : GROUP_COLORS)[s.id] }))
  const table = useMemo(() => groupTable(summary), [summary])
  const regions = useMemo(() => chartRows(summary, { by: 'region', metric: 'hours' }), [summary])
  const totalHours = Object.values(regions.totals).reduce((a, n) => a + n, 0)
  const fmt = (v) => formatMetric(v, metric)
  const fmtTick = (v) => (metric === 'hours' ? `${formatNumber(v, 1)}` : formatNumber(v, 0))
  const hasData = summary.buckets.some((b) => Object.keys(b.groups).length > 0)

  const toggleGroup = (id) => setGroups((current) => (current.includes(id) ? current.filter((g) => g !== id) : [...current, id]))

  return (
    <>
      <section className="card">
        <PeriodControls range={range} setRange={setRange} grain={grain} setGrain={setGrain} />
        <div className="field">
          <span className="field-label">Medir</span>
          <Segmented label="Medir" options={METRICS} value={metric} onChange={setMetric} />
        </div>
        <div className="field">
          <span className="field-label">Ver por</span>
          <Segmented label="Ver por" options={[{ id: 'region', label: 'Superior / inferior' }, { id: 'group', label: 'Músculo' }]} value={by} onChange={setBy} />
        </div>
        {by === 'group' && (
          <div className="field">
            <span className="field-label">Músculos a mostrar (hasta {MAX_GROUPS_SHOWN})</span>
            <div className="chips" role="group" aria-label="Músculos a mostrar">
              {MUSCLE_GROUPS.map((g) => (
                <button key={g.id} type="button" className={`chip${shownGroups.includes(g.id) ? ' chip-on' : ''}`} aria-pressed={shownGroups.includes(g.id)} onClick={() => toggleGroup(g.id)}>
                  {g.label}
                </button>
              ))}
            </div>
            {groups.length > MAX_GROUPS_SHOWN && <p className="muted small">Solo se dibujan {MAX_GROUPS_SHOWN} a la vez: quita alguno para ver los demás.</p>}
          </div>
        )}
      </section>

      <section className="card">
        <h2>
          {METRICS.find((m) => m.id === metric).label} de fuerza {grain === 'week' ? 'por semana' : 'por mes'}
        </h2>
        {!hasData && <p className="muted">No hay sesiones de fuerza terminadas en este periodo.</p>}
        <ChartLegend items={colored} />
        <StackedBars
          rows={chart.rows}
          series={colored}
          formatValue={fmt}
          formatTick={fmtTick}
          ariaLabel={`Barras de ${METRICS.find((m) => m.id === metric).label.toLowerCase()} por ${grain === 'week' ? 'semana' : 'mes'}`}
        />
      </section>

      <section className="card">
        <h2>Totales del periodo</h2>
        <div className="tiles">
          <div className="tile">
            <span className="muted small">Tiempo de fuerza</span>
            <strong>{formatHours(totalHours)}</strong>
          </div>
          {MUSCLE_REGIONS.map((r) => (
            <div className="tile" key={r.id}>
              <span className="muted small">
                <span className="swatch" style={{ background: REGION_COLORS[r.id] }} aria-hidden="true" />
                {r.label}
              </span>
              <strong>{formatHours(regions.totals[r.id])}</strong>
            </div>
          ))}
        </div>
        <table className="totals-table">
          <thead>
            <tr>
              <th scope="col">Músculo</th>
              <th scope="col">Horas</th>
              <th scope="col">Series</th>
              <th scope="col">Rep.</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                <td>{row.hours > 0 ? formatHours(row.hours) : '–'}</td>
                <td>{row.sets || '–'}</td>
                <td>{row.reps || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <details className="chart-data">
          <summary>Cómo se calcula el tiempo</summary>
          <p className="muted small">
            Es tiempo real. Cada ejercicio cuenta desde que terminas el anterior (o empiezas la sesión) hasta su última serie, con sus
            descansos, y se anota en su músculo principal. Lo que pasa después de la última serie no cuenta. Cada vez que marcas el core
            hecho en un descanso, ese descanso cuenta como core el 75 % del tiempo (1,5 min con descansos de 2 min) y se resta del ejercicio.
            Las series y repeticiones también se anotan en el músculo principal; la plancha cuenta series pero no repeticiones.
          </p>
        </details>
      </section>
    </>
  )
}

// ---- Ejercicio ---------------------------------------------------------------------------------------------

function ExerciseView({ sessions, sets, exercises, scales }) {
  const options = useMemo(() => exercisesWithHistory({ exercises, sessions, sets }), [exercises, sessions, sets])
  const [chosen, setChosen] = useState(null)
  const current = options.find((o) => o.exercise.id === chosen)?.exercise ?? options[0]?.exercise ?? null
  const scale = current ? scales.find((s) => s.id === current.scaleId) ?? null : null
  const progress = useMemo(() => (current ? exerciseProgress({ exercise: current, scale, sessions, sets }) : null), [current, scale, sessions, sets])

  if (!current) {
    return (
      <section className="card">
        <p>Aún no hay ejercicios con series terminadas. Cuando termines una sesión de fuerza, podrás ver aquí cómo evoluciona cada ejercicio.</p>
      </section>
    )
  }

  const levels = levelsEasyToHard(current, scale)
  const unit = progress.unit === 'seconds' ? 's' : 'rep.'
  const points = progress.entries.map((e) => ({
    key: e.sessionId,
    date: e.date,
    value: Math.round(e.avg * 10) / 10,
    color: levelColor(e.levelId, levels),
    title: `${e.levelLabel ?? 'Sin material'} · media ${formatNumber(e.avg, 1)} ${unit}`,
    detail: `Series: ${e.reps.join(', ')} ${unit}`,
  }))
  const usedLevels = levels.filter((l) => progress.entries.some((e) => e.levelId === l.id)).map((l) => ({ id: l.id, label: l.label, color: levelColor(l.id, levels) }))
  const describe = (e) => `${shortDate(e.date)} · ${e.levelLabel ? `${e.levelLabel} · ` : ''}media ${formatNumber(e.avg, 1)} ${unit}`

  return (
    <>
      <section className="card">
        <label className="field">
          <span className="field-label">Ejercicio</span>
          <select value={current.id} onChange={(e) => setChosen(e.target.value)}>
            {options.map((o) => (
              <option key={o.exercise.id} value={o.exercise.id}>
                {o.exercise.name} ({o.sessions} {o.sessions === 1 ? 'sesión' : 'sesiones'})
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2>Media de {progress.unit === 'seconds' ? 'segundos' : 'repeticiones'} por sesión</h2>
        {usedLevels.length > 0 && <ChartLegend items={usedLevels} />}
        <DotsLine
          points={points}
          target={progress.repRange}
          formatDate={shortDate}
          unitWord={unit}
          ariaLabel={`Evolución de ${current.name}: media por sesión y material usado`}
        />
        <p className="muted small">Cada punto es una sesión (la media de sus series). El color indica la banda o el peso usados: si cambia de color hacia más difícil, hay progreso aunque la media baje.</p>
      </section>

      <section className="card">
        <h2>Resumen</h2>
        <ul className="summary-list">
          <li>
            <span className="muted small">Primera vez</span>
            <span>{describe(progress.first)}</span>
          </li>
          <li>
            <span className="muted small">Última vez</span>
            <span>{describe(progress.last)}</span>
          </li>
          <li>
            <span className="muted small">Mejor serie</span>
            <span>
              {progress.bestSet} {unit}
            </span>
          </li>
          <li>
            <span className="muted small">Sesiones</span>
            <span>{progress.entries.length}</span>
          </li>
        </ul>
        {progress.changes.length > 0 && (
          <>
            <h2 className="changes-title">Cambios de material</h2>
            <ul className="summary-list">
              {progress.changes.map((c) => (
                <li key={c.date + c.to}>
                  <span>
                    {shortDate(c.date)}: de {c.from ?? 'sin material'} a {c.to}
                  </span>
                  <span className="muted small">{c.harder ? 'Más difícil' : 'Más fácil'}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  )
}

// ---- Bici -------------------------------------------------------------------------------------------------

function BikeView({ sessions }) {
  const [range, setRange] = useState('3m')
  const [grainChoice, setGrain] = useState(null)
  const [metric, setMetric] = useState('tss')
  const [type, setType] = useState('all')
  const grain = grainChoice ?? defaultGrain(range)
  const { from, to } = useBounds(range, sessions, isBike)
  const summary = useMemo(() => bikeSummary({ sessions, from, to, grain, type }), [sessions, from, to, grain, type])
  const rows = summary.rows.map((r) => {
    const value = metric === 'tss' ? r.tss : metric === 'hours' ? r.minutes / 60 : r.count
    return { key: r.key, label: r.label, values: { bike: value }, total: value }
  })
  const fmt = (v) => (metric === 'tss' ? `${formatNumber(v, 0)} TSS` : metric === 'hours' ? formatHours(v) : `${formatNumber(v, 0)} ${Math.round(v) === 1 ? 'salida' : 'salidas'}`)
  const fmtTick = (v) => formatNumber(v, metric === 'hours' ? 1 : 0)
  const color = type === SESSION_TYPES.BIKE_OUTDOOR ? '#1baf7a' : type === SESSION_TYPES.BIKE_TRAINER ? '#eb6834' : '#2a78d6'
  const t = summary.totals

  return (
    <>
      <section className="card">
        <PeriodControls range={range} setRange={setRange} grain={grain} setGrain={setGrain} />
        <div className="field">
          <span className="field-label">Medir</span>
          <Segmented label="Medir" options={BIKE_METRICS} value={metric} onChange={setMetric} />
        </div>
        <div className="field">
          <span className="field-label">Tipo</span>
          <Segmented label="Tipo de bici" options={BIKE_FILTERS} value={type} onChange={setType} />
        </div>
      </section>

      <section className="card">
        <div className="tiles">
          <div className="tile">
            <span className="muted small">Tiempo en bici</span>
            <strong>{formatHours(t.minutes / 60)}</strong>
          </div>
          <div className="tile">
            <span className="muted small">TSS total</span>
            <strong>{formatNumber(t.tss, 0)}</strong>
          </div>
          <div className="tile">
            <span className="muted small">Salidas</span>
            <strong>{t.count}</strong>
          </div>
          <div className="tile">
            <span className="muted small">TSS medio</span>
            <strong>{t.count > 0 ? formatNumber(t.avgTss, 0) : '–'}</strong>
          </div>
        </div>
        {t.count === 0 && <p className="muted">No hay salidas de bici hechas en este periodo.</p>}
        <h2>
          {BIKE_METRICS.find((m) => m.id === metric).label} {grain === 'week' ? 'por semana' : 'por mes'}
        </h2>
        <StackedBars
          rows={rows}
          series={[{ id: 'bike', label: 'Bici', color }]}
          formatValue={fmt}
          formatTick={fmtTick}
          ariaLabel={`Barras de ${BIKE_METRICS.find((m) => m.id === metric).label.toLowerCase()} de bici`}
        />
        <p className="muted small">Cuentan las salidas que marcaste como hechas. El TSS que no escribiste cuenta 0.</p>
      </section>
    </>
  )
}

// ---- Pantalla ---------------------------------------------------------------------------------------------

export default function Progress({ db, sessions, exercises, scales, templates }) {
  const [view, setView] = useState('summary')
  const [demo, setDemo] = useState(false)
  const [realSets, setRealSets] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getAll(db, 'sets')
      .then((rows) => !cancelled && setRealSets(rows))
      .catch((e) => !cancelled && setError(`No se pudieron leer las series: ${e.message}`))
    return () => {
      cancelled = true
    }
  }, [db, sessions])

  const demoData = useMemo(() => (demo ? buildDemoData({ exercises, scales, templates }) : null), [demo, exercises, scales, templates])
  const data = demo ? demoData : { sessions, sets: realSets }

  return (
    <>
      <h1>Progreso</h1>
      <Segmented label="Vista" options={VIEWS} value={view} onChange={setView} />
      <label className="check demo-check">
        <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
        <span>Ver con datos de ejemplo</span>
      </label>
      {demo && <p className="message">Estás viendo datos inventados, no los tuyos. Sirven para ver cómo quedan las gráficas.</p>}
      {error && <p className="message message-error">{error}</p>}

      {view === 'summary' && <Summary sessions={data.sessions} sets={data.sets} exercises={exercises} />}
      {view === 'exercise' && <ExerciseView sessions={data.sessions} sets={data.sets} exercises={exercises} scales={scales} />}
      {view === 'bike' && <BikeView sessions={data.sessions} />}
    </>
  )
}
