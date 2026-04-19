import { useState, useEffect } from 'react'
import {
  PortalNav, PortalLoginModal, AirportOps, PortalFooter, GalleryGrid,
  STATUS_COLOR, fmt$, GALLERY_GRADIENTS, ProspectsBoard,
} from '../portal'
import { FleetCard } from '../components/shared/FleetCard'
import {
  DZ_INFO, JUMP_PLANES, JUMP_PILOTS, JUMP_INSTRUCTORS, JUMP_PRICING,
  REGULAR_JUMPERS, AFF_STUDENTS, JUMP_PROGRAMS, DZ_WEATHER_LIMITS, getTodayLoads,
} from './skydivingData'

const SKY_PERSONAS = [
  { id: 'vis-1',     name: 'Alex Rivera',     role: 'visitor',    label: 'First-time Visitor',          email: 'arivera@email.com', weightLbs: 185 },
  { id: 'affs-001',  name: 'Derek Yamashita', role: 'student',    label: 'AFF Student (Level 5)',       email: 'dyamashita@email.com', weightLbs: 168, studentId: 'affs-001', program: 'aff' },
  { id: 'jmp-001',   name: 'Aaron Pollock',   role: 'jumper',     label: 'D-License · 4-Way Captain',   email: 'apollock@email.com', weightLbs: 195, licenseLevel: 'D', totalJumps: 1420 },
  { id: 'jmp-003',   name: 'Jake Novotny',    role: 'jumper',     label: 'B-License · Weekend Warrior',  email: 'jnovotny@email.com', weightLbs: 215, licenseLevel: 'B', totalJumps: 88 },
  { id: 'ji-001',    name: 'Tony Marchetti',  role: 'instructor', label: 'Tandem-I / AFF-I · 4200 jumps',email: 'tmarchetti@email.com', weightLbs: 190, totalJumps: 4200 },
]

const USER_KEY = 'milehi_sky_user'

const NAV_ITEMS = ['packages', 'fleet', 'training', 'team', 'operations', 'gallery']
const NAV_LABELS = { packages: 'Jump!', fleet: 'Aircraft', training: 'Learn', team: 'Team', operations: 'DZ Status', gallery: 'Gallery', prospects: 'Prospects' }

const WEATHER_LINKS = [
  { label: 'METAR / TAF', url: 'https://aviationweather.gov/data/metar/?id=KBDU&hours=6' },
  { label: 'FAA WeatherCam', url: 'https://weathercams.faa.gov/map/-105.22583,39.8594,10/airport/BDU/details/weather' },
  { label: 'Windy Forecast', url: 'https://www.windy.com/airport/KBDU' },
]

const OPS_FIELDS = [
  { label: 'Field', key: 'fieldElevation', icon: '⛰️', value: DZ_INFO.fieldElevation },
  { label: 'Wind (ground)', icon: '💨' },
  { label: 'Wind (aloft)', icon: '🌬️' },
  { label: 'Planes Flying', icon: '✈️' },
  { label: 'Loads Today', icon: '📋' },
  { label: 'Next Load', icon: '⏱️' },
  { label: 'Jump Run', icon: '🧭' },
]

