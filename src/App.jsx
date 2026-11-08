import { useCallback, useEffect, useState } from 'react'
import { getAll, getSetting, openDb } from './storage/db.js'
import { seedIfNeeded } from './storage/seed.js'
import { applyTheme } from './theme.js'
import { CalendarIcon, DumbbellIcon, HistoryIcon, HomeIcon, SlidersIcon } from './ui/icons.jsx'
import Placeholder from './screens/Placeholder.jsx'
import Settings from './screens/Settings.jsx'
import Today from './screens/Today.jsx'

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
  const [plan, theme] = await Promise.all([getAll(db, 'plan'), getSetting(db, 'theme', 'dark')])
  applyTheme(theme)
  return { plan, theme }
}

export default function App() {
  const [tab, setTab] = useState('today')
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

  return (
    <div className="app">
      <main className="screen">
        {tab === 'today' && <Today plan={state.plan} />}
        {tab === 'week' && <Placeholder title="Semana" entrega="1c" text="Aquí verás y editarás tu plan semanal." />}
        {tab === 'history' && <Placeholder title="Historial" entrega="1e" text="Aquí verás los entrenos que ya hiciste." />}
        {tab === 'exercises' && <Placeholder title="Ejercicios" entrega="1b" text="Aquí estará tu lista de ejercicios con vídeo." />}
        {tab === 'settings' && <Settings db={state.db} theme={state.theme} persisted={state.persisted} onChanged={reload} />}
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
