import { useMemo, useState } from 'react'
import { MUSCLE_GROUPS } from '../core/defaultData.js'
import {
  blankExercise, exerciseUsage, groupExercises, isArchived, levelsEasyToHard, newExerciseId, removeExerciseFromTemplates,
  searchExercises, setArchived, targetText, toDraft,
} from '../core/exercises.js'
import { parseYoutubeId } from '../core/youtube.js'
import { put, remove } from '../storage/db.js'
import { loadExerciseHistory } from '../storage/sessions.js'
import { RESISTANCE_TYPE_HELP, RESISTANCE_TYPE_LABELS } from '../ui/labels.js'
import VideoPlayer from '../ui/VideoPlayer.jsx'
import ExerciseForm from './ExerciseForm.jsx'

const groupLabel = (id) => MUSCLE_GROUPS.find((g) => g.id === id)?.label ?? id

export default function Exercises({ db, exercises, scales, rules, sessions, templates, onChanged }) {
  // view: { mode: 'list' } | { mode: 'detail', id } | { mode: 'form', id } (id null = nuevo)
  const [view, setView] = useState({ mode: 'list' })
  const [query, setQuery] = useState('')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null) // por qué no se pudo borrar un ejercicio
  const [showArchived, setShowArchived] = useState(false)

  const archivedCount = exercises.filter(isArchived).length
  const visible = useMemo(() => (showArchived ? exercises : exercises.filter((e) => !isArchived(e))), [exercises, showArchived])
  const groups = useMemo(() => groupExercises(searchExercises(visible, query)), [visible, query])
  const selected = view.id ? exercises.find((e) => e.id === view.id) : null

  async function save(exercise) {
    const toSave = exercise.id ? exercise : { ...exercise, id: newExerciseId() }
    await put(db, 'exercises', toSave)
    await onChanged()
    setView({ mode: 'detail', id: toSave.id })
  }

  async function toggleArchive(exercise) {
    setError(null)
    setNotice(null)
    try {
      await put(db, 'exercises', setArchived(exercise, !isArchived(exercise)))
      await onChanged()
    } catch (e) {
      setError(`No se pudo guardar el cambio: ${e.message}`)
    }
  }

  async function removeExercise(exercise) {
    setError(null)
    setNotice(null)
    try {
      // Si ya tiene historial, no se borra: el historial dejaría de contar. Se ofrece archivarlo.
      const usage = exerciseUsage({ exerciseId: exercise.id, sets: await loadExerciseHistory(db, [exercise.id]), sessions, templates })
      if (usage.blocked) {
        setNotice(
          `No se puede borrar «${exercise.name}»: está en tu historial` +
            `${usage.sets > 0 ? ` (${usage.sets} ${usage.sets === 1 ? 'serie' : 'series'} en ${usage.sessions} ${usage.sessions === 1 ? 'sesión' : 'sesiones'})` : ''}. ` +
            'Si la borraras, esas sesiones dejarían de contar en Progreso. Puedes archivarla: desaparece de las listas y de las sesiones nuevas, ' +
            'pero conserva su historial, y la puedes restaurar cuando quieras.',
        )
        return
      }
      const where = usage.templates.length > 0 ? ` Se quitará de las sesiones: ${usage.templates.join(', ')}.` : ''
      if (!window.confirm(`¿Borrar «${exercise.name}»?${where} Esta acción no se puede deshacer.`)) return
      for (const template of removeExerciseFromTemplates(templates, exercise.id)) await put(db, 'templates', template)
      await remove(db, 'exercises', exercise.id)
      await onChanged()
      setView({ mode: 'list' })
    } catch (e) {
      setError(`No se pudo borrar: ${e.message}`)
    }
  }

  if (view.mode === 'form') {
    const editing = view.id ? exercises.find((e) => e.id === view.id) : null
    return (
      <ExerciseForm
        initial={editing ? toDraft(editing) : blankExercise()}
        scales={scales}
        rules={rules}
        isNew={!editing}
        onSave={save}
        onCancel={() => setView(editing ? { mode: 'detail', id: editing.id } : { mode: 'list' })}
      />
    )
  }

  if (view.mode === 'detail') {
    if (!selected) {
      // el ejercicio ya no existe (por ejemplo, tras restaurar una copia)
      return (
        <>
          <button type="button" className="back" onClick={() => setView({ mode: 'list' })}>
            ← Ejercicios
          </button>
          <p className="muted">Este ejercicio ya no existe.</p>
        </>
      )
    }
    const scale = scales.find((s) => s.id === selected.scaleId) ?? null
    const levels = levelsEasyToHard(selected, scale)
    const videoId = parseYoutubeId(selected.videoUrl)
    return (
      <>
        <button type="button" className="back" onClick={() => setView({ mode: 'list' })}>
          ← Ejercicios
        </button>
        <h1>{selected.name}</h1>
        <p>
          {selected.muscleGroups.map((id) => (
            <span className="badge badge-gap" key={id}>
              {groupLabel(id)}
            </span>
          ))}
        </p>

        {videoId ? (
          <section className="card">
            <VideoPlayer videoId={videoId} title={selected.name} channel={selected.videoChannel} />
          </section>
        ) : (
          <section className="card">
            <p className="muted">Este ejercicio no tiene vídeo. Puedes añadir uno al editarlo.</p>
          </section>
        )}

        {selected.notes && (
          <section className="card">
            <h2>Cómo hacerlo</h2>
            <p>{selected.notes}</p>
          </section>
        )}

        <section className="card">
          <h2>Dificultad</h2>
          <p>
            <strong>Objetivo:</strong> {targetText(selected, rules)}.
          </p>
          <p>
            <strong>{RESISTANCE_TYPE_LABELS[selected.resistanceType]}.</strong> {RESISTANCE_TYPE_HELP[selected.resistanceType]}
          </p>
          {levels.length > 0 ? (
            <>
              <p className="muted small">De más fácil a más difícil:</p>
              <ol className="levels">
                {levels.map((level) => (
                  <li key={level.id}>{level.label}</li>
                ))}
              </ol>
            </>
          ) : (
            <p className="muted small">Sin niveles de material: se progresa mejorando el resultado de cada serie.</p>
          )}
        </section>

        {error && <p className="message message-error">{error}</p>}
        {notice && (
          <p className="message" role="status">
            {notice}
          </p>
        )}
        {isArchived(selected) && <p className="muted small">Este ejercicio está archivado: no sale en las listas ni se puede añadir a sesiones nuevas.</p>}
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => setView({ mode: 'form', id: selected.id })}>
            Editar
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => toggleArchive(selected)}>
            {isArchived(selected) ? 'Restaurar' : 'Archivar'}
          </button>
          <button type="button" className="btn btn-secondary btn-danger" onClick={() => removeExercise(selected)}>
            Borrar
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <h1>Ejercicios</h1>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => setView({ mode: 'form', id: null })}>
          + Añadir ejercicio
        </button>
      </div>
      <input
        type="search"
        className="search"
        placeholder="Buscar por nombre o músculo"
        aria-label="Buscar ejercicio"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {exercises.length === 0 && (
        <section className="card">
          <p>Aún no tienes ejercicios. Pulsa «Añadir ejercicio» para crear el primero.</p>
        </section>
      )}
      {exercises.length > 0 && groups.length === 0 && <p className="muted">Ningún ejercicio coincide con la búsqueda.</p>}
      {archivedCount > 0 && (
        <button type="button" className="btn btn-secondary archived-toggle" aria-pressed={showArchived} onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Ocultar archivados' : `Mostrar archivados (${archivedCount})`}
        </button>
      )}

      {groups.map((group) => (
        <section key={group.groupId} aria-label={group.label}>
          <h2 className="group-title">{group.label}</h2>
          <ul className="exercise-list">
            {group.exercises.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  className="exercise-row"
                  onClick={() => {
                    setNotice(null)
                    setView({ mode: 'detail', id: exercise.id })
                  }}
                >
                  <span className="exercise-name">{exercise.name}</span>
                  <span className="muted small">
                    {exercise.muscleGroups.map(groupLabel).join(' · ')}
                    {exercise.videoUrl ? ' · ▶ vídeo' : ''}
                    {isArchived(exercise) ? ' · archivado' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
