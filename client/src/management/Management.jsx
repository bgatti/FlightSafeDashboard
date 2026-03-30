// =============================================================================
// Operations Management — 2-Week Resource Planning
// Tabs: Schedule | Demand Forecast | Weather Outlook | ML Model
//       + one tab per employee group: Flight Ops | Operations | Maintenance | FBO
// =============================================================================

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, ComposedChart, ScatterChart, Scatter,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, ReferenceLine, ErrorBar, Cell,
} from 'recharts'
import {
  WEATHER_FORECAST, SCHEDULE, SHIFT_DEFS, DEPT_COLORS, shiftCapacity,
} from './mockManagement'
import {
  MODEL, predict, DOW_PARTIAL, MONTH_PARTIAL, hourlyProfile, FEATURE_NAMES,
  predictGroupDemand,
} from './demandModel'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: '#1e293b', border: '1px solid #334155',
  borderRadius: 6, color: '#f1f5f9', fontSize: 12,
}

function fmtPct(n, d = 1) { return n.toFixed(d) + '%' }

const CAT_COLORS = {
  VFR:  'text-emerald-400',
  MVFR: 'text-amber-400',
  IFR:  'text-red-400',
  LIFR: 'text-purple-400',
}
const CAT_BG = {
  VFR:  'bg-emerald-400/10 border-emerald-400/30',
  MVFR: 'bg-amber-400/10 border-amber-400/30',
  IFR:  'bg-red-400/10 border-red-400/30',
  LIFR: 'bg-purple-400/10 border-purple-400/30',
}

function windDirLabel(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(deg / 45) % 8]
}

function SectionTitle({ children }) {
  return <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">{children}</h3>
}

function KpiTile({ label, value, sub, subColor = 'text-slate-500' }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg p-3 text-center min-w-[110px]">
      <p className="font-mono font-bold text-xl text-slate-100">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {sub && <p className={`text-xs mt-0.5 ${subColor}`}>{sub}</p>}
    </div>
  )
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-0.5 border-b border-surface-border mb-4 overflow-x-auto">
      {tabs.map((t, i) => (
        <button key={t} onClick={() => onChange(i)}
          className={[
            'px-3 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px',
            i === active
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-100',
          ].join(' ')}>
          {t}
        </button>
      ))}
    </div>
  )
}

// ── Demand data (computed once, shared by all tabs) ───────────────────────────
const DEPTS_LIST = ['Flight Ops', 'Operations', 'Maintenance', 'FBO']

function useDemandData() {
  return useMemo(() => {
    return WEATHER_FORECAST.map((wx, i) => {
      const date = new Date(wx.date + 'T12:00:00')
      const { mean, low, high } = predict(date, wx.weatherScore)
      const staffOn      = SCHEDULE.reduce((s, p) => s + (p.shifts[i] !== 'O' ? 1 : 0), 0)
      const staffActive  = SCHEDULE.reduce((s, p) => s + shiftCapacity(p.shifts[i]), 0)
      const staffNeeded  = Math.max(4, Math.ceil(mean / 4))
      const understaffed = staffActive < staffNeeded - 1

      // Group-specific demand predictions
      const group = predictGroupDemand(date, wx.weatherScore, mean)

      // Scheduled capacity (staff-hours) per department for this day
      const deptCap = {}
      DEPTS_LIST.forEach(dept => {
        deptCap[dept] = SCHEDULE
          .filter(p => p.dept === dept)
          .reduce((s, p) => s + shiftCapacity(p.shifts[i]) * 8, 0)
      })

      return { ...wx, date, mean, low, high, errorBar: high - mean,
               staffOn, staffActive, staffNeeded, understaffed, group, deptCap }
    })
  }, [])
}

// ── Tab 0: Schedule ────────────────────────────────────────────────────────────

const DAY_HEADERS = [
  'M 3/30','T 3/31','W 4/1','T 4/2','F 4/3','S 4/4','S 4/5',
  'M 4/6','T 4/7','W 4/8','T 4/9','F 4/10','S 4/11','S 4/12',
]
const DEPTS = ['Flight Ops', 'Operations', 'Maintenance', 'FBO']

