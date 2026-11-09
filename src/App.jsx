import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_PROGRESSION_RULES } from './core/progressionConfig.js'
import { getAll, getSetting, openDb } from './storage/db.js'
import { DEFAULT_GOALS } from './core/defaultData.js'
import { DEFAULT_REST_SECONDS } from './core/templates.js'
import { seedIfNeeded, seedLibraryIfNeeded, seedScaleLevelsIfNeeded, seedTemplatesIfNeeded } from './storage/seed.js'
import { applyTheme } from './theme.js'
import { CalendarIcon, DumbbellIcon, HistoryIcon, HomeIcon, SlidersIcon } from './ui/icons.jsx'
import Exercises from './screens/Exercises.jsx'
import Placeholder from './screens/Placeholder.jsx'
import SessionRunner from './screens/SessionRunner.jsx'
import Settings from './screens/Settings.jsx'
import Today from './screens/Today.jsx'
import Week from './screens/Week.jsx'

const TABS = [
  { id: 'today', label: 'Hoy', Icon: HomeIcon },
  { id: 'week', label: 'Semana', Icon: CalendarIcon },
  { id: 'history', label: 'Historial', Icon: HistoryIcon },
  { id: 'exercises', label: 'Ejercicios', Icon: DumbbellIcon },
  { id: 'settings', label: 'Ajustes', Icon: SlidersIcon },
]

/** Pide al navegador que no borre los datos por falta de espacio. Devuelve si quedó protegido. */
async function requestPersistence() {
  try {
    if (await navigator.storage?.persisted?.()) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

async function loadAppData(db) {
  // También tras restaurar una copia antigua que no traía ejercicios, niveles o sesiones. El orden importa:
  // las sesiones de partida necesitan que los ejercicios ya estén cargados.
  await seedLibraryIfNeeded(db)
  await seedScaleLevelsIfNeeded(db)
  await seedTemplatesIfNeeded(db)
  const [plan, theme, exercises, scales, rules, templates, sessions, goals, restSeconds] = await Promise.all([
    getAll(db, 'plan'),
    getSetting(db, 'theme', 'dark'),
    getAll(db, 'exercises'),
    getAll(db, 'scales'),
    getSetting(db, 'progressionRules', DEFAULT_PROGRESSION_RULES),
    getAll(db, 'templates'),
    getAll(db, 'sessions'),
    getSetting(db, 'goals', DEFAULT_GOALS),
    getSetting(db, 'restSeconds', DEFAULT_REST_SECONDS),
  ])
  applyTheme(theme)
  return { plan, theme, exercises, scales, rules, templates, sessions, goals, restSeconds }
}

export default function App() {
  const [tab, setTab] = useState('today')
  const [runningId, setRunningId] = useState(null) // sesión de fuerza abierta a pantalla completa
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const db = await openDb()
        if (cancelled) return db.close()
        await seedIfNeeded(db)
        const data = await loadAppData(db)
        const persisted = await requestPersistence()
        if (!cancelled) setState({ status: 'ready', db, persisted, ...data })
      } catch (error) {
        if (!cancelled) setState({ status: 'error', error })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const reload = useCallback(async () => {
    const data = await loadAppData(state.db)
    setState((previous) => ({ ...previous, ...data }))
  }, [state.db])

  if (state.status === 'loading') return <p className="status">Abriendo…</p>

  if (state.status === 'error') {
    return (
      <main className="screen">
        <h1>No se pudo abrir el guardado</h1>
        <p className="muted">
          La app necesita guardar tus datos en este dispositivo y el navegador no lo permite. Si estás en una
          ventana privada, ábrela en una ventana normal.
        </p>
        <p className="muted small">{String(state.error?.message ?? state.error)}</p>
      </main>
    )
  }

  // La sesión en curso ocupa toda la pantalla (sin menú inferior) para no tocarlo sin querer.
  if (runningId) {
    return (
      <div className="app">
        <main className="screen">
          <SessionRunner
            db={state.db}
            sessionId={runningId}
            exercises={state.exercises}
            scales={state.scales}
            rules={state.rules}
            restSeconds={state.restSeconds}
            sessions={state.sessions}
            onExit={async () => {
              setRunningId(null)
              await reload()
            }}
            onChanged={reload}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <main className="screen">
        {tab === 'today' && (
          <Today
            db={state.db}
            plan={state.plan}
            templates={state.templates}
            exercises={state.exercises}
            sessions={state.sessions}
            rules={state.rules}
            restSeconds={state.restSeconds}
            onOpenSession={setRunningId}
            onChanged={reload}
          />
        )}
        {tab === 'week' && (
          <Week
            db={state.db}
            plan={state.plan}
            templates={state.templates}
            exercises={state.exercises}
            rules={state.rules}
            restSeconds={state.restSeconds}
            goals={state.goals}
            onChanged={reload}
          />
        )}
        {tab === 'history' && <Placeholder title="Historial" entrega="1e" text="Aquí verás los entrenos que ya hiciste." />}
        {tab === 'exercises' && (
          <Exercises db={state.db} exercises={state.exercises} scales={state.scales} rules={state.rules} onChanged={reload} />
        )}
        {tab === 'settings' && (
          <Settings db={state.db} theme={state.theme} persisted={state.persisted} restSeconds={state.restSeconds} onChanged={reload} />
        )}
      </main>
      <nav className="tabbar" aria-label="Secciones">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`tab${tab === id ? ' tab-active' : ''}`}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
