import { useEffect, useMemo, useState } from 'react'
import { calendarMonth, ENTRY_KINDS, trackingStart, weekGroupsWorked, weeklyStreak } from '../core/calendar.js'
import { toIsoDate } from '../core/dates.js'
import { MUSCLE_GROUPS } from '../core/defaultData.js'
import { dateText, sessionLine, sessionMinutes } from '../core/history.js'
import { getAll } from '../storage/db.js'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const LETTERS = { strength: 'F', bike_trainer: 'R', bike_outdoor: 'O', mobility: 'M' }
const TYPE_NAMES = { strength: 'Fuerza', bike_trainer: 'Rodillo', bike_outdoor: 'Outdoor', mobility: 'Movilidad' }
const KIND_TEXT = {
  done: 'Hecha',
  extra: 'Hecha (no estaba prevista)',
  missed: 'No hecha',
  planned: 'Prevista',
  running: 'En curso',
}
const MAX_MARKERS = 4

function Marker({ entry }) {
  return (
    <span className={`mk mk-${entry.type} mk-${entry.kind}`} aria-hidden="true">
      {LETTERS[entry.type] ?? '?'}
    </span>
  )
}

const dayLabel = (day) => {
  const text = day.entries.map((e) => `${TYPE_NAMES[e.type] ?? e.type}: ${KIND_TEXT[e.kind].toLowerCase()}`).join(', ')
  return `${dateText(day.date)}${text ? `. ${text}` : '. Sin sesiones'}`
}