function ScheduleTab({ demandData }) {
  const [selectedDay, setSelectedDay] = useState(null)

  const coverage = DAY_HEADERS.map((_, di) => ({
    active:      SCHEDULE.reduce((s, p) => s + (p.shifts[di] !== 'O' ? 1 : 0), 0),
    understaffed: demandData[di].understaffed,
    category:    WEATHER_FORECAST[di].category,
  }))

  const avgActive = Math.round(
    SCHEDULE.reduce((s, p) => s + p.shifts.filter(x => x !== 'O').length, 0) / 14
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        <KpiTile label="Staff on Roster"   value={SCHEDULE.length} sub="across 4 departments" />
        <KpiTile label="Avg Daily Active"   value={avgActive} sub="staff per day" />
        <KpiTile
          label="Understaffed Days"
          value={coverage.filter(c => c.understaffed).length}
          sub="vs predicted demand"
          subColor={coverage.some(c => c.understaffed) ? 'text-red-400' : 'text-emerald-400'}
        />
        <KpiTile
          label="Wx-Impacted Days"
          value={WEATHER_FORECAST.filter(w => w.category !== 'VFR').length}
          sub="MVFR / IFR"
          subColor="text-amber-400"
        />
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg overflow-x-auto">
        <table className="text-xs w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="text-left px-3 py-2 text-slate-400 font-medium w-36 sticky left-0 bg-surface-card z-10">Employee</th>
              <th className="text-left px-2 py-2 text-slate-400 font-medium w-24">Role</th>
              {DAY_HEADERS.map((h, i) => (
                <th key={h}
                  onClick={() => setSelectedDay(i === selectedDay ? null : i)}
                  className={[
                    'px-0.5 py-2 text-center font-medium cursor-pointer transition-colors w-10',
                    coverage[i].understaffed ? 'text-red-400' : coverage[i].category !== 'VFR' ? 'text-amber-400' : 'text-slate-400',
                    i === selectedDay ? 'bg-sky-400/10' : 'hover:bg-white/5',
                    (i === 6 || i === 13) ? 'border-r border-surface-border' : '',
                  ].join(' ')}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEPTS.map(dept => {
              const people = SCHEDULE.filter(p => p.dept === dept)
              return [
                <tr key={dept + '-hdr'}>
                  <td colSpan={2 + 14}
                    className={`px-3 py-1 text-xs uppercase tracking-wider font-semibold border-t border-surface-border/60 ${DEPT_COLORS[dept] ?? 'text-slate-400'}`}>
                    {dept}
                  </td>
                </tr>,
                ...people.map(person => (
                  <tr key={person.id} className="hover:bg-white/5 border-t border-surface-border/30">
                    <td className="px-3 py-1.5 text-slate-200 sticky left-0 bg-surface-card z-10 font-medium truncate max-w-[135px]">
                      {person.name}
                    </td>
                    <td className="px-2 py-1.5 text-slate-500 truncate max-w-[90px]">{person.role}</td>
                    {person.shifts.map((shift, di) => {
                      const sd = SHIFT_DEFS[shift] ?? SHIFT_DEFS.O
                      return (
                        <td key={di}
                          className={[
                            'px-0.5 py-1 text-center',
                            di === selectedDay ? 'bg-sky-400/10' : '',
                            (di === 6 || di === 13) ? 'border-r border-surface-border' : '',
                          ].join(' ')}>
                          {shift !== 'O' ? (
                            <span className={`inline-block px-1 py-0.5 rounded border text-xs font-mono ${sd.color}`}>
                              {shift}
                            </span>
                          ) : (
                            <span className="text-slate-700">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )),
              ]
            })}

            {/* Coverage row */}
            <tr className="border-t-2 border-surface-border">
              <td className="px-3 py-1.5 text-slate-400 font-semibold sticky left-0 bg-surface-card z-10">Active Staff</td>
              <td className="px-2 py-1.5" />
              {coverage.map((c, i) => (
                <td key={i}
                  className={[
                    'px-0.5 py-1.5 text-center font-mono font-semibold',
                    c.understaffed ? 'text-red-400' : 'text-emerald-400',
                    (i === 6 || i === 13) ? 'border-r border-surface-border' : '',
                  ].join(' ')}>
                  {c.active}
                </td>
              ))}
            </tr>

            {/* Predicted ops row */}
            <tr className="border-t border-surface-border/50">
              <td className="px-3 py-1.5 text-slate-400 sticky left-0 bg-surface-card z-10">Predicted Ops</td>
              <td className="px-2 py-1.5" />
              {demandData.map((d, i) => (
                <td key={i}
                  className={[
                    'px-0.5 py-1.5 text-center font-mono text-xs',
                    d.mean >= 22 ? 'text-red-400' : d.mean >= 17 ? 'text-amber-400' : 'text-emerald-400',
                    (i === 6 || i === 13) ? 'border-r border-surface-border' : '',
                  ].join(' ')}>
                  {d.mean}
                </td>
              ))}
            </tr>

            {/* Weather row */}
            <tr className="border-t border-surface-border/50">
              <td className="px-3 py-1.5 text-slate-400 sticky left-0 bg-surface-card z-10">Wx</td>
              <td className="px-2 py-1.5" />
              {WEATHER_FORECAST.map((wx, i) => (
                <td key={i}
                  className={[
                    'px-0.5 py-1.5 text-center text-xs font-semibold',
                    CAT_COLORS[wx.category],
                    (i === 6 || i === 13) ? 'border-r border-surface-border' : '',
                  ].join(' ')}>
                  {wx.category === 'VFR' ? 'V' : wx.category}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(SHIFT_DEFS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`px-1.5 py-0.5 rounded border font-mono ${v.color}`}>{k}</span>
            <span className="text-slate-500">{v.label} {v.time}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Tab 1: Demand Forecast ─────────────────────────────────────────────────────

function DemandForecastTab({ demandData }) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const selected = demandData[selectedIdx]

  const profile = useMemo(
    () => hourlyProfile(selected.date, selected.mean, selected.weatherScore),
    [selectedIdx] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const peakDay = demandData.reduce((best, d) => d.mean > best.mean ? d : best)
  const avgOps  = Math.round(demandData.reduce((s, d) => s + d.mean, 0) / 14)

  const barColors = demandData.map(d =>
    d.mean >= 22 ? '#f87171' : d.mean >= 17 ? '#fbbf24' : '#34d399'
  )

  const hourlyData = profile.map((ops, h) => {
    const label = h === 0 ? 'Mid' : h === 6 ? '6am' : h === 9 ? '9am'
      : h === 12 ? 'Noon' : h === 15 ? '3pm' : h === 18 ? '6pm' : h === 21 ? '9pm' : ''
    return { hour: `${h}:00`, label, ops }
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <KpiTile label="Peak Day"     value={peakDay.dow} sub={`${peakDay.mean} ops predicted`} subColor="text-red-400" />
        <KpiTile label="Avg Daily Ops" value={avgOps}    sub="14-day outlook" />
        <KpiTile label="VFR Days"     value={demandData.filter(d => d.category === 'VFR').length}  sub="full ops capacity"  subColor="text-emerald-400" />
        <KpiTile label="Wx-Impacted"  value={demandData.filter(d => d.category !== 'VFR').length} sub="reduced ops days"   subColor="text-amber-400" />
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-4">
        <SectionTitle>Predicted Daily Operations — 14-Day Outlook (90% PI) — click a bar for hourly profile</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={demandData}
            margin={{ top: 4, right: 8, left: 24, bottom: 0 }}
            onClick={d => d?.activeTooltipIndex != null && setSelectedIdx(d.activeTooltipIndex)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 32]} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v, n) => [n === 'mean' ? v + ' ops' : v, n === 'mean' ? 'Predicted' : n]} />
            <ReferenceLine y={avgOps} stroke="#64748b" strokeDasharray="4 4"
              label={{ value: 'Avg', fill: '#64748b', fontSize: 10, position: 'right' }} />
            <Bar dataKey="mean" name="mean" radius={[3, 3, 0, 0]}>
              {demandData.map((d, i) => (
                <Cell key={i}
                  fill={i === selectedIdx ? '#38bdf8' : barColors[i]}
                  fillOpacity={i === selectedIdx ? 1 : 0.75} />
              ))}
              <ErrorBar dataKey="errorBar" width={4} strokeWidth={1.5} stroke="#94a3b8" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-4">
        <SectionTitle>
          Hourly Traffic Profile — {selected.label} ({selected.category}, {selected.mean} ops total)
        </SectionTitle>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={hourlyData} margin={{ top: 2, right: 8, left: 24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 9 }}
              tickFormatter={(_, i) => hourlyData[i]?.label ?? ''} interval={0} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v + ' ops', 'Traffic']} />
            <Bar dataKey="ops" fill="#38bdf8" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-border">
              {['Date','DoW','Wx','Pred Ops','Low','High','Staff Needed','Staff Active','Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-slate-400 uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {demandData.map((d, i) => (
              <tr key={d.date} onClick={() => setSelectedIdx(i)}
                className={['border-b border-surface-border/50 cursor-pointer',
                  i === selectedIdx ? 'bg-sky-400/10' : 'hover:bg-white/5'].join(' ')}>
                <td className="px-3 py-1.5 text-slate-200 font-medium">{d.label}</td>
                <td className="px-3 py-1.5 text-slate-400">{d.dow}</td>
                <td className={`px-3 py-1.5 font-semibold ${CAT_COLORS[d.category]}`}>{d.category}</td>
                <td className="px-3 py-1.5 font-mono text-slate-100">{d.mean}</td>
                <td className="px-3 py-1.5 font-mono text-slate-400">{d.low}</td>
                <td className="px-3 py-1.5 font-mono text-slate-400">{d.high}</td>
                <td className="px-3 py-1.5 font-mono text-slate-300">{d.staffNeeded}</td>
                <td className="px-3 py-1.5 font-mono text-slate-300">{d.staffActive.toFixed(1)}</td>
                <td className={`px-3 py-1.5 font-semibold ${d.understaffed ? 'text-red-400' : 'text-emerald-400'}`}>
                  {d.understaffed ? '⚠ Under' : '✓ OK'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab 2: Weather Outlook ─────────────────────────────────────────────────────

function WeatherOutlookTab() {
  const vfrDays  = WEATHER_FORECAST.filter(w => w.category === 'VFR').length
  const mvfrDays = WEATHER_FORECAST.filter(w => w.category === 'MVFR').length
  const ifrDays  = WEATHER_FORECAST.filter(w => w.category === 'IFR').length
  const avgTemp  = Math.round(WEATHER_FORECAST.reduce((s, w) => s + w.tempC, 0) / 14)

  const wxLineData = WEATHER_FORECAST.map(wx => {
    const date = new Date(wx.date + 'T12:00:00')
    return {
      label:   wx.label,
      wxScore: Math.round(wx.weatherScore * 100),
      ops:     predict(date, wx.weatherScore).mean,
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <KpiTile label="VFR Days"  value={vfrDays}  sub="full operations"    subColor="text-emerald-400" />
        <KpiTile label="MVFR Days" value={mvfrDays} sub="reduced operations" subColor="text-amber-400" />
        <KpiTile label="IFR Days"  value={ifrDays}  sub="significant impact" subColor="text-red-400" />
        <KpiTile label="Avg Temp"  value={avgTemp + '°C'} sub="14-day mean" />
      </div>

      <div className="grid grid-cols-7 gap-2">
        {WEATHER_FORECAST.map(wx => (
          <div key={wx.date}
            className={`bg-surface-card border rounded-lg p-2.5 text-center space-y-1 ${CAT_BG[wx.category]}`}>
            <p className="text-slate-300 text-xs font-semibold">{wx.dow}</p>
            <p className="text-slate-500 text-xs">{wx.date.slice(5)}</p>
            <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded border ${CAT_BG[wx.category]} ${CAT_COLORS[wx.category]}`}>
              {wx.category}
            </span>
            <p className="text-slate-200 text-xs font-mono">{wx.tempC}°C</p>
            <p className="text-slate-400 text-xs">
              {windDirLabel(wx.windDir)} {wx.windKt}{wx.gustKt ? 'G' + wx.gustKt : ''}kt
            </p>
            <p className="text-slate-400 text-xs">
              {wx.visibilitySm < 3 ? wx.visibilitySm + 'SM' : '≥' + Math.min(wx.visibilitySm, 10) + 'SM'}
            </p>
            {wx.ceilingFt && (
              <p className="text-slate-500 text-xs">OVC {String(Math.round(wx.ceilingFt / 100)).padStart(3, '0')}</p>
            )}
            {wx.precip && (
              <p className={`text-xs font-semibold ${wx.precip.includes('TS') ? 'text-purple-400' : 'text-sky-400'}`}>
                {wx.precip}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-4">
        <SectionTitle>Weather Score vs Predicted Operations (14-Day)</SectionTitle>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={wxLineData} margin={{ top: 4, right: 40, left: 24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9 }} />
            <YAxis yAxisId="ops" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis yAxisId="wx" orientation="right" domain={[0, 100]}
              tickFormatter={v => v + '%'} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Line yAxisId="ops" type="monotone" dataKey="ops"
              name="Predicted Ops" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
            <Line yAxisId="wx" type="monotone" dataKey="wxScore"
              name="Weather Score %" stroke="#34d399" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Tab 3: ML Model ─────────────────────────────────────────────────────────────

function MLModelTab() {
  const featureData = FEATURE_NAMES.slice(1).map((name, i) => ({
    name,
    coef: Math.round(MODEL.beta[i + 1] * 100) / 100,
  })).sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef))

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <KpiTile
          label="R² Score"
          value={fmtPct(MODEL.r2 * 100)}
          sub="variance explained"
          subColor={MODEL.r2 > 0.85 ? 'text-emerald-400' : 'text-amber-400'}
        />
        <KpiTile label="RMSE"          value={MODEL.rmse.toFixed(2)} sub="ops ± residual error" />
        <KpiTile label="MAE"           value={MODEL.mae.toFixed(2)}  sub="mean absolute error" />
        <KpiTile label="Training Days" value={MODEL.n}               sub="Apr '25 – Mar '26" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Feature coefficients */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-4">
          <SectionTitle>Feature Coefficients (ops per unit)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={featureData} layout="vertical"
              margin={{ top: 0, right: 40, left: 90, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} width={85} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v + ' ops/unit', 'Coefficient']} />
              <ReferenceLine x={0} stroke="#475569" />
              <Bar dataKey="coef" name="Coefficient" radius={[0, 3, 3, 0]}>
                {featureData.map((d, i) => (
                  <Cell key={i} fill={d.coef >= 0 ? '#34d399' : '#f87171'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Residual scatter */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-4">
          <SectionTitle>Actual vs Fitted — training sample (every 5th day)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 4, right: 8, left: 8, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" dataKey="fitted" name="Fitted" domain={[8, 34]}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                label={{ value: 'Fitted', position: 'insideBottom', offset: -12, fill: '#64748b', fontSize: 11 }} />
              <YAxis type="number" dataKey="actual" name="Actual" domain={[8, 34]}
                tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ strokeDasharray: '3 3' }} />
              <ReferenceLine
                segment={[{ x: 8, y: 8 }, { x: 34, y: 34 }]}
                stroke="#475569" strokeDasharray="4 4" />
              <Scatter data={MODEL.residualSample} fill="#38bdf8" fillOpacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Day-of-week partial effect */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-4">
          <SectionTitle>Day-of-Week Effect (Apr baseline, weather=0.8)</SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={DOW_PARTIAL} margin={{ top: 4, right: 8, left: 24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="dow" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis domain={[10, 32]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v + ' ops', 'Predicted']} />
              <Bar dataKey="predicted" name="Predicted Ops" radius={[3, 3, 0, 0]}>
                {DOW_PARTIAL.map((d, i) => (
                  <Cell key={i}
                    fill={d.predicted >= 22 ? '#f87171' : d.predicted >= 18 ? '#fbbf24' : '#38bdf8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Seasonal effect */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-4">
          <SectionTitle>Seasonal Effect (Wed baseline, weather=0.8)</SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={MONTH_PARTIAL} margin={{ top: 4, right: 8, left: 24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis domain={[10, 32]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v + ' ops', 'Predicted']} />
              <Bar dataKey="predicted" name="Predicted Ops" radius={[3, 3, 0, 0]}>
                {MONTH_PARTIAL.map((d, i) => (
                  <Cell key={i}
                    fill={d.predicted >= 22 ? '#34d399' : d.predicted <= 16 ? '#475569' : '#38bdf8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Model description */}
      <div className="bg-surface-card border border-surface-border rounded-lg p-4 text-xs text-slate-400 space-y-1.5">
        <p className="text-slate-300 font-semibold text-sm mb-2">Model Architecture</p>
        <p><span className="text-sky-400">Algorithm:</span> Ordinary Least Squares (OLS) linear regression with cyclical feature encoding</p>
        <p><span className="text-sky-400">Features:</span> Day-of-week (sin/cos), seasonal month (sin/cos), is_weekend, is_friday, weather_score — 8 total (including intercept)</p>
        <p><span className="text-sky-400">Cyclical encoding:</span> sin/cos transforms preserve circular distance — Dec and Jan are adjacent, not opposite</p>
        <p><span className="text-sky-400">Training:</span> 365 synthetic days (Apr 2025 – Mar 2026), matrix inversion β = (XᵀX)⁻¹Xᵀy, runs at module load</p>
        <p><span className="text-sky-400">Prediction interval:</span> mean ± 1.645 × RMSE (90% coverage)</p>
        <p><span className="text-sky-400">Weather input:</span> VFR=0.95 · MVFR=0.70 · IFR=0.35 · LIFR=0.10 from 14-day forecast</p>
      </div>
    </div>
  )
}

// ── Shared: mini schedule grid for a single department ────────────────────────

function GroupScheduleMini({ dept }) {
  const people = SCHEDULE.filter(p => p.dept === dept)
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr className="border-b border-surface-border">
            <th className="text-left px-3 py-1.5 text-slate-400 font-medium sticky left-0 bg-surface-card w-32">Name</th>
            {DAY_HEADERS.map((h, i) => (
              <th key={h} className={['px-0.5 py-1.5 text-center text-slate-400 font-medium w-9',
                (i === 6 || i === 13) ? 'border-r border-surface-border' : ''].join(' ')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map(person => (
            <tr key={person.id} className="border-t border-surface-border/30 hover:bg-white/5">
              <td className="px-3 py-1 text-slate-200 sticky left-0 bg-surface-card truncate max-w-[128px]">
                {person.name}
              </td>
              {person.shifts.map((shift, di) => {
                const sd = SHIFT_DEFS[shift] ?? SHIFT_DEFS.O
                return (
                  <td key={di} className={['px-0.5 py-0.5 text-center',
                    (di === 6 || di === 13) ? 'border-r border-surface-border' : ''].join(' ')}>
                    {shift !== 'O' ? (
                      <span className={`inline-block px-1 py-0.5 rounded border text-xs font-mono ${sd.color}`}>
                        {shift}
                      </span>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Shared: recommendation list ────────────────────────────────────────────────

function AlertList({ alerts }) {
  if (!alerts.length) return (
    <p className="text-emerald-400 text-xs">✓ No issues detected for this 2-week window.</p>
  )
  return (
    <ul className="space-y-1.5">
      {alerts.map((a, i) => (
        <li key={i} className={`text-xs flex gap-2 items-start ${a.level === 'warn' ? 'text-amber-400' : 'text-red-400'}`}>
          <span className="flex-shrink-0">{a.level === 'warn' ? '⚠' : '✕'}</span>
          <span>{a.text}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Tab 4: Flight Ops group ───────────────────────────────────────────────────

function FlightOpsTab({ demandData }) {
  const totalCrewHrs  = demandData.reduce((s, d) => s + d.group.flightOps.crewHrs, 0)
  const totalCapHrs   = demandData.reduce((s, d) => s + d.deptCap['Flight Ops'], 0)
  const peakDay       = demandData.reduce((a, b) => b.group.flightOps.crewHrs > a.group.flightOps.crewHrs ? b : a)
  const overDays      = demandData.filter(d => d.group.flightOps.crewHrs > d.deptCap['Flight Ops']).length

  const chartData = demandData.map(d => ({
    label:    d.label,
    demand:   d.group.flightOps.crewHrs,
    capacity: d.deptCap['Flight Ops'],
    gap:      Math.max(0, d.group.flightOps.crewHrs - d.deptCap['Flight Ops']),
  }))

  const alerts = [
    { level: 'warn', text: 'prs-005 Carlos Rivera — medical expired, standby only. Does not count toward active PIC capacity.' },
    ...demandData
      .filter(d => d.group.flightOps.crewHrs > d.deptCap['Flight Ops'])
      .map(d => ({ level: 'error', text: `${d.label}: ${d.group.flightOps.crewHrs}hr crew demand exceeds ${d.deptCap['Flight Ops']}hr scheduled capacity.` })),
    ...demandData
      .filter(d => d.category === 'IFR' && d.group.flightOps.ownFlights > 0)
      .map(d => ({ level: 'warn', text: `${d.label}: IFR conditions — expect flight cancellations. Crew available for simulator / ground training.` })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <KpiTile label="14-Day Crew-Hrs Demand" value={totalCrewHrs + 'hr'} sub="own-aircraft ops" />
        <KpiTile label="14-Day Capacity"  value={totalCapHrs + 'hr'}  sub="scheduled crew-hrs" />
        <KpiTile label="Peak Demand Day"  value={peakDay.dow}          sub={peakDay.group.flightOps.crewHrs + 'hr needed'} subColor="text-amber-400" />
        <KpiTile label="Over-Capacity Days" value={overDays}
          sub={overDays ? 'crew-hrs shortfall' : 'all within capacity'}
          subColor={overDays ? 'text-red-400' : 'text-emerald-400'} />
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-4">
        <SectionTitle>Crew-Hours: Predicted Demand vs Scheduled Capacity (14 days)</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [v + 'hr', n]} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar dataKey="demand"   name="Demand (hrs)"   fill="#fbbf24" fillOpacity={0.8} radius={[3,3,0,0]} />
            <Bar dataKey="capacity" name="Capacity (hrs)" fill="#38bdf8" fillOpacity={0.5} radius={[3,3,0,0]} />
            <Line type="monotone" dataKey="gap" name="Shortfall (hrs)" stroke="#f87171" strokeWidth={2}
              dot={false} strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div>
        <SectionTitle>Flight Ops Schedule — 2 Weeks</SectionTitle>
        <GroupScheduleMini dept="Flight Ops" />
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-4">
        <SectionTitle>Recommendations & Alerts</SectionTitle>
        <AlertList alerts={alerts} />
      </div>
    </div>
  )
}

// ── Tab 5: Operations group ───────────────────────────────────────────────────

function OperationsTab({ demandData }) {
  const safetyDays     = demandData.filter(d => d.group.operations.safetyActivated).length
  const totalDispHrs   = demandData.reduce((s, d) => s + d.group.operations.dispatcherHrs, 0)
  const totalCapHrs    = demandData.reduce((s, d) => s + d.deptCap['Operations'], 0)
  const coverageGapDays = demandData.filter(d =>
    d.group.operations.dispatcherHrs + d.group.operations.safetyHrs > d.deptCap['Operations']
  ).length

  const chartData = demandData.map(d => ({
    label:      d.label,
    dispatcher: d.group.operations.dispatcherHrs,
    safety:     d.group.operations.safetyHrs,
    capacity:   d.deptCap['Operations'],
  }))

  const alerts = [
    { level: 'warn', text: 'Operations has only 2 staff (Alex Torres + Jordan Lee). Any absence = single-point-of-failure for dispatcher coverage.' },
    ...demandData.filter(d => d.group.operations.safetyActivated)
      .map(d => ({ level: 'warn', text: `${d.label}: Safety Manager activation — IFR conditions or high ops (${d.mean} ops). Ensure Jordan Lee is available.` })),
    ...demandData.filter(d => d.group.operations.dispatcherHrs + d.group.operations.safetyHrs > d.deptCap['Operations'])
      .map(d => ({ level: 'error', text: `${d.label}: Coverage demand (${d.group.operations.dispatcherHrs + d.group.operations.safetyHrs}hr) exceeds scheduled hours (${d.deptCap['Operations']}hr).` })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <KpiTile label="Total Dispatcher-Hrs" value={totalDispHrs + 'hr'} sub="14-day outlook" />
        <KpiTile label="Safety Activations"   value={safetyDays}
          sub="IFR or >22 ops days" subColor={safetyDays > 2 ? 'text-amber-400' : 'text-slate-500'} />
        <KpiTile label="Coverage Gap Days"    value={coverageGapDays}
          sub={coverageGapDays ? 'demand > scheduled' : 'fully covered'}
          subColor={coverageGapDays ? 'text-red-400' : 'text-emerald-400'} />
        <KpiTile label="Scheduled Capacity"   value={totalCapHrs + 'hr'} sub="dispatcher + safety" />
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-4">
        <SectionTitle>Coverage-Hours: Dispatcher + Safety vs Capacity (14 days)</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [v + 'hr', n]} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar dataKey="dispatcher" name="Dispatcher"  stackId="a" fill="#34d399" fillOpacity={0.85} radius={[0,0,0,0]} />
            <Bar dataKey="safety"     name="Safety Mgr"  stackId="a" fill="#a78bfa" fillOpacity={0.85} radius={[3,3,0,0]} />
            <Line type="monotone" dataKey="capacity" name="Capacity (hrs)" stroke="#38bdf8"
              strokeWidth={2} dot={false} strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div>
        <SectionTitle>Operations Schedule — 2 Weeks</SectionTitle>
        <GroupScheduleMini dept="Operations" />
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-4">
        <SectionTitle>Recommendations & Alerts</SectionTitle>
        <AlertList alerts={alerts} />
      </div>
    </div>
  )
}

// ── Tab 6: Maintenance group ──────────────────────────────────────────────────

function MaintenanceTab({ demandData }) {
  const totalDemand  = demandData.reduce((s, d) => s + d.group.maintenance.total, 0)
  const totalCap     = demandData.reduce((s, d) => s + d.deptCap['Maintenance'], 0)
  const weatherHrs   = demandData.reduce((s, d) => s + d.group.maintenance.weather, 0)
  const overDays     = demandData.filter(d => d.group.maintenance.total > d.deptCap['Maintenance']).length

  const chartData = demandData.map(d => ({
    label:     d.label,
    scheduled: d.group.maintenance.scheduled,
    squawks:   d.group.maintenance.squawks,
    weather:   d.group.maintenance.weather,
    capacity:  d.deptCap['Maintenance'],
  }))

  const alerts = [
    { level: 'warn', text: 'T. Huang (Avionics) is external — available Wed & Thu only. Do not schedule avionics-dependent work on other days.' },
    ...demandData.filter(d => d.group.maintenance.total > d.deptCap['Maintenance'])
      .map(d => ({ level: 'error', text: `${d.label}: Shop demand ${d.group.maintenance.total}hr exceeds capacity ${d.deptCap['Maintenance']}hr. Consider overtime or defer non-critical work.` })),
    ...demandData.filter(d => d.group.maintenance.weather > 0)
      .map(d => ({ level: 'warn', text: `${d.label}: ${d.category} — +${d.group.maintenance.weather}hr weather-driven maintenance expected (preheat, AOG inspections).` })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <KpiTile label="14-Day Shop Demand" value={totalDemand + 'hr'} sub="total mechanic-hrs" />
        <KpiTile label="Scheduled Capacity" value={totalCap + 'hr'}    sub="mechanic-hrs available" />
        <KpiTile label="Weather-Driven Hrs" value={weatherHrs + 'hr'}
          sub="preheat / AOG / inspections" subColor={weatherHrs > 10 ? 'text-amber-400' : 'text-slate-500'} />
        <KpiTile label="Over-Capacity Days" value={overDays}
          sub={overDays ? 'shop-hrs shortfall' : 'all within capacity'}
          subColor={overDays ? 'text-red-400' : 'text-emerald-400'} />
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-4">
        <SectionTitle>Shop-Hours Demand Breakdown vs Capacity (14 days)</SectionTitle>
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [v + 'hr', n]} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar dataKey="scheduled" name="Scheduled"    stackId="d" fill="#fb923c" fillOpacity={0.9} />
            <Bar dataKey="squawks"   name="Squawks"      stackId="d" fill="#fbbf24" fillOpacity={0.9} />
            <Bar dataKey="weather"   name="Weather"      stackId="d" fill="#f87171" fillOpacity={0.9} radius={[3,3,0,0]} />
            <Line type="monotone" dataKey="capacity" name="Capacity (hrs)" stroke="#38bdf8"
              strokeWidth={2} dot={false} strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div>
        <SectionTitle>Maintenance Schedule — 2 Weeks</SectionTitle>
        <GroupScheduleMini dept="Maintenance" />
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-4">
        <SectionTitle>Recommendations & Alerts</SectionTitle>
        <AlertList alerts={alerts} />
      </div>
    </div>
  )
}

// ── Tab 7: FBO group ──────────────────────────────────────────────────────────

function FBOTab({ demandData }) {
  const totalSvcEvents = demandData.reduce((s, d) => s + d.group.fbo.serviceEvents, 0)
  const totalJetA      = demandData.reduce((s, d) => s + d.group.fbo.jetAGal, 0)
  const totalAvgas     = demandData.reduce((s, d) => s + d.group.fbo.avgasGal, 0)
  const overDays       = demandData.filter(d => d.group.fbo.hrsNeeded > d.deptCap['FBO']).length
  const peakDay        = demandData.reduce((a, b) => b.group.fbo.serviceEvents > a.group.fbo.serviceEvents ? b : a)

  const chartData = demandData.map(d => ({
    label:    d.label,
    services: d.group.fbo.serviceEvents,
    hrsNeeded: d.group.fbo.hrsNeeded,
    capacity: d.deptCap['FBO'],
  }))

  const fuelData = demandData.map(d => ({
    label:  d.label,
    'Jet-A':  d.group.fbo.jetAGal,
    'Avgas':  d.group.fbo.avgasGal,
  }))

  const alerts = [
    { level: 'warn', text: 'Devon Park (1yr exp) — HIGH fuel confusion risk on Jet-A turboprop fueling. Requires Jordan Kim co-sign per DEFCON policy.' },
    ...demandData.filter(d => d.group.fbo.hrsNeeded > d.deptCap['FBO'])
      .map(d => ({ level: 'error', text: `${d.label}: FBO demand ${d.group.fbo.hrsNeeded}hr exceeds scheduled capacity ${d.deptCap['FBO']}hr — ${d.group.fbo.serviceEvents} service events predicted.` })),
    ...demandData.filter(d => d.category !== 'VFR' && d.group.fbo.serviceEvents > 0)
      .map(d => ({ level: 'warn', text: `${d.label}: ${d.category} — reduced arrivals but fueling/preheat complexity increases. Allocate extra time per service.` })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <KpiTile label="Total Service Events" value={totalSvcEvents} sub="14-day outlook" />
        <KpiTile label="Peak Day" value={peakDay.dow}
          sub={peakDay.group.fbo.serviceEvents + ' events'} subColor="text-amber-400" />
        <KpiTile label="Jet-A Forecast" value={Math.round(totalJetA / 1000) + 'k gal'}
          sub="14-day turbine fuel" subColor="text-sky-400" />
        <KpiTile label="Avgas Forecast" value={Math.round(totalAvgas / 1000) + 'k gal'}
          sub="14-day piston fuel" subColor="text-emerald-400" />
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-4">
        <SectionTitle>Service Events vs FBO Staff Capacity (14 days)</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis yAxisId="svc" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis yAxisId="hrs" orientation="right" tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={v => v + 'hr'} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar yAxisId="svc" dataKey="services" name="Service Events" fill="#a78bfa" fillOpacity={0.8} radius={[3,3,0,0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.services > 14 ? '#f87171' : d.services > 10 ? '#fbbf24' : '#a78bfa'} />
              ))}
            </Bar>
            <Line yAxisId="hrs" type="monotone" dataKey="hrsNeeded" name="Hrs Needed"
              stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
            <Line yAxisId="hrs" type="monotone" dataKey="capacity" name="Capacity (hrs)"
              stroke="#38bdf8" strokeWidth={2} dot={false} strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-4">
        <SectionTitle>Predicted Fuel Volume by Type (14 days)</SectionTitle>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={fuelData} margin={{ top: 2, right: 8, left: 40, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tickFormatter={v => v + 'gal'} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [v + ' gal', n]} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar dataKey="Jet-A" stackId="f" fill="#38bdf8" fillOpacity={0.85} />
            <Bar dataKey="Avgas" stackId="f" fill="#34d399" fillOpacity={0.85} radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <SectionTitle>FBO Schedule — 2 Weeks</SectionTitle>
        <GroupScheduleMini dept="FBO" />
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-4">
        <SectionTitle>Recommendations & Alerts</SectionTitle>
        <AlertList alerts={alerts} />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Management() {
  const [tab, setTab] = useState(0)
  const demandData = useDemandData()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-slate-100 font-semibold text-lg">Operations Management</h1>
        <p className="text-slate-500 text-xs mt-0.5">2-Week Resource Planning · Mar 30 – Apr 12, 2026</p>
      </div>

      <TabBar
        tabs={['Schedule', 'Demand Forecast', 'Weather Outlook', 'ML Model',
               'Flight Ops', 'Operations', 'Maintenance', 'FBO']}
        active={tab}
        onChange={setTab}
      />

      {tab === 0 && <ScheduleTab demandData={demandData} />}
      {tab === 1 && <DemandForecastTab demandData={demandData} />}
      {tab === 2 && <WeatherOutlookTab />}
      {tab === 3 && <MLModelTab />}
      {tab === 4 && <FlightOpsTab demandData={demandData} />}
      {tab === 5 && <OperationsTab demandData={demandData} />}
      {tab === 6 && <MaintenanceTab demandData={demandData} />}
      {tab === 7 && <FBOTab demandData={demandData} />}
    </div>
  )
}
