import { useState, useEffect, useCallback, useMemo } from 'react'
import { FlightBar } from '../components/flights/FlightBar'
import { FlightTimeline } from '../components/flights/FlightTimeline'
import { RouteMap } from '../components/flights/RouteMap'
import { getAllFlights, subscribe, updateFlight, extractRiskItems, addFlight } from '../store/flights'
import { mockPersonnel } from '../mocks/personnel'
import { computeScheduleConflicts, allConflictsForFlight } from '../lib/scheduleConflicts'
import { estimateFlightDuration, formatHours, CRUISE_SPEEDS_KTS } from '../lib/flightCalc'

// ─── Constants ────────────────────────────────────────────────────────────────

const WEATHER_BASE = 'http://localhost:3000'
const STALE_MINUTES = 15

// ─── User selector helpers ────────────────────────────────────────────────────

function personnelToUser(p) {
  if (!p) return null
  const parts = p.name.split(' ')
  const lastName  = parts[parts.length - 1]
  const firstInit = parts[0]?.[0] ?? ''
  return {
    id:          p.id,
    name:        p.name,
    shortName:   `${lastName}, ${firstInit}.`,
    role:        p.role,
    isChiefPilot: p.isChiefPilot ?? false,
  }
}

const SELECTABLE_USERS = mockPersonnel
  .filter((p) => ['pilot_pic', 'pilot_sic', 'safety_officer', 'dispatcher'].includes(p.role))
  .map(personnelToUser)

// ─── Time filter logic ────────────────────────────────────────────────────────

const TIME_FILTERS = [
  { key: 'past',  label: 'Past' },
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'future', label: 'Future' },
  { key: 'all',   label: 'All' },
]

function isToday(iso) {
  const d = new Date(iso), n = new Date()
  // Compare in LOCAL time — flights are scheduled in local, stored as ISO/UTC
  return d.getFullYear() === n.getFullYear()
      && d.getMonth()    === n.getMonth()
      && d.getDate()     === n.getDate()
}

function filterFlights(flights, timeFilter) {
  const now    = Date.now()
  const weekMs = 7 * 24 * 3_600_000
  const live   = flights.filter((f) => f.status !== 'cancelled' && f.status !== 'closed')
  switch (timeFilter) {
    case 'past':   return live.filter((f) => new Date(f.plannedDepartureUtc) < now - 2 * 3_600_000 && f.status !== 'active')
    case 'today':  return live.filter((f) => isToday(f.plannedDepartureUtc) || f.status === 'active')
    case 'week':   return live.filter((f) => {
      const d = new Date(f.plannedDepartureUtc).getTime()
      return d >= now - 2 * 3_600_000 && d <= now + weekMs
    })
    case 'future': return live.filter((f) => new Date(f.plannedDepartureUtc).getTime() > now + weekMs)
    default:       return live
  }
}

function isStaleCheck(flight) {
  if (flight.status !== 'active' && flight.status !== 'planned') return false
  const checked = flight.riskSnapshot?.lastCheckedAt
  if (!checked) return false
  return Date.now() - new Date(checked).getTime() > STALE_MINUTES * 60_000
}

// ─── Recalculation ────────────────────────────────────────────────────────────

