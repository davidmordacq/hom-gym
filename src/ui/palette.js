// Colores de las gráficas. Cada cosa (región, músculo, banda) tiene SIEMPRE el mismo color, para que al filtrar no cambie.
// Son los colores categóricos del sistema de diseño; funcionan en tema claro y oscuro.

import { sequentialBlue } from './chartMath.js'

export const REGION_COLORS = { upper: '#2a78d6', lower: '#eb6834', core: '#1baf7a' }

export const GROUP_COLORS = {
  chest: '#2a78d6',
  back: '#eb6834',
  shoulders: '#1baf7a',
  biceps: '#eda100',
  triceps: '#e87ba4',
  quads: '#008300',
  hamstrings: '#6250d6',
  glutes: '#e34948',
  calves: '#8a5a2b',
  core: '#9a9890',
}

/** Músculos que se dibujan por defecto al ver "por músculo" (como mucho se pueden ver 8 a la vez). */
export const DEFAULT_GROUPS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes']
export const MAX_GROUPS_SHOWN = 8

const BAND_COLORS = { 'band-yellow': '#eda100', 'band-green': '#008300', 'band-blue': '#2a78d6', none: '#898781' }

/** Color de un nivel de resistencia: las bandas con el color de la banda; el resto, azules de claro (fácil) a oscuro (difícil). */
export function levelColor(levelId, levelsEasyToHard) {
  if (!levelId) return '#898781'
  if (BAND_COLORS[levelId]) return BAND_COLORS[levelId]
  const ordered = levelsEasyToHard.filter((l) => l.id !== 'none')
  const rank = ordered.findIndex((l) => l.id === levelId)
  return sequentialBlue(Math.max(0, rank), ordered.length)
}
