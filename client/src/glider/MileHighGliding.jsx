import { useState, useEffect, useRef } from 'react'
import {
  MHG_INFO, MHG_FLEET, MHG_TOW_PLANES, MHG_FLIGHTS, MHG_INSTRUCTION,
  MHG_STAFF, MHG_TOW_FEES, MHG_RESTRICTIONS, MHG_GALLERY, getTodayOps,
} from './mhgData'

/* ═══════════════════════════════════════════════════════════
   Mile High Gliding — Full-Screen Client-Facing Portal
   ═══════════════════════════════════════════════════════════ */

const fmt$ = (n) => n != null ? `$${n}` : 'Call'
const STATUS_COLOR = {
  airworthy:   { bg: 'bg-green-400/15', border: 'border-green-400/30', text: 'text-green-400', dot: 'bg-green-400', label: 'Airworthy' },
  maintenance: { bg: 'bg-amber-400/15', border: 'border-amber-400/30', text: 'text-amber-400', dot: 'bg-amber-400', label: 'In Maintenance' },
  grounded:    { bg: 'bg-red-400/15',   border: 'border-red-400/30',   text: 'text-red-400',   dot: 'bg-red-400',   label: 'Grounded' },
}

/* ─── VIDEO BACKGROUND ─── */
// MHG_Clip from milehighgliding.com — Cloudflare Stream (19.9s loop, ~10MB)
const MHG_VIDEO_HLS = 'https://customer-ugajlzvkncemhxjh.cloudflarestream.com/f16266e9fbc601a0ee1cdbe675471316/manifest/video.m3u8'
const MHG_VIDEO_DASH = 'https://customer-ugajlzvkncemhxjh.cloudflarestream.com/f16266e9fbc601a0ee1cdbe675471316/manifest/video.mpd'
const MHG_VIDEO_THUMB = 'https://customer-ugajlzvkncemhxjh.cloudflarestream.com/f16266e9fbc601a0ee1cdbe675471316/thumbnails/thumbnail.jpg'

function VideoBackground() {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    // Try HLS native (Safari) or fallback — Cloudflare Stream also serves
    // progressive MP4 at the watch URL, but HLS/DASH are preferred
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = MHG_VIDEO_HLS
    } else {
      // Most browsers: try loading HLS via native or just use the stream iframe fallback
      video.src = MHG_VIDEO_HLS
    }
    video.play().catch(() => {})
  }, [])

  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay muted loop playsInline
        poster={MHG_VIDEO_THUMB}
      />
      {/* Fallback for browsers that can't play HLS natively — use Cloudflare Stream iframe */}
      <iframe
        src={`https://customer-ugajlzvkncemhxjh.cloudflarestream.com/f16266e9fbc601a0ee1cdbe675471316/iframe?muted=true&loop=true&autoplay=true&controls=false&poster=${encodeURIComponent(MHG_VIDEO_THUMB)}`}
        className="absolute inset-0 w-full h-full border-0 pointer-events-none"
        style={{ minWidth: '100%', minHeight: '100%' }}
        allow="autoplay; fullscreen"
        loading="lazy"
      />
    </>
  )
}