async function recalcFlight(flight) {
  const { departure, arrival, plannedDepartureUtc } = flight
  if (!departure || !arrival) return null
  try {
    const res = await fetch(`${WEATHER_BASE}/api/flight-weather`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ departure, arrival, departureTime: plannedDepartureUtc }),
    })
    if (!res.ok) return null
    const routeData = await res.json()

    const sigmets = routeData?.sigmets?.route?.features ?? []
    const airmets = routeData?.airmets?.route?.features  ?? []
    const deptMetar = routeData?.metars?.data?.find((m) =>
      m.station_id === departure || m.station_id?.endsWith(departure.slice(-3))
    ) ?? null
    const newWeatherSummary = {
      flightCategory: deptMetar?.flight_category ?? flight.riskSnapshot?.weatherSummary?.flightCategory,
      sigmetCount:    sigmets.length,
      airmetCount:    airmets.length,
      windKts:        deptMetar?.wind_speed_kt ?? flight.riskSnapshot?.weatherSummary?.windKts,
      visibilitySm:   deptMetar?.visibility_statute_mi ?? flight.riskSnapshot?.weatherSummary?.visibilitySm,
    }
    const oldSig   = flight.riskSnapshot?.weatherSummary?.sigmetCount ?? 0
    const oldAir   = flight.riskSnapshot?.weatherSummary?.airmetCount ?? 0
    const wxChange = (sigmets.length - oldSig) + (airmets.length - oldAir) * 0.5
    const oldRatio = flight.riskSnapshot?.ratioToBaseline ?? 1.0
    const newRatio = Math.max(0.1, oldRatio + wxChange * 0.3)
    const delta    = parseFloat((newRatio - oldRatio).toFixed(2))
    const trend    = Math.abs(delta) < 0.05 ? 'stable' : delta > 0 ? 'increasing' : 'decreasing'
    const riskItems = extractRiskItems(
      { activeFactors: flight.riskSnapshot?.activeFactors ?? [] },
      newWeatherSummary, null,
    )
    return {
      riskSnapshot: {
        ...flight.riskSnapshot,
        lastCheckedAt:   new Date().toISOString(),
        ratioToBaseline: newRatio,
        riskTrend:       trend,
        riskDelta:       delta,
        weatherSummary:  newWeatherSummary,
        riskItems:       riskItems.length ? riskItems : (flight.riskSnapshot?.riskItems ?? []),
      },
      riskScore: Math.min(100, Math.round(newRatio * 25)),
    }
  } catch { return null }
}

// ─── Implied Repositioning Bar ────────────────────────────────────────────────