/** Calendario del mes con lo previsto y lo cumplido, resumen de cumplimiento y músculos trabajados esta semana. */
export default function CalendarView({ db, plan, sessions, exercises, goals, installedAt }) {
  const today = new Date()
  const todayIso = toIsoDate(today)
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [selected, setSelected] = useState(todayIso)
  const [sets, setSets] = useState([])

  useEffect(() => {
    let cancelled = false
    getAll(db, 'sets')
      .then((rows) => !cancelled && setSets(rows))
      .catch(() => !cancelled && setSets([]))
    return () => {
      cancelled = true
    }
  }, [db, sessions])

  const trackingFrom = useMemo(() => trackingStart(installedAt, sessions), [installedAt, sessions])
  const month = useMemo(
    () => calendarMonth({ year: cursor.year, month: cursor.month, plan, sessions, today: todayIso, trackingFrom }),
    [cursor, plan, sessions, todayIso, trackingFrom],
  )
  const streak = useMemo(() => weeklyStreak({ plan, sessions, today: todayIso, trackingFrom }), [plan, sessions, todayIso, trackingFrom])
  const worked = useMemo(() => weekGroupsWorked({ sessions, sets, exercises, today: todayIso }), [sessions, sets, exercises, todayIso])
  const selectedDay = month.weeks.flat().find((d) => d.date === selected) ?? null

  const monthName = new Date(cursor.year, cursor.month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const move = (delta) => {
    const next = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: next.getFullYear(), month: next.getMonth() })
    setSelected(null)
  }
  const { stats } = month

  return (
    <>
      <section className="card">
        <div className="cal-header">
          <button type="button" className="step-btn" aria-label="Mes anterior" onClick={() => move(-1)}>
            ‹
          </button>
          <h2 className="cal-title">{monthName.charAt(0).toUpperCase() + monthName.slice(1)}</h2>
          <button type="button" className="step-btn" aria-label="Mes siguiente" onClick={() => move(1)}>
            ›
          </button>
        </div>
        <div className="cal-grid" role="grid" aria-label={monthName}>
          {WEEKDAYS.map((d) => (
            <span key={d} className="cal-weekday" role="columnheader">
              {d}
            </span>
          ))}
          {month.weeks.flat().map((day) => {
            const shown = day.entries.slice(0, MAX_MARKERS)
            return (
              <button
                key={day.date}
                type="button"
                role="gridcell"
                className={`cal-day${day.inMonth ? '' : ' cal-out'}${day.isToday ? ' cal-today' : ''}${selected === day.date ? ' cal-selected' : ''}`}
                aria-label={dayLabel(day)}
                aria-pressed={selected === day.date}
                onClick={() => setSelected(day.date)}
              >
                <span className="cal-num">{Number(day.date.slice(8))}</span>
                <span className="cal-markers">
                  {shown.map((e, i) => (
                    <Marker key={i} entry={e} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>

        <ul className="cal-legend" aria-label="Leyenda">
          <li>
            <span className="mk mk-strength mk-done" aria-hidden="true">F</span> Hecha
          </li>
          <li>
            <span className="mk mk-strength mk-planned" aria-hidden="true">F</span> Prevista
          </li>
          <li>
            <span className="mk mk-strength mk-missed" aria-hidden="true">F</span> No hecha
          </li>
        </ul>
        <ul className="cal-legend" aria-label="Tipos">
          {Object.entries(TYPE_NAMES).map(([type, name]) => (
            <li key={type}>
              <span className={`mk mk-${type} mk-done`} aria-hidden="true">
                {LETTERS[type]}
              </span>{' '}
              {name}
            </li>
          ))}
        </ul>
      </section>

      {selectedDay && (
        <section className="card" aria-label="Día elegido">
          <h2>{dateText(selectedDay.date)}</h2>
          {selectedDay.entries.length === 0 ? (
            <p className="muted">No hay nada previsto ni hecho este día.</p>
          ) : (
            <ul className="summary-list">
              {selectedDay.entries.map((e, i) => {
                const minutes = e.session ? sessionMinutes(e.session) : null
                const detail = e.session && e.kind !== ENTRY_KINDS.MISSED ? sessionLine(e.session, [], []) : ''
                return (
                  <li key={i} className="cal-entry">
                    <Marker entry={e} />
                    <span className="cal-entry-text">
                      <span className="exercise-name">{e.name}</span>
                      <span className="muted small">
                        {KIND_TEXT[e.kind]}
                        {e.kind === ENTRY_KINDS.DONE || e.kind === ENTRY_KINDS.EXTRA ? (minutes ? ` · ${minutes} min` : detail ? ` · ${detail}` : '') : ''}
                        {e.session?.tss ? ` · TSS ${e.session.tss}` : ''}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <section className="card">
        <h2>Cumplimiento</h2>
        {stats.percent === null ? (
          <p className="muted">Todavía no hay sesiones previstas que se hayan podido cumplir este mes.</p>
        ) : (
          <p>
            <strong>
              {stats.done} de {stats.done + stats.missed}
            </strong>{' '}
            previstas cumplidas ({stats.percent} %)
          </p>
        )}
        <p className="muted small">
          {stats.extra > 0 ? `${stats.extra} extra (sin estar previstas) · ` : ''}
          {stats.planned > 0 ? `${stats.planned} por hacer este mes` : 'Nada más previsto este mes'}
        </p>
        <p>
          <strong>Racha:</strong> {streak} {streak === 1 ? 'semana seguida' : 'semanas seguidas'} con todo lo previsto cumplido
        </p>
        <p className="muted small">
          El calendario compara el plan actual con lo que has hecho. Si cambias el plan, los días pasados se calculan con el plan nuevo.
        </p>
      </section>

      <section className="card">
        <h2>Músculos trabajados esta semana</h2>
        <p className="muted small">En cuántas sesiones ha salido cada uno, frente a tu objetivo por semana.</p>
        <ul className="freq-list">
          {MUSCLE_GROUPS.map((g) => {
            const goal = goals?.timesPerWeekByGroup?.[g.id] ?? 2
            const count = worked[g.id] ?? 0
            return (
              <li key={g.id} className={count >= goal ? 'freq-ok' : undefined}>
                <span>{g.label}</span>
                <span>
                  {count >= goal ? '✓ ' : ''}
                  {count}/{goal}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
