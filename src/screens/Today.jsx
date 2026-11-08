import { weekdayOf } from '../core/dates.js'
import { SESSION_TYPE_LABELS } from '../ui/labels.js'

export default function Today({ plan }) {
  const now = new Date()
  const rawDate = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const todayText = rawDate.charAt(0).toUpperCase() + rawDate.slice(1) // "Domingo, 8 de noviembre"
  const slots = plan.filter((slot) => slot.weekday === weekdayOf(now))

  return (
    <>
      <h1>Hoy</h1>
      <p className="muted day-text">{todayText}</p>

      {slots.length === 0 ? (
        <section className="card">
          <p>No tienes nada previsto para hoy.</p>
        </section>
      ) : (
        slots.map((slot) => (
          <section className="card" key={slot.id}>
            <span className="badge">{SESSION_TYPE_LABELS[slot.type] ?? slot.type}</span>
            <p className="card-title">{slot.name}</p>
          </section>
        ))
      )}

      <p className="muted small">El botón para empezar el entreno llega en la entrega 1d.</p>
    </>
  )
}