const FOOTER_CONTACT = [
  { label: 'Phone', value: DZ_INFO.phone },
  { label: 'Email', value: DZ_INFO.email },
]
const FOOTER_SOCIAL = [
  { label: 'Website', url: DZ_INFO.website },
]
const FOOTER_RESOURCES = [
  { label: 'USPA', url: 'https://uspa.org' },
  { label: 'FAA Part 105', url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-105' },
  { label: 'Weather — KBDU', url: 'https://aviationweather.gov/data/metar/?id=KBDU' },
  { label: 'Winds Aloft', url: 'https://aviationweather.gov/data/windtemp/?region=bou' },
]

const GALLERY = [
  { id: 1, alt: 'Tandem exit over the Rockies', category: 'tandem' },
  { id: 2, alt: 'AFF student in stable freefall', category: 'training' },
  { id: 3, alt: 'Twin Otter climb to altitude', category: 'aircraft' },
  { id: 4, alt: 'Formation skydive — 4-way belly', category: 'jumps' },
  { id: 5, alt: 'Canopy flight over Boulder', category: 'canopy' },
  { id: 6, alt: 'Freefly exit from Grand Caravan', category: 'jumps' },
  { id: 7, alt: 'Sunset load — golden hour jump', category: 'jumps' },
  { id: 8, alt: 'Tandem landing with instructor', category: 'tandem' },
  { id: 9, alt: 'Wingsuit flight over the Flatirons', category: 'jumps' },
]

const scrollTo = (id) => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth' })

// ─── Ops adapter ─────────────────────────────────────────────────────────────

function getOpsForPortal() {
  const ops = getTodayLoads()
  return {
    isOpen:         ops.isOperating,
    fieldElevation: DZ_INFO.fieldElevation,
    windDir:        ops.windGround,
    windSpeed:      '',
    windAltitude:   ops.windAltitude,
    jumpRun:        ops.jumpRun,
    planesFlying:   `${ops.planesFlying} / ${ops.planesTotal}`,
    loadsToday:     `${ops.loadsFlown} / ${ops.loadsPlanned}`,
    nextLoad:       ops.nextLoadEta,
    temp:           '--',
  }
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function HeroSection({ onBook }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Video background — Mile Hi Skydiving promo reel */}
      <div className="absolute inset-0">
        <iframe
          src="https://www.youtube.com/embed/VhBMnNCTjLQ?autoplay=1&mute=1&loop=1&playlist=VhBMnNCTjLQ&controls=0&showinfo=0&modestbranding=1&playsinline=1&rel=0&vq=hd1080"
          title="Mile Hi Skydiving"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ width: '100vw', height: '56.25vw', minHeight: '100vh', minWidth: '177.78vh', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          allow="autoplay; encrypted-media"
          frameBorder="0"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/80" />

      <div className="relative z-10 text-center px-6 max-w-3xl">
        <p className="text-sky-300 text-sm tracking-widest uppercase mb-4 font-medium">Colorado's Premier Drop Zone</p>
        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
          Mile Hi<br />Skydiving
        </h1>
        <p className="text-white/80 text-lg md:text-xl mb-8 leading-relaxed">
          Jump from 14,000 feet over the Rocky Mountains. Tandem, AFF, and experienced
          jumper loads — Thursday through Monday at Boulder Municipal Airport.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={onBook} className="bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 px-8 rounded-xl text-lg shadow-lg shadow-sky-500/25 transition-all hover:scale-105">
            Book Your Jump
          </button>
          <button onClick={() => scrollTo('training')} className="border-2 border-white/30 hover:border-white/60 text-white font-semibold py-3 px-8 rounded-xl text-lg transition-all">
            Learn to Skydive
          </button>
        </div>
        <div className="flex justify-center gap-8 mt-12 text-white/70 text-sm">
          <span>✈️ {JUMP_PLANES.filter(p => p.status === 'airworthy').length} jump planes</span>
          <span>🪂 {JUMP_INSTRUCTORS.length} instructors</span>
          <span>📍 {DZ_INFO.airport}</span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center pt-2">
          <div className="w-1.5 h-3 rounded-full bg-white/60" />
        </div>
      </div>
    </section>
  )
}

// ─── Packages Section ────────────────────────────────────────────────────────

