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
- **Objetivo de David:** fuerza orientada a salud y longevidad y, si acaso, a su ciclismo. **No busca hipertrofia.** Entrena fuerza 2-3 veces por semana.
- El 8-10 y las 3-4 series son **valores por defecto razonables, no un límite científico** (revisado el 2026-11-08): la evidencia dice que muchos modelos funcionan; cargas más pesadas dan algo más de fuerza máxima; para ciclistas hay estudios contradictorios. Mantener todo configurable por ejercicio. David decidió (2026-11-08) **no** usar el esfuerzo percibido como condición para subir de nivel: las reglas se quedan como están. Sigue abierta la idea de rangos más bajos (por ejemplo 5-8) en ejercicios de piernas con lastre; no se hace sin que él lo pida.

## Fases
- **Fase 0 (hecha):** proyecto, git, este archivo, modelo de datos, motor de progresión y pruebas. Sin pantallas.
- **Fase 1:** plan semanal editable, sesión en curso, historial simple, lista de ejercicios con vídeo, modo oscuro, exportar/importar. Se construye en 5 entregas, cada una con commit y probada por David antes de seguir:
  - **1a Base:** menú inferior (Hoy, Semana, Historial, Ejercicios, Ajustes), modo oscuro, datos locales (IndexedDB), exportar/importar, PWA instalable y publicación en GitHub Pages **desde esta entrega** para probar en el móvil.
  - **1a (hecha y probada en el móvil):** publicada en https://davidmordacq.github.io/hom-gym/ (repositorio público `davidmordacq/hom-gym`).
  - **1b Ejercicios (hecha, pendiente de probar en el móvil):** lista editable con grupo muscular, tipo, escala y vídeo de YouTube incrustado; biblioteca inicial de 30 ejercicios (`src/core/exerciseLibrary.js`) con enlaces comprobados (existen y se pueden incrustar; solo se revisó título y canal). Material de David: bandas azul/verde, barra de dominadas, esterilla, tobilleras de 2 kg, saco de 10 kg y mochila de ~10 kg; **sin banco ni mancuernas**. Sin molestias ni lesiones que evitar. La movilidad no está en esta biblioteca (se decidirá en 1c). Nada basado en tiempo (plancha, isométricos), porque las series solo registran repeticiones.
  - **1c Plan semanal:** sesiones por día, añadir/quitar/mover, plantillas de fuerza.
  - **1d Sesión en curso:** registrar series con pocos toques; bici simple.
  - **1e Hoy e historial:** qué toca hoy, historial, ajustes de las reglas de progresión.
- Decisiones de la Fase 1 (2026-11-08): la sesión muestra **lo hecho la última vez + la sugerencia del motor**; vídeos **en español si existe, si no en inglés**; tres sesiones de fuerza **distintas A/B/C**, de modo que entre las tres cada grupo muscular salga al menos 2 veces por semana.
- **Fase 2:** gráficas, sugerencias de progresión en pantalla, propuesta de plan, racha y calendario de cumplimiento.
- **Fase 3:** recordatorios. En Android una web instalada no avisa de forma fiable con la app cerrada: habrá que elegir entre un pequeño servidor de avisos o eventos de calendario.
- **Fase 4:** entrenador con IA (clave de API, con coste por uso).

## Estructura
- `src/core/` — lógica pura, sin pantallas, con pruebas (`*.test.js`):
  - `model.js` nombres y tipos de datos · `progressionConfig.js` reglas ajustables · `resistance.js` niveles y dirección de dificultad
  - `progression.js` motor de recomendaciones · `backup.js` exportar/importar · `defaultData.js` datos de partida
  - `exerciseLibrary.js` biblioteca inicial de ejercicios · `exercises.js` validar/agrupar/buscar ejercicios y ordenar niveles · `youtube.js` enlaces de YouTube
- `src/storage/` — guardado local: `db.js` (IndexedDB genérico, exportar/importar atómico) y `seed.js` (datos de la primera vez; `seedLibraryIfNeeded` carga la biblioteca una sola vez y nunca pisa cambios). Con pruebas usando `fake-indexeddb`.
- `src/App.jsx`, `src/screens/`, `src/ui/`, `src/theme.js`, `src/styles.css` — pantallas (menú inferior, tema oscuro/claro/auto). Móvil primero, botones grandes.
- `vite.config.js` — configura la PWA (`vite-plugin-pwa`, actualización automática, funciona sin conexión). `base: './'` para publicar en una subcarpeta.
- `.github/workflows/deploy.yml` — publica en GitHub Pages al subir a `main`, tras pasar las pruebas.
- `public/icons/` — iconos de la app (generados con un script puntual; el diseño es una "H" verde sobre fondo oscuro).
- `.claude/launch.json` — servidor de desarrollo (`hom-gym-dev`). El panel de vista previa de Claude puede seguir leyendo la configuración de la carpeta anterior; si abre otra app, lanzar `vite preview` desde el panel de Terminal.

## Comandos
- `npm run dev` — abrir la app en local · `npm test` — ejecutar las pruebas · `npm run build` — generar la versión publicable.
- En Windows, si `npm` no se reconoce, usar la ruta completa `C:\Program Files\nodejs\npm.cmd`.

## Cómo volver atrás si algo falla (git)
- Ver el historial: `git log --oneline`
- Descartar los cambios sin guardar de un archivo: `git restore ruta/del/archivo`
- Volver temporalmente a una versión antigua para mirarla: `git switch --detach <código>` y, para regresar, `git switch main`
- Deshacer un commit sin perder el historial: `git revert <código>`
