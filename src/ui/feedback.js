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

const vibrate = (pattern) => {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // sin vibración
  }
}

/** Aviso de "quedan 15 segundos": dos bips cortos. */
export function warningBeep() {
  try {
    if (audioContext) {
      tone(880, 0, 0.15)
      tone(880, 0.25, 0.15)
    }
  } catch {
    // sin sonido
  }
  vibrate([150, 100, 150])
}

/** Fin del descanso: un bip más largo y más grave. */
export function endBeep() {
  try {
    if (audioContext) tone(660, 0, 0.5)
  } catch {
    // sin sonido
  }
  vibrate([400])
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
