// Tema de color: 'dark' (oscuro, por defecto), 'light' (claro) o 'auto' (el del móvil).

export const THEMES = [
  { id: 'dark', label: 'Oscuro' },
  { id: 'light', label: 'Claro' },
  { id: 'auto', label: 'Automático' },
]

const STORAGE_KEY = 'hom-gym-theme'

/** Aplica el tema a la página. Además lo apunta aparte para poder aplicarlo al instante al abrir. */
export function applyTheme(theme) {
  const valid = THEMES.some((t) => t.id === theme) ? theme : 'dark'
  document.documentElement.dataset.theme = valid
  try {
    localStorage.setItem(STORAGE_KEY, valid)
  } catch {
    // sin almacenamiento rápido: no pasa nada, el tema de verdad está en la base de datos
  }
  const isLight = valid === 'light' || (valid === 'auto' && window.matchMedia?.('(prefers-color-scheme: light)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isLight ? '#f4f5f8' : '#0f1115')
}
