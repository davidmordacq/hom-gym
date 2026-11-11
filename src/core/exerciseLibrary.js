// Biblioteca inicial de ejercicios. Es solo el punto de partida: en la app se puede editar, añadir y borrar todo.
//
// Pensada para el material de David: bandas (azul y verde), peso corporal, barra de dominadas, esterilla,
// tobilleras de 2 kg, saco de arena de 10 kg y mochila de lastre de ~10 kg. Sin banco ni mancuernas.
//
// Los vídeos son de personas reales y se comprobó (2026-11-08) que existen y se pueden incrustar.
// Se prefiere español; solo se comprobó el título y el canal, no se vio cada vídeo entero.

import { EXERCISE_UNITS, RESISTANCE_TYPES } from './model.js'

const A = RESISTANCE_TYPES.ASSISTED
const R = RESISTANCE_TYPES.RESISTED
const SECONDS = EXERCISE_UNITS.SECONDS
const watch = (id) => `https://www.youtube.com/watch?v=${id}`

/**
 * Los 30 ejercicios de la primera versión de la biblioteca (entrega 1b). Sirve para saber cuáles ya se
 * ofrecieron en un móvil que se instaló antes de que existiera el registro de ejercicios ofrecidos.
 * No se cambia nunca: los ejercicios que se añadan después simplemente no van en esta lista.
 */
export const ORIGINAL_LIBRARY_IDS = Object.freeze([
  'goblet-squat', 'romanian-deadlift', 'reverse-lunge', 'glute-bridge', 'single-leg-bridge', 'calf-raise',
  'banded-good-morning', 'banded-side-walk', 'hamstring-slider-curl', 'side-lying-hip-abduction',
  'quadruped-glute-kick', 'assisted-pull-up', 'banded-row', 'bent-over-row', 'face-pull', 'superman',
  'banded-biceps-curl', 'push-up', 'banded-chest-press', 'banded-shoulder-press', 'banded-lateral-raise',
  'pike-push-up', 'banded-triceps-extension', 'leg-raise', 'dead-bug', 'bird-dog', 'banded-wood-chop',
  'pallof-press', 'crunch', 'reverse-crunch',
])

