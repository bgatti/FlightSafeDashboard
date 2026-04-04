import { useState, useEffect } from 'react'
import { getClients, upsertClient, subscribeClients } from '../store/clients'
import { addSquawk } from '../store/squawks'
import { addServiceRequest } from '../store/serviceRequests'

const FBO_CATEGORIES = [
  { value: 'glider',          label: 'Glider' },
  { value: 'piston_single',   label: 'Piston Single' },
  { value: 'piston_twin',     label: 'Piston Twin' },
  { value: 'turboprop_single', label: 'Turboprop Single' },
  { value: 'turboprop_twin',  label: 'Turboprop Twin' },
  { value: 'jet_light',       label: 'Light Jet' },
  { value: 'jet_midsize',     label: 'Midsize Jet' },
  { value: 'jet_heavy',       label: 'Heavy Jet' },
]

const FUEL_TYPES = [
  { value: '',             label: 'None / N/A' },
  { value: 'avgas_100ll',  label: 'Avgas 100LL' },
  { value: 'jet_a',        label: 'Jet-A' },
  { value: 'mogas',        label: 'Mogas' },
]

const SERVICE_TYPES = [
  { value: 'fueling',          label: 'Fueling' },
  { value: 'tie_down',         label: 'Tie-Down' },
  { value: 'hangaring',        label: 'Hangaring' },
  { value: 'tow',              label: 'Repositioning / Tow' },
  { value: 'preheat',          label: 'Engine Pre-Heat' },
  { value: 'gpu',              label: 'Ground Power (GPU)' },
  { value: 'oxygen_service',   label: 'O\u2082 Service' },
  { value: 'cleaning',         label: 'Cleaning / Detail' },
  { value: 'lavatory_service', label: 'Lavatory Service' },
  { value: 'catering',         label: 'Catering' },
  { value: 'transportation',   label: 'Transportation' },
]