/* ─── TOP NAV ─── */
function TopNav({ onLogin, loggedIn, onLogout, onSection }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <span className="text-white font-bold text-lg tracking-tight">Mile High Gliding</span>
          <div className="hidden md:flex items-center gap-4">
            {['flights', 'fleet', 'instruction', 'operations', 'gallery', 'leaderboard'].map((s) => (
              <button key={s} onClick={() => onSection(s)} className="text-white/70 hover:text-white text-xs uppercase tracking-wide transition-colors capitalize">{s}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href={`tel:${MHG_INFO.phone.replace(/[^\d]/g, '')}`} className="text-white/70 hover:text-white text-xs transition-colors hidden sm:block">
            {MHG_INFO.phone}
          </a>
          {loggedIn ? (
            <div className="flex items-center gap-2">
              <span className="text-sky-300 text-xs">Welcome back</span>
              <button onClick={onLogout} className="text-white/60 hover:text-white text-xs underline">Sign out</button>
            </div>
          ) : (
            <button onClick={onLogin} className="bg-white/10 hover:bg-white/20 text-white text-xs px-4 py-1.5 rounded-lg border border-white/20 transition-all">
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

/* ─── LOGIN MODAL ─── */
function LoginModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const handleSubmit = (e) => { e.preventDefault(); onSuccess(email) }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white mb-1">Welcome Back</h3>
        <p className="text-slate-400 text-xs mb-5">Students & club members — sign in to reserve aircraft and view your log</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
          <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
          <button type="submit" className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">Sign In</button>
        </form>
        <p className="text-slate-500 text-[10px] text-center mt-3">New? Call {MHG_INFO.phone} to create an account</p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   PROGRESSIVE BOOKING FUNNEL
   Step 1 → Pick a package + leave contact
   Step 2 → Group size + preferred date
   Step 3 → Choose a time slot + pay
   ═══════════════════════════════════════════════════════════ */

const PACKAGES = [
  {
    id: 'boulder-view',
    name: 'Boulder View',
    price: 175,
    tagline: 'A bird\'s-eye tour of Boulder',
    duration: '~15 min',
    altitude: '8,000 ft',
    description: 'Glide over CU campus, downtown Boulder, and the Foothills. The perfect intro to silent flight.',
    gradient: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'mile-high',
    name: 'Mile High Flight',
    price: 300,
    tagline: 'Our most popular experience',
    duration: '~30 min',
    altitude: '10,600 ft',
    description: 'Soar along the Continental Divide with Longs Peak, the Flatirons, and Indian Peaks in full panoramic view.',
    gradient: 'from-sky-500 to-indigo-600',
    popular: true,
  },
  {
    id: 'adventure',
    name: 'Adventure Flight',
    price: 500,
    tagline: 'The ultimate Rocky Mountain soaring',
    duration: '~45 min+',
    altitude: 'Custom',
    description: 'A bespoke soaring experience tailored to you — aerobatics optional, extended duration, peak immersion.',
    gradient: 'from-indigo-500 to-purple-600',
  },
]

function BookingFunnel({ initialPackage, onClose }) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState({
    package: initialPackage || '',
    contact: '',    // email or phone
    contactType: 'email',
    groupSize: 1,
    dateChoice: '',
    specificDate: '',
    timeSlot: '',
  })
  const [confirmed, setConfirmed] = useState(false)

  const set = (k) => (v) => setData((d) => ({ ...d, [k]: typeof v === 'object' && v.target ? v.target.value : v }))

  // Save to localStorage as lead progresses
  const saveLead = (stepNum) => {
    const leads = JSON.parse(localStorage.getItem('mhg_leads') || '[]')
    leads.push({ ...data, step: stepNum, ts: new Date().toISOString() })
    localStorage.setItem('mhg_leads', JSON.stringify(leads))
  }

  const handleStep1 = (e) => { e.preventDefault(); saveLead(1); setStep(2) }
  const handleStep2 = (e) => { e.preventDefault(); saveLead(2); setStep(3) }
  const handleStep3 = (e) => { e.preventDefault(); saveLead(3); setConfirmed(true) }

  // Generate fake available slots
  const generateSlots = () => {
    const slots = []
    const times = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '12:00 PM', '12:30 PM', '1:00 PM', '2:00 PM', '3:00 PM']
    times.forEach((t) => {
      const avail = Math.random() > 0.3
      slots.push({ time: t, available: avail, condition: t < '11:30' ? 'Smooth air' : 'Thermals likely' })
    })
    return slots
  }
  const slots = useRef(generateSlots()).current

  if (confirmed) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
        <div className="bg-surface-card border border-surface-border rounded-2xl p-10 w-full max-w-md mx-4 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-white mb-2">You're Booked!</h3>
          <p className="text-slate-300 text-sm mb-1">
            <strong>{PACKAGES.find((p) => p.id === data.package)?.name || 'Flight'}</strong> for {data.groupSize} {data.groupSize > 1 ? 'people' : 'person'}
          </p>
          <p className="text-slate-400 text-xs mb-4">{data.timeSlot} · Confirmation sent to {data.contact}</p>
          <p className="text-sky-400 text-sm font-medium mb-6">Payment collected after your flight — no upfront charge</p>
          <button onClick={onClose} className="bg-sky-500 hover:bg-sky-400 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                s <= step ? 'bg-sky-500 text-white' : 'bg-white/10 text-white/40'
              }`}>{s}</div>
              {s < 3 && <div className={`w-12 h-0.5 ${s < step ? 'bg-sky-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Choose package + contact ── */}
        {step === 1 && (
          <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl overflow-hidden shadow-2xl">
            {/* Step image */}
            <div className="relative h-40 bg-gradient-to-r from-sky-700 via-blue-600 to-indigo-700 overflow-hidden">
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-6 left-[15%] w-40 h-12 bg-white/40 rounded-full blur-2xl animate-[drift_20s_linear_infinite]" />
                <div className="absolute top-12 right-[20%] w-56 h-14 bg-white/25 rounded-full blur-3xl animate-[drift_30s_linear_infinite_reverse]" />
              </div>
              <svg className="absolute bottom-0 w-full" viewBox="0 0 800 100" preserveAspectRatio="none">
                <path d="M0,100L0,60L100,45L200,55L300,25L400,40L500,20L600,35L700,30L800,50L800,100Z" fill="rgba(15,23,42,0.7)"/>
              </svg>
              <div className="relative z-10 flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-white/60 text-xs uppercase tracking-[0.3em]">Step 1 of 3</div>
                  <h3 className="text-white text-2xl font-bold mt-1">Choose Your Flight</h3>
                </div>
              </div>
            </div>

            <form onSubmit={handleStep1} className="p-6 space-y-5">
              {/* Package cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PACKAGES.map((pkg) => (
                  <button type="button" key={pkg.id} onClick={() => set('package')(pkg.id)}
                    className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                      data.package === pkg.id
                        ? 'border-sky-400 bg-sky-400/10 ring-2 ring-sky-400/20'
                        : 'border-surface-border hover:border-slate-500 bg-surface'
                    }`}>
                    {pkg.popular && <div className="absolute -top-2 right-3 bg-sky-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">POPULAR</div>}
                    <div className="text-white font-bold text-sm">{pkg.name}</div>
                    <div className="text-sky-400 font-bold text-lg mt-0.5">{fmt$(pkg.price)}</div>
                    <div className="text-slate-400 text-[10px] mt-1">{pkg.duration} · {pkg.altitude}</div>
                    <div className="text-slate-500 text-[10px] mt-1 leading-relaxed">{pkg.tagline}</div>
                  </button>
                ))}
              </div>

              {/* Contact capture */}
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">How should we reach you?</label>
                <div className="flex gap-2">
                  <select value={data.contactType} onChange={set('contactType')}
                    className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none w-28">
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                  </select>
                  <input
                    type={data.contactType === 'email' ? 'email' : 'tel'}
                    required
                    placeholder={data.contactType === 'email' ? 'you@email.com' : '(303) 555-0123'}
                    value={data.contact}
                    onChange={set('contact')}
                    className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>

              <button type="submit" disabled={!data.package || !data.contact}
                className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                Continue →
              </button>
              <button type="button" onClick={onClose} className="w-full text-slate-500 hover:text-slate-300 text-xs py-1 transition-colors">Cancel</button>
            </form>
          </div>
        )}

        {/* ── STEP 2: Group size + date ── */}
        {step === 2 && (
          <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl overflow-hidden shadow-2xl">
            <div className="relative h-40 bg-gradient-to-r from-amber-600 via-orange-500 to-rose-600 overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-4 left-[20%] w-36 h-10 bg-white/40 rounded-full blur-2xl" />
                <div className="absolute top-14 right-[15%] w-48 h-12 bg-white/30 rounded-full blur-3xl" />
              </div>
              <svg className="absolute bottom-0 w-full" viewBox="0 0 800 80" preserveAspectRatio="none">
                <path d="M0,80L0,50L150,35L300,45L450,25L600,40L750,30L800,40L800,80Z" fill="rgba(15,23,42,0.7)"/>
              </svg>
              <div className="relative z-10 flex items-center justify-center h-full text-center">
                <div>
                  <div className="text-white/60 text-xs uppercase tracking-[0.3em]">Step 2 of 3</div>
                  <h3 className="text-white text-2xl font-bold mt-1">Who & When</h3>
                  <p className="text-white/70 text-xs mt-1">{PACKAGES.find((p) => p.id === data.package)?.name} · {fmt$(PACKAGES.find((p) => p.id === data.package)?.price)}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleStep2} className="p-6 space-y-5">
              {/* Group size */}
              <div>
                <label className="text-slate-400 text-xs block mb-2">How many people in your group?</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, '6+'].map((n) => (
                    <button type="button" key={n} onClick={() => set('groupSize')(n)}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                        data.groupSize === n ? 'bg-sky-500 text-white ring-2 ring-sky-400/30' : 'bg-surface border border-surface-border text-slate-300 hover:border-slate-500'
                      }`}>
                      {n}
                    </button>
                  ))}
                </div>
                {typeof data.groupSize === 'number' && data.groupSize > 2 && (
                  <p className="text-slate-500 text-[10px] mt-1.5">Groups of 3+ fly in rotation — each person gets their own cockpit experience</p>
                )}
              </div>

              {/* Date preference */}
              <div>
                <label className="text-slate-400 text-xs block mb-2">When would you like to fly?</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {[
                    { id: 'today', label: 'Today', sub: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) },
                    { id: 'tomorrow', label: 'Tomorrow', sub: new Date(Date.now() + 86400000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) },
                    { id: 'this-week', label: 'This Week', sub: 'Flexible' },
                    { id: 'pick-date', label: 'Pick a Date', sub: 'Calendar' },
                  ].map((opt) => (
                    <button type="button" key={opt.id} onClick={() => set('dateChoice')(opt.id)}
                      className={`p-3 rounded-xl text-center transition-all ${
                        data.dateChoice === opt.id ? 'bg-sky-500 text-white ring-2 ring-sky-400/30' : 'bg-surface border border-surface-border text-slate-300 hover:border-slate-500'
                      }`}>
                      <div className="text-sm font-semibold">{opt.label}</div>
                      <div className={`text-[10px] mt-0.5 ${data.dateChoice === opt.id ? 'text-sky-100' : 'text-slate-500'}`}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
                {data.dateChoice === 'pick-date' && (
                  <input type="date" value={data.specificDate} onChange={set('specificDate')} required
                    className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none" />
                )}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 border border-surface-border text-slate-300 hover:text-white py-3 rounded-xl text-sm transition-colors">← Back</button>
                <button type="submit" disabled={!data.dateChoice}
                  className="flex-[2] bg-sky-500 hover:bg-sky-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                  See Available Slots →
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP 3: Time slot + confirm ── */}
        {step === 3 && (
          <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl overflow-hidden shadow-2xl">
            <div className="relative h-40 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-6 left-[25%] w-44 h-12 bg-white/40 rounded-full blur-2xl" />
              </div>
              <svg className="absolute bottom-0 w-full" viewBox="0 0 800 80" preserveAspectRatio="none">
                <path d="M0,80L0,55L200,40L400,50L600,30L800,45L800,80Z" fill="rgba(15,23,42,0.7)"/>
              </svg>
              <div className="relative z-10 flex items-center justify-center h-full text-center">
                <div>
                  <div className="text-white/60 text-xs uppercase tracking-[0.3em]">Step 3 of 3</div>
                  <h3 className="text-white text-2xl font-bold mt-1">Pick Your Time</h3>
                  <p className="text-white/70 text-xs mt-1">{data.groupSize} {typeof data.groupSize === 'number' && data.groupSize > 1 ? 'people' : 'person'} · {data.dateChoice === 'pick-date' ? data.specificDate : data.dateChoice}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleStep3} className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button type="button" key={slot.time}
                    disabled={!slot.available}
                    onClick={() => set('timeSlot')(slot.time)}
                    className={`p-3 rounded-xl text-center transition-all ${
                      !slot.available
                        ? 'bg-surface border border-surface-border text-slate-600 cursor-not-allowed line-through'
                        : data.timeSlot === slot.time
                          ? 'bg-sky-500 text-white ring-2 ring-sky-400/30'
                          : 'bg-surface border border-surface-border text-slate-300 hover:border-sky-400/50 cursor-pointer'
                    }`}>
                    <div className="text-sm font-semibold">{slot.time}</div>
                    <div className={`text-[10px] mt-0.5 ${data.timeSlot === slot.time ? 'text-sky-100' : 'text-slate-500'}`}>
                      {slot.available ? slot.condition : 'Booked'}
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-surface border border-surface-border rounded-xl p-4">
                <h4 className="text-white text-sm font-semibold mb-2">Booking Summary</h4>
                <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                  <span className="text-slate-400">Flight</span><span className="text-slate-200">{PACKAGES.find((p) => p.id === data.package)?.name}</span>
                  <span className="text-slate-400">Group</span><span className="text-slate-200">{data.groupSize} {typeof data.groupSize === 'number' && data.groupSize > 1 ? 'people' : 'person'}</span>
                  <span className="text-slate-400">When</span><span className="text-slate-200">{data.timeSlot || '—'}</span>
                  <span className="text-slate-400">Contact</span><span className="text-slate-200">{data.contact}</span>
                  <span className="text-slate-400">Price</span><span className="text-sky-400 font-bold">{fmt$(PACKAGES.find((p) => p.id === data.package)?.price)}/person</span>
                </div>
                <p className="text-slate-500 text-[10px] mt-3">Payment collected after your flight — not at booking. Free rescheduling for weather.</p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="flex-1 border border-surface-border text-slate-300 hover:text-white py-3 rounded-xl text-sm transition-colors">← Back</button>
                <button type="submit" disabled={!data.timeSlot}
                  className="flex-[2] bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                  Confirm Booking ✓
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── HERO SECTION ─── */
function HeroSection({ onBook }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center">
      <VideoBackground />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
      <div className="relative z-10 text-center px-6 max-w-3xl">
        <div className="text-sky-300/80 text-xs uppercase tracking-[0.4em] mb-3">Boulder, Colorado · Est. 1998</div>
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight leading-[1.1]">
          Soar the<br />Rocky Mountains
        </h1>
        <p className="text-white/70 text-lg md:text-xl mb-8 max-w-xl mx-auto leading-relaxed">
          Silent flight over the Continental Divide. Scenic rides, flight instruction, and the freedom of engineless aviation.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={() => onBook('mile-high')}
            className="bg-sky-500 hover:bg-sky-400 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-xl shadow-sky-500/25 hover:shadow-sky-400/30 hover:scale-105">
            Book a Discovery Flight — $245
          </button>
          <a href={`tel:${MHG_INFO.phone.replace(/[^\d]/g, '')}`}
            className="border-2 border-white/30 hover:border-white/60 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all backdrop-blur-sm hover:bg-white/10">
            Call {MHG_INFO.phone}
          </a>
        </div>
        <div className="mt-8 flex flex-wrap gap-6 justify-center text-white/50 text-xs">
          <span>✈️ Rides from $175</span>
          <span>🏔️ Up to 10,600 ft</span>
          <span>🎓 Flight instruction</span>
          <span>📅 Year-round</span>
        </div>
      </div>
      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/40">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
      </div>
    </section>
  )
}

/* ─── PACKAGES SECTION ─── */
function PackagesSection({ onBook }) {
  return (
    <section id="sec-flights" className="py-20 px-6 bg-gradient-to-b from-surface via-surface-card/50 to-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Scenic Flights</h2>
          <p className="text-slate-400 max-w-lg mx-auto">Every flight departs from Boulder Municipal Airport with views of the Flatirons, Continental Divide, and Rocky Mountain National Park.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MHG_FLIGHTS.map((fl) => (
            <div key={fl.id} className={`relative bg-surface-card border rounded-2xl p-6 transition-all hover:scale-[1.02] hover:shadow-xl ${
              fl.popular ? 'border-sky-400/50 ring-1 ring-sky-400/20' : fl.featured ? 'border-amber-400/50 ring-1 ring-amber-400/20' : 'border-surface-border'
            }`}>
              {fl.popular && <div className="absolute -top-3 left-5 bg-sky-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">MOST POPULAR</div>}
              {fl.featured && <div className="absolute -top-3 left-5 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">YOU FLY!</div>}
              <div className="flex items-start justify-between mb-3 mt-1">
                <h3 className="text-white font-bold text-xl">{fl.name}</h3>
                <div className="text-sky-400 font-bold text-2xl">{fmt$(fl.price)}</div>
              </div>
              <div className="flex gap-3 text-slate-500 text-xs uppercase tracking-wide mb-3">
                <span>{fl.duration}</span><span>·</span><span>{fl.altitude}</span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">{fl.description}</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {fl.highlights.map((h) => (
                  <span key={h} className="bg-sky-400/10 text-sky-300 text-[10px] px-2 py-0.5 rounded-full border border-sky-400/20">{h}</span>
                ))}
              </div>
              <button onClick={() => onBook(fl.id)}
                className="w-full bg-sky-500/20 hover:bg-sky-500 text-sky-400 hover:text-white font-semibold py-2.5 rounded-xl text-sm transition-all border border-sky-500/30 hover:border-sky-500">
                Book This Flight
              </button>
            </div>
          ))}
        </div>
        <p className="text-center text-slate-500 text-xs mt-8">Gift certificates available for all flights · 1 or 2 passengers</p>
      </div>
    </section>
  )
}

/* ─── FLEET SECTION ─── */
function FleetSection() {
  const [expanded, setExpanded] = useState(null)
  const airworthy = MHG_FLEET.filter((a) => a.status === 'airworthy').length
  return (
    <section id="sec-fleet" className="py-20 px-6 bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Our Fleet</h2>
          <p className="text-slate-400">{airworthy} of {MHG_FLEET.length} aircraft airworthy · Tow fee: ${MHG_TOW_FEES.hookup} hookup + ${MHG_TOW_FEES.perThousandFt}/1,000 ft</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {MHG_FLEET.map((ac) => {
            const s = STATUS_COLOR[ac.status]
            const open = expanded === ac.id
            return (
              <div key={ac.id} onClick={() => setExpanded(open ? null : ac.id)}
                className={`${s.bg} border ${s.border} rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.01]`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-white text-base font-bold">{ac.type}</div>
                    <div className="text-slate-400 text-xs">{ac.tailNumber} · {ac.seats}-seat · {ac.wing}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                    <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
                  </div>
                </div>
                <div className="text-slate-300 text-xs mb-1">{ac.role}</div>
                <div className="text-slate-500 text-[11px]">{ac.notes}</div>
                {open && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <h4 className="text-slate-400 text-[10px] uppercase tracking-wide mb-2">Weight & Balance</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-500">Empty:</span> <span className="text-slate-200">{ac.emptyWeight} lbs</span></div>
                      <div><span className="text-slate-500">Max gross:</span> <span className="text-slate-200">{ac.maxGross} lbs</span></div>
                      <div><span className="text-slate-500">Payload:</span> <span className="text-slate-200">{ac.maxPayload} lbs</span></div>
                      <div><span className="text-slate-500">Wingspan:</span> <span className="text-slate-200">{ac.wingSpan}</span></div>
                      <div><span className="text-slate-500">L/D:</span> <span className="text-slate-200">{ac.glideRatio}</span></div>
                      <div><span className="text-slate-500">Vne:</span> <span className="text-slate-200">{ac.vne} kts</span></div>
                    </div>
                    <PayloadCalc aircraft={ac} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function PayloadCalc({ aircraft }) {
  const [pilotW, setPilotW] = useState('')
  const [paxW, setPaxW] = useState('')
  const total = (Number(pilotW) || 0) + (Number(paxW) || 0)
  const remaining = aircraft.maxPayload - total
  return (
    <div className="mt-3 space-y-2">
      <h4 className="text-slate-400 text-[10px] uppercase tracking-wide">Payload Calculator</h4>
      <div className="flex gap-2">
        <input type="number" placeholder="Pilot (lbs)" value={pilotW} onChange={(e) => setPilotW(e.target.value)} onClick={(e) => e.stopPropagation()}
          className="w-full bg-surface border border-surface-border rounded px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
        {aircraft.seats > 1 && (
          <input type="number" placeholder="Pax (lbs)" value={paxW} onChange={(e) => setPaxW(e.target.value)} onClick={(e) => e.stopPropagation()}
            className="w-full bg-surface border border-surface-border rounded px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
        )}
      </div>
      {(pilotW || paxW) && (
        <div className={`text-xs font-medium ${remaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
          {remaining < 0 ? `⚠ Over by ${Math.abs(remaining)} lbs` : `✓ ${remaining} lbs remaining`}
        </div>
      )}
    </div>
  )
}

/* ─── INSTRUCTION SECTION ─── */
function InstructionSection() {
  return (
    <section id="sec-instruction" className="py-20 px-6 bg-gradient-to-b from-surface to-surface-card/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Flight Instruction</h2>
          <p className="text-slate-400">Earn your glider rating at one of America's best soaring sites — FAA examiner on staff</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {MHG_INSTRUCTION.map((item) => (
            <div key={item.id} className="bg-surface-card border border-surface-border rounded-2xl p-5 hover:border-sky-400/30 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-white text-sm font-bold">{item.name}</h3>
                {item.price && <span className="text-sky-400 font-bold">{fmt$(item.price)}</span>}
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 bg-gradient-to-r from-sky-900/50 to-indigo-900/50 border border-sky-400/20 rounded-2xl p-8 text-center">
          <h3 className="text-white text-xl font-bold mb-2">🎓 Complete Your Rating Here</h3>
          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            From first flight to checkride — all at Mile High. Train in mountain soaring from day one.
            Most students solo in 30–40 flights. A glider rating typically costs $3,000–$5,000 — a fraction of powered flight.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ─── CURRENT OPERATIONS ─── */
function OperationsSection() {
  const [ops, setOps] = useState(getTodayOps)
  useEffect(() => { const id = setInterval(() => setOps(getTodayOps()), 60000); return () => clearInterval(id) }, [])

  return (
    <section id="sec-operations" className="py-20 px-6 bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 flex items-center justify-center gap-3">
            <span className={`w-3 h-3 rounded-full ${ops.isOperating ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
            Current Operations
          </h2>
          <p className="text-slate-400">{ops.isOperating ? 'We\'re flying today!' : 'Operations closed — check back during daylight hours'}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Field', value: ops.fieldElevation, icon: '⛰️' },
            { label: 'Runway', value: ops.runwayInUse, icon: '🛬' },
            { label: 'Wind', value: `${ops.windDir} @ ${ops.windSpeed}`, icon: '💨' },
            { label: 'Temp', value: ops.temp, icon: '🌡️' },
            { label: 'Tow Planes', value: `${ops.towPlanesActive}/${ops.towPlanesTotal} active`, icon: '🛩️' },
            { label: 'Queue', value: ops.queueLength > 0 ? `${ops.queueLength} waiting` : 'No wait', icon: '⏱️' },
            { label: 'Est. Wait', value: ops.estimatedWait > 0 ? `~${ops.estimatedWait} min` : 'None', icon: '⏳' },
            { label: 'Thermals', value: ops.thermalForecast, icon: '🌀' },
          ].map((item) => (
            <div key={item.label} className="bg-surface-card border border-surface-border rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-slate-500 text-[10px] uppercase tracking-wide">{item.label}</div>
              <div className="text-white text-sm font-bold mt-1">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {[
            { label: 'METAR / TAF', url: MHG_INFO.metarUrl },
            { label: 'FAA WeatherCam', url: MHG_INFO.webcamUrl },
            { label: 'Windy Forecast', url: MHG_INFO.windyUrl },
          ].map((l) => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-sky-400 hover:text-sky-300 border border-sky-400/30 rounded-xl px-4 py-2 transition-colors hover:bg-sky-400/10">
              {l.label} ↗
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── GALLERY ─── */
function GallerySection() {
  const [filter, setFilter] = useState('all')
  const cats = ['all', 'scenery', 'flights', 'operations', 'instruction']
  const filtered = filter === 'all' ? MHG_GALLERY : MHG_GALLERY.filter((g) => g.category === filter)
  const gradients = [
    'from-sky-600 to-blue-800', 'from-amber-500 to-orange-700', 'from-emerald-500 to-teal-700',
    'from-purple-500 to-indigo-700', 'from-rose-500 to-pink-700', 'from-cyan-500 to-sky-700',
    'from-blue-500 to-indigo-800', 'from-teal-400 to-emerald-700', 'from-indigo-500 to-purple-800',
    'from-sky-400 to-blue-700', 'from-amber-400 to-red-600', 'from-green-500 to-teal-800',
  ]

  return (
    <section id="sec-gallery" className="py-20 px-6 bg-gradient-to-b from-surface to-surface-card/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Gallery</h2>
        </div>
        <div className="flex gap-2 justify-center mb-6">
          {cats.map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={`text-xs px-4 py-1.5 rounded-full transition-colors capitalize ${filter === c ? 'bg-sky-500 text-white' : 'bg-surface-card border border-surface-border text-slate-400 hover:text-white'}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((img) => (
            <div key={img.id} className="group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer">
              <div className={`absolute inset-0 bg-gradient-to-br ${gradients[(img.id - 1) % gradients.length]} transition-transform group-hover:scale-110 duration-500`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white text-xs font-medium">{img.alt}</p>
                <span className="text-white/50 text-[10px] capitalize">{img.category}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── LEADERBOARD (WeGlide / OLC) ─── */
function LeaderboardSection() {
  // Simulated recent flights from WeGlide/OLC
  const flights = [
    { pilot: 'Jim Murray', distance: '318 mi', aircraft: 'DG 800A 18m', duration: '6h 58m', date: '2025-06-16', speed: '60 mph' },
    { pilot: 'Clemens Ceipek', distance: '255 mi', aircraft: 'ASW 27', duration: '5h 42m', date: '2025-04-12', speed: '52 mph' },
    { pilot: 'Mark Hawkins', distance: '210 mi', aircraft: 'LS8-18', duration: '4h 55m', date: '2025-07-03', speed: '48 mph' },
    { pilot: 'Sarah Chen', distance: '185 mi', aircraft: 'Discus 2a', duration: '4h 20m', date: '2025-08-11', speed: '45 mph' },
    { pilot: 'Tom Reynolds', distance: '162 mi', aircraft: 'ASG 29', duration: '3h 48m', date: '2025-09-22', speed: '50 mph' },
  ]

  return (
    <section id="sec-leaderboard" className="py-20 px-6 bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Boulder Soaring Leaderboard</h2>
          <p className="text-slate-400">Recent cross-country flights from KBDU — 700+ mile flights have been achieved from Boulder</p>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3">#</th>
                <th className="text-left px-5 py-3">Pilot</th>
                <th className="text-left px-5 py-3">Distance</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">Aircraft</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">Duration</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">Speed</th>
              </tr>
            </thead>
            <tbody>
              {flights.map((f, i) => (
                <tr key={i} className="border-b border-surface-border/50 hover:bg-surface/50 transition-colors">
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-slate-400/20 text-slate-300' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-surface text-slate-500'
                    }`}>{i + 1}</span>
                  </td>
                  <td className="px-5 py-3 text-white font-medium">{f.pilot}</td>
                  <td className="px-5 py-3 text-sky-400 font-bold">{f.distance}</td>
                  <td className="px-5 py-3 text-slate-400 hidden sm:table-cell">{f.aircraft}</td>
                  <td className="px-5 py-3 text-slate-400 hidden md:table-cell">{f.duration}</td>
                  <td className="px-5 py-3 text-slate-400 hidden md:table-cell">{f.speed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <a href="https://www.weglide.org/flight" target="_blank" rel="noopener noreferrer"
            className="text-sm text-sky-400 hover:text-sky-300 border border-sky-400/30 rounded-xl px-5 py-2.5 transition-colors hover:bg-sky-400/10">
            WeGlide — Live Flight Tracking ↗
          </a>
          <a href="https://www.onlinecontest.org/olc-3.0/gliding/" target="_blank" rel="noopener noreferrer"
            className="text-sm text-sky-400 hover:text-sky-300 border border-sky-400/30 rounded-xl px-5 py-2.5 transition-colors hover:bg-sky-400/10">
            OLC — Online Contest ↗
          </a>
          <a href="https://www.soarboulder.org/" target="_blank" rel="noopener noreferrer"
            className="text-sm text-sky-400 hover:text-sky-300 border border-sky-400/30 rounded-xl px-5 py-2.5 transition-colors hover:bg-sky-400/10">
            Soaring Society of Boulder ↗
          </a>
        </div>

        <div className="mt-6 text-center">
          <p className="text-slate-500 text-xs">Soaring Society of Boulder placed <strong className="text-slate-300">2nd globally</strong> in the IGC-OLC World League — among 1,000+ clubs worldwide</p>
        </div>
      </div>
    </section>
  )
}

/* ─── SURPRISE / START SOARING ─── */
function StartSoaringSection({ onBook }) {
  const cards = [
    { icon: '🦅', title: 'Why Soaring?', body: 'No engine, no noise — just you and the sky. Pilots describe it as meditation at altitude. The Schweizer 2-32 once held a world record. You can fly one today.' },
    { icon: '🏔️', title: 'Front Range Advantage', body: 'Mountain wave, thermal, and ridge lift converge right here. Boulder is one of the best soaring sites in North America — year-round, consistent, spectacular.' },
    { icon: '⏱️', title: 'Solo Faster Than You Think', body: 'Most students solo in 30–40 flights. FAA examiner on staff means no traveling for your checkride. From first flight to certificate, all at MHG.' },
    { icon: '💰', title: 'Affordable Aviation', body: 'A complete glider rating typically costs $3K–$5K — compare to $10K+ for powered. No fuel burn, lower insurance, simpler aircraft.' },
    { icon: '📊', title: 'The Numbers', body: 'The 2-32 glides 34:1. Released at 10,600 ft, that\'s 30+ minutes with zero lift. And there\'s almost always lift over the Rockies.' },
    { icon: '🌊', title: 'Mountain Wave', body: 'Westerly winds create standing waves above the Rockies that can carry gliders past 30,000 ft. Boulder is famous for it. Some days you climb faster than a jet.' },
  ]

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-surface to-surface-card/20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Start Soaring Today</h2>
          <p className="text-slate-400">Everything you need to know about the world's most beautiful way to fly</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cards.map((c) => (
            <div key={c.title} className="bg-surface-card border border-surface-border rounded-2xl p-6 hover:border-sky-400/30 transition-all group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform inline-block">{c.icon}</div>
              <h3 className="text-white font-bold mb-2">{c.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>

        {/* Final CTA */}
        <div className="mt-16 relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-4 left-[20%] w-40 h-12 bg-white/40 rounded-full blur-2xl" />
              <div className="absolute bottom-4 right-[25%] w-56 h-14 bg-white/30 rounded-full blur-3xl" />
            </div>
          </div>
          <div className="relative z-10 px-8 py-12 text-center">
            <h3 className="text-3xl font-bold text-white mb-3">Ready to Fly?</h3>
            <p className="text-sky-100/80 text-base mb-6 max-w-lg mx-auto">
              Book a Discovery Flight and experience the Rocky Mountains like never before. No experience needed.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button onClick={() => onBook('mile-high')}
                className="bg-white text-sky-700 font-bold px-8 py-4 rounded-xl text-sm hover:bg-sky-50 transition-colors shadow-xl">
                Book Now — From $175
              </button>
              <a href={`tel:${MHG_INFO.phone.replace(/[^\d]/g, '')}`}
                className="border-2 border-white/50 text-white font-bold px-8 py-4 rounded-xl text-sm hover:bg-white/10 transition-colors">
                Call {MHG_INFO.phone}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── FOOTER ─── */
function Footer() {
  return (
    <footer className="bg-surface-card border-t border-surface-border py-12 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h4 className="text-white font-bold text-lg mb-2">Mile High Gliding</h4>
          <p className="text-slate-400 text-sm leading-relaxed">{MHG_INFO.address}</p>
          <p className="text-slate-400 text-sm">{MHG_INFO.airport}</p>
          <p className="text-slate-400 text-sm mt-2">{MHG_INFO.hours}</p>
        </div>
        <div>
          <h4 className="text-white font-bold mb-2">Contact</h4>
          <p className="text-slate-300 text-sm">{MHG_INFO.phone}</p>
          <p className="text-slate-300 text-sm">{MHG_INFO.email}</p>
          <div className="flex gap-3 mt-3">
            <a href={MHG_INFO.facebook} target="_blank" rel="noopener noreferrer" className="text-sky-400 text-sm hover:text-sky-300">Facebook</a>
            <a href={MHG_INFO.instagram} target="_blank" rel="noopener noreferrer" className="text-sky-400 text-sm hover:text-sky-300">Instagram</a>
            <a href={MHG_INFO.website} target="_blank" rel="noopener noreferrer" className="text-sky-400 text-sm hover:text-sky-300">Website</a>
          </div>
        </div>
        <div>
          <h4 className="text-white font-bold mb-2">Resources</h4>
          <div className="space-y-1">
            <a href="https://www.weglide.org/flight" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-400 text-sm block transition-colors">WeGlide Flight Tracker ↗</a>
            <a href="https://www.onlinecontest.org/olc-3.0/gliding/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-400 text-sm block transition-colors">OLC Online Contest ↗</a>
            <a href="https://www.soarboulder.org/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-400 text-sm block transition-colors">Soaring Society of Boulder ↗</a>
            <a href={MHG_INFO.metarUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-400 text-sm block transition-colors">KBDU Weather ↗</a>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-surface-border text-center text-slate-600 text-xs">
        © {new Date().getFullYear()} Mile High Gliding · Boulder, Colorado · Est. 1998
      </div>
    </footer>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE — Full-screen client portal
   ═══════════════════════════════════════════════════════════ */
export function MileHighGliding() {
  const [showLogin, setShowLogin] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [booking, setBooking] = useState(null) // package id or null

  const scrollTo = (id) => {
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleBook = (pkgId) => setBooking(pkgId)

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <TopNav
        onLogin={() => setShowLogin(true)}
        loggedIn={loggedIn}
        onLogout={() => { setLoggedIn(false); setUserEmail('') }}
        onSection={scrollTo}
      />

      <HeroSection onBook={handleBook} />
      <PackagesSection onBook={handleBook} />
      <FleetSection />
      <InstructionSection />
      <OperationsSection />
      <GallerySection />
      <LeaderboardSection />
      <StartSoaringSection onBook={handleBook} />
      <Footer />

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={(email) => { setLoggedIn(true); setUserEmail(email); setShowLogin(false) }}
        />
      )}

      {booking && (
        <BookingFunnel
          initialPackage={booking}
          onClose={() => setBooking(null)}
        />
      )}
    </div>
  )
}
