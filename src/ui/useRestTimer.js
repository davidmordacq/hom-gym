import { useCallback, useEffect, useRef, useState } from 'react'
import { crossedEnd, crossedWarning, restRemaining } from '../core/workout.js'
import { endBeep, warningBeep } from './feedback.js'

/**
 * Cuenta atrás del descanso. Se basa en la hora de fin (no en ir restando), así que sigue siendo exacta aunque el
 * móvil frene la página un rato. Suena una vez a los 15 s y otra al llegar a 0.
 * Devuelve { remaining (null si no hay descanso), start(segundos), stop() }.
 */
export function useRestTimer() {
  const [endAt, setEndAt] = useState(null)
  const [remaining, setRemaining] = useState(null)
  const previous = useRef(null)

  useEffect(() => {
    if (endAt === null) {
      setRemaining(null)
      return undefined
    }
    previous.current = restRemaining(endAt)
    setRemaining(previous.current)
    const timer = setInterval(() => {
      const current = restRemaining(endAt)
      if (crossedWarning(previous.current, current)) warningBeep()
      if (crossedEnd(previous.current, current)) endBeep()
      previous.current = current
      setRemaining(current)
    }, 250)
    return () => clearInterval(timer)
  }, [endAt])

  const start = useCallback((seconds) => setEndAt(Date.now() + seconds * 1000), [])
  const stop = useCallback(() => setEndAt(null), [])
  return { remaining, start, stop }
}
