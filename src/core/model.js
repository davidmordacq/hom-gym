// Modelo de datos de la app: nombres fijos que usa todo el código.
// Aquí solo hay definiciones; la lógica está en los otros archivos de /core.

/** Versión del formato de datos. Se sube si algún día cambia la estructura de las copias de seguridad. */
export const DATA_SCHEMA_VERSION = 1

/**
 * Tipo de resistencia de un ejercicio. Decide en qué dirección se hace más difícil:
 *  - assisted: con asistencia (dominadas con banda). Banda más suave = más difícil.
 *  - resisted: con resistencia (remo con banda, sentadilla con lastre). Más dura/pesada = más difícil.
 */
export const RESISTANCE_TYPES = Object.freeze({
  ASSISTED: 'assisted',
  RESISTED: 'resisted',
})

/**
 * En qué se mide un ejercicio. Solo cambia las palabras que ve David (y el rango objetivo del ejercicio):
 * la lógica de progresión es la misma, porque trabaja con números.
 *  - reps: repeticiones (lo normal)
 *  - seconds: segundos que se aguanta (plancha). El rango objetivo va en `rules.repRange` del ejercicio.
 */
export const EXERCISE_UNITS = Object.freeze({
  REPS: 'reps',
  SECONDS: 'seconds',
})

/** Tipos de sesión que caben en un día. Un día puede tener varias. */
export const SESSION_TYPES = Object.freeze({
  STRENGTH: 'strength',
  MOBILITY: 'mobility',
  BIKE_TRAINER: 'bike_trainer', // rodillo
  BIKE_OUTDOOR: 'bike_outdoor',
})

/** Estado de una sesión planificada. */
export const SESSION_STATUS = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress', // sesión empezada y sin terminar
  DONE: 'done',
  MOVED: 'moved', // se hizo otro día distinto al previsto
  SKIPPED: 'skipped',
})

/**
 * Acciones que puede recomendar el motor de progresión.
 *  start         -> aún no hay historial de este ejercicio
 *  add_reps      -> sigue igual, el objetivo es llegar al tope de repeticiones
 *  increase_load -> sube al siguiente nivel de dificultad
 *  max_level     -> ya estás en el nivel más difícil disponible
 *  keep          -> mantén (llevas varias sesiones sin mejorar)
 *  rest          -> descansa / descarga (las repeticiones bajan)
 *  decrease_load -> baja un nivel (no llegas al rango mínimo y no mejoras)
 *  unknown_level -> la resistencia registrada ya no existe en tu lista
 */
export const PROGRESSION_ACTIONS = Object.freeze({
  START: 'start',
  ADD_REPS: 'add_reps',
  INCREASE_LOAD: 'increase_load',
  MAX_LEVEL: 'max_level',
  KEEP: 'keep',
  REST: 'rest',
  DECREASE_LOAD: 'decrease_load',
  UNKNOWN_LEVEL: 'unknown_level',
})

/**
 * @typedef {Object} ResistanceLevel
 * @property {string} id
 * @property {string} label
 *
 * @typedef {Object} ResistanceScale
 * Lista de niveles ORDENADA de menos a más resistencia (de banda más suave a más dura, de menos kg a más kg).
 * @property {string} id
 * @property {string} name
 * @property {ResistanceLevel[]} levels
 *
 * @typedef {Object} Exercise
 * @property {string} id
 * @property {string} name
 * @property {string[]} muscleGroups
 * @property {'assisted'|'resisted'} resistanceType
 * @property {string|null} scaleId   escala de resistencia que usa (null = sin niveles)
 * @property {'reps'|'seconds'} [unit]  en qué se mide (por defecto, repeticiones)
 * @property {string|null} videoUrl
 * @property {string} [videoChannel]  quién publica el vídeo (solo para mostrarlo)
 * @property {string} [notes]         consejos de técnica y material
 * @property {Partial<import('./progressionConfig.js').ProgressionRules>} [rules] ajustes propios de este ejercicio
 *
 * @typedef {Object} SetLog
 * @property {string} id         `${sessionId}:${exerciseId}:${order}` (marcar de nuevo la misma serie la sobrescribe)
 * @property {string} sessionId
 * @property {string} exerciseId
 * @property {string} date       fecha ISO (AAAA-MM-DD)
 * @property {number} order      número de serie dentro de la sesión (1, 2, 3...)
 * @property {number} reps       repeticiones (o segundos, si el ejercicio se mide en segundos)
 * @property {string|null} levelId  nivel de la escala usado (o 'none' = sin banda en ejercicios asistidos)
 * @property {string} completedAt   momento exacto en que se marcó (ISO); sirve para el análisis de tiempos
 * @property {boolean} [coreAfter]  si en el descanso posterior a esta serie se hizo el core previsto
 * @property {number} [effort]   esfuerzo percibido 1-10 (opcional)
 * @property {string} [notes]
 *
 * @typedef {Object} SessionLog
 * Una sesión realizada (o en curso). Las de fuerza llevan `exercises` (copia de la sesión tipo al empezar, para que
 * cambiarla después no altere el historial) y las marcas de tiempo reales; las de bici y movilidad, los datos sencillos.
 * @property {string} id
 * @property {'strength'|'mobility'|'bike_trainer'|'bike_outdoor'} type
 * @property {'in_progress'|'done'|'skipped'|'moved'} status
 * @property {string} date          día en que empezó (AAAA-MM-DD)
 * @property {string} name
 * @property {string|null} slotId   hueco del plan del que viene (null si David la empezó por su cuenta)
 * @property {string|null} templateId
 * @property {string|null} startedAt  ISO
 * @property {string|null} endedAt    ISO
 * @property {number|null} [durationMin]  solo bici y movilidad
 * @property {number|null} [tss]          solo bici
 * @property {string} [source]            'intervals' si se importó de Intervals.icu (si no, la anotó David)
 * @property {string} [externalId]        identificador de la actividad en Intervals.icu
 * @property {number|null} [effort]       1-10
 * @property {string} notes
 *
 * @typedef {Object} PlanSlot
 * Una sesión prevista en la semana.
 * @property {string} id
 * @property {number} weekday    1 = lunes ... 7 = domingo
 * @property {'strength'|'mobility'|'bike_trainer'|'bike_outdoor'} type
 * @property {string} name
 * @property {boolean} flexible  si se puede mover de día
 * @property {string[]} [exerciseIds]
 *
 * @typedef {Object} BikeSession
 * @property {boolean} done
 * @property {number} [durationMin]
 * @property {number} [tss]
 * @property {number} [effort]
 * @property {string} [notes]
 */
