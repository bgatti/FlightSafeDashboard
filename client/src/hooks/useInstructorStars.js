import { useState, useEffect, useCallback } from 'react'

const EVENT = 'flightsafe:instructor-stars'
const STORAGE_KEY = 'flightsafe_instructor_stars'

function readStars() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

/**
 * Instructor star preference rating (1–3 stars), persisted in localStorage.
 * Single shared store — all hook instances stay in sync via CustomEvent.
 */
export function useInstructorStars() {
  const [stars, setStars] = useState(readStars)

  useEffect(() => {
    const handler = () => setStars(readStars())
    window.addEventListener(EVENT, handler)
    return () => window.removeEventListener(EVENT, handler)
  }, [])

  const setStar = useCallback((instructorName, rating) => {
    const next = { ...readStars(), [instructorName]: rating }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setStars(next)
    window.dispatchEvent(new CustomEvent(EVENT))
  }, [])

  return [stars, setStar]
}
