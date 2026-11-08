# Especificación inicial: app personal de registro y progresión de entrenamientos

## 1. Objetivo
Una aplicación de uso personal (un solo usuario) para planificar mis entrenamientos semana a semana, registrar cada serie que hago y ver mi progreso a lo largo del tiempo. Quiero que sea potente y con aspecto profesional, pensada para usarla desde el móvil mientras entreno.

## 2. Mi plan de entrenamiento (punto de partida)
- **Martes y jueves:** bici en rodillo.
- **Resto de días:** fuerza de cuerpo completo, de modo que cada grupo muscular se trabaje **al menos 2 veces por semana**.
- **Movilidad articular y estiramientos:** incluidos de forma regular en la semana.
- Material de fuerza: bandas elásticas de resistencia (verde = media, azul = más suave) y mi propio peso corporal. Puede haber más bandas: la app debe permitir definirlas.
- La planificación puede cambiar. La app debe dejarme editar el plan sin tocar código.

## 3. Qué se registra en cada serie
Ejemplo real: dominadas, 4 series con banda verde: 10, 8, 8 y 7 repeticiones.
- Ejercicio, fecha, orden de la serie.
- Repeticiones realizadas.
- Resistencia usada (banda elegida de mi lista, o peso si aplica).
- Esfuerzo percibido (opcional, 1-10) y notas.
- Para bici: duración, y datos básicos (opcional).

## 4. Reglas de progresión
- En fuerza, el objetivo es trabajar en el rango de **8-10 repeticiones**.
- Cuando consigo el tope del rango (10) en todas las series con una resistencia, la app me sugiere pasar al siguiente nivel de dificultad.
- **Importante:** hay dos tipos de ejercicio.
  - *Con asistencia* (ej. dominadas con banda): una banda más suave = más difícil.
  - *Con resistencia* (ej. remo con banda): una banda más dura = más difícil.
  El modelo de datos debe distinguir ambos casos para sugerir el cambio en la dirección correcta.
- Las reglas deben estar en un solo sitio y ser fáciles de ajustar (rango de repeticiones, número de series, cuántas sesiones seguidas).
- Si no progreso, o bajan mis repeticiones varias sesiones seguidas, la app me sugiere mantener, descansar o reducir.

## 5. Pantallas principales (primera versión)
1. **Hoy:** qué entrenamiento me toca y botón para empezarlo.
2. **Sesión en curso:** lista de ejercicios, introducir repeticiones y resistencia de cada serie con pocos toques.
3. **Semana:** vista del plan semanal y qué grupos musculares llevo trabajados.
4. **Historial y progreso:** gráficas por ejercicio.
5. **Ejercicios:** lista editable, con grupo muscular, tipo de resistencia y vídeo.

## 6. Vídeos y vista de cada ejercicio
- Cada ejercicio muestra un **vídeo de una persona real** haciendo el ejercicio.
- Primera opción: **incrustar vídeos de YouTube** elegidos por mí o sugeridos por Code (comprobando que el enlace funciona).
- No quiero muñecos de palitos ni dibujos básicos. Si Code propone imágenes o animaciones propias, deben tener calidad realista.
- Code debe investigar si existe alguna base de datos de ejercicios con vídeos o animaciones de calidad, y comprobar sus condiciones de uso antes de integrarla.

## 7. Diseño
- Aspecto moderno, limpio y profesional, con modo oscuro.
- Pensada primero para móvil (se usa durante el entreno), pero que funcione bien en ordenador.
- Botones grandes, introducción de datos rápida.

## 8. Fases de desarrollo
**Fase 1 (empezar aquí):** plan semanal, registrar entrenos y series, historial simple, lista de ejercicios con vídeo.
**Fase 2:** gráficas de progreso, sugerencias de progresión con reglas fijas, tracker de cumplimiento (racha, % de entrenos completados, calendario de cumplimiento) como motivación.
**Fase 3:** recordatorios en los días y horas de entreno, y avisos X minutos antes de empezar.
**Fase 4:** entrenador con IA, al que pueda preguntar si mi planteamiento es correcto (por ejemplo, si debo hacer más repeticiones o menos series) usando mi historial. Necesitará clave de API y tiene coste por uso.

Aunque se desarrollen por fases, **el diseño inicial debe dejar preparado el terreno** para las fases posteriores (datos, estructura y avisos), para no rehacer la app más adelante.

## 9. Requisitos técnicos
- Uso personal, un solo usuario. No hace falta registro de usuarios al principio.
- Mis datos deben guardarse de forma permanente y poder exportarse (copia de seguridad).
- Elegir una tecnología sencilla de mantener. Explícame las opciones y recomienda una, con sus pros y contras.
- Que se pueda abrir desde el móvil y ordenador (por ejemplo, como aplicación web instalable).

## 10. Cómo quiero que trabajes
- No tengo experiencia programando: explícame las decisiones en lenguaje sencillo.
- **Antes de escribir código, haz un plan y hazme las preguntas que necesites.**
- Trabaja por fases pequeñas y deja que pruebe cada una antes de seguir.
- Usa control de versiones (git) y explica cómo volver atrás si algo falla.
- Crea un archivo `CLAUDE.md` con las decisiones del proyecto y las reglas de esta especificación.
- Añade pruebas para las reglas de progresión, que son lo más importante.
