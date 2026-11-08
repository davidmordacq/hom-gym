export default function Placeholder({ title, entrega, text }) {
  return (
    <>
      <h1>{title}</h1>
      <section className="card">
        <p>{text}</p>
        <p className="muted small">Esta pantalla llega en la entrega {entrega}.</p>
      </section>
    </>
  )
}