/** @type {import('./model.js').Exercise[]} */
export const DEFAULT_EXERCISES = [
  // ---- Piernas y glúteos ----
  {
    id: 'goblet-squat',
    name: 'Sentadilla con lastre (goblet)',
    muscleGroups: ['quads', 'glutes'],
    resistanceType: R,
    scaleId: 'kg',
    videoUrl: watch('XANUniwN1Jg'),
    videoChannel: 'Diana Ayala',
    notes:
      'Sujeta el saco contra el pecho (o ponte la mochila) y baja con la espalda recta hasta que los muslos queden paralelos al suelo. Para 20 kg: mochila puesta y saco en las manos.',
  },
  {
    id: 'bodyweight-squat',
    name: 'Sentadilla normal (peso corporal)',
    muscleGroups: ['quads', 'glutes'],
    resistanceType: R,
    scaleId: null,
    rules: { repRange: { min: 50, max: 50 } },
    videoUrl: watch('yluv--sqkNo'),
    videoChannel: 'Trainer Alex León',
    notes:
      'Una serie de 50 repeticiones seguidas, sin peso (es el primer ejercicio del tren inferior). Pies a la anchura de los hombros, baja con la espalda recta hasta que los muslos queden paralelos al suelo y sube empujando con los talones. Si hace falta, para unos segundos a mitad de la serie y sigue.',
  },
  {
    id: 'romanian-deadlift',
    name: 'Peso muerto rumano con lastre',
    muscleGroups: ['hamstrings', 'glutes', 'back'],
    resistanceType: R,
    scaleId: 'kg',
    videoUrl: watch('HwMngJ1DWO8'),
    videoChannel: 'ENFAF',
    notes:
      'Rodillas ligeramente flexionadas, lleva la cadera hacia atrás y baja el saco (o la mochila) pegado a las piernas. Sube apretando los glúteos. Espalda siempre recta.',
  },
  {
    id: 'reverse-lunge',
    name: 'Zancada hacia atrás con lastre',
    muscleGroups: ['quads', 'glutes'],
    resistanceType: R,
    scaleId: 'kg',
    videoUrl: watch('iQcb_o9kNiE'),
    videoChannel: 'Pierdeloss90 Adelgaza desde casa',
    notes:
      'Da un paso atrás y baja hasta que la rodilla de atrás casi roce el suelo. Haz las repeticiones con una pierna y luego con la otra: una serie son las repeticiones de cada pierna.',
  },
  {
    id: 'glute-bridge',
    name: 'Puente de glúteos',
    muscleGroups: ['glutes', 'hamstrings'],
    resistanceType: R,
    scaleId: 'kg',
    videoUrl: watch('oDXM-a-gBt8'),
    videoChannel: 'Móveo Fisioterapia y Pilates',
    notes: 'Tumbado boca arriba con las rodillas dobladas, sube la cadera apretando glúteos. Con lastre, apoya el saco o la mochila sobre la cadera.',
  },
  {
    id: 'single-leg-bridge',
    name: 'Puente de glúteos a una pierna',
    muscleGroups: ['glutes', 'hamstrings'],
    resistanceType: R,
    scaleId: 'kg',
    videoUrl: watch('pBM5Mwk6KL0'),
    videoChannel: 'SEReumatologia',
    notes: 'Una pierna apoyada y la otra estirada en el aire. Sube la cadera sin que se ladee. Una serie son las repeticiones de cada pierna.',
  },
  {
    id: 'calf-raise',
    name: 'Elevación de talones a una pierna',
    muscleGroups: ['calves'],
    resistanceType: R,
    scaleId: 'kg',
    videoUrl: watch('1gUi-82B2Xc'),
    videoChannel: 'ENTRENAMIENTO.PRO',
    notes: 'Apóyate con una mano en la pared. Sube de puntillas despacio y baja en 2-3 segundos. Con lastre, sujeta el saco o lleva la mochila. Una serie son las repeticiones de cada pierna.',
  },
  {
    id: 'banded-good-morning',
    name: 'Buenos días con banda',
    muscleGroups: ['hamstrings', 'glutes', 'back'],
    resistanceType: R,
    scaleId: 'bands',
    videoUrl: watch('CTRaCzE8pWU'),
    videoChannel: 'Jenny LaBaw',
    notes: 'Pisa la banda y pásala sobre los hombros. Lleva la cadera hacia atrás con la espalda recta y sube apretando los glúteos.',
  },
  {
    id: 'banded-side-walk',
    name: 'Pasos laterales con banda',
    muscleGroups: ['glutes'],
    resistanceType: R,
    scaleId: 'bands',
    videoUrl: watch('oAd4R-MM7Is'),
    videoChannel: 'Centro 3D10 Fisioterapia',
    notes: 'Banda alrededor de los muslos o los tobillos, rodillas ligeramente flexionadas. Da pasos laterales sin juntar los pies. Una serie son los pasos hacia cada lado.',
  },
  {
    id: 'hamstring-slider-curl',
    name: 'Curl femoral deslizante (con toalla)',
    muscleGroups: ['hamstrings', 'glutes'],
    resistanceType: R,
    scaleId: null,
    videoUrl: watch('QWw-iY-ef6c'),
    videoChannel: 'DrVíctorLópez',
    notes: 'Tumbado boca arriba con los talones sobre una toalla en suelo liso. Sube la cadera y desliza los talones alejándolos y acercándolos.',
  },
  {
    id: 'side-lying-hip-abduction',
    name: 'Abducción de cadera tumbado (con tobillera)',
    muscleGroups: ['glutes'],
    resistanceType: R,
    scaleId: 'ankle-weights',
    videoUrl: watch('dILxTvY88uI'),
    videoChannel: 'Javier Giménez - Healthy Fitness',
    notes: 'Tumbado de lado, sube la pierna de arriba sin girar la cadera. Con tobilleras sube la dificultad. Una serie son las repeticiones de cada lado.',
  },
  {
    id: 'quadruped-glute-kick',
    name: 'Patada de glúteo a cuatro apoyos (con tobillera)',
    muscleGroups: ['glutes', 'hamstrings'],
    resistanceType: R,
    scaleId: 'ankle-weights',
    videoUrl: watch('jX4ojYiFYAg'),
    videoChannel: 'Fit Kamp',
    notes: 'A cuatro apoyos, lleva una pierna hacia atrás y arriba sin arquear la espalda. Una serie son las repeticiones de cada pierna.',
  },

  {
    id: 'single-leg-rdl',
    name: 'Peso muerto rumano a una pierna',
    muscleGroups: ['hamstrings', 'glutes'],
    resistanceType: R,
    scaleId: 'kg',
    videoUrl: watch('EERrhuuOtnE'),
    videoChannel: 'DrVíctorLópez',
    notes:
      'El vídeo usa una mancuerna: tú usa el saco de arena o la mochila. Apoyado en una pierna, inclina el tronco llevando la otra pierna hacia atrás, con la espalda recta. Una serie son las repeticiones de cada pierna.',
  },
  {
    id: 'bulgarian-split-squat',
    name: 'Sentadilla búlgara',
    muscleGroups: ['quads', 'glutes'],
    resistanceType: R,
    scaleId: 'kg',
    videoUrl: watch('giVdHLHtsIw'),
    videoChannel: 'Squat University Español',
    notes:
      'Pie de atrás apoyado en algo estable y alto (silla firme, sofá o escalón) y pie de delante lo bastante adelantado. Baja con el tronco recto. Con lastre, el saco contra el pecho o la mochila. Una serie son las repeticiones de cada pierna.',
  },

  // ---- Espalda y bíceps ----
  {
    id: 'assisted-pull-up',
    name: 'Dominadas con banda',
    muscleGroups: ['back', 'biceps'],
    resistanceType: A,
    scaleId: 'bands',
    videoUrl: watch('HNVzNWBGDrU'),
    videoChannel: 'Lakbarz Calistenia',
    notes:
      'Pasa la banda por la barra y apoya la rodilla o el pie en ella. Banda más suave = más difícil; después de la más suave, dominada sin banda.',
  },
  {
    id: 'assisted-chin-up',
    name: 'Dominadas supinas con banda (palmas hacia ti)',
    muscleGroups: ['back', 'biceps'],
    resistanceType: A,
    scaleId: 'bands',
    videoUrl: watch('RNvjNCC0j4g'),
    videoChannel: 'CLARA FLORINDO | ASESORÍAS ONLINE',
    notes:
      'Agarre con las palmas hacia ti y las manos a la anchura de los hombros. Suele trabajar algo más el bíceps que el agarre con las palmas hacia delante. Banda más suave = más difícil; después de la más suave, sin banda.',
  },
  {
    id: 'banded-row',
    name: 'Remo con banda sentado',
    muscleGroups: ['back', 'biceps'],
    resistanceType: R,
    scaleId: 'bands',
    videoUrl: watch('KmpDowjBY2A'),
    videoChannel: 'Proet Ejercicio Terapéutico',
    notes: 'Sentado en el suelo con la banda en los pies. Tira de los codos hacia atrás juntando los omóplatos.',
  },
  {
    id: 'bent-over-row',
    name: 'Remo inclinado con lastre',
    muscleGroups: ['back', 'biceps'],
    resistanceType: R,
    scaleId: 'kg',
    videoUrl: watch('radVWm-e81I'),
    videoChannel: 'DrVíctorLópez',
    notes: 'El vídeo usa mancuernas: tú usa el saco de arena (con las dos manos) o la mochila. Torso inclinado y espalda recta, y sube hacia el abdomen.',
  },
  {
    id: 'face-pull',
    name: 'Face pull con banda',
    muscleGroups: ['shoulders', 'back'],
    resistanceType: R,
    scaleId: 'bands',
    videoUrl: watch('w06tVYSLH20'),
    videoChannel: 'Paco The Fisio',
    notes: 'Banda sujeta a la altura de la cara. Tira hacia la cara separando las manos y abriendo los codos.',
  },
  {
    id: 'superman',
    name: 'Superman (extensión lumbar)',
    muscleGroups: ['back'],
    resistanceType: R,
    scaleId: null,
    videoUrl: watch('jTNpZIl1qU0'),
    videoChannel: 'MoveU',
    notes: 'Tumbado boca abajo, eleva brazos y piernas a la vez, aguanta un segundo y baja con control.',
  },
  {
    id: 'banded-biceps-curl',
    name: 'Curl de bíceps con banda',
    muscleGroups: ['biceps'],
    resistanceType: R,
    scaleId: 'bands',
    videoUrl: watch('2PbsGMc9iKc'),
    videoChannel: 'Proet Ejercicio Terapéutico',
    notes: 'Pisa la banda y sube las manos hacia los hombros con los codos pegados al cuerpo.',
  },

  // ---- Pecho, hombros y tríceps ----
  {
    id: 'push-up',
    name: 'Flexiones',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    resistanceType: R,
    scaleId: 'kg',
    videoUrl: watch('b2UagYWNErY'),
    videoChannel: 'Blue Man',
    notes: 'Cuerpo en línea recta de la cabeza a los talones. Con la mochila puesta sube la dificultad.',
  },
  {
    id: 'close-push-up',
    name: 'Flexiones con manos juntas (diamante)',
    muscleGroups: ['triceps', 'chest', 'shoulders'],
    resistanceType: R,
    scaleId: 'kg',
    videoUrl: watch('NO3fnbQr5nk'),
    videoChannel: 'EresFitness',
    notes:
      'Manos juntas bajo el pecho. En los estudios con electrodos activan pecho y tríceps algo más que las manos abiertas. Si es demasiado duro, apoya las rodillas.',
  },
  {
    id: 'banded-chest-press',
    name: 'Press de pecho con banda',
    muscleGroups: ['chest', 'triceps'],
    resistanceType: R,
    scaleId: 'bands',
    videoUrl: watch('PTrOW--0y2k'),
    videoChannel: 'Javier Giménez - Healthy Fitness',
    notes: 'Banda por la espalda, empuja hacia delante con los brazos estirándolos sin bloquear los codos.',
  },
  {
    id: 'banded-shoulder-press',
    name: 'Press de hombros con banda',
    muscleGroups: ['shoulders', 'triceps'],
    resistanceType: R,
    scaleId: 'bands',
    videoUrl: watch('rvySjIqSQyk'),
    videoChannel: 'Deportika Online',
    notes: 'Pisa la banda y empuja hacia arriba desde los hombros, sin arquear la espalda.',
  },
  {
    id: 'banded-lateral-raise',
    name: 'Elevaciones laterales con banda',
    muscleGroups: ['shoulders'],
    resistanceType: R,
    scaleId: 'bands',
    videoUrl: watch('yfNg5sFndbw'),
    videoChannel: "Men's Health",
    notes: 'Pisa la banda y sube los brazos hacia los lados hasta la altura de los hombros, con control.',
  },
  {
    id: 'banded-front-raise',
    name: 'Elevaciones frontales con banda',
    muscleGroups: ['shoulders'],
    resistanceType: R,
    scaleId: 'bands',
    videoUrl: watch('733F5Ld-GYM'),
    videoChannel: 'Narekfitness',
    notes: 'Pisa la banda y sube los brazos estirados hacia delante hasta la altura de los hombros, sin balancear el cuerpo.',
  },
  {
    id: 'pike-push-up',
    name: 'Flexiones en pica',
    muscleGroups: ['shoulders', 'triceps'],
    resistanceType: R,
    scaleId: 'kg',
    videoUrl: watch('4IQAbNVgPG8'),
    videoChannel: 'Kranos Calistenia',
    notes: 'Cadera alta, cuerpo en forma de "V" invertida, y baja la cabeza hacia el suelo entre las manos.',
  },
  {
    id: 'banded-triceps-extension',
    name: 'Extensión de tríceps con banda',
    muscleGroups: ['triceps'],
    resistanceType: R,
    scaleId: 'bands',
    videoUrl: watch('v3uVtjVASzs'),
    videoChannel: 'Luis Carballo',
    notes: 'Codos fijos y pegados a la cabeza; estira los brazos y vuelve despacio.',
  },

  // ---- Core ----
  {
    id: 'leg-raise',
    name: 'Elevación de piernas tumbado',
    muscleGroups: ['core'],
    resistanceType: R,
    scaleId: 'ankle-weights',
    videoUrl: watch('oxJj5FoBycQ'),
    videoChannel: 'P4P Español',
    notes: 'Lumbar pegada al suelo todo el rato. Con las tobilleras de 2 kg sube la dificultad.',
  },
  {
    id: 'plank',
    name: 'Plancha',
    muscleGroups: ['core'],
    resistanceType: R,
    scaleId: 'kg',
    unit: SECONDS,
    rules: { repRange: { min: 30, max: 45 } },
    videoUrl: watch('zfY5XXa26ug'),
    videoChannel: 'Marcos Sacristán | Fisioterapia a tu alcance',
    notes:
      'Se mide en segundos. Antebrazos y puntas de los pies apoyados, cuerpo en línea recta sin dejar caer la cadera. Con la mochila puesta sube la dificultad.',
  },
  {
    id: 'side-plank',
    name: 'Plancha lateral',
    muscleGroups: ['core'],
    resistanceType: R,
    scaleId: null,
    unit: SECONDS,
    rules: { repRange: { min: 30, max: 45 } },
    videoUrl: watch('45t3tTcRcKE'),
    videoChannel: 'APTA Vital Sport',
    notes: 'Se mide en segundos. Apoyado en un antebrazo y el lateral del pie, cuerpo recto. Una serie son los segundos de cada lado.',
  },
  {
    id: 'dead-bug',
    name: 'Bicho muerto (dead bug)',
    muscleGroups: ['core'],
    resistanceType: R,
    scaleId: null,
    videoUrl: watch('2_2RPDMA_aw'),
    videoChannel: 'Clínicas Diego de León',
    notes: 'Tumbado boca arriba, baja brazo y pierna contrarios sin que se despegue la zona lumbar. Una serie son las repeticiones totales.',
  },
  {
    id: 'bird-dog',
    name: 'Perro pájaro (bird dog)',
    muscleGroups: ['core', 'back'],
    resistanceType: R,
    scaleId: null,
    videoUrl: watch('QABW99qPiNM'),
    videoChannel: 'Muscle & Motion',
    notes: 'A cuatro apoyos, estira brazo y pierna contrarios y aguanta un segundo sin girar la cadera.',
  },
  {
    id: 'banded-wood-chop',
    name: 'Leñador con banda',
    muscleGroups: ['core'],
    resistanceType: R,
    scaleId: 'bands',
    videoUrl: watch('cMBIh-L-Fqg'),
    videoChannel: 'BuhoSalud',
    notes: 'Tira de la banda en diagonal desde arriba hacia abajo girando el tronco. Una serie son las repeticiones de cada lado.',
  },
  {
    id: 'pallof-press',
    name: 'Press Pallof con banda',
    muscleGroups: ['core'],
    resistanceType: R,
    scaleId: 'bands',
    videoUrl: watch('qrjDv2wGL4I'),
    videoChannel: 'Vitar Club',
    notes: 'Banda sujeta a un lado. Empuja las manos al frente sin dejar que la banda te gire. Una serie son las repeticiones de cada lado.',
  },
  {
    id: 'crunch',
    name: 'Abdominal (crunch)',
    muscleGroups: ['core'],
    resistanceType: R,
    scaleId: null,
    videoUrl: watch('oRIi-jKzCro'),
    videoChannel: 'Saber Entrenar',
    notes: 'Sube solo los hombros del suelo, sin tirar del cuello con las manos.',
  },
  {
    id: 'reverse-crunch',
    name: 'Crunch inverso',
    muscleGroups: ['core'],
    resistanceType: R,
    scaleId: null,
    videoUrl: watch('S_Dfyqi68aw'),
    videoChannel: 'DrVíctorLópez',
    notes: 'Tumbado, sube las rodillas hacia el pecho levantando un poco la pelvis. Sin balanceo.',
  },
  // ---- Core y lumbares para los descansos (añadidos después de la 1b) ----
  {
    id: 'russian-twist',
    name: 'Russian twists (giros rusos)',
    muscleGroups: ['core'],
    resistanceType: R,
    scaleId: 'kg',
    videoUrl: watch('hdSyLWfRJHc'),
    videoChannel: 'Deportika Online',
    notes: 'Sentado con el torso inclinado hacia atrás y la espalda recta, gira el tronco de un lado a otro. Más difícil con los pies en el aire o sujetando el saco.',
  },
  {
    id: 'leg-circles',
    name: 'Around the world (círculos con las piernas)',
    muscleGroups: ['core'],
    resistanceType: R,
    scaleId: null,
    videoUrl: watch('z2hhOgGjwd4'),
    videoChannel: 'Lo de Noel UY by Noel Antoine',
    notes: 'Tumbado boca arriba con la zona lumbar pegada al suelo, levanta las piernas estiradas y dibuja círculos con ellas, juntas. Más fácil con círculos pequeños.',
  },
  {
    id: 'swimmer',
    name: 'Nadador (swimmer)',
    muscleGroups: ['back', 'glutes'],
    resistanceType: R,
    scaleId: null,
    videoUrl: watch('XwugiIe09rQ'),
    videoChannel: 'Ampelusinha',
    notes: 'Tumbado boca abajo, eleva brazos y piernas y alterna brazo derecho con pierna izquierda y al revés, con movimientos cortos y controlados. Trabaja lumbares y glúteos.',
  },
  {
    id: 'prone-trunk-raise',
    name: 'Elevación de tronco boca abajo (lumbares)',
    muscleGroups: ['back'],
    resistanceType: R,
    scaleId: null,
    videoUrl: watch('35srtXJE1Cg'),
    videoChannel: 'JMF-PersonalTrainer',
    notes: 'Tumbado boca abajo con las manos junto a la cabeza, sube el pecho con suavidad sin forzar el cuello, aguanta un segundo y baja con control.',
  },
]

