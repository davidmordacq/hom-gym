# Hom Gym — app personal de entrenamiento

Aplicación web instalable (PWA) de **un solo usuario** (David) para planificar entrenos, registrar series y ver progreso.
Especificación original: `Especificacion_App_Entrenamiento.md` (en esta carpeta).

## Cómo trabajar con David
- No tiene experiencia programando: explica las decisiones en lenguaje sencillo, en español.
- Trabajar por **fases pequeñas**; él prueba cada una antes de seguir.
- **Antes de escribir código nuevo importante, plan y preguntas.**
- Usar git; commits pequeños y con mensajes claros. Nunca reescribir historia sin que lo pida.
- Las reglas de progresión son lo más importante: **todo cambio en ellas lleva pruebas**.

## Decisiones tomadas
- **Proyecto nuevo, independiente de ASCENSO** (`Home_GYM/ascenso-app`). No se reutilizan sus muñecos de palitos: la especificación los prohíbe.
- **Tecnología:** React + Vite, JavaScript (sin TypeScript), pruebas con Vitest. App web instalable en Android (Chrome).
- **Datos:** solo en el dispositivo (IndexedDB, a implementar en Fase 1) + exportar/importar copia en JSON (`src/core/backup.js`). Sin cuentas ni sincronización por ahora; el modelo queda preparado por si se añade más adelante.
- **Idioma:** interfaz en español. Unidades en kg. La semana empieza en lunes (1 = lunes ... 7 = domingo).
- **Un día puede tener varias sesiones** (fuerza, movilidad, bici rodillo, bici outdoor), cada una con estado: pendiente, hecha, movida u omitida. El plan es 100 % editable desde la app.
- **Plan de partida:** martes y jueves rodillo; sábado y domingo bici outdoor; lunes, miércoles y viernes fuerza; movilidad flexible (puede compartir día). Una fuerza pendiente puede sustituir a una bici del fin de semana.
- **Bici:** datos ligeros porque David ya gestiona su ciclismo en otro proyecto: cumplida sí/no, duración, TSS, notas y esfuerzo.
- **Material de fuerza:** bandas (verde = media, azul = más suave; se pueden añadir más), peso corporal, cintas de lastre de tobillo (para abdominales), saco de arena de 10 kg y mochila de lastre de ~10 kg (combinadas = 20 kg).
- **Vídeos:** de personas reales (nada de muñecos ni dibujos básicos). Primera opción: YouTube comprobado. Antes de integrar cualquier base de datos de ejercicios, revisar sus condiciones de uso.
- **Propuesta de plan y series/repeticiones:** con reglas fijas a partir de los objetivos de David (veces por semana por grupo muscular, nº de sesiones de fuerza y movilidad, objetivo por ejercicio). La IA queda para la Fase 4.

## Reglas de progresión (resumen; el detalle manda en `src/core/progressionConfig.js`)
- Rango objetivo **8-10 repeticiones**, 3 series por defecto. Todo se ajusta en **un solo archivo** (`progressionConfig.js`), y cada ejercicio puede tener sus propios valores.
- Si en **todas** las series se llega al tope (10) con un nivel → sugerir pasar al siguiente nivel de dificultad (`sessionsToConfirmTop` sesiones seguidas, 1 por defecto).
- **Dos tipos de ejercicio**, que cambian la dirección de la dificultad:
  - `assisted` (dominadas con banda): banda más suave = más difícil; después de la más suave, "sin banda".
  - `resisted` (remo con banda, sentadilla con lastre): banda más dura / más kg = más difícil.
- Tres sesiones seguidas sin mejorar → **mantener**. Tres sesiones seguidas bajando repeticiones → **descansar**, o **reducir** un nivel si además se está por debajo del rango.
- Subir de nivel gana siempre sobre las demás reglas. Solo cuentan las sesiones seguidas con el mismo nivel de resistencia.
- Decisión pendiente de revisar con David: para fuerza pura, 8-10 repeticiones es un rango más de hipertrofia; es válido con bandas y peso corporal, y es configurable.

## Fases
- **Fase 0 (hecha):** proyecto, git, este archivo, modelo de datos, motor de progresión y pruebas. Sin pantallas.
- **Fase 1:** plan semanal editable, sesión en curso, historial simple, lista de ejercicios con vídeo, modo oscuro, exportar/importar.
- **Fase 2:** gráficas, sugerencias de progresión en pantalla, propuesta de plan, racha y calendario de cumplimiento.
- **Fase 3:** recordatorios. En Android una web instalada no avisa de forma fiable con la app cerrada: habrá que elegir entre un pequeño servidor de avisos o eventos de calendario.
- **Fase 4:** entrenador con IA (clave de API, con coste por uso).

## Estructura
- `src/core/` — lógica pura, sin pantallas, con pruebas (`*.test.js`):
  - `model.js` nombres y tipos de datos · `progressionConfig.js` reglas ajustables · `resistance.js` niveles y dirección de dificultad
  - `progression.js` motor de recomendaciones · `backup.js` exportar/importar · `defaultData.js` datos de partida
- `src/main.jsx` — marcador de posición hasta la Fase 1.

## Comandos
- `npm run dev` — abrir la app en local · `npm test` — ejecutar las pruebas · `npm run build` — generar la versión publicable.
- En Windows, si `npm` no se reconoce, usar la ruta completa `C:\Program Files\nodejs\npm.cmd`.

## Cómo volver atrás si algo falla (git)
- Ver el historial: `git log --oneline`
- Descartar los cambios sin guardar de un archivo: `git restore ruta/del/archivo`
- Volver temporalmente a una versión antigua para mirarla: `git switch --detach <código>` y, para regresar, `git switch main`
- Deshacer un commit sin perder el historial: `git revert <código>`