function ImpliedRepoBar({ repo }) {
  const [scheduled, setScheduled] = useState(false)

  const windowMin = repo.windowMinutes ?? 0
  const feasible  = repo.feasible
  const estBlock  = repo.estFlightHours ? formatHours(repo.estFlightHours) : null
  const urgent    = feasible === false

  function scheduleRepo() {
    const depTime = repo.windowStart instanceof Date ? repo.windowStart : new Date(repo.windowStart)
    addFlight({
      id:                  `flt-${Date.now()}`,
      callsign:            repo.tailNumber,
      tailNumber:          repo.tailNumber,
      aircraftType:        repo.aircraftType,
      departure:           repo.fromAirport,
      arrival:             repo.toAirport,
      waypoints:           [],
      plannedDepartureUtc: depTime.toISOString(),
      status:              'planned',
      pic:                 repo.prevFlight?.pic ?? null,
      picId:               repo.prevFlight?.picId ?? null,
      sic:                 null,
      sicId:               null,
      passengers:          0,
      missionType:         'positioning',
      riskScore:           8,
      riskSnapshot: {
        capturedAt:      new Date().toISOString(),
        lastCheckedAt:   new Date().toISOString(),
        ratioToBaseline: 0.7,
        riskTrend:       'stable',
        riskDelta:       0,
        weatherSummary:  null,
        terrainProfile:  null,
        riskItems:       [],
      },
    })
    setScheduled(true)
  }

  return (
    <div className={`border rounded-lg px-4 py-2.5 flex items-center gap-3 flex-wrap opacity-70 ${
      urgent
        ? 'border-red-500/40 bg-red-500/5 border-dashed'
        : 'border-slate-600/40 bg-slate-800/30 border-dashed'
    }`}>
      {/* Dashed-circle indicator */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 border-2 ${
        urgent ? 'border-red-400' : 'border-slate-500'
      }`} />

      {/* Tail */}
      <div className="flex-shrink-0 w-20">
        <div className="text-xs font-mono text-slate-400">{repo.tailNumber}</div>
        <div className="text-[10px] text-slate-600">{repo.aircraftType}</div>
      </div>

      {/* Route */}
      <div className="flex-1 min-w-[140px]">
        <div className={`text-sm font-mono ${urgent ? 'text-red-300' : 'text-slate-400'}`}>
          {repo.fromAirport} → {repo.toAirport}
        </div>
        <div className="text-[10px] text-slate-600">
          Implied reposition · {windowMin > 0 ? `${windowMin}m window` : 'timing unknown'}
          {estBlock && ` · ${estBlock} est.`}
          {urgent && ' · ⚠ Window too short'}
        </div>
      </div>

      {/* Prev / next labels */}
      <div className="text-[10px] text-slate-600 flex-shrink-0 hidden sm:block">
        after {repo.prevFlight?.departure}→{repo.prevFlight?.arrival}
        {' · '}before {repo.nextFlight?.departure}→{repo.nextFlight?.arrival}
      </div>

      {/* Schedule button */}
      <div className="flex-shrink-0">
        {scheduled ? (
          <span className="text-xs text-sky-400">✓ Scheduled</span>
        ) : (
          <button
            onClick={scheduleRepo}
            className={`text-xs px-3 py-1 rounded border transition-colors ${
              urgent
                ? 'border-red-500/50 text-red-400 hover:bg-red-500/10'
                : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'
            }`}
          >
            Schedule Reposition
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function Flights() {
  const [flights,       setFlights]       = useState(() => getAllFlights())
  const [timeFilter,    setTimeFilter]    = useState('today')
  const [partFilter,    setPartFilter]    = useState(null)   // null = All
  const [flightTab,     setFlightTab]     = useState(null)
  const [selectedId,    setSelectedId]    = useState(null)
  const [currentUser,   setCurrentUser]   = useState(() => personnelToUser(mockPersonnel[0]))
  const [recalculating, setRecalculating] = useState({})

  // ── Subscribe to flight store ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribe((updated) => setFlights(updated))
    return unsub
  }, [])

  // ── Role-based default tab ─────────────────────────────────────────────────
  useEffect(() => {
    if (currentUser?.isChiefPilot)           setFlightTab('others')
    else if (currentUser?.role === 'safety_officer') setFlightTab(null)
    else                                      setFlightTab('mine')
  }, [currentUser?.id])

  // ── Conflict computation — recalculated every render from fresh store ──────
  // Runs over ALL flights so cross-flight conflicts are detected even when
  // some flights are filtered out of the current view.
  const { pilotConflicts, aircraftConflicts, impliedRepos } = useMemo(
    () => computeScheduleConflicts(flights),
    [flights]   // recalculates whenever store changes (subscribe above triggers re-render)
  )

  const totalConflictCount = useMemo(() => {
    const ids = new Set([
      ...Object.keys(pilotConflicts),
      ...Object.keys(aircraftConflicts),
    ])
    return ids.size
  }, [pilotConflicts, aircraftConflicts])

  // ── Stale recalculation ────────────────────────────────────────────────────
  const checkStaleFlights = useCallback(async () => {
    const live  = getAllFlights()
    const stale = live.filter((f) => isStaleCheck(f) && !recalculating[f.id])
    if (!stale.length) return

    const ids = stale.map((f) => f.id)
    setRecalculating((prev) => { const n = { ...prev }; ids.forEach((id) => { n[id] = true }); return n })

    await Promise.allSettled(
      stale.map(async (flight) => {
        const updates = await recalcFlight(flight)
        updateFlight(flight.id, updates ?? {
          riskSnapshot: { ...(flight.riskSnapshot ?? {}), lastCheckedAt: new Date().toISOString() },
        })
      })
    )

    setRecalculating((prev) => { const n = { ...prev }; ids.forEach((id) => { delete n[id] }); return n })
  }, [recalculating])

  useEffect(() => {
    checkStaleFlights()
    const interval = setInterval(checkStaleFlights, 60_000)
    return () => clearInterval(interval)
  }, [])

  // ── Filtering ──────────────────────────────────────────────────────────────
  const timeFiltered = filterFlights(flights, timeFilter)

  const partFiltered = partFilter
    ? timeFiltered.filter((f) => (f.part ?? '135') === partFilter)
    : timeFiltered

  const tabFiltered = partFiltered.filter((f) => {
    if (!flightTab) return true
    if (flightTab === 'mine')   return f.picId === currentUser?.id || f.sicId === currentUser?.id
    if (flightTab === 'others') return f.picId !== currentUser?.id && f.sicId !== currentUser?.id
    return true
  })

  // ── Build interleaved list: real flights + implied repos for this view ─────
  // Implied repos are included if their windowEnd falls inside the filtered window.
  const tabFilteredIds = new Set(tabFiltered.map((f) => f.id))

  const visibleRepos = impliedRepos.filter((r) => {
    // Show if either the prev or next flight is in the current tab view
    return tabFilteredIds.has(r.prevFlight.id) || tabFilteredIds.has(r.nextFlight.id)
  })

  // Merge and sort by relevant time
  const listItems = [
    ...tabFiltered.map((f) => ({ _type: 'flight', _sortKey: new Date(f.plannedDepartureUtc).getTime(), flight: f })),
    ...visibleRepos.map((r) => ({
      _type: 'implied_reposition',
      _sortKey: r.windowStart instanceof Date ? r.windowStart.getTime() : new Date(r.windowStart).getTime(),
      repo: r,
    })),
  ].sort((a, b) => a._sortKey - b._sortKey)

  // ── Stats ──────────────────────────────────────────────────────────────────
  const activeCount   = partFiltered.filter((f) => f.status === 'active').length
  const criticalCount = partFiltered.filter((f) => {
    const r = f.riskSnapshot?.ratioToBaseline ?? (f.riskScore ? f.riskScore / 25 : 0)
    return r >= 2
  }).length

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Flights</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeCount > 0     && <span className="text-green-400 font-medium">{activeCount} active · </span>}
            {criticalCount > 0   && <span className="text-red-400 font-medium">{criticalCount} elevated risk · </span>}
            {totalConflictCount > 0 && <span className="text-orange-400 font-medium">{totalConflictCount} conflict{totalConflictCount !== 1 ? 's' : ''} · </span>}
            {partFiltered.length} flight{partFiltered.length !== 1 ? 's' : ''} in view
          </p>
        </div>

        {/* User selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Logged in as:</span>
          <select
            value={currentUser?.id ?? ''}
            onChange={(e) => {
              const p = mockPersonnel.find((x) => x.id === e.target.value)
              if (p) setCurrentUser(personnelToUser(p))
            }}
            className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-sky-500"
          >
            {SELECTABLE_USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}{u.isChiefPilot ? ' (Chief Pilot)' : ''}{u.role === 'safety_officer' ? ' (Safety)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Route Map ── */}
      <RouteMap
        flights={partFiltered}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId((prev) => prev === id ? null : id)}
      />

      {/* ── Flight Timeline (Gantt) ── */}
      <FlightTimeline
        flights={tabFiltered}
        impliedRepos={visibleRepos}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId((prev) => prev === id ? null : id)}
      />

      {/* ── Filters + tabs ── */}
      <div className="flex flex-col gap-2">
        {/* Row 1: time filter + mine/others */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            {TIME_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTimeFilter(key)}
                className={`px-3 py-1 rounded text-xs border transition-colors ${
                  timeFilter === key
                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                    : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-xs">
            {[['mine','My Flights'],['others','Other Flights'],[null,'All']].map(([val, label]) => (
              <button
                key={String(val)}
                onClick={() => setFlightTab(val)}
                className={`px-3 py-1 rounded border transition-colors ${
                  flightTab === val
                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                    : 'border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Part filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-slate-600 uppercase tracking-wide mr-1">Reg</span>
          {[
            [null,  'All'],
            ['135', 'Part 135'],
            ['91',  'Part 91'],
            ['61',  'Part 61 Training'],
          ].map(([val, label]) => {
            const active = partFilter === val
            const colorMap = { '135': 'bg-sky-500/20 border-sky-500/50 text-sky-300', '91': 'bg-amber-500/20 border-amber-500/50 text-amber-300', '61': 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' }
            return (
              <button
                key={String(val)}
                onClick={() => setPartFilter(val)}
                className={`px-3 py-1 rounded text-xs border transition-colors ${
                  active
                    ? (val ? colorMap[val] : 'bg-sky-500/20 border-sky-500/50 text-sky-300')
                    : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Flight list (interleaved with implied repos) ── */}
      <div className="flex flex-col gap-2">
        {listItems.length === 0 ? (
          <div className="text-sm text-slate-500 italic py-6 text-center">
            No flights match this filter.
          </div>
        ) : (
          listItems.map((item) => {
            if (item._type === 'implied_reposition') {
              return <ImpliedRepoBar key={item.repo.id} repo={item.repo} />
            }
            const { flight } = item
            const conflicts = allConflictsForFlight(flight.id, pilotConflicts, aircraftConflicts)
            return (
              <FlightBar
                key={flight.id}
                flight={flight}
                currentUser={currentUser}
                recalculating={recalculating[flight.id] ?? false}
                conflicts={conflicts}
                isSelected={selectedId === flight.id}
                onSelect={() => setSelectedId((prev) => prev === flight.id ? null : flight.id)}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
