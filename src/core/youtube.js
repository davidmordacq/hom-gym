// Ayudas para enlaces de YouTube. Solo lógica, sin pantallas.

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

/**
 * Saca el identificador (11 caracteres) de un enlace de YouTube o de un identificador suelto.
 * Admite: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/..., youtube.com/embed/...
 * Devuelve null si no es un enlace de YouTube reconocible.
 */
export function parseYoutubeId(input) {
  if (typeof input !== 'string') return null
  const text = input.trim()
  if (!text) return null
  if (ID_PATTERN.test(text)) return text

  let url
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')

  let candidate = null
  if (host === 'youtu.be') {
    candidate = url.pathname.split('/')[1]
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, kind, id] = url.pathname.split('/')
    if (url.pathname === '/watch') candidate = url.searchParams.get('v')
    else if (kind === 'shorts' || kind === 'embed' || kind === 'live') candidate = id
  }
  return candidate && ID_PATTERN.test(candidate) ? candidate : null
}

/** Dirección para ver el vídeo dentro de la app (sin cookies de seguimiento). */
export const youtubeEmbedUrl = (id) => `https://www.youtube-nocookie.com/embed/${id}?rel=0`

/** Dirección normal del vídeo, para abrirlo en YouTube. */
export const youtubeWatchUrl = (id) => `https://www.youtube.com/watch?v=${id}`
