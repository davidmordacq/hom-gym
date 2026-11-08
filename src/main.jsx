import { createRoot } from 'react-dom/client'

// Marcador de la Fase 0: todavía no hay pantallas.
// Las pantallas reales llegan en la Fase 1.
createRoot(document.getElementById('root')).render(
  <main style={{ fontFamily: 'sans-serif', padding: 24, color: '#eee', background: '#0f1115', minHeight: '100vh' }}>
    <h1>Hom Gym</h1>
    <p>Fase 0: cimientos y reglas de progresión. Aún sin pantallas.</p>
  </main>,
)
