import { useEffect, useRef, useState } from 'react'
import { niceScale, pickLabelIndexes, timePositions } from './chartMath.js'

const M = { left: 44, right: 8, top: 10, bottom: 28 }

/** Ancho real del contenedor, para dibujar con el tamaño de letra y de barras de verdad (sin escalar). */
function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(340)
  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const update = () => setWidth(Math.max(240, Math.round(element.getBoundingClientRect().width)))
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/** Leyenda con cuadraditos de color. */
export function ChartLegend({ items }) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.id}>
          <span className="swatch" style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

const onKey = (action) => (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    action()
  }
}

/**
 * Barras (apiladas si hay varias series) por periodo. Tocar una columna muestra sus valores debajo.
 * rows: [{ key, label, values: { idSerie: número }, total }]; series: [{ id, label, color }].
 */
export function StackedBars({ rows, series, formatValue, formatTick = formatValue, height = 230, ariaLabel }) {
  const [ref, width] = useWidth()
  const [picked, setPicked] = useState(null)
  const lastWithData = rows.reduce((found, r, i) => (r.total > 0 ? i : found), rows.length - 1)
  const selected = picked !== null && picked < rows.length ? picked : lastWithData
  const maxTotal = Math.max(0, ...rows.map((r) => r.total))
  const scale = niceScale(maxTotal)
  const innerW = width - M.left - M.right
  const innerH = height - M.top - M.bottom
  const band = rows.length > 0 ? innerW / rows.length : innerW
  const barW = Math.min(24, Math.max(4, band * 0.66))
  const y = (v) => M.top + innerH - (v / scale.max) * innerH
  const labels = pickLabelIndexes(rows.length, Math.max(3, Math.floor(innerW / 52)))
  const row = rows[selected]

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {scale.values.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={M.left - 6} y={y(v) + 4} textAnchor="end" className="chart-text">
              {formatTick(v)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x = M.left + band * i + (band - barW) / 2
          let base = 0
          return (
            <g key={r.key}>
              {i === selected && <rect x={M.left + band * i} y={M.top} width={band} height={innerH} className="chart-selected" />}
              {series.map((s) => {
                const value = r.values[s.id] ?? 0
                if (value <= 0) return null
                const top = y(base + value)
                const h = Math.max(1, y(base) - top - (base > 0 ? 1.5 : 0))
                base += value
                return <rect key={s.id} x={x} y={top} width={barW} height={h} rx="2" fill={s.color} />
              })}
              <rect
                x={M.left + band * i}
                y={M.top}
                width={band}
                height={innerH}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`${r.label}: ${formatValue(r.total)}`}
                onClick={() => setPicked(i)}
                onFocus={() => setPicked(i)}
                onMouseEnter={() => setPicked(i)}
                onKeyDown={onKey(() => setPicked(i))}
              />
            </g>
          )
        })}
        <line x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} className="chart-axis" />
        {labels.map((i) => (
          <text key={rows[i].key} x={M.left + band * i + band / 2} y={height - 8} textAnchor="middle" className="chart-text">
            {rows[i].label}
          </text>
        ))}
      </svg>

      {row && (
        <div className="chart-readout" aria-live="polite">
          <strong>{row.label}</strong>
          {series.length > 1 ? (
            <>
              {series.map((s) => (
                <span key={s.id}>
                  <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
                  {s.label}: {formatValue(row.values[s.id] ?? 0)}
                </span>
              ))}
              <span>Total: {formatValue(row.total)}</span>
            </>
          ) : (
            <span>{formatValue(row.total)}</span>
          )}
        </div>
      )}

      <details className="chart-data">
        <summary>Ver los datos en una tabla</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Periodo</th>
              {series.map((s) => (
                <th scope="col" key={s.id}>
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                {series.map((s) => (
                  <td key={s.id}>{formatValue(r.values[s.id] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

/**
 * Puntos unidos por una línea en el tiempo (la fecha real manda en el eje horizontal).
 * points: [{ key, date, value, color, title, detail }]; target: { min, max } o null (franja del objetivo).
 */
export function DotsLine({ points, target, unitWord = 'rep.', yFloor = 0, height = 230, ariaLabel, formatDate }) {
  const [ref, width] = useWidth()
  const [picked, setPicked] = useState(null)
  const selected = picked !== null && picked < points.length ? picked : points.length - 1
  const maxValue = Math.max(target?.max ?? 0, ...points.map((p) => p.value))
  const scale = niceScale(maxValue * 1.05, 6)
  const innerW = width - M.left - M.right
  const innerH = height - M.top - M.bottom
  const pad = 12
  const positions = timePositions(points.map((p) => p.date))
  const x = (i) => M.left + pad + positions[i] * (innerW - pad * 2)
  const y = (v) => M.top + innerH - ((v - yFloor) / (scale.max - yFloor)) * innerH
  const labels = pickLabelIndexes(points.length, Math.max(2, Math.floor(innerW / 70)))
  const point = points[selected]

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {scale.values.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={M.left - 6} y={y(v) + 4} textAnchor="end" className="chart-text">
              {v}
            </text>
          </g>
        ))}
        {target && (
          <g>
            <rect x={M.left} y={y(target.max)} width={innerW} height={Math.max(2, y(target.min) - y(target.max))} className="chart-target" />
            <text x={width - M.right - 4} y={y(target.max) - 4} textAnchor="end" className="chart-text">
              objetivo {target.min}-{target.max}
            </text>
          </g>
        )}
        <line x1={M.left} x2={width - M.right} y1={y(yFloor)} y2={y(yFloor)} className="chart-axis" />
        {points.length > 1 && <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} className="chart-line" />}
        {points.map((p, i) => (
          <g key={p.key}>
            <circle cx={x(i)} cy={y(p.value)} r={i === selected ? 9 : 6} fill={p.color} className="chart-dot" />
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={16}
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={`${formatDate(p.date)}: ${p.title}`}
              onClick={() => setPicked(i)}
              onFocus={() => setPicked(i)}
              onMouseEnter={() => setPicked(i)}
              onKeyDown={onKey(() => setPicked(i))}
            />
          </g>
        ))}
        {labels.map((i) => (
          <text key={points[i].key} x={x(i)} y={height - 8} textAnchor="middle" className="chart-text">
            {formatDate(points[i].date)}
          </text>
        ))}
      </svg>
      {point && (
        <div className="chart-readout" aria-live="polite">
          <strong>{formatDate(point.date)}</strong>
          <span>{point.title}</span>
          <span>{point.detail}</span>
        </div>
      )}
      <span className="sr-only">{unitWord}</span>
    </div>
  )
}
