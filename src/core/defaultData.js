// Datos de partida. Todo esto se podrá editar desde la app (Fase 1); aquí solo está el punto de arranque.

import { SESSION_TYPES } from './model.js'

/** Escalas de resistencia, de menos a más resistencia. */
export const DEFAULT_SCALES = [
  {
    id: 'bands',
    name: 'Bandas elásticas',
    levels: [
      { id: 'band-blue', label: 'Banda azul (más suave)' },
      { id: 'band-green', label: 'Banda verde (media)' },
      { id: 'band-yellow', label: 'Banda amarilla (muy dura)' },
    ],
  },
  {
    id: 'kg',
    name: 'Peso y lastre (kg)',
    levels: [
      { id: 'kg-0', label: 'Peso corporal' },
      { id: 'kg-5', label: '5 kg' },
      { id: 'kg-10', label: '10 kg (mochila o saco)' },
      { id: 'kg-15', label: '15 kg' },
      { id: 'kg-20', label: '20 kg (mochila + saco)' },
    ],
  },
  {
    id: 'ankle-weights',
    name: 'Tobilleras',
    levels: [
      { id: 'ankle-0', label: 'Sin tobilleras' },
      { id: 'ankle-2', label: 'Tobilleras de 2 kg' },
    ],
  },
]

/**
 * Niveles que se añadieron a una escala DESPUÉS de la primera versión. Cada dispositivo los recibe una sola vez
 * (ver seedScaleLevelsIfNeeded), para que los móviles que ya tenían la escala los reciban sin pisar nada.
 */
export const SCALE_LEVEL_ADDITIONS = [
  {
    id: 'band-yellow',
    scaleId: 'bands',
    afterLevelId: 'band-green',
    level: { id: 'band-yellow', label: 'Banda amarilla (muy dura)' },
  },
]

export const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Pecho' },
  { id: 'back', label: 'Espalda' },
  { id: 'shoulders', label: 'Hombros' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'core', label: 'Core' },
  { id: 'quads', label: 'Cuádriceps' },
  { id: 'hamstrings', label: 'Isquiotibiales' },
  { id: 'glutes', label: 'Glúteos' },
  { id: 'calves', label: 'Gemelos' },
]

/** Plan semanal de ejemplo (1 = lunes ... 7 = domingo). Un día puede tener varias sesiones. */
export const DEFAULT_WEEK_PLAN = [
  { id: 'mon-strength', weekday: 1, type: SESSION_TYPES.STRENGTH, name: 'Fuerza', flexible: true },
  { id: 'tue-trainer', weekday: 2, type: SESSION_TYPES.BIKE_TRAINER, name: 'Bici en rodillo', flexible: false },
  { id: 'tue-mobility', weekday: 2, type: SESSION_TYPES.MOBILITY, name: 'Movilidad', flexible: true },
  { id: 'wed-strength', weekday: 3, type: SESSION_TYPES.STRENGTH, name: 'Fuerza', flexible: true },
  { id: 'thu-trainer', weekday: 4, type: SESSION_TYPES.BIKE_TRAINER, name: 'Bici en rodillo', flexible: false },
  { id: 'thu-mobility', weekday: 4, type: SESSION_TYPES.MOBILITY, name: 'Movilidad', flexible: true },
  { id: 'fri-strength', weekday: 5, type: SESSION_TYPES.STRENGTH, name: 'Fuerza', flexible: true },
  { id: 'sat-outdoor', weekday: 6, type: SESSION_TYPES.BIKE_OUTDOOR, name: 'Bici outdoor', flexible: true },
  { id: 'sun-outdoor', weekday: 7, type: SESSION_TYPES.BIKE_OUTDOOR, name: 'Bici outdoor', flexible: true },
]

/**
 * Sesiones de fuerza de partida (editables desde la app). Se usan en este orden para la rotación:
 * la app propone la siguiente a la última que hiciste.
 * Cada ejercicio lleva: series, si se hace por separado con cada lado (pierna o brazo) y el core opcional del descanso.
 */
export const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-upper',
    name: 'Tren superior',
    order: 1,
    items: [
      { exerciseId: 'assisted-pull-up', sets: 3, perSide: false, coreExerciseId: 'dead-bug' },
      { exerciseId: 'push-up', sets: 3, perSide: false, coreExerciseId: 'reverse-crunch' },
      { exerciseId: 'assisted-chin-up', sets: 3, perSide: false, coreExerciseId: 'bird-dog' },
      { exerciseId: 'close-push-up', sets: 3, perSide: false, coreExerciseId: 'leg-raise' },
      { exerciseId: 'banded-lateral-raise', sets: 3, perSide: false, coreExerciseId: 'crunch' },
      { exerciseId: 'banded-front-raise', sets: 3, perSide: false, coreExerciseId: null },
    ],
  },
  {
    id: 'tpl-lower',
    name: 'Tren inferior',
    order: 2,
    items: [
      { exerciseId: 'bulgarian-split-squat', sets: 3, perSide: true, coreExerciseId: 'plank' },
      { exerciseId: 'single-leg-rdl', sets: 3, perSide: true, coreExerciseId: 'side-plank' },
      { exerciseId: 'single-leg-bridge', sets: 3, perSide: true, coreExerciseId: 'dead-bug' },
      { exerciseId: 'calf-raise', sets: 3, perSide: true, coreExerciseId: null },
      { exerciseId: 'goblet-squat', sets: 3, perSide: false, coreExerciseId: 'bird-dog' },
    ],
  },
]

/** Objetivos de partida (editables). La propuesta automática de plan (Fase 2) partirá de aquí. */
export const DEFAULT_GOALS = {
  timesPerWeekByGroup: Object.fromEntries(MUSCLE_GROUPS.map((g) => [g.id, 2])),
  strengthSessionsPerWeek: 3,
  mobilitySessionsPerWeek: 2,
}
