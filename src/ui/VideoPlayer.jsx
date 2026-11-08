import { useState } from 'react'
import { youtubeEmbedUrl, youtubeWatchUrl } from '../core/youtube.js'

/**
 * Vídeo de YouTube incrustado. No se carga hasta que se pulsa "Ver vídeo": así la ficha abre rápido,
 * no gasta datos y no contacta con YouTube si no quieres verlo. Sin internet explica por qué no se ve.
 */
export default function VideoPlayer({ videoId, title, channel }) {
  const [playing, setPlaying] = useState(false)
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false

  return (
    <div className="video">
      {playing && !offline ? (
        <div className="video-frame">
          <iframe
            src={youtubeEmbedUrl(videoId)}
            title={`Vídeo: ${title}`}
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <button type="button" className="btn btn-secondary video-start" onClick={() => setPlaying(true)}>
          ▶ Ver vídeo
        </button>
      )}
      {offline && <p className="message">Sin conexión: el vídeo necesita internet. El resto de la ficha sí se ve.</p>}
      <p className="muted small">
        {channel ? `Vídeo de ${channel}. ` : ''}
        <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer">
          Abrir en YouTube
        </a>
      </p>
    </div>
  )
}
