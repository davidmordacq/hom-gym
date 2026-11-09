// Sonido, vibración y pantalla encendida durante la sesión. Todo es "mejor esfuerzo": si el navegador no lo permite,
// la app sigue funcionando (el temporizador se ve en pantalla igualmente).

let audioContext = null

/** Hay que llamarlo desde un toque del usuario (por ejemplo, al marcar una serie): el navegador no deja sonar antes. */
export function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    audioContext ??= new Ctx()
    if (audioContext.state === 'suspended') audioContext.resume()
  } catch {
    // sin sonido
  }
}

function tone(frequency, startSeconds, durationSeconds) {
  const start = audioContext.currentTime + startSeconds
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.4, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSeconds)
  oscillator.connect(gain).connect(audioContext.destination)
  oscillator.start(start)
  oscillator.stop(start + durationSeconds + 0.05)
}

/**
 * Intenta vibrar y dice qué pasó: 'ok' (el navegador la aceptó), 'unsupported' (este navegador no tiene vibración)
 * o 'blocked' (la tiene pero no la deja usar: por ejemplo, ajustes del móvil o falta un toque previo en la página).
 * Aceptar no garantiza que el móvil vibre: eso depende también de los ajustes de sonido y vibración del teléfono.
 */
export function tryVibrate(pattern, nav = typeof navigator === 'undefined' ? undefined : navigator) {
  if (!nav || typeof nav.vibrate !== 'function') return 'unsupported'
  try {
    return nav.vibrate(pattern) ? 'ok' : 'blocked'
  } catch {
    return 'blocked'
  }
}

/** Aviso de "quedan 15 segundos": dos bips cortos y una vibración. Devuelve el estado de la vibración. */
export function warningBeep() {
  try {
    if (audioContext) {
      tone(880, 0, 0.15)
      tone(880, 0.25, 0.15)
    }
  } catch {
    // sin sonido
  }
  return tryVibrate([300, 150, 300])
}

/** Fin del descanso: un bip más largo y más grave, y una vibración larga. */
export function endBeep() {
  try {
    if (audioContext) tone(660, 0, 0.5)
  } catch {
    // sin sonido
  }
  return tryVibrate([600])
}

/** Para el botón "Probar el aviso" de Ajustes: suena, vibra y cuenta qué ha podido hacer. */
export function testAlert() {
  unlockAudio()
  const sound = audioContext ? audioContext.state : 'unsupported'
  const vibration = warningBeep()
  return { sound, vibration }
}

/** Intenta mantener la pantalla encendida. Devuelve una función para soltarla. */
export async function keepScreenAwake() {
  let lock = null
  let released = false
  const acquire = async () => {
    try {
      if (!released && document.visibilityState === 'visible') lock = (await navigator.wakeLock?.request('screen')) ?? null
    } catch {
      lock = null
    }
  }
  const onVisible = () => acquire() // el navegador la suelta al cambiar de app: se vuelve a pedir al regresar
  document.addEventListener('visibilitychange', onVisible)
  await acquire()
  return () => {
    released = true
    document.removeEventListener('visibilitychange', onVisible)
    lock?.release?.().catch(() => {})
  }
}