function PackagesSection({ onBook }) {
  const packages = [
    { name: 'Tandem Skydive', price: JUMP_PRICING.tandem14k, desc: 'Your first jump — harnessed to an instructor. Freefall from 14,000 ft for ~60 seconds.', badge: null, alt: `${JUMP_PRICING.tandem14k}`, icon: '🪂' },
    { name: 'Tandem + Handcam', price: JUMP_PRICING.tandem14k + JUMP_PRICING.videoHandcam, desc: 'Tandem jump with wrist-mounted camera. Relive every second of freefall.', badge: 'POPULAR', icon: '📹' },
    { name: 'Tandem + Full Video', price: JUMP_PRICING.tandem14k + JUMP_PRICING.videoCombo, desc: 'Premium package — handcam plus dedicated outside videographer.', badge: null, icon: '🎬' },
    { name: 'HALO Tandem (18k)', price: JUMP_PRICING.tandem18k, desc: 'High-altitude jump from 18,000 ft — 90 seconds of freefall. Twin Otter only.', badge: 'EXTREME', icon: '🏔️' },
  ]
  return (
    <section id="sec-packages" className="py-20 px-6 bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Jump Packages</h2>
          <p className="text-slate-400">No experience needed — we handle everything. You just enjoy the ride.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {packages.map((pkg) => (
            <div key={pkg.name} className="bg-surface-card border border-surface-border rounded-2xl p-6 flex flex-col hover:border-sky-500/30 transition-colors group">
              {pkg.badge && (
                <span className="self-start text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 mb-3 font-medium">{pkg.badge}</span>
              )}
              <span className="text-3xl mb-3">{pkg.icon}</span>
              <h3 className="text-white font-bold text-lg mb-1">{pkg.name}</h3>
              <p className="text-slate-400 text-sm mb-4 flex-1">{pkg.desc}</p>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-black text-sky-400">{fmt$(pkg.price)}</span>
                <button onClick={onBook} className="text-xs bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 px-4 py-2 rounded-lg border border-sky-500/30 transition-colors">
                  Book Now
                </button>
              </div>
            </div>
          ))}
        </div>
        {/* Fun jumper pricing */}
        <div className="mt-8 bg-surface-card border border-surface-border rounded-2xl p-6">
          <h3 className="text-white font-bold mb-3">Licensed Jumpers</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-slate-500">Full altitude:</span> <span className="text-green-400 font-bold">{fmt$(JUMP_PRICING.funJumperFull)}/jump</span></div>
            <div><span className="text-slate-500">Hop-n-Pop:</span> <span className="text-green-400 font-bold">{fmt$(JUMP_PRICING.funJumperHopNPop)}/jump</span></div>
            <div><span className="text-slate-500">Gear rental:</span> <span className="text-slate-300">{fmt$(JUMP_PRICING.gearRentalFull)}/day</span></div>
            <div><span className="text-slate-500">Packer tip:</span> <span className="text-slate-300">{fmt$(JUMP_PRICING.packerTip)}</span></div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Fleet Section ───────────────────────────────────────────────────────────

function FleetSection() {
  const [expanded, setExpanded] = useState(null)
  return (
    <section id="sec-fleet" className="py-20 px-6 bg-gradient-to-b from-surface to-surface-card/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Fleet</h2>
          <p className="text-slate-400">Turbine power — fast climbs, more jumps, less waiting.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {JUMP_PLANES.map((p) => (
            <FleetCard
              key={p.id}
              aircraft={p}
              expanded={expanded === p.id}
              onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
              renderSpecs={(a) => (
                <span className="flex gap-4 mt-1 text-slate-400">
                  <span>{a.seats} jumpers</span>
                  <span>{a.climbRate}</span>
                  <span>{a.jumpDoor}</span>
                </span>
              )}
              renderDetail={(a) => (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-slate-500">Max Gross:</span> <span className="text-slate-200">{a.maxGross.toLocaleString()} lbs</span></div>
                  <div><span className="text-slate-500">Empty Weight:</span> <span className="text-slate-200">{a.emptyWeight.toLocaleString()} lbs</span></div>
                  <div><span className="text-slate-500">Useful Load:</span> <span className="text-slate-200">{a.usefulLoad.toLocaleString()} lbs</span></div>
                  <div><span className="text-slate-500">Door:</span> <span className="text-slate-200">{a.jumpDoor}</span></div>
                  {a.notes && <div className="col-span-2 text-slate-500 italic">{a.notes}</div>}
                </div>
              )}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Training / AFF Section ─────────────────────────────────────────────────

function TrainingSection() {
  const aff = JUMP_PROGRAMS.aff
  return (
    <section id="sec-training" className="py-20 px-6 bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Learn to Skydive</h2>
          <p className="text-slate-400">From first jump to licensed skydiver — USPA-certified programs.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* AFF detail */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6">
            <span className="text-3xl">{aff.icon}</span>
            <h3 className="text-white font-bold text-xl mt-2 mb-1">{aff.name}</h3>
            <p className="text-sky-400 text-xs mb-3">{aff.reg}</p>
            <p className="text-slate-400 text-sm mb-4">{aff.description}</p>
            <div className="space-y-2 mb-4">
              {aff.pricePerLevel.map((l) => (
                <div key={l.level} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{l.label}</span>
                  <span className="text-green-400 font-mono font-bold">{fmt$(l.price)}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-500">
              Ground school: {aff.groundSchoolHrs} hrs · Typical total: {fmt$(aff.typicalCost.min)}–{fmt$(aff.typicalCost.avg)}
            </div>
          </div>
          {/* License progression */}
          <div className="space-y-4">
            {['a_license', 'b_license', 'c_license', 'd_license'].map((key) => {
              const prog = JUMP_PROGRAMS[key]
              if (!prog) return null
              return (
                <div key={key} className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-start gap-3">
                  <span className="text-2xl">{prog.icon}</span>
                  <div className="flex-1">
                    <h4 className="text-white font-bold text-sm">{prog.name}</h4>
                    <p className="text-slate-400 text-xs mb-2">{prog.description}</p>
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span>Min {prog.minJumps} jumps</span>
                      <span>{prog.requirements?.length ?? 0} requirements</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {/* Static line / IAD */}
            <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-start gap-3">
              <span className="text-2xl">{JUMP_PROGRAMS.static_line.icon}</span>
              <div className="flex-1">
                <h4 className="text-white font-bold text-sm">{JUMP_PROGRAMS.static_line.name}</h4>
                <p className="text-slate-400 text-xs mb-1">{JUMP_PROGRAMS.static_line.description}</p>
                <span className="text-green-400 text-xs font-mono">{fmt$(JUMP_PROGRAMS.static_line.pricePerJump)}/jump</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Team Section ────────────────────────────────────────────────────────────

function TeamSection() {
  const team = [...JUMP_PILOTS.map(p => ({ ...p, cat: 'Pilot' })), ...JUMP_INSTRUCTORS.map(i => ({ ...i, cat: 'Instructor' }))]
  return (
    <section id="sec-team" className="py-20 px-6 bg-gradient-to-b from-surface via-surface-card/50 to-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Our Team</h2>
          <p className="text-slate-400">{JUMP_PILOTS.length} pilots + {JUMP_INSTRUCTORS.length} instructors keeping you safe.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {team.map((t) => (
            <div key={t.id} className="bg-surface-card border border-surface-border rounded-xl p-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-lg flex-shrink-0">
                {t.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold">{t.name}</div>
                <div className="text-sky-400 text-xs mb-1">{t.role}</div>
                <div className="text-slate-400 text-xs">{t.totalHours ? `${t.totalHours.toLocaleString()} hrs` : t.totalJumps ? `${t.totalJumps.toLocaleString()} jumps` : ''}{t.ratings && ` · ${t.ratings.join(' · ')}`}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Student Dashboard ──────────────────────────────────────────────────────

function StudentDashboard({ user }) {
  const student = AFF_STUDENTS.find(s => s.id === user.studentId) ?? null
  if (!student) return <div className="pt-20 px-6 text-center text-slate-400">Student record not found.</div>
  const pct = Math.round((student.currentLevel / 7) * 100)
  const instructor = JUMP_INSTRUCTORS.find(i => i.id === student.assignedInstructorId)
  return (
    <section className="pt-24 pb-12 px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Welcome back, {user.name}</h2>
          <p className="text-slate-400 text-sm">AFF Level {student.currentLevel} / 7 · {student.totalJumps} jumps</p>
        </div>
        {/* Progress card */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">AFF Progression</span>
            <span className="text-sky-400 font-bold">{pct}%</span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-slate-500">Total Jumps</span><div className="text-white font-bold text-xl">{student.totalJumps}</div></div>
            <div><span className="text-slate-500">Freefall Time</span><div className="text-white font-bold text-xl">{(student.freefallTime * 60).toFixed(0)} min</div></div>
            <div><span className="text-slate-500">Instructor</span><div className="text-white font-bold">{instructor?.name ?? '--'}</div></div>
            <div><span className="text-slate-500">Enrolled</span><div className="text-white font-bold">{student.enrolledDate}</div></div>
          </div>
        </div>
        {/* Level history */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-6">
          <h3 className="text-white font-bold mb-3">Jump Log</h3>
          <div className="space-y-2">
            {student.levelHistory.map((l, i) => (
              <div key={i} className={`flex items-center gap-3 text-sm px-3 py-2 rounded-lg ${
                l.result === 'pass' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
              }`}>
                <span className={`text-xs font-bold ${l.result === 'pass' ? 'text-green-400' : 'text-red-400'}`}>
                  L{l.level} {l.result === 'pass' ? '✓' : '↻'}
                </span>
                <span className="text-slate-300">{l.date}</span>
                <span className="text-slate-500 flex-1">{l.notes}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Jumper Dashboard ───────────────────────────────────────────────────────

function JumperDashboard({ user }) {
  const j = REGULAR_JUMPERS.find(r => r.id === user.id)
  if (!j) return <div className="pt-20 px-6 text-center text-slate-400">Jumper record not found.</div>
  const stats = [
    ['Total Jumps', j.totalJumps.toLocaleString()], ['Freefall', `${j.freefallHrs} hrs`],
    ['Wing Loading', j.wingLoading ?? '--'], ['Canopy', j.canopyType],
  ]
  const details = [
    ['Last Jump', j.lastJumpDate], ['Currency', j.currency], ['Gear', j.ownGear ? 'Own rig' : 'DZ rental'],
    ['USPA Thru', j.uspaCurrentThru], ['Member Since', j.memberSince], ['Exit Weight', `${j.exitWeight} lbs`],
  ]
  return (
    <section className="pt-24 pb-12 px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Welcome, {j.name}</h2>
          <p className="text-slate-400 text-sm">USPA {j.uspaLicense} · {j.totalJumps.toLocaleString()} jumps · {j.disciplines.join(', ')}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(([label, value]) => (
            <div key={label} className="bg-surface-card border border-surface-border rounded-xl p-4">
              <div className="text-slate-500 text-xs">{label}</div>
              <div className="text-white font-bold text-lg mt-1">{value}</div>
            </div>
          ))}
        </div>
        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 text-sm">
          <div className="grid grid-cols-2 gap-4">
            {details.map(([label, value]) => (
              <div key={label}><span className="text-slate-500">{label}:</span> <span className={label === 'Currency' && j.currency !== 'current' ? 'text-yellow-400' : 'text-slate-200'}>{value}</span></div>
            ))}
          </div>
          {j.notes && <div className="mt-3 text-slate-500 italic">{j.notes}</div>}
        </div>
      </div>
    </section>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function MileHiSkydiving() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  })
  const [showLogin, setShowLogin] = useState(false)

  function handleLogin(u) {
    setUser(u)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setShowLogin(false)
  }
  function handleLogout() {
    setUser(null)
    localStorage.removeItem(USER_KEY)
  }

  const isStudent = user?.role === 'student'
  const isJumper = user?.role === 'jumper'
  const isStaff = user?.role === 'instructor' || user?.role === 'admin'
  const navItems = isStaff ? [...NAV_ITEMS.slice(0, 5), 'prospects', 'gallery'] : NAV_ITEMS

  return (
    <div className="min-h-screen bg-surface text-white">
      <PortalNav
        brand="Mile Hi Skydiving"
        phone={DZ_INFO.phone}
        navItems={navItems}
        navLabels={NAV_LABELS}
        user={user}
        onSection={scrollTo}
        onLoginClick={() => setShowLogin(true)}
        onLogout={handleLogout}
      />

      {showLogin && (
        <PortalLoginModal
          title="Welcome to Mile Hi Skydiving"
          subtitle="Jumpers & students — sign in to see your dashboard, jump log, and manifest."
          personas={SKY_PERSONAS}
          phone={DZ_INFO.phone}
          onClose={() => setShowLogin(false)}
          onLogin={handleLogin}
        />
      )}

      {isStudent && <StudentDashboard user={user} />}
      {isJumper && <JumperDashboard user={user} />}

      {!isStudent && <HeroSection onBook={() => scrollTo('packages')} />}
      <PackagesSection onBook={() => alert('Booking coming soon! Call ' + DZ_INFO.phone)} />
      <FleetSection />
      <TrainingSection />
      <TeamSection />

      <AirportOps
        getOps={getOpsForPortal}
        title="Drop Zone Status"
        openLabel="DZ is open — loads running"
        closedLabel="DZ closed — check back during operating hours"
        weatherLinks={WEATHER_LINKS}
        fields={OPS_FIELDS.map(f => ({ ...f, value: f.value ?? undefined }))}
      />

      {isStaff && <ProspectsBoard operator="skydiving" heading="Sales Pipeline" subtitle="Mile Hi Skydiving — prospect tracking & follow-up" />}

      <section id="sec-gallery" className="py-20 px-6 bg-surface">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Gallery</h2>
            <p className="text-slate-400">Life above the clouds.</p>
          </div>
          <GalleryGrid gallery={GALLERY} />
        </div>
      </section>

      <PortalFooter
        brand="Mile Hi Skydiving"
        address={DZ_INFO.address}
        airport={DZ_INFO.airport}
        hours={DZ_INFO.hours}
        contactLines={FOOTER_CONTACT}
        socialLinks={FOOTER_SOCIAL}
        resources={FOOTER_RESOURCES}
        copyright={`© ${new Date().getFullYear()} Front Range Skydivers · ${DZ_INFO.airport} · Est. ${DZ_INFO.established}`}
      />
    </div>
  )
}
