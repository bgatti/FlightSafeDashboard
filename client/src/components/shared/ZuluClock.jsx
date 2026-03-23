import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

/**
 * Displays the current UTC/Zulu time, updating every second.
 * Shows the "Z" suffix per aviation convention.
 *
 * @param {boolean} [showLocal=false] - Also display local time in parentheses
 */
export function ZuluClock({ showLocal = false }) {
  const [now, setNow] = useState(() => dayjs.utc())

  useEffect(() => {
    const id = setInterval(() => setNow(dayjs.utc()), 1_000)
    return () => clearInterval(id)
  }, [])

  const zuluStr = now.format('HH:mm:ss')

  return (
    <time
      className="font-mono text-sm tabular-nums"
      dateTime={now.toISOString()}
      aria-label={`Current Zulu time: ${zuluStr} UTC`}
    >
      <span className="text-sky-400 font-bold">{zuluStr}</span>
      <span className="text-slate-400">Z</span>
      {showLocal && (
        <span className="ml-2 text-slate-500 text-xs">
          ({dayjs().format('HH:mm')} LCL)
        </span>
      )}
    </time>
  )
}
