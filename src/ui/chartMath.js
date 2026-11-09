// Cuentas de las gráficas: escalas "redondas" y qué etiquetas mostrar. Sin pantallas, con pruebas.

/**
 * Escala del eje vertical: un máximo y un paso redondos (1, 2, 2,5, 5 por una potencia de 10) con unas `ticks` marcas.
 * Siempre incluye el valor máximo de los datos. Con datos todo 0, devuelve una escala de 0 a 1.
 */
export function niceScale(maxValue, ticks = 4) {
  if (!(maxValue > 0)) return { max: 1, step: 0.25, values: [0, 0.25, 0.5, 0.75, 1] }
  const rough = maxValue / ticks
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power
  const max = Math.ceil(maxValue / step - 1e-9) * step
  const values = []
  for (let v = 0; v <= max + step / 2; v += step) values.push(Math.round(v * 1e6) / 1e6)
  return { max, step, values }
}

/** Índices de las etiquetas del eje horizontal que se muestran (como mucho `maxLabels`, repartidas; siempre la última). */
export function pickLabelIndexes(count, maxLabels = 8) {
  if (count <= 0) return []
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i)
  const every = Math.ceil(count / maxLabels)
  const indexes = []
  for (let i = count - 1; i >= 0; i -= every) indexes.unshift(i) // se cuenta desde el final para que salga siempre la más reciente
  return indexes
}

/** Posición horizontal (0 a 1) de cada fecha ISO según el tiempo real entre ellas; una sola fecha queda en el centro. */
export function timePositions(isoDates) {
  if (isoDates.length === 0) return []
  const times = isoDates.map((d) => Date.parse(`${d}T12:00:00Z`))
  const min = Math.min(...times)
  const span = Math.max(...times) - min
  return times.map((t) => (span === 0 ? 0.5 : (t - min) / span))
}

/** Color de un nivel con una escala de azules, del más fácil (claro) al más difícil (oscuro). `rank` va de 0 a `count - 1`. */
export function sequentialBlue(rank, count) {
  const t = count <= 1 ? 1 : rank / (count - 1)
  const lightness = Math.round(72 - t * 38) // 72 % → 34 %
  return `hsl(212 72% ${lightness}%)`
}