export function Clients() {
  const [clients, setClients] = useState(getClients)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const unsub = subscribeClients(setClients)
    return unsub
  }, [])

  const filtered = clients.filter((c) => {
    if (filter === 'glider')  return c.fboCategory === 'glider'
    if (filter === 'powered') return c.fboCategory !== 'glider'
    if (filter === 'based')   return c.basedHere
    return true
  })

  const based     = filtered.filter((c) => c.basedHere)
  const transient = filtered.filter((c) => !c.basedHere)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">Client Aircraft</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-[10px] px-3 py-1 rounded border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Aircraft'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {[
          { key: 'all',     label: `All (${clients.length})` },
          { key: 'glider',  label: `Gliders (${clients.filter((c) => c.fboCategory === 'glider').length})` },
          { key: 'powered', label: `Powered (${clients.filter((c) => c.fboCategory !== 'glider').length})` },
          { key: 'based',   label: `Based (${clients.filter((c) => c.basedHere).length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              filter === key
                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showForm && <AddClientForm onDone={() => setShowForm(false)} />}

      {based.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Based Aircraft</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {based.map((c) => <ClientCard key={c.id} c={c} />)}
          </div>
        </div>
      )}

      {transient.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Transient / Visiting</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {transient.map((c) => <ClientCard key={c.id} c={c} />)}
          </div>
        </div>
      )}

      {filtered.length === 0 && !showForm && (
        <p className="text-sm text-slate-500 italic">No client aircraft match the current filter.</p>
      )}
    </div>
  )
}

// ─── Add Client Form ──────────────────────────────────────────────────────────

function AddClientForm({ onDone }) {
  const [tail, setTail]           = useState('')
  const [ownerName, setOwner]     = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [makeModel, setMake]      = useState('')
  const [icaoType, setIcao]       = useState('')
  const [fboCategory, setCat]     = useState('glider')
  const [fuelType, setFuel]       = useState('')
  const [basedHere, setBased]     = useState(false)
  const [notes, setNotes]         = useState('')

  function handleSubmit() {
    if (!tail.trim()) return
    upsertClient({
      tailNumber: tail, ownerName: ownerName || null,
      phone: phone || null, email: email || null,
      makeModel: makeModel || null, icaoType: icaoType || null,
      fboCategory, fuelType: fuelType || null, basedHere, notes: notes || null,
    })
    onDone()
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-400 uppercase">Tail Number *</label>
          <input value={tail} onChange={(e) => setTail(e.target.value.toUpperCase())}
            placeholder="N1234G" className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-400 uppercase">Owner / Operator</label>
          <input value={ownerName} onChange={(e) => setOwner(e.target.value)}
            placeholder="Last, First" className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-400 uppercase">Make / Model</label>
          <input value={makeModel} onChange={(e) => setMake(e.target.value)}
            placeholder="Schweizer SGS 2-33A" className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-400 uppercase">ICAO Type</label>
          <input value={icaoType} onChange={(e) => setIcao(e.target.value.toUpperCase())}
            placeholder="S33" className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600 w-24" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-400 uppercase">Category</label>
          <select value={fboCategory} onChange={(e) => setCat(e.target.value)}
            className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none">
            {FBO_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-400 uppercase">Fuel Type</label>
          <select value={fuelType} onChange={(e) => setFuel(e.target.value)}
            className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none">
            {FUEL_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-400 uppercase">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="(303) 555-0100" className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-400 uppercase">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="pilot@example.com" className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600" />
        </div>
        <div className="flex flex-col gap-1 justify-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={basedHere} onChange={(e) => setBased(e.target.checked)} className="accent-sky-500" />
            <span className="text-xs text-slate-300">Based here</span>
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-slate-400 uppercase">Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Hangar 3, preferred fuel truck access from south..."
          className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600" />
      </div>
      <button onClick={handleSubmit} disabled={!tail.trim()}
        className="self-start text-xs px-4 py-1.5 rounded border border-sky-500/50 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 transition-colors disabled:opacity-40">
        Save Aircraft
      </button>
    </div>
  )
}

// ─── Client Card ──────────────────────────────────────────────────────────────

function ClientCard({ c }) {
  const [showSquawk, setShowSquawk]     = useState(false)
  const [showService, setShowService]   = useState(false)
  const fuelLabel = FUEL_TYPES.find((f) => f.value === c.fuelType)?.label
  const catLabel  = FBO_CATEGORIES.find((f) => f.value === c.fboCategory)?.label

  return (
    <div className="bg-surface-card border border-surface-border rounded-lg px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-mono font-bold text-slate-100">{c.tailNumber}</span>
        {c.basedHere && <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-medium">BASED</span>}
      </div>
      {c.makeModel && <div className="text-xs text-slate-400">{c.makeModel}</div>}
      {c.ownerName && <div className="text-xs text-slate-300">{c.ownerName}</div>}
      <div className="flex gap-2 flex-wrap text-[10px] text-slate-500 mt-0.5">
        {catLabel && <span>{catLabel}</span>}
        {fuelLabel && <span>· {fuelLabel}</span>}
        {c.icaoType && <span>· {c.icaoType}</span>}
      </div>
      {(c.phone || c.email) && (
        <div className="text-[10px] text-slate-500 mt-0.5">
          {c.phone}{c.phone && c.email && ' · '}{c.email}
        </div>
      )}
      {c.notes && <div className="text-[10px] text-slate-600 italic mt-0.5">{c.notes}</div>}
      {c.lastSeen && <div className="text-[9px] text-slate-600 mt-0.5">Last seen {c.lastSeen.split('T')[0]}</div>}

      {/* Action buttons */}
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={() => { setShowSquawk(!showSquawk); setShowService(false) }}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
            showSquawk
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
              : 'border-surface-border text-slate-500 hover:text-amber-400 hover:border-amber-500/30'
          }`}
        >
          Report Squawk
        </button>
        <button
          onClick={() => { setShowService(!showService); setShowSquawk(false) }}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
            showService
              ? 'border-sky-500/50 bg-sky-500/15 text-sky-400'
              : 'border-surface-border text-slate-500 hover:text-sky-400 hover:border-sky-500/30'
          }`}
        >
          Request Service
        </button>
      </div>

      {showSquawk && <ClientSquawkForm client={c} onDone={() => setShowSquawk(false)} />}
      {showService && <ClientServiceForm client={c} onDone={() => setShowService(false)} />}
    </div>
  )
}

// ─── Squawk Form (for client aircraft) ────────────────────────────────────────

function ClientSquawkForm({ client, onDone }) {
  const [reportedBy, setReportedBy]   = useState(client.ownerName || '')
  const [description, setDescription] = useState('')
  const [grounding, setGrounding]     = useState(false)

  function handleSubmit() {
    if (!description.trim()) return
    addSquawk({
      id:               `sqk-cli-${Date.now()}`,
      tailNumber:       client.tailNumber,
      aircraftId:       null,
      reportedBy:       reportedBy || client.ownerName || '—',
      reportedDate:     new Date().toISOString().split('T')[0],
      reportedAt:       new Date().toISOString(),
      description:      description.trim(),
      severity:         grounding ? 'grounding' : 'monitoring',
      status:           'open',
      melReference:     null,
      melExpiryDate:    null,
      airframeHours:    null,
      resolvedDate:     null,
      resolvedBy:       null,
      resolutionNotes:  null,
      workOrderId:      null,
    })
    onDone()
  }

  return (
    <div className="flex flex-col gap-2 mt-1 p-2 rounded border border-amber-500/30 bg-amber-500/5">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-slate-400 uppercase">Reported By</label>
        <input
          value={reportedBy}
          onChange={(e) => setReportedBy(e.target.value)}
          placeholder="Owner / reporter name"
          className="bg-surface-card border border-surface-border rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-600"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-slate-400 uppercase">Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Describe the discrepancy..."
          className="bg-surface-card border border-surface-border rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-600 resize-none"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={grounding} onChange={(e) => setGrounding(e.target.checked)} className="accent-red-500" />
        <span className="text-[10px] text-red-400 font-medium">GROUND this aircraft</span>
      </label>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!description.trim()}
          className="text-[10px] px-3 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
        >
          Submit Squawk
        </button>
        <button onClick={onDone} className="text-[10px] px-3 py-1 text-slate-500 hover:text-slate-300 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Service Request Form (for client aircraft) ──────────────────────────────

function ClientServiceForm({ client, onDone }) {
  const defaultService = 'fueling'
  const [serviceType, setServiceType] = useState(defaultService)
  const [fuelType, setFuelType]       = useState(client.fuelType || '')
  const [notes, setNotes]             = useState('')

  function handleSubmit() {
    addServiceRequest({
      id:             `svc-cli-${Date.now()}`,
      tailNumber:     client.tailNumber,
      serviceType,
      fuelType:       serviceType === 'fueling' ? (fuelType || null) : null,
      fuelQuantityGal: null,
      assignedTo:     null,
      weatherCondition: null,
      status:         'pending',
      priority:       'normal',
      requestedAt:    new Date().toISOString(),
      requestedBy:    client.ownerName || null,
      completedAt:    null,
      fee:            null,
      crossModule:    null,
      crossModuleRef: null,
      notes:          notes || null,
    })
    onDone()
  }

  const serviceLabel = SERVICE_TYPES.find((s) => s.value === serviceType)?.label || serviceType

  return (
    <div className="flex flex-col gap-2 mt-1 p-2 rounded border border-sky-500/30 bg-sky-500/5">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-slate-400 uppercase">Service</label>
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
          className="bg-surface-card border border-surface-border rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          {SERVICE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      {serviceType === 'fueling' && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-400 uppercase">Fuel Type</label>
          <select
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value)}
            className="bg-surface-card border border-surface-border rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {FUEL_TYPES.filter((f) => f.value).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-slate-400 uppercase">Notes</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={serviceType === 'fueling' ? 'e.g. Top-off, tabs only...' : `Notes for ${serviceLabel}...`}
          className="bg-surface-card border border-surface-border rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-600"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          className="text-[10px] px-3 py-1 rounded border border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors"
        >
          Submit Request
        </button>
        <button onClick={onDone} className="text-[10px] px-3 py-1 text-slate-500 hover:text-slate-300 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