/**
 * Ejercicios de core y lumbares entre los que la app elige al azar el que toca hacer en cada descanso (David puede
 * cambiar el conjunto en Ajustes). Incluye las dos planchas, con una restricción: nunca salen en el descanso de un
 * ejercicio de espalda (dominadas), ver `CORE_REST_NOT_AFTER`.
 */
export const CORE_REST_POOL_IDS = Object.freeze([
  'dead-bug', 'bird-dog', 'reverse-crunch', 'leg-raise', 'crunch', 'russian-twist', 'leg-circles', 'superman', 'swimmer',
  'prone-trunk-raise', 'plank', 'side-plank',
])

/**
 * Ejercicios de core que NO deben tocar en el descanso de un ejercicio según su músculo principal (decisión de David,
 * 2026-11-09): las planchas, sobre todo la lateral, trabajan algo los dorsales y los hombros y podrían restar fuerza
 * en la siguiente serie de dominadas. Ampliado (David, 2026-11-11) a los ejercicios de tren superior que cargan los
 * hombros: flexiones (pecho; las de manos juntas cuentan como tríceps) y elevaciones de hombro. En la práctica, las
 * planchas solo salen en los descansos de la sesión de tren inferior.
 */
const UPPER_BODY_GROUPS = Object.freeze(['back', 'chest', 'triceps', 'shoulders'])
export const CORE_REST_NOT_AFTER = Object.freeze({
  plank: UPPER_BODY_GROUPS,
  'side-plank': UPPER_BODY_GROUPS,
})
