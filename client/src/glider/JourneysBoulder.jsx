import { useState, useEffect, useRef } from 'react'
import {
  JB_INFO, JB_STAFF, JB_INSTRUCTORS, JB_MEMBERSHIP, JB_INSTRUCTION_RATES,
  JB_INSURANCE, JB_FUEL, JB_FBO_SERVICES, JB_TRAINING, JB_GALLERY,
  JB_RESOURCES, getJBTodayOps,
} from './journeysBoulderData'
import { getAircraftByOperator } from '../mocks/aircraft'
import { mockAircraft } from '../mocks/aircraft'
import { subscribeSquawks } from '../store/squawks'
import {
  PortalNav, PortalLoginModal, MiniGalleryStrip, GalleryGrid,
  AirportOps, PortalFooter, SquawkPanel as SharedSquawkPanel,
  FlightLog, InstructorsDisplay, ProspectsBoard,
  HeroSection, TeamSection, TrainingSection, FBOSection,
  ScheduleSection, FleetSection, MyFleetSection, StudentDashboard,
} from '../portal'
import {
  IcMaint, IcScience, IcTechnology, IcEngineering, IcMath,
  IcCareer, IcAIHardened, IcMedical, IcHelicopter, IcLogistics,
  IcPlane, IcShield, IcFlask, IcSatellite,
  IcVolume, IcVolumeOff, IcEar, IcHomeHeart, IcFire, IcFirstAid, IcMessage, IcSend, IcSupport, IcThumbUp,
} from '../portal/icons'

/* ═══════════════════════════════════════════════════════════
   Journeys Aviation — Full-Screen Client-Facing Portal
   Uses shared portal components from ../portal/
   ═══════════════════════════════════════════════════════════ */

/* ─── PERSONAS (login-as for testing) ─── */
const PERSONAS = [
  // PPL student — beginner, Stage 1
  { id: 'student-1', name: 'Tyler Mason', role: 'student', label: 'Student Pilot (PPL)', email: 'tyler@example.com',
    aircraft: ['N52993', 'N12JA'], hours: 7.2, weightLbs: 178, preferredCfis: ['prs-018', 'prs-017'],
    cert: 'student', ratings: [], endorsements: [], program: 'private_pilot',
  },
  // PPL holder — enrolled in Instrument Rating, Stage 1
  { id: 'student-2', name: 'Maria Vasquez', role: 'student', label: 'PPL → Instrument Rating', email: 'maria@example.com',
    aircraft: ['N733JM', 'N3547L', 'N6694E'], hours: 310, weightLbs: 145, preferredCfis: ['prs-017'],
    cert: 'private', ratings: ['asel'], endorsements: ['hp'], program: 'instrument_rating',
  },
  // PPL+IR holder — enrolled in Commercial, Stage 2
  { id: 'student-3', name: 'Jake Rosen', role: 'student', label: 'PPL+IR → Commercial', email: 'jake@example.com',
    aircraft: ['N6694E', 'N3547L', 'N401SS'], hours: 238.5, weightLbs: 190, preferredCfis: ['prs-001'],
    cert: 'private', ratings: ['asel', 'instrument'], endorsements: ['hp', 'complex'], program: 'commercial_pilot',
  },
  // CPL+ME holder — tailwheel endorsement + maintenance client
  { id: 'mx-client-1', name: 'Dave Kowalski', role: 'mx_client', label: 'CPL/ME — Tailwheel + MX Client', email: 'dave@example.com',
    hours: 1200, weightLbs: 195, preferredCfis: ['prs-018'],
    cert: 'commercial', ratings: ['asel', 'amel', 'instrument'], endorsements: ['hp', 'complex'],
    program: 'private_pilot', // using PPL program for endorsement scheduling
    ownedAircraft: [
      { tail: 'N789DK', type: 'Cessna 182Q Skylane', agents: ['Dave Kowalski', 'Lisa Kowalski'] },
      { tail: 'N421PB', type: 'Piper PA-28-180 Cherokee', agents: ['Dave Kowalski'] },
    ],
  },
  // PPL student — nearly done, Stage 5 checkride prep
  { id: 'student-5', name: 'Emily Carter', role: 'student', label: 'PPL Stage 5 (Checkride)', email: 'emily@example.com',
    aircraft: ['N733JM', 'N52993'], hours: 42.8, weightLbs: 135, preferredCfis: ['prs-017'],
    cert: 'student', ratings: [], endorsements: [], program: 'private_pilot',
  },
  // CFI
  { id: 'cfi-1', name: 'Linda Foster', role: 'cfi', label: 'CFI / CFII', email: 'linda@journeysaviation.com',
    aircraft: [], hours: 3200, weightLbs: 147, personnelId: 'prs-017',
    cert: 'commercial', ratings: ['asel', 'instrument', 'cfi', 'cfii'], endorsements: ['hp', 'complex', 'tailwheel'],
  },
  { id: 'admin-1', name: 'Andrew McKenna', role: 'admin', label: 'Admin / Owner', email: 'andrew@journeysaviation.com',
    aircraft: [], hours: 1000, weightLbs: 185,
    cert: 'commercial', ratings: ['asel', 'amel', 'instrument'], endorsements: ['hp'],
  },
]

/* ─── LOGIN MODAL ─── */
function LoginModal({ onClose, onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const handleSubmit = (e) => { e.preventDefault(); onLogin({ id: 'custom', name: email.split('@')[0], role: 'renter', label: 'Member', email, aircraft: [], hours: 0 }) }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white mb-1">Welcome to Journeys</h3>
        <p className="text-slate-400 text-xs mb-5">Students, renters, and maintenance clients — sign in to access your portal</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
          <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
          <button type="submit" className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">Sign In</button>
        </form>

        {/* Login-as personas for testing */}
        <div className="mt-5 pt-4 border-t border-surface-border">
          <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-2">Quick Login (Testing)</p>
          <div className="space-y-1.5">
            {PERSONAS.map((p) => (
              <button key={p.id} onClick={() => onLogin(p)}
                className="w-full flex items-center justify-between bg-surface border border-surface-border rounded-lg px-3 py-2 text-left hover:border-sky-400/40 transition-colors group">
                <div>
                  <div className="text-slate-200 text-xs font-medium group-hover:text-white">{p.name}</div>
                  <div className="text-slate-500 text-[10px]">{p.label}</div>
                </div>
                <span className="text-sky-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </button>
            ))}
          </div>
        </div>
        <p className="text-slate-600 text-[10px] text-center mt-3">New? Call {JB_INFO.phone} to set up an account</p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SCHOOL VISIT FUNNEL — Progressive wizard for teachers
   planning a field trip to Boulder Municipal Airport (KBDU)
   ═══════════════════════════════════════════════════════════ */

const SCHOOL_VISIT_STEPS = 5

const GRADE_RANGES = [
  { id: 'k-2',   label: 'K–2',   sub: 'Ages 5–8' },
  { id: '3-5',   label: '3–5',   sub: 'Ages 8–11' },
  { id: '6-8',   label: '6–8',   sub: 'Ages 11–14' },
  { id: '9-12',  label: '9–12',  sub: 'Ages 14–18' },
  { id: 'mixed', label: 'Mixed', sub: 'Multi-age group' },
]

const INTEREST_TOPICS = [
  { id: 'stem-flight',    label: 'Science of Flight',         Ic: IcScience,     sub: 'Aerodynamics, lift, drag, Bernoulli' },
  { id: 'stem-weather',   label: 'Weather & Atmosphere',      Ic: IcFlask,       sub: 'METAR, fronts, density altitude, forecasting' },
  { id: 'stem-nav',       label: 'Navigation & Technology',   Ic: IcTechnology,  sub: 'GPS, radar, radio, glass cockpits' },
  { id: 'careers',        label: 'Aviation Careers',          Ic: IcCareer,      sub: 'Pilots, mechanics, controllers, dispatch' },
  { id: 'environment',    label: 'Environment & Soaring',     Ic: IcSatellite,   sub: 'Zero-emission gliders, thermals, ecology' },
  { id: 'history',        label: 'Aviation History',          Ic: IcPlane,       sub: 'Tuskegee Airmen, restoration, Wright Bros to today' },
  { id: 'competition',    label: 'Competitive Gliding',      Ic: IcEngineering, sub: 'Cross-country soaring, records, Olympic sport' },
  { id: 'hands-on',       label: 'Hands-On Experience',      Ic: IcMaint,       sub: 'Preflight, cockpit sit-in, radio demo' },
]

/* EAA logos — official assets from eaa.org */
const EAA_LOGO = 'https://www.eaa.org/-/media/images/logos/eaa-logos/eaa2019_wtag_1clogo_white.png'
const YOUNG_EAGLES_LOGO = 'https://www.eaa.org/~/media/d3e79c842b12462389df6d5918821c0a.ashx'

/* Tuskegee Airmen — Wikimedia Commons public domain (U.S. Air Force photo)
   Pilots of the 332nd Fighter Group at Ramitelli Airfield, Italy, 1945 */
const TUSKEGEE_IMG = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Pilots_of_the_332nd_Fighter_Group.jpg/640px-Pilots_of_the_332nd_Fighter_Group.jpg'

/* Step header with gallery photo */
function StepHeader({ stepNum, title, subtitle, gallery, category }) {
  const photo = gallery.find((g) => g.category === category && g.img)
  const gradients = [
    'from-sky-700 via-blue-600 to-indigo-700',
    'from-emerald-700 via-teal-600 to-cyan-700',
    'from-amber-600 via-orange-500 to-rose-600',
    'from-violet-700 via-purple-600 to-indigo-700',
    'from-green-700 via-emerald-600 to-teal-700',
  ]
  return (
    <div className="relative h-48 overflow-hidden">
      {photo?.img ? (
        <>
          <img src={photo.img} alt={photo.alt} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        </>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-r ${gradients[stepNum - 1] || gradients[0]}`}>
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-6 left-[15%] w-40 h-12 bg-white/40 rounded-full blur-2xl animate-[drift_20s_linear_infinite]" />
            <div className="absolute top-12 right-[20%] w-56 h-14 bg-white/25 rounded-full blur-3xl animate-[drift_30s_linear_infinite_reverse]" />
          </div>
        </div>
      )}
      <div className="relative z-10 flex items-end h-full p-6">
        <div>
          <div className="text-white/60 text-[10px] uppercase tracking-[0.3em]">Step {stepNum} of {SCHOOL_VISIT_STEPS}</div>
          <h3 className="text-white text-2xl font-bold mt-1">{title}</h3>
          {subtitle && <p className="text-white/70 text-xs mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

/* Fact card used across wizard steps — accepts Tabler icon component or fallback text */
function FactCard({ Ic, title, body, highlight }) {
  return (
    <div className={`bg-surface border rounded-xl p-4 ${highlight ? 'border-sky-400/30 bg-sky-400/5' : 'border-surface-border'}`}>
      <div className="flex items-start gap-3">
        {Ic ? <Ic size={20} className="text-slate-400 flex-shrink-0 mt-0.5" /> : null}
        <div>
          <div className="text-white text-xs font-semibold">{title}</div>
          <div className="text-slate-400 text-[11px] leading-relaxed mt-0.5">{body}</div>
        </div>
      </div>
    </div>
  )
}

function SchoolVisitFunnel({ onClose }) {
  const [step, setStep] = useState(1)
  const [confirmed, setConfirmed] = useState(false)
  const [data, setData] = useState({
    contactName: '', contactEmail: '', contactPhone: '', schoolName: '', role: 'teacher',
    numStudents: '', gradeRange: '', interests: [],
    preferredDate: '', alternateDate: '', busNeeded: false, chaperones: '',
    questions: '',
  })
  const set = (k) => (v) => setData((d) => ({ ...d, [k]: typeof v === 'object' && v?.target ? v.target.value : v }))

  const saveLead = (stepNum) => {
    const leads = JSON.parse(localStorage.getItem('jb_school_leads') || '[]')
    leads.push({ ...data, step: stepNum, ts: new Date().toISOString(), type: 'school-visit' })
    localStorage.setItem('jb_school_leads', JSON.stringify(leads))
  }

  const toggleInterest = (id) => {
    setData((d) => ({
      ...d,
      interests: d.interests.includes(id)
        ? d.interests.filter((i) => i !== id)
        : [...d.interests, id],
    }))
  }

  if (confirmed) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
        <div className="bg-surface-card border border-surface-border rounded-2xl p-10 w-full max-w-md mx-4 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
          <div className="text-5xl mb-4">🎓</div>
          <h3 className="text-2xl font-bold text-white mb-2">Request Received!</h3>
          <p className="text-slate-300 text-sm mb-1">{data.schoolName || 'Your group'} — {data.numStudents} students ({GRADE_RANGES.find((g) => g.id === data.gradeRange)?.label || 'TBD'})</p>
          <p className="text-slate-400 text-xs mb-4">We'll reach out to {data.contactEmail || data.contactPhone} within 2 business days to plan your visit.</p>
          <div className="bg-surface border border-surface-border rounded-xl p-4 text-left mb-6">
            <div className="text-slate-500 text-[10px] uppercase tracking-wide mb-2">What happens next</div>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex gap-2"><span className="text-sky-400">1.</span> Our education coordinator reviews your request</div>
              <div className="flex gap-2"><span className="text-sky-400">2.</span> We'll confirm date, schedule, and any special accommodations</div>
              <div className="flex gap-2"><span className="text-sky-400">3.</span> You'll receive a trip guide with directions, parking, and what to wear</div>
            </div>
          </div>
          <button onClick={onClose} className="bg-sky-500 hover:bg-sky-400 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {Array.from({ length: SCHOOL_VISIT_STEPS }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${s <= step ? 'bg-sky-500 text-white' : 'bg-white/10 text-white/40'}`}>{s}</div>
              {s < SCHOOL_VISIT_STEPS && <div className={`w-8 h-0.5 ${s < step ? 'bg-sky-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Welcome + minimal contact ── */}
        {step === 1 && (
          <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl overflow-hidden shadow-2xl">
            <StepHeader stepNum={1} title="Plan an Airport Field Trip" subtitle="Bring your students to Boulder Municipal Airport" gallery={JB_GALLERY} category="fbo" />
            <form onSubmit={(e) => { e.preventDefault(); saveLead(1); setStep(2) }} className="p-6 space-y-5">
              <div className="bg-sky-400/5 border border-sky-400/20 rounded-xl p-4">
                <p className="text-slate-300 text-sm leading-relaxed">
                  Bring your class to a working airport and watch aviation come to life. Students see real aircraft up close,
                  meet pilots and mechanics, and connect classroom STEM concepts to real-world careers.
                </p>
                <p className="text-sky-400 text-xs mt-2 font-medium">Free for school groups · No minimum size · Bus parking available</p>
              </div>

              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Your name</label>
                <input required placeholder="First and last name" value={data.contactName} onChange={set('contactName')}
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Best way to reach you</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input type="email" placeholder="Email address" value={data.contactEmail} onChange={set('contactEmail')}
                    className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
                  <input type="tel" placeholder="Phone (optional)" value={data.contactPhone} onChange={set('contactPhone')}
                    className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
                </div>
              </div>

              <button type="submit" disabled={!data.contactName || (!data.contactEmail && !data.contactPhone)}
                className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                Continue →
              </button>
              <button type="button" onClick={onClose} className="w-full text-slate-500 hover:text-slate-300 text-xs py-1 transition-colors">Cancel</button>
            </form>
          </div>
        )}

        {/* ── STEP 2: Why aviation? Careers, economy, history ── */}
        {step === 2 && (
          <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl overflow-hidden shadow-2xl">
            <StepHeader stepNum={2} title="Why an Airport Visit?" subtitle="Standards-aligned STEM learning, career exposure, and community connection" gallery={JB_GALLERY} category="training" />
            <form onSubmit={(e) => { e.preventDefault(); saveLead(2); setStep(3) }} className="p-6 space-y-4">
              <p className="text-slate-400 text-xs">An airport field trip connects to Next Generation Science Standards (NGSS), CTE career clusters, and ICAP planning — all in one visit.</p>

              {/* AI-hardened / can't-outsource careers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FactCard Ic={IcAIHardened} title="Careers That Can't Be Automated" highlight
                  body="Aviation careers require hands-on judgment in unpredictable environments. A pilot reads weather, terrain, and mechanical feedback in real time. An A&P mechanic physically inspects, repairs, and signs off on aircraft. These roles are AI-resistant by nature — no algorithm can replace a human in the cockpit or on the ramp." />
                <FactCard Ic={IcCareer} title="Can't Be Outsourced, Can't Be Remote"
                  body="Aircraft must be maintained where they're based. Pilots must be in the cockpit. Controllers must be in the tower. Aviation jobs are permanently local — they can't be shipped overseas or done from a laptop. The FAA projects a need for 18,000+ new pilots per year through 2043." />
                <FactCard Ic={IcShield} title="High-Demand, High-Wage, No 4-Year Degree Required"
                  body="Median airline pilot salary: $219,140/yr. A&P mechanics: $75,400/yr. Air traffic controllers: $137,380/yr. Many paths start with certificates and on-the-job training — not a bachelor's degree. These are durable, well-compensated career pathways for students at every academic level." />
              </div>

              {/* Aviation drives every sector */}
              <div className="bg-sky-400/5 border border-sky-400/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <IcPlane size={16} className="text-sky-400" />
                  <h4 className="text-white text-xs font-semibold">Aviation Powers Every Sector of the Economy</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <IcMedical size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-400 text-[11px] leading-relaxed"><strong className="text-slate-200">Healthcare:</strong> Air ambulances, organ transport, medical supply chains to rural communities, and Flight for Life — patients are alive today because of aviation.</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <IcFlask size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-400 text-[11px] leading-relaxed"><strong className="text-slate-200">Science & Research:</strong> Weather monitoring, atmospheric sampling, wildfire mapping, aerial survey, and NOAA hurricane hunters — aviation is the platform for earth science.</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <IcLogistics size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-400 text-[11px] leading-relaxed"><strong className="text-slate-200">Transportation & Logistics:</strong> 45,000+ flights per day in the U.S. move 2.9 million passengers and 65,000 tons of cargo. Denver International is the 3rd busiest airport in the world.</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <IcShield size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-400 text-[11px] leading-relaxed"><strong className="text-slate-200">National Defense:</strong> Military aviation protects the nation's airspace 24/7. Buckley Space Force Base and the U.S. Air Force Academy are right here in Colorado.</p>
                  </div>
                </div>
              </div>

              {/* Tuskegee Airmen */}
              <div className="bg-surface border border-surface-border rounded-xl overflow-hidden">
                <img src={TUSKEGEE_IMG} alt="Pilots of the 332nd Fighter Group — Tuskegee Airmen — at Ramitelli Airfield, Italy, 1945" className="w-full h-36 object-cover object-top" />
                <div className="p-4">
                  <h4 className="text-white text-xs font-semibold mb-1">Aviation as a Force for Opportunity</h4>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    In 1941, the U.S. Army began training the first Black military pilots at Tuskegee Army Airfield in Alabama.
                    The <strong className="text-white">Tuskegee Airmen</strong> — 992 pilots trained between 1941 and 1946 —
                    compiled one of the finest combat records of World War II. The 332nd Fighter Group flew 1,578 combat missions,
                    destroyed 261 enemy aircraft, and earned 96 Distinguished Flying Crosses.
                    Their excellence under segregation was instrumental in President Truman's 1948 order to desegregate the U.S. military.
                    Aviation has always opened doors that other institutions kept closed.
                  </p>
                  <p className="text-slate-600 text-[9px] mt-2">Photo: Pilots of the 332nd Fighter Group, Ramitelli Airfield, Italy, 1945. U.S. Air Force / Public Domain.</p>
                </div>
              </div>

              {/* EAA + Young Eagles */}
              <div className="bg-surface border border-surface-border rounded-xl p-4">
                <div className="flex items-center gap-4 mb-3">
                  <img src={EAA_LOGO} alt="EAA — Experimental Aircraft Association" className="h-5 object-contain opacity-70" onError={(e) => { e.target.style.display = 'none' }} />
                  <img src={YOUNG_EAGLES_LOGO} alt="EAA Young Eagles" className="h-8 object-contain rounded opacity-80" onError={(e) => { e.target.style.display = 'none' }} />
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  <strong className="text-white">EAA Chapter 1627 (Boulder)</strong> and the <strong className="text-white">Young Eagles</strong> program
                  offer free first flights for students ages 8–17. Over 2.3 million Young Eagles flights have been flown nationwide since 1992.
                  Your visit can include a Young Eagles signup for interested students.
                </p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 border border-surface-border text-slate-300 hover:text-white py-3 rounded-xl text-sm transition-colors">← Back</button>
                <button type="submit" className="flex-[2] bg-sky-500 hover:bg-sky-400 text-white font-semibold py-3 rounded-xl text-sm transition-colors">Continue →</button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP 3: Group details — students, grade, school ── */}
        {step === 3 && (
          <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl overflow-hidden shadow-2xl">
            <StepHeader stepNum={3} title="Tell Us About Your Group" subtitle="So we can tailor the experience to your students" gallery={JB_GALLERY} category="fleet" />
            <form onSubmit={(e) => { e.preventDefault(); saveLead(3); setStep(4) }} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs block mb-1.5">School or organization</label>
                  <input placeholder="School name" value={data.schoolName} onChange={set('schoolName')}
                    className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1.5">Your role</label>
                  <select value={data.role} onChange={set('role')}
                    className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none">
                    <option value="teacher">Teacher</option>
                    <option value="homeschool">Homeschool Parent / Co-op</option>
                    <option value="admin">Administrator</option>
                    <option value="counselor">Counselor</option>
                    <option value="scout">Scout / Youth Leader</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 text-xs block mb-1.5">How many students?</label>
                <input type="number" min={1} max={200} placeholder="Approximate number" value={data.numStudents} onChange={set('numStudents')}
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
                {Number(data.numStudents) > 40 && (
                  <p className="text-amber-400 text-[10px] mt-1">Large groups are welcome! We'll split into smaller rotation stations so everyone gets a close-up experience.</p>
                )}
              </div>

              <div>
                <label className="text-slate-400 text-xs block mb-2">Grade range</label>
                <div className="flex flex-wrap gap-2">
                  {GRADE_RANGES.map((g) => (
                    <button type="button" key={g.id} onClick={() => set('gradeRange')(g.id)}
                      className={`px-4 py-2.5 rounded-xl text-center transition-all ${data.gradeRange === g.id ? 'bg-sky-500 text-white ring-2 ring-sky-400/30' : 'bg-surface border border-surface-border text-slate-300 hover:border-slate-500'}`}>
                      <div className="text-sm font-semibold">{g.label}</div>
                      <div className={`text-[10px] mt-0.5 ${data.gradeRange === g.id ? 'text-sky-100' : 'text-slate-500'}`}>{g.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grade-appropriate fact */}
              {data.gradeRange && (
                <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-xl p-3">
                  <p className="text-emerald-400 text-[10px] font-medium mb-1">Perfect fit for {GRADE_RANGES.find((g) => g.id === data.gradeRange)?.label}</p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {data.gradeRange === 'k-2' && 'Young learners get to see aircraft up close, sit in a cockpit, and learn how wings create lift using simple hands-on demos. Age-appropriate focus on observation and wonder.'}
                    {data.gradeRange === '3-5' && 'Students explore forces of flight, weather instruments, and how pilots navigate. Connects directly to NGSS PS2 (Forces and Motion) and ESS2 (Weather and Climate).'}
                    {data.gradeRange === '6-8' && 'Middle schoolers dig into aerodynamics calculations, weather data interpretation (real METAR readings), and career exploration mapping. Aligns with ICAP planning and NGSS MS-PS2, MS-ESS2.'}
                    {data.gradeRange === '9-12' && 'High schoolers engage with real-world physics applications, FAA career pathways (no 4-year degree required for many roles), and can discuss Part 61/141 training options. Great for CTE and ICAP.'}
                    {data.gradeRange === 'mixed' && 'We set up age-differentiated stations so every learner engages at their level — older students mentor younger ones, reinforcing their own understanding.'}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="flex-1 border border-surface-border text-slate-300 hover:text-white py-3 rounded-xl text-sm transition-colors">← Back</button>
                <button type="submit" disabled={!data.numStudents || !data.gradeRange}
                  className="flex-[2] bg-sky-500 hover:bg-sky-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors">Continue →</button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP 4: Interests — what do you want students to experience? ── */}
        {step === 4 && (
          <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl overflow-hidden shadow-2xl">
            <StepHeader stepNum={4} title="What Interests Your Students?" subtitle="Select all that apply — we'll build a custom experience" gallery={JB_GALLERY} category="flights" />
            <form onSubmit={(e) => { e.preventDefault(); saveLead(4); setStep(5) }} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {INTEREST_TOPICS.map((t) => {
                  const selected = data.interests.includes(t.id)
                  return (
                    <button type="button" key={t.id} onClick={() => toggleInterest(t.id)}
                      className={`flex items-start gap-3 p-3.5 rounded-xl text-left transition-all ${selected ? 'bg-sky-500/10 border-2 border-sky-400/50 ring-1 ring-sky-400/20' : 'bg-surface border-2 border-surface-border hover:border-slate-500'}`}>
                      <t.Ic size={18} className={`flex-shrink-0 mt-0.5 ${selected ? 'text-sky-400' : 'text-slate-500'}`} />
                      <div>
                        <div className={`text-xs font-semibold ${selected ? 'text-sky-300' : 'text-white'}`}>{t.label}</div>
                        <div className="text-slate-500 text-[10px] mt-0.5">{t.sub}</div>
                      </div>
                      {selected && <span className="ml-auto text-sky-400 text-sm">✓</span>}
                    </button>
                  )
                })}
              </div>

              {/* Contextual content based on selections */}
              {data.interests.includes('careers') && (
                <FactCard Ic={IcCareer} title="U.S. Aviation Employment"
                  body="The U.S. aviation industry employs 1.1 million workers directly and supports 10.9 million jobs total. The Denver metro region is home to the 3rd-busiest airport in the world (DEN), 100+ aerospace companies, and a growing demand for pilots, A&P mechanics, avionics technicians, UAS operators, and aerospace engineers." />
              )}
              {data.interests.includes('environment') && (
                <FactCard Ic={IcSatellite} title="Zero-Emission Flight Is Here"
                  body="Gliders fly on pure atmospheric energy — thermals, ridge lift, and wave. Our Pipistrel Alpha Trainer is electric-ready. Students see sustainability in action: engineless flight that can cover 300+ miles, and next-gen electric trainers that produce zero emissions." />
              )}
              {data.interests.includes('history') && (
                <FactCard Ic={IcPlane} title="Living Aviation History at KBDU"
                  body="Boulder Airport is home to antique aircraft restoration projects and vintage planes dating to the 1940s. Students can see fabric-covered taildraggers alongside modern glass-cockpit trainers — the full arc of aviation technology in one walk down the ramp." />
              )}
              {data.interests.includes('competition') && (
                <FactCard Ic={IcEngineering} title="World-Class Soaring from Boulder"
                  body="Pilots launch from KBDU and soar 300+ miles along the Rocky Mountain Front Range. Boulder's wave lift has produced flights above 40,000 feet. Competitive gliding is recognized by the International Olympic Committee and tests strategy, weather reading, and precision flying." />
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(3)} className="flex-1 border border-surface-border text-slate-300 hover:text-white py-3 rounded-xl text-sm transition-colors">← Back</button>
                <button type="submit" disabled={data.interests.length === 0}
                  className="flex-[2] bg-sky-500 hover:bg-sky-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors">Almost Done →</button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP 5: Logistics & submit ── */}
        {step === 5 && (
          <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl overflow-hidden shadow-2xl">
            <StepHeader stepNum={5} title="Schedule & Logistics" subtitle="Pick a date and we'll handle the rest" gallery={JB_GALLERY} category="scenery" />
            <form onSubmit={(e) => { e.preventDefault(); saveLead(5); setConfirmed(true) }} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs block mb-1.5">Preferred date</label>
                  <input type="date" value={data.preferredDate} onChange={set('preferredDate')}
                    className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1.5">Alternate date (optional)</label>
                  <input type="date" value={data.alternateDate} onChange={set('alternateDate')}
                    className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs block mb-1.5">Number of chaperones</label>
                  <input type="number" min={0} placeholder="Adults attending" value={data.chaperones} onChange={set('chaperones')}
                    className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-3 bg-surface border border-surface-border rounded-lg px-3 py-2.5 w-full cursor-pointer hover:border-sky-400/30 transition-colors">
                    <input type="checkbox" checked={data.busNeeded} onChange={(e) => set('busNeeded')(e.target.checked)}
                      className="w-4 h-4 rounded border-surface-border bg-surface text-sky-500 focus:ring-sky-400" />
                    <span className="text-sm text-slate-200">Arriving by school bus</span>
                  </label>
                </div>
              </div>
              {data.busNeeded && (
                <p className="text-sky-400 text-[10px]">Bus parking and turnaround space available on the FBO ramp. We'll send directions with your confirmation.</p>
              )}

              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Questions or special requests</label>
                <textarea placeholder="Accessibility needs, specific aircraft you'd like to see, tie-in to a curriculum unit..." value={data.questions} onChange={set('questions')} rows={3}
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none resize-none" />
              </div>

              {/* Summary */}
              <div className="bg-surface border border-surface-border rounded-xl p-4">
                <h4 className="text-white text-sm font-semibold mb-2">Visit Summary</h4>
                <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                  <span className="text-slate-400">Contact</span><span className="text-slate-200">{data.contactName}</span>
                  <span className="text-slate-400">School</span><span className="text-slate-200">{data.schoolName || '—'}</span>
                  <span className="text-slate-400">Students</span><span className="text-slate-200">{data.numStudents} ({GRADE_RANGES.find((g) => g.id === data.gradeRange)?.label || '—'})</span>
                  <span className="text-slate-400">Topics</span><span className="text-slate-200">{data.interests.length} selected</span>
                  <span className="text-slate-400">Date</span><span className="text-slate-200">{data.preferredDate || 'Flexible'}</span>
                  <span className="text-slate-400">Cost</span><span className="text-green-400 font-bold">Free</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(4)} className="flex-1 border border-surface-border text-slate-300 hover:text-white py-3 rounded-xl text-sm transition-colors">← Back</button>
                <button type="submit"
                  className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 rounded-xl text-sm transition-colors">Submit Request ✓</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   AIRPORTS ARE CRITICAL — Rotating message carousel
   + compact Noise Complaint wizard
   ═══════════════════════════════════════════════════════════ */

/* Wikimedia Commons — public domain / CC images (thumb.php endpoint) */
const wmt = (f, w = 640) => `https://commons.wikimedia.org/w/thumb.php?width=${w}&f=${encodeURIComponent(f.split('/').pop())}`

const CRITICAL_SLIDES = [
  {
    img: wmt('b/b5/Zepper-BK_117-C2-%28EC145%29-SchweizerischeRettungsflugwacht.jpg'),
    Ic: IcFirstAid,
    title: 'Emergency Medical Flights Save Lives',
    body: 'Air ambulances and Flight for Life helicopters operate from regional airports around the clock. Trauma patients, organ transports, and neonatal transfers depend on aviation infrastructure that must be ready at a moment\'s notice. An airport is part of the emergency response system.',
    stat: null,
    interest: 'Emergency medical aviation',
    followUpStat: 'Over 550,000 air ambulance transports per year in the U.S.',
    followUpImg: wmt('9/9f/Mercy-412-N410MA-050228-02cr.jpg'),
    followUpQ: 'Are you interested in EMS aviation, community health, or supporting airport medical readiness?',
  },
  {
    img: wmt('6/62/Thunder_Over_The_Empire_Airfest_2012_120519-F-EI671-001.jpg'),
    Ic: IcFire,
    title: 'Wildfire Response Depends on Aviation',
    body: 'Colorado averages over 4,000 wildfires per year. Air tankers, lead planes, and reconnaissance aircraft launch from airports across the state to protect homes, forests, and lives. Training airports keep these pilots current and ready when the call comes.',
    stat: null,
    interest: 'Wildfire & emergency response aviation',
    followUpStat: '4,000+ wildfires per year in Colorado — aviation is the first line of defense',
    followUpImg: wmt('6/62/Thunder_Over_The_Empire_Airfest_2012_120519-F-EI671-001.jpg'),
    followUpQ: 'Would you like to learn about aerial firefighting careers, volunteer opportunities, or community preparedness?',
  },
  {
    img: wmt('7/77/Young_Eagles_participant_in_the_cockpit_after_her_flight.jpg'),
    Ic: IcCareer,
    title: 'Young Eagles — Dreams Take Flight at Boulder',
    body: 'EAA Chapter 1627 has given more than 800 young people ages 8–17 their first flight right here at Boulder Municipal Airport. Nationwide, 2.3 million Young Eagles flights have launched careers in aviation and aerospace. Participants are 5.4x more likely to become pilots.',
    stat: '800+ youth flown at KBDU',
    interest: 'Young Eagles & youth aviation programs',
    followUpStat: '2.3 million Young Eagles flights nationwide — participants are 5.4x more likely to become pilots',
    followUpImg: wmt('7/77/Young_Eagles_participant_in_the_cockpit_after_her_flight.jpg'),
    followUpQ: 'Do you have a young person who would love a free introductory flight, or would you like to volunteer as a pilot?',
  },
  {
    img: wmt('f/f9/Pilots_of_the_332nd_Fighter_Group.jpg'),
    Ic: IcShield,
    title: 'Aviation Opens Doors Others Keep Closed',
    body: 'In 1941, the Tuskegee Airmen became the first Black military pilots in U.S. history. The 332nd Fighter Group flew 1,578 combat missions and earned 96 Distinguished Flying Crosses in World War II. Their excellence was instrumental in desegregating the U.S. military. Aviation has always been a force for opportunity.',
    stat: '992 pilots trained, 1941–1946',
    interest: 'Aviation history & diversity in flight',
    followUpStat: '992 Tuskegee Airmen trained — their legacy lives on in every diverse cockpit today',
    followUpImg: wmt('f/f9/Pilots_of_the_332nd_Fighter_Group.jpg'),
    followUpQ: 'Are you interested in aviation history programs, scholarship opportunities, or community outreach?',
  },
  {
    img: wmt('d/d8/FedEx_Express_B777F_%28N850FD%29_%40_HKG%2C_Jan_2019_%2801%29.jpg'),
    Ic: IcLogistics,
    title: 'The Flights You Don\'t See',
    body: 'Boulder is too small for commercial service, but every airline flight at Denver International exists because pilots trained at airports just like KBDU. Amazon packages, fresh seafood 2,000 miles from the ocean, overnight document delivery — the entire system rests on a network of training airports where the next generation learns to fly.',
    stat: '45,000 flights per day in U.S. airspace',
    interest: 'Pilot training & airline career paths',
    followUpStat: 'Hundreds of pilots have launched their careers training right here at Boulder Municipal',
    followUpImg: wmt('e/e3/Cessna172InstructorAndStudent.png'),
    followUpQ: 'Are you considering flight training, or would you like to learn about the path from student pilot to airline captain?',
  },
  {
    img: wmt('2/22/Canada_Search_and_Rescue.jpg'),
    Ic: IcHelicopter,
    title: 'Search & Rescue in the Mountains',
    body: 'Colorado runs more than 3,600 search and rescue incidents per year — more than any other state. The Colorado Army National Guard performs 60% of all U.S. SAR hoist rescues, saving dozens of lives annually from the backcountry. Helicopters and fixed-wing spotters launch from regional airports to reach hikers, climbers, and skiers in distress.',
    stat: '3,600+ SAR incidents per year in Colorado',
    interest: 'Search & rescue aviation',
    followUpStat: 'Colorado\'s Army National Guard performs 60% of all U.S. SAR hoist rescues',
    followUpImg: wmt('2/22/Canada_Search_and_Rescue.jpg'),
    followUpQ: 'Are you interested in Civil Air Patrol, mountain rescue volunteering, or SAR aviation careers?',
  },
  {
    img: wmt('e/e3/Cessna172InstructorAndStudent.png'),
    Ic: IcPlane,
    title: 'Someone\'s First Flight Is Happening Right Now',
    body: 'Every airline captain, every medevac pilot, every cargo pilot started at an airport like this one — nervous, excited, and dreaming of the sky. The FAA projects a need for 18,000 new pilots every year through 2043. The airplane you hear may be carrying someone\'s future.',
    stat: '18,000 new pilots needed per year',
    interest: 'Learning to fly',
    followUpStat: '18,000 new pilots needed per year — the best time to start is now',
    followUpImg: wmt('e/e3/Cessna172InstructorAndStudent.png'),
    followUpQ: 'Have you ever thought about learning to fly? Would you like to book a discovery flight?',
  },
  {
    img: wmt('9/9f/Mercy-412-N410MA-050228-02cr.jpg'),
    Ic: IcMedical,
    title: 'Healthcare Reaches Rural Colorado by Air',
    body: 'Critical-access hospitals across the Western Slope and High Plains depend on air transport for specialists, lab samples, and patient transfers. When a Level I trauma center is 200 miles away, a helicopter is not a luxury — it\'s the difference between life and death.',
    stat: null,
    interest: 'Rural healthcare & medical aviation',
    followUpStat: 'When the nearest trauma center is 200 miles away, aviation is the difference',
    followUpImg: wmt('b/b5/Zepper-BK_117-C2-%28EC145%29-SchweizerischeRettungsflugwacht.jpg'),
    followUpQ: 'Are you involved in healthcare, emergency services, or community health planning?',
  },
  {
    img: wmt('b/b3/DIA_Roof_and_Hotel.jpg'),
    Ic: IcAIHardened,
    title: 'Careers That Can\'t Be Automated or Outsourced',
    body: 'A pilot reads weather, terrain, and mechanical feedback in real time. A mechanic physically inspects and signs off on aircraft. These careers require hands-on judgment in unpredictable environments — they are permanently local, AI-resistant, and in high demand. Median airline pilot salary: $219,140/yr.',
    stat: '674,000 new pilots needed worldwide by 2045',
    interest: 'Aviation careers',
    followUpStat: 'Median airline pilot salary: $219,140/yr — no 4-year degree required',
    followUpImg: wmt('b/b3/DIA_Roof_and_Hotel.jpg'),
    followUpQ: 'Are you exploring career options, considering a career change, or advising a student?',
  },
]

/* ── Carousel component ── */
function AirportsCriticalCarousel({ onSlideClick }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (paused) return
    timerRef.current = setInterval(() => setActive((i) => (i + 1) % CRITICAL_SLIDES.length), 6000)
    return () => clearInterval(timerRef.current)
  }, [paused])

  const go = (i) => { setActive(i); setPaused(true) }
  const slide = CRITICAL_SLIDES[active]

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden cursor-pointer group"
      onClick={() => { setPaused(true); onSlideClick?.(slide) }}>
      {/* Image header */}
      <div className="relative h-44 overflow-hidden">
        <img src={slide.img} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 group-hover:from-black/70 transition-colors" />
        <div className="relative z-10 flex items-end h-full p-5">
          <div className="flex items-center gap-3">
            <slide.Ic size={22} className="text-white/80" />
            <h3 className="text-white font-bold text-lg leading-snug">{slide.title}</h3>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <p className="text-slate-300 text-sm leading-relaxed">{slide.body}</p>
        {slide.stat && (
          <div className="mt-3 bg-sky-400/5 border border-sky-400/15 rounded-lg px-3 py-2">
            <span className="text-sky-400 text-xs font-semibold">{slide.stat}</span>
          </div>
        )}
        <p className="text-sky-400/50 text-[10px] mt-3 group-hover:text-sky-400/80 transition-colors">Click to learn more or get involved →</p>
      </div>

      {/* Dot navigation */}
      <div className="flex items-center justify-center gap-1.5 pb-4">
        {CRITICAL_SLIDES.map((_, i) => (
          <button key={i} onClick={(e) => { e.stopPropagation(); go(i) }} aria-label={`Slide ${i + 1}`}
            className={`transition-all ${i === active ? 'w-5 h-1.5 rounded-full bg-sky-400' : 'w-1.5 h-1.5 rounded-full bg-slate-600 hover:bg-slate-400'}`} />
        ))}
      </div>
    </div>
  )
}

/* ── Interest wizard — opens when a carousel slide is clicked ── */
function InterestWizard({ slide, onClose }) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState({
    interest: slide.interest,
    name: '', email: '', phone: '',
    context: '', goals: '',
  })
  const set = (k) => (v) => setData((d) => ({ ...d, [k]: typeof v === 'object' && v?.target ? v.target.value : v }))

  const save = (stepNum) => {
    // Save partial data into CRM prospects
    const key = 'crm_prospects_journeys'
    const prospects = JSON.parse(localStorage.getItem(key) || '[]')
    const existingIdx = prospects.findIndex((p) => p.id === `p-interest-${slide.interest}`)
    const prospect = {
      id: data.email ? `p-int-${Date.now()}` : `p-interest-${slide.interest}`,
      name: data.name || 'Interested visitor',
      email: data.email || '',
      phone: data.phone || '',
      source: 'portal-booking',
      stage: data.email ? 'contacted' : 'new',
      package: 'discovery',
      groupSize: 1,
      value: 0,
      created: new Date().toISOString(),
      notes: `Interest: ${data.interest}. ${data.context ? 'Context: ' + data.context + '. ' : ''}${data.goals ? 'Goals: ' + data.goals : ''}`.trim(),
      nextAction: data.email ? 'Follow up on interest' : null,
      contactLog: data.email ? [{ id: `cl-${Date.now()}`, type: 'email', direction: 'inbound', body: `Portal interest: ${data.interest}`, at: new Date().toISOString() }] : [],
      operator: 'journeys',
      _wizardStep: stepNum,
    }
    if (existingIdx >= 0 && !data.email) {
      prospects[existingIdx] = { ...prospects[existingIdx], ...prospect, id: prospects[existingIdx].id }
    } else {
      prospects.unshift(prospect)
    }
    localStorage.setItem(key, JSON.stringify(prospects))
  }

  const CONTEXT_OPTIONS = [
    { id: 'personal',  label: 'Personal interest' },
    { id: 'career',    label: 'Considering a career' },
    { id: 'child',     label: 'For my child / student' },
    { id: 'volunteer', label: 'Want to volunteer' },
    { id: 'community', label: 'Community involvement' },
    { id: 'curious',   label: 'Just curious' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl overflow-hidden shadow-2xl">
          {/* ── Step 1: Interest confirmed + minimal contact ── */}
          {step === 1 && (
            <>
              <div className="relative h-32 overflow-hidden">
                <img src={slide.img} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20" />
                <div className="relative z-10 flex items-end h-full p-5">
                  <slide.Ic size={18} className="text-white/70 mr-2" />
                  <h3 className="text-white font-bold text-sm leading-snug">{slide.title}</h3>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-sky-400/5 border border-sky-400/20 rounded-xl p-3">
                  <p className="text-sky-300 text-xs font-medium">I'm interested in: {slide.interest}</p>
                </div>
                <p className="text-slate-400 text-xs">We'd love to connect you with the right people. Leave your info and we'll reach out.</p>
                <input placeholder="Name" value={data.name} onChange={set('name')}
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input type="email" placeholder="Email" value={data.email} onChange={set('email')}
                    className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
                  <input type="tel" placeholder="Phone (optional)" value={data.phone} onChange={set('phone')}
                    className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
                </div>
                <button onClick={() => { save(1); setStep(2) }} disabled={!data.name && !data.email}
                  className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl text-sm transition-colors">Continue →</button>
              </div>
            </>
          )}

          {/* ── Step 2: Follow-up photo + stat + ask more ── */}
          {step === 2 && (
            <>
              <div className="relative h-36 overflow-hidden">
                <img src={slide.followUpImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20" />
                <div className="relative z-10 flex items-end h-full p-5">
                  <div className="bg-sky-400/10 border border-sky-400/20 rounded-lg px-3 py-1.5">
                    <span className="text-sky-400 text-xs font-bold">{slide.followUpStat}</span>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-slate-300 text-sm leading-relaxed">{slide.followUpQ}</p>
                <div>
                  <label className="text-slate-500 text-[10px] uppercase tracking-wide">What best describes you?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
                    {CONTEXT_OPTIONS.map((c) => (
                      <button key={c.id} onClick={() => set('context')(c.id)}
                        className={`p-2 rounded-xl text-center text-[11px] font-medium transition-all ${data.context === c.id ? 'bg-sky-500/15 border border-sky-400/50 text-sky-300' : 'bg-surface border border-surface-border text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 border border-surface-border text-slate-300 hover:text-white py-2.5 rounded-xl text-sm transition-colors">← Back</button>
                  <button onClick={() => { save(2); setStep(3) }}
                    className="flex-[2] bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Continue →</button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: Goals + submit ── */}
          {step === 3 && (
            <div className="p-6 space-y-4">
              <h3 className="text-white font-bold text-base">Anything else you'd like us to know?</h3>
              <p className="text-slate-500 text-xs">Tell us what you're hoping for — we'll make sure the right person follows up.</p>
              <textarea placeholder="I'd like to... / I'm curious about... / My goal is..." value={data.goals} onChange={set('goals')} rows={4}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none resize-none" />
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 border border-surface-border text-slate-300 hover:text-white py-2.5 rounded-xl text-sm transition-colors">← Back</button>
                <button onClick={() => { save(3); setStep(4) }}
                  className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Submit →</button>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === 4 && (
            <div className="p-8 text-center space-y-4">
              <slide.Ic size={28} className="text-sky-400 mx-auto" />
              <h3 className="text-xl font-bold text-white">Thank you{data.name ? `, ${data.name.split(' ')[0]}` : ''}!</h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
                We've received your interest in <strong className="text-slate-200">{slide.interest.toLowerCase()}</strong>.
                {data.email ? ' We\'ll be in touch soon.' : ' Visit us at the airport anytime — we\'d love to show you around.'}
              </p>
              <button onClick={onClose} className="bg-sky-500 hover:bg-sky-400 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors">Done</button>
            </div>
          )}
        </div>

        <button onClick={onClose} className="w-full text-slate-600 hover:text-slate-400 text-xs py-3 transition-colors text-center">Cancel</button>
      </div>
    </div>
  )
}

/* ── Noise complaint wizard (progressive, saves partial data at each step) ── */

const NOISE_WIZARD_STEPS = 4

const LOUDNESS_LEVELS = [
  { id: 'barely', label: 'Barely noticeable', desc: 'Could hear it but didn\'t interrupt' },
  { id: 'moderate', label: 'Noticeable', desc: 'Had to raise my voice' },
  { id: 'loud', label: 'Very loud', desc: 'Disruptive — hard to think' },
  { id: 'extreme', label: 'Extremely loud', desc: 'Shook windows or woke someone' },
]

const DURATION_OPTIONS = [
  { id: 'brief', label: 'A few seconds', desc: 'Single pass' },
  { id: 'minute', label: 'About a minute', desc: 'One pattern' },
  { id: 'several', label: 'Several minutes', desc: 'Multiple passes' },
  { id: 'extended', label: '10+ minutes', desc: 'Extended practice' },
]

const TIME_OPTIONS = [
  { id: 'morning', label: 'Morning', desc: '6 AM – 12 PM' },
  { id: 'afternoon', label: 'Afternoon', desc: '12 – 6 PM' },
  { id: 'evening', label: 'Evening', desc: '6 – 9 PM' },
  { id: 'night', label: 'Night', desc: 'After 9 PM' },
]

/* Facts shown in the wizard — one random per step, never repeated */
const NOISE_CONTEXT_FACTS = [
  { Ic: IcVolumeOff, text: 'Pilots at KBDU follow voluntary noise abatement procedures — avoiding populated areas and maintaining minimum altitudes over the city.' },
  { Ic: IcHomeHeart, text: 'Flight instructors brief every student on noise-sensitive neighborhoods and preferred departure routes that minimize overflights.' },
  { Ic: IcEar, text: 'Repetitive practice flights are discouraged at night and concentrated over less populated terrain whenever possible.' },
  { Ic: IcFirstAid, text: 'Emergency medical helicopters and Flight for Life depend on regional airports being available 24/7 — an airport is part of the emergency response system.' },
  { Ic: IcFire, text: 'Colorado\'s wildfire season depends on aviation. Air tankers and recon aircraft launch from airports across the state to protect communities.' },
  { Ic: IcCareer, text: 'Every airline captain started at an airport like this one. The FAA projects a need for 18,000 new pilots per year through 2043.' },
  { Ic: IcLogistics, text: 'Amazon packages, fresh seafood 2,000 miles from the ocean, overnight delivery — the entire system rests on a network of training airports.' },
  { Ic: IcHelicopter, text: 'Colorado runs 3,600+ search and rescue incidents per year. Helicopters launch from regional airports to reach hikers and climbers in distress.' },
  { Ic: IcMessage, text: 'Every noise report is reviewed and used to refine flight procedures, pilot briefings, and noise abatement guidance.' },
  { Ic: IcPlane, text: 'The airplane you hear may be carrying someone on their very first flight — nervous, excited, and dreaming of the sky.' },
]

function useShuffledFacts() {
  const [order] = useState(() => {
    const indices = NOISE_CONTEXT_FACTS.map((_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]]
    }
    return indices
  })
  return (stepIdx) => NOISE_CONTEXT_FACTS[order[stepIdx % order.length]]
}

function NoiseWizard({ onClose }) {
  const [step, setStep] = useState(1)
  const [done, setDone] = useState(false)
  const [convertToSupport, setConvertToSupport] = useState(false)
  const [supportDone, setSupportDone] = useState(false)
  const getFact = useShuffledFacts()
  const [data, setData] = useState({
    neighborhood: '', crossStreet: '',
    loudness: '', duration: '', timeOfDay: '', date: '',
    name: '', email: '', phone: '', notes: '',
  })
  const [supportData, setSupportData] = useState({ name: '', email: '', comment: '' })
  const set = (k) => (v) => setData((d) => ({ ...d, [k]: typeof v === 'object' && v?.target ? v.target.value : v }))

  const save = () => {
    const reports = JSON.parse(localStorage.getItem('jb_noise_reports') || '[]')
    reports.push({ ...data, step, ts: new Date().toISOString() })
    localStorage.setItem('jb_noise_reports', JSON.stringify(reports))
  }

  const saveSupport = () => {
    const feedback = JSON.parse(localStorage.getItem('jb_airport_feedback') || '[]')
    feedback.push({ ...supportData, type: 'support', convertedFrom: 'noise_complaint', convertedAtStep: step, ts: new Date().toISOString() })
    localStorage.setItem('jb_airport_feedback', JSON.stringify(feedback))
  }

  const next = () => { save(); if (step < NOISE_WIZARD_STEPS) setStep(step + 1); else setDone(true) }

  const fact = getFact(step - 1)

  /* ── Converted to support / compliment ── */
  if (convertToSupport) {
    if (supportDone) {
      return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-10 w-full max-w-md mx-4 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <IcSupport size={32} className="text-emerald-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Thank You for Your Support!</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Your voice matters. Community support helps keep Boulder Municipal Airport operating, training future pilots, and serving emergency services.
            </p>
            <button onClick={onClose} className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors">Done</button>
          </div>
        </div>
      )
    }
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
        <div className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="bg-surface-card/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <IcSupport size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">I Support Boulder Aviation</h3>
                  <p className="text-slate-500 text-[11px]">Share a kind word — pilots, instructors, and airport staff will see it.</p>
                </div>
              </div>
              <textarea placeholder="What do you appreciate about the airport? A sunset takeoff you watched, the sound of a student's first solo, the community it creates..."
                value={supportData.comment} onChange={(e) => setSupportData((d) => ({ ...d, comment: e.target.value }))} rows={4}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Name (optional)" value={supportData.name} onChange={(e) => setSupportData((d) => ({ ...d, name: e.target.value }))}
                  className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none" />
                <input type="email" placeholder="Email (optional)" value={supportData.email} onChange={(e) => setSupportData((d) => ({ ...d, email: e.target.value }))}
                  className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setConvertToSupport(false)}
                className="flex-1 border border-surface-border text-slate-300 hover:text-white py-2.5 rounded-xl text-sm transition-colors">← Back to Report</button>
              <button onClick={() => { saveSupport(); setSupportDone(true) }}
                className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Send My Support</button>
            </div>
          </div>
          <button onClick={onClose} className="w-full text-slate-600 hover:text-slate-400 text-xs py-3 transition-colors text-center">Cancel</button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
        <div className="bg-surface-card border border-surface-border rounded-2xl p-10 w-full max-w-md mx-4 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
          <IcMessage size={32} className="text-sky-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Thank You</h3>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Your feedback has been recorded. We review every report and use them to improve our noise abatement procedures and pilot briefings.
          </p>
          <button onClick={onClose} className="bg-sky-500 hover:bg-sky-400 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {Array.from({ length: NOISE_WIZARD_STEPS }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${s <= step ? 'bg-sky-500 text-white' : 'bg-white/10 text-white/40'}`}>{s}</div>
              {s < NOISE_WIZARD_STEPS && <div className={`w-6 h-0.5 ${s < step ? 'bg-sky-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl overflow-hidden shadow-2xl">
          {/* ── Step 1: Location ── */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-base">Where did you hear it?</h3>
                <p className="text-slate-500 text-[11px] mt-1">Help us identify the area so we can review flight paths.</p>
              </div>
              <input placeholder="Neighborhood (e.g. North Boulder, Gunbarrel)" value={data.neighborhood} onChange={set('neighborhood')}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
              <input placeholder="Nearest cross street (e.g. 28th & Iris)" value={data.crossStreet} onChange={set('crossStreet')}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
            </div>
          )}

          {/* ── Step 2: When + how loud ── */}
          {step === 2 && (
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-base">When and how loud?</h3>
              </div>
              <div>
                <label className="text-slate-500 text-[10px] uppercase tracking-wide">Time of day</label>
                <div className="grid grid-cols-4 gap-2 mt-1.5">
                  {TIME_OPTIONS.map((t) => (
                    <button type="button" key={t.id} onClick={() => set('timeOfDay')(t.id)}
                      className={`p-2 rounded-xl text-center transition-all ${data.timeOfDay === t.id ? 'bg-sky-500/15 border border-sky-400/50 text-sky-300' : 'bg-surface border border-surface-border text-slate-300 hover:border-slate-500'}`}>
                      <div className="text-[11px] font-semibold">{t.label}</div>
                      <div className="text-[9px] text-slate-600">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <input type="date" value={data.date} onChange={set('date')}
                className="w-full sm:w-48 bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-sky-400 focus:outline-none" />
              <div>
                <label className="text-slate-500 text-[10px] uppercase tracking-wide">How loud?</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {LOUDNESS_LEVELS.map((l) => (
                    <button type="button" key={l.id} onClick={() => set('loudness')(l.id)}
                      className={`p-2 rounded-xl text-left transition-all ${data.loudness === l.id ? 'bg-sky-500/15 border border-sky-400/50 text-sky-300' : 'bg-surface border border-surface-border text-slate-300 hover:border-slate-500'}`}>
                      <div className="text-[11px] font-semibold">{l.label}</div>
                      <div className="text-[9px] text-slate-600">{l.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Duration + notes ── */}
          {step === 3 && (
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-base">How long and any details?</h3>
              </div>
              <div>
                <label className="text-slate-500 text-[10px] uppercase tracking-wide">Duration</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {DURATION_OPTIONS.map((d) => (
                    <button type="button" key={d.id} onClick={() => set('duration')(d.id)}
                      className={`p-2 rounded-xl text-left transition-all ${data.duration === d.id ? 'bg-sky-500/15 border border-sky-400/50 text-sky-300' : 'bg-surface border border-surface-border text-slate-300 hover:border-slate-500'}`}>
                      <div className="text-[11px] font-semibold">{d.label}</div>
                      <div className="text-[9px] text-slate-600">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <textarea placeholder="Direction of flight, type of aircraft, anything else helpful..." value={data.notes} onChange={set('notes')} rows={3}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none resize-none" />
            </div>
          )}

          {/* ── Step 4: Contact (optional) ── */}
          {step === 4 && (
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-base">Contact information</h3>
                <p className="text-slate-500 text-[11px] mt-1">Optional — only used if we need to follow up. Never shared.</p>
              </div>
              <input placeholder="Name" value={data.name} onChange={set('name')}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
              <input type="email" placeholder="Email" value={data.email} onChange={set('email')}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
              <input type="tel" placeholder="Phone" value={data.phone} onChange={set('phone')}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
            </div>
          )}

          {/* Context fact — random, not repeated */}
          <div className="mx-6 mb-4 bg-sky-400/5 border border-sky-400/15 rounded-xl p-3 flex items-start gap-2.5">
            <fact.Ic size={16} className="text-sky-400/60 flex-shrink-0 mt-0.5" />
            <p className="text-slate-400 text-[11px] leading-relaxed">{fact.text}</p>
          </div>

          {/* Navigation */}
          <div className="px-6 pb-4 flex gap-3">
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="flex-1 border border-surface-border text-slate-300 hover:text-white py-2.5 rounded-xl text-sm transition-colors">← Back</button>
            )}
            <button onClick={next}
              className={`${step > 1 ? 'flex-[2]' : 'w-full'} ${step === NOISE_WIZARD_STEPS ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-sky-500 hover:bg-sky-400'} text-white font-semibold py-2.5 rounded-xl text-sm transition-colors`}>
              {step === NOISE_WIZARD_STEPS ? 'Submit Report' : 'Next →'}
            </button>
          </div>

          {/* Convert to support */}
          <div className="px-6 pb-6">
            <button onClick={() => setConvertToSupport(true)}
              className="w-full flex items-center justify-center gap-2 text-emerald-400/70 hover:text-emerald-300 text-[11px] py-2 transition-colors">
              <IcThumbUp size={13} />
              Actually, I support aviation — leave a compliment instead
            </button>
          </div>
        </div>

        <button onClick={onClose} className="w-full text-slate-600 hover:text-slate-400 text-xs py-3 transition-colors text-center">Cancel</button>
      </div>
    </div>
  )
}

/* ── Combined section: carousel + noise CTA ── */
function SupportWizard({ onClose }) {
  const [done, setDone] = useState(false)
  const [data, setData] = useState({ name: '', email: '', comment: '' })

  const save = () => {
    const feedback = JSON.parse(localStorage.getItem('jb_airport_feedback') || '[]')
    feedback.push({ ...data, type: 'support', ts: new Date().toISOString() })
    localStorage.setItem('jb_airport_feedback', JSON.stringify(feedback))
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
        <div className="bg-surface-card border border-surface-border rounded-2xl p-10 w-full max-w-md mx-4 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
          <IcSupport size={32} className="text-emerald-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Thank You for Your Support!</h3>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Your voice matters. Community support helps keep Boulder Municipal Airport operating, training future pilots, and serving emergency services.
          </p>
          <button onClick={onClose} className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-surface-card/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <IcSupport size={20} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">I Support Boulder Aviation</h3>
                <p className="text-slate-500 text-[11px]">Let the airport know you value what it brings to our community.</p>
              </div>
            </div>
            <textarea placeholder="What do you appreciate? The sound of a Cessna on a summer evening, a child pointing at takeoffs, the pilots who volunteer for search and rescue..."
              value={data.comment} onChange={(e) => setData((d) => ({ ...d, comment: e.target.value }))} rows={4}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Name (optional)" value={data.name} onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
                className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none" />
              <input type="email" placeholder="Email (optional)" value={data.email} onChange={(e) => setData((d) => ({ ...d, email: e.target.value }))}
                className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none" />
            </div>

            <div className="bg-emerald-400/5 border border-emerald-400/15 rounded-xl p-3 flex items-start gap-2.5">
              <IcPlane size={16} className="text-emerald-400/60 flex-shrink-0 mt-0.5" />
              <p className="text-slate-400 text-[11px] leading-relaxed">Every airline captain started at an airport like this one. Your support helps ensure the next generation of pilots has a place to learn.</p>
            </div>
          </div>
          <div className="px-6 pb-6">
            <button onClick={() => { save(); setDone(true) }}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Register My Support</button>
          </div>
        </div>
        <button onClick={onClose} className="w-full text-slate-600 hover:text-slate-400 text-xs py-3 transition-colors text-center">Cancel</button>
      </div>
    </div>
  )
}

function AirportsCriticalSection() {
  const [showNoise, setShowNoise] = useState(false)
  const [showSupport, setShowSupport] = useState(false)
  const [interestSlide, setInterestSlide] = useState(null)

  return (
    <>
      <section id="sec-noise-report" className="py-16 px-6 bg-gradient-to-b from-surface via-surface-card/20 to-surface">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Heading */}
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Your Airport, Your Community</h2>
            <p className="text-slate-500 text-sm">Boulder Municipal Airport has served this community since 1942.</p>
          </div>

          {/* Carousel */}
          <AirportsCriticalCarousel onSlideClick={setInterestSlide} />

          {/* Community feedback CTAs — noise + support */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <IcEar size={16} className="text-slate-400" />
                <h3 className="text-white text-sm font-semibold">Aircraft Noise Feedback</h3>
              </div>
              <p className="text-slate-500 text-xs leading-relaxed">
                We take noise seriously. Pilots follow voluntary abatement procedures, avoid populated areas, and limit night practice. Your feedback helps us improve.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setShowNoise(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-surface border border-surface-border hover:border-sky-400/30 text-slate-300 hover:text-white px-5 py-3 rounded-xl text-xs font-medium transition-all">
                <IcSend size={14} />
                Register Noise Complaint
              </button>
              <button onClick={() => setShowSupport(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/25 hover:border-emerald-400/50 text-emerald-300 hover:text-emerald-200 px-5 py-3 rounded-xl text-xs font-medium transition-all">
                <IcSupport size={14} />
                Register Support for Aviation
              </button>
            </div>
          </div>
        </div>
      </section>

      {showNoise && <NoiseWizard onClose={() => setShowNoise(false)} />}
      {showSupport && <SupportWizard onClose={() => setShowSupport(false)} />}
      {interestSlide && <InterestWizard slide={interestSlide} onClose={() => setInterestSlide(null)} />}
    </>
  )
}


/* ═══════════════════════════════════════════════════════════
   TRAINING INTEREST WIZARD — opens when a training program is clicked
   Progressive: interest → contact → goals → CRM
   ═══════════════════════════════════════════════════════════ */

const TRAINING_EXPERIENCE = [
  { id: 'none',       label: 'No experience yet' },
  { id: 'discovery',  label: 'Took a discovery flight' },
  { id: 'student',    label: 'Currently a student pilot' },
  { id: 'private',    label: 'Private pilot — adding a rating' },
  { id: 'commercial', label: 'Commercial pilot — advanced training' },
  { id: 'lapsed',     label: 'Used to fly — getting back into it' },
]

const TRAINING_TIMELINE = [
  { id: 'asap',       label: 'Ready now' },
  { id: 'month',      label: 'Within a month' },
  { id: 'quarter',    label: 'Next few months' },
  { id: 'exploring',  label: 'Just exploring' },
]

function TrainingInterestWizard({ program, onClose }) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState({
    program: program.name,
    programId: program.id,
    name: '', email: '', phone: '',
    experience: '', timeline: '', goals: '',
  })
  const set = (k) => (v) => setData((d) => ({ ...d, [k]: typeof v === 'object' && v?.target ? v.target.value : v }))

  const save = (stepNum) => {
    const key = 'crm_prospects_journeys'
    const prospects = JSON.parse(localStorage.getItem(key) || '[]')
    const prospect = {
      id: `p-trn-${Date.now()}`,
      name: data.name || 'Training inquiry',
      email: data.email || '',
      phone: data.phone || '',
      source: 'portal-booking',
      stage: data.email ? 'contacted' : 'new',
      package: program.id === 'discovery' ? 'discovery' : program.id === 'private' ? 'ppl-program' : program.id === 'instrument' ? 'ifr-program' : program.id === 'commercial' ? 'commercial' : 'discovery',
      groupSize: 1,
      value: program.rate ? program.rate * 10 : 225,
      created: new Date().toISOString(),
      notes: `Program: ${data.program}. Experience: ${data.experience || 'not specified'}. Timeline: ${data.timeline || 'not specified'}. ${data.goals ? 'Goals: ' + data.goals : ''}`.trim(),
      nextAction: data.email ? 'Follow up — training inquiry' : null,
      contactLog: data.email ? [{ id: `cl-${Date.now()}`, type: 'email', direction: 'inbound', body: `Portal inquiry: ${data.program}`, at: new Date().toISOString() }] : [],
      operator: 'journeys',
      _wizardStep: stepNum,
    }
    prospects.unshift(prospect)
    localStorage.setItem(key, JSON.stringify(prospects))
  }

  // Gallery photo for the header
  const photo = JB_GALLERY.find((g) => g.category === 'training' && g.img)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl overflow-hidden shadow-2xl">

          {/* ── Step 1: Interest confirmed + contact ── */}
          {step === 1 && (
            <>
              {photo && (
                <div className="relative h-32 overflow-hidden">
                  <img src={photo.img} alt={photo.alt} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20" />
                  <div className="relative z-10 flex items-end h-full p-5">
                    <h3 className="text-white font-bold text-sm">I'm interested in: {program.name}</h3>
                  </div>
                </div>
              )}
              <div className="p-6 space-y-4">
                <p className="text-slate-400 text-xs leading-relaxed">{program.desc}</p>
                <div className="bg-sky-400/5 border border-sky-400/15 rounded-lg p-3">
                  <p className="text-sky-400 text-xs font-medium">We'll connect you with the right instructor and help you plan your next step.</p>
                </div>
                <input placeholder="Name" value={data.name} onChange={set('name')}
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input type="email" placeholder="Email" value={data.email} onChange={set('email')}
                    className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
                  <input type="tel" placeholder="Phone (optional)" value={data.phone} onChange={set('phone')}
                    className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
                </div>
                <button onClick={() => { save(1); setStep(2) }} disabled={!data.name && !data.email}
                  className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl text-sm transition-colors">Continue →</button>
              </div>
            </>
          )}

          {/* ── Step 2: Experience + timeline ── */}
          {step === 2 && (
            <>
              {(() => { const p2 = JB_GALLERY.find((g) => g.category === 'fleet' && g.img); return p2 ? (
                <div className="relative h-28 overflow-hidden">
                  <img src={p2.img} alt={p2.alt} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20" />
                  <div className="relative z-10 flex items-end h-full p-5">
                    <div className="bg-sky-400/10 border border-sky-400/20 rounded-lg px-3 py-1.5">
                      <span className="text-sky-400 text-xs font-bold">Hundreds of pilots have started their career at KBDU</span>
                    </div>
                  </div>
                </div>
              ) : null })()}
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-slate-500 text-[10px] uppercase tracking-wide">What's your experience level?</label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {TRAINING_EXPERIENCE.map((e) => (
                      <button key={e.id} onClick={() => set('experience')(e.id)}
                        className={`p-2.5 rounded-xl text-left text-[11px] font-medium transition-all ${data.experience === e.id ? 'bg-sky-500/15 border border-sky-400/50 text-sky-300' : 'bg-surface border border-surface-border text-slate-400 hover:border-slate-500'}`}>
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-slate-500 text-[10px] uppercase tracking-wide">When would you like to start?</label>
                  <div className="grid grid-cols-4 gap-2 mt-1.5">
                    {TRAINING_TIMELINE.map((t) => (
                      <button key={t.id} onClick={() => set('timeline')(t.id)}
                        className={`p-2 rounded-xl text-center text-[11px] font-medium transition-all ${data.timeline === t.id ? 'bg-sky-500/15 border border-sky-400/50 text-sky-300' : 'bg-surface border border-surface-border text-slate-400 hover:border-slate-500'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 border border-surface-border text-slate-300 hover:text-white py-2.5 rounded-xl text-sm transition-colors">← Back</button>
                  <button onClick={() => { save(2); setStep(3) }}
                    className="flex-[2] bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Continue →</button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: Goals + submit ── */}
          {step === 3 && (
            <div className="p-6 space-y-4">
              <h3 className="text-white font-bold text-base">Anything else we should know?</h3>
              <p className="text-slate-500 text-xs">Schedule preferences, goals, questions — we'll tailor our response.</p>
              <textarea placeholder="I'd like to fly on weekends... / My goal is to get my instrument rating by fall... / I have questions about cost..." value={data.goals} onChange={set('goals')} rows={4}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none resize-none" />
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 border border-surface-border text-slate-300 hover:text-white py-2.5 rounded-xl text-sm transition-colors">← Back</button>
                <button onClick={() => { save(3); setStep(4) }}
                  className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Submit →</button>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === 4 && (
            <div className="p-8 text-center space-y-4">
              <IcPlane size={28} className="text-sky-400 mx-auto" />
              <h3 className="text-xl font-bold text-white">Thank you{data.name ? `, ${data.name.split(' ')[0]}` : ''}!</h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
                We've received your interest in <strong className="text-slate-200">{program.name}</strong>.
                {data.email ? ' An instructor will reach out soon.' : ` Call ${JB_INFO.phone} anytime to get started.`}
              </p>
              <button onClick={onClose} className="bg-sky-500 hover:bg-sky-400 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors">Done</button>
            </div>
          )}
        </div>

        <button onClick={onClose} className="w-full text-slate-600 hover:text-slate-400 text-xs py-3 transition-colors text-center">Cancel</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Discovery Flight — prominent CTA section + progressive wizard
   14 CFR 91 compliant: no revenue passengers, this is an
   introductory instructional flight under 14 CFR 61.
   ═══════════════════════════════════════════════════════════ */

const JB_IMG_BASE = 'https://www.journeysaviation.com/uploads/1/3/2/8/132898297'
const MHG_CDN2 = 'https://4d7a9580e910a5227ad3.cdn6.editmysite.com/uploads/b/4d7a9580e910a5227ad31b8f17f245e444d0c04f822164dcfd300a7e2f96ba78'

const DISCOVERY_SLIDES = [
  {
    img: `${JB_IMG_BASE}/published/img-9118.jpg?1733952061`,
    alt: 'Cockpit view during flight instruction over Boulder',
    headline: 'You Fly the Airplane',
    sub: 'From your very first minute in the air, you\'re at the controls — with a certified flight instructor beside you every second.',
  },
  {
    img: `${MHG_CDN2}/s658900642949356718_p15_i12_w1200_1643401087.jpeg`,
    alt: 'Soaring above the Flatirons',
    headline: 'The Flatirons From Above',
    sub: 'See Boulder\'s iconic rock formations, the Continental Divide, and green valleys stretching to the horizon.',
  },
  {
    img: `${MHG_CDN2}/48400283806_af4fef99bb_k_1643401059.jpg`,
    alt: 'Continental Divide panorama',
    headline: 'Rocky Mountain Panorama',
    sub: 'Snow-capped peaks in winter, golden aspens in fall, wildflower meadows in summer — every season is a different flight.',
  },
  {
    img: `${JB_IMG_BASE}/editor/flight-training.jpeg?1769028309`,
    alt: 'Flight training at Journeys Aviation',
    headline: 'Real Flight Training',
    sub: 'This isn\'t a scenic ride — it\'s a real lesson. Learn straight-and-level, turns, climbs, and descents. Log it in your pilot record.',
  },
  {
    img: `${MHG_CDN2}/48058599958_8c0c5c9409_4k_1643401058.jpg`,
    alt: 'Longs Peak and the Divide in winter',
    headline: 'Come Back Every Season',
    sub: 'Each flight is different. Morning thermals, evening alpenglow, winter peaks, fall colors — pilots fly here for a lifetime and never get bored.',
  },
]

const DISCOVERY_WIZARD_STEPS = 5
const DISCOVERY_PRICE = 225

const WHO_OPTIONS = [
  { id: 'myself', label: 'Just me' },
  { id: 'couple', label: 'Me + partner' },
  { id: 'family', label: 'Family / kids' },
  { id: 'group', label: 'Friends / group' },
  { id: 'gift', label: 'It\'s a gift' },
  { id: 'team', label: 'Corporate / team event' },
]

const GOAL_OPTIONS = [
  { id: 'bucket-list', label: 'Bucket list experience' },
  { id: 'considering', label: 'Thinking about learning to fly' },
  { id: 'career', label: 'Exploring an aviation career' },
  { id: 'gift', label: 'Gift for someone special' },
  { id: 'returning', label: 'Coming back for another flight!' },
  { id: 'photos', label: 'Photos & memories' },
]

const SEASON_HIGHLIGHTS = [
  { season: 'Spring', desc: 'Wildflowers blanket the foothills, thermals build, and the snow line retreats up the peaks.' },
  { season: 'Summer', desc: 'Morning flights catch calm air and 100-mile visibility. Afternoon cumulus makes every photo dramatic.' },
  { season: 'Fall', desc: 'Golden aspens carpet the canyons. The air is crisp, dense, and the airplane climbs like a rocket.' },
  { season: 'Winter', desc: 'Snow-capped peaks from Longs to Pikes. Cold, dense air means powerful climbs and crystal-clear skies.' },
]

function DiscoveryFlightWizard({ onClose }) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState({
    name: '', email: '', phone: '',
    who: '', groupSize: 1, goal: '',
    preferredDate: '', preferredTime: '',
    weight: '', medicalNotes: '',
    notes: '', heardAbout: '',
  })
  const set = (k) => (v) => setData((d) => ({ ...d, [k]: typeof v === 'object' && v?.target ? v.target.value : v }))

  const save = (stepNum) => {
    // Progressive CRM save
    const key = 'crm_prospects_journeys'
    const prospects = JSON.parse(localStorage.getItem(key) || '[]')
    const prospectId = data.email ? `p-disc-${data.email.replace(/[^a-z0-9]/gi, '')}` : `p-disc-anon-${Date.now()}`
    const existingIdx = prospects.findIndex((p) => p.id === prospectId)
    const prospect = {
      id: prospectId,
      name: data.name || 'Discovery flight visitor',
      email: data.email || '',
      phone: data.phone || '',
      source: 'portal-booking',
      stage: data.email ? (stepNum >= 4 ? 'booked' : 'contacted') : 'new',
      package: 'discovery',
      groupSize: data.groupSize || 1,
      value: DISCOVERY_PRICE * (data.groupSize || 1),
      created: new Date().toISOString(),
      notes: [
        data.who && `Who: ${data.who}`,
        data.goal && `Goal: ${data.goal}`,
        data.preferredDate && `Preferred: ${data.preferredDate} ${data.preferredTime}`,
        data.weight && `Weight: ${data.weight} lbs`,
        data.medicalNotes && `Medical: ${data.medicalNotes}`,
        data.heardAbout && `Source: ${data.heardAbout}`,
        data.notes && `Notes: ${data.notes}`,
      ].filter(Boolean).join('. '),
      nextAction: data.email ? 'Confirm discovery flight availability' : null,
      contactLog: data.email ? [{
        id: `cl-${Date.now()}`, type: 'email', direction: 'inbound',
        body: `Discovery flight inquiry — step ${stepNum}/${DISCOVERY_WIZARD_STEPS}`,
        at: new Date().toISOString(),
      }] : [],
      operator: 'journeys',
      _wizardStep: stepNum,
    }
    if (existingIdx >= 0) {
      prospects[existingIdx] = { ...prospects[existingIdx], ...prospect, id: prospects[existingIdx].id, created: prospects[existingIdx].created }
    } else {
      prospects.unshift(prospect)
    }
    localStorage.setItem(key, JSON.stringify(prospects))
  }

  const next = () => { save(step); if (step < DISCOVERY_WIZARD_STEPS) setStep(step + 1) }

  const slide = DISCOVERY_SLIDES[step - 1] || DISCOVERY_SLIDES[0]

  /* ── Done ── */
  if (step > DISCOVERY_WIZARD_STEPS) return null

  if (step === DISCOVERY_WIZARD_STEPS && data._done) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
        <div className="bg-surface-card border border-surface-border rounded-2xl p-10 w-full max-w-md mx-4 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
          <IcPlane size={32} className="text-sky-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">You're Almost in the Air!</h3>
          <p className="text-slate-400 text-sm mb-3 leading-relaxed">
            {data.name ? `${data.name.split(' ')[0]}, we` : 'We'}'ve received your request. {data.email ? 'We\'ll confirm your discovery flight within 24 hours.' : `Call ${JB_INFO.phone} to finalize your booking.`}
          </p>
          <div className="bg-sky-400/5 border border-sky-400/15 rounded-xl p-3 mb-6">
            <p className="text-slate-500 text-[11px] leading-relaxed">
              <strong className="text-slate-300">14 CFR 61 Introductory Flight:</strong> You'll fly with an FAA-certified flight instructor in a maintained, airworthy aircraft. This is dual instruction — you're the student, not a passenger. All flights operate under 14 CFR Part 91 safety standards.
            </p>
          </div>
          <div className="bg-emerald-400/5 border border-emerald-400/15 rounded-xl p-3 mb-6">
            <p className="text-emerald-300 text-[11px] font-medium mb-1">Every season is a different adventure</p>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Come back for fall colors over the canyons, winter peaks dusted in snow, spring wildflowers along the foothills, or summer thermals lifting you to 12,000 feet. Many of our students started with multiple discovery flights before committing — and loved every one.
            </p>
          </div>
          <button onClick={onClose} className="bg-sky-500 hover:bg-sky-400 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {Array.from({ length: DISCOVERY_WIZARD_STEPS }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${s <= step ? 'bg-sky-500 text-white' : 'bg-white/10 text-white/40'}`}>{s}</div>
              {s < DISCOVERY_WIZARD_STEPS && <div className={`w-6 h-0.5 ${s < step ? 'bg-sky-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-surface-card/95 backdrop-blur-xl border border-surface-border rounded-2xl overflow-hidden shadow-2xl">
          {/* Photo header — different each step */}
          <div className="relative h-40 overflow-hidden">
            <img src={slide.img} alt={slide.alt} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="relative z-10 flex flex-col justify-end h-full p-5">
              <h3 className="text-white font-bold text-lg leading-snug drop-shadow-lg">{slide.headline}</h3>
              <p className="text-white/70 text-xs mt-1 drop-shadow">{slide.sub}</p>
            </div>
          </div>

          {/* ── Step 1: Who are you + contact ── */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-base">Let's get you in the air</h3>
                <p className="text-slate-500 text-[11px] mt-1">A discovery flight is a real flight lesson — you'll fly a Cessna or Pipistrel over Boulder with an FAA-certified instructor.</p>
              </div>
              <input placeholder="Your name" value={data.name} onChange={set('name')}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="email" placeholder="Email" value={data.email} onChange={set('email')}
                  className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
                <input type="tel" placeholder="Phone (optional)" value={data.phone} onChange={set('phone')}
                  className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
              </div>
              <div className="bg-sky-400/5 border border-sky-400/15 rounded-xl p-2.5">
                <p className="text-slate-500 text-[10px] leading-relaxed"><strong className="text-slate-400">$225</strong> · ~1 hour (briefing + flight) · No experience needed · You log the flight time</p>
              </div>
            </div>
          )}

          {/* ── Step 2: Who's coming + goal ── */}
          {step === 2 && (
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-base">Who's flying?</h3>
                <p className="text-slate-500 text-[11px] mt-1">Help us prepare the right experience for you.</p>
              </div>
              <div>
                <label className="text-slate-500 text-[10px] uppercase tracking-wide">Who is this for?</label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {WHO_OPTIONS.map((w) => (
                    <button type="button" key={w.id} onClick={() => set('who')(w.id)}
                      className={`p-2 rounded-xl text-center text-[11px] font-medium transition-all ${data.who === w.id ? 'bg-sky-500/15 border border-sky-400/50 text-sky-300' : 'bg-surface border border-surface-border text-slate-400 hover:border-slate-500'}`}>
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
              {(data.who === 'couple' || data.who === 'family' || data.who === 'group' || data.who === 'team') && (
                <div>
                  <label className="text-slate-500 text-[10px] uppercase tracking-wide">How many people?</label>
                  <input type="number" min={1} max={10} value={data.groupSize} onChange={set('groupSize')}
                    className="w-24 mt-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-sky-400 focus:outline-none" />
                  <p className="text-slate-600 text-[10px] mt-1">Each person flies individually with the instructor. We'll schedule back-to-back.</p>
                </div>
              )}
              <div>
                <label className="text-slate-500 text-[10px] uppercase tracking-wide">What brings you here?</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {GOAL_OPTIONS.map((g) => (
                    <button type="button" key={g.id} onClick={() => set('goal')(g.id)}
                      className={`p-2 rounded-xl text-left text-[11px] font-medium transition-all ${data.goal === g.id ? 'bg-sky-500/15 border border-sky-400/50 text-sky-300' : 'bg-surface border border-surface-border text-slate-400 hover:border-slate-500'}`}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Scheduling preference ── */}
          {step === 3 && (
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-base">When would you like to fly?</h3>
                <p className="text-slate-500 text-[11px] mt-1">Pick a date and we'll confirm availability. Morning flights are calmest; evening flights catch the best light.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 text-[10px] uppercase tracking-wide">Preferred date</label>
                  <input type="date" value={data.preferredDate} onChange={set('preferredDate')}
                    className="w-full mt-1 bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none" />
                </div>
                <div>
                  <label className="text-slate-500 text-[10px] uppercase tracking-wide">Time preference</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {['Morning', 'Afternoon'].map((t) => (
                      <button type="button" key={t} onClick={() => set('preferredTime')(t.toLowerCase())}
                        className={`p-2 rounded-xl text-center text-[11px] font-medium transition-all ${data.preferredTime === t.toLowerCase() ? 'bg-sky-500/15 border border-sky-400/50 text-sky-300' : 'bg-surface border border-surface-border text-slate-400 hover:border-slate-500'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Season highlights */}
              <div className="grid grid-cols-2 gap-2">
                {SEASON_HIGHLIGHTS.map((s) => (
                  <div key={s.season} className="bg-surface border border-surface-border rounded-xl p-2.5">
                    <div className="text-white text-[11px] font-semibold">{s.season}</div>
                    <div className="text-slate-500 text-[9px] leading-relaxed mt-0.5">{s.desc}</div>
                  </div>
                ))}
              </div>
              <div className="bg-emerald-400/5 border border-emerald-400/15 rounded-xl p-2.5">
                <p className="text-emerald-300/80 text-[10px] font-medium">Every flight is different — come back each season for a new perspective on the Rockies.</p>
              </div>
            </div>
          )}

          {/* ── Step 4: Safety & weight (14 CFR 91 compliance) ── */}
          {step === 4 && (
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-base">Safety & aircraft loading</h3>
                <p className="text-slate-500 text-[11px] mt-1">Federal regulations require us to calculate weight & balance for every flight. This is standard for all aircraft operations under 14 CFR 91.</p>
              </div>
              <div>
                <label className="text-slate-500 text-[10px] uppercase tracking-wide">Your approximate weight (lbs)</label>
                <input type="number" min={80} max={350} placeholder="e.g. 180" value={data.weight} onChange={set('weight')}
                  className="w-full mt-1 bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
                <p className="text-slate-600 text-[10px] mt-1">Used for weight & balance calculation only — not shared. Training aircraft have specific load limits per the POH.</p>
              </div>
              <div>
                <label className="text-slate-500 text-[10px] uppercase tracking-wide">Any medical considerations?</label>
                <textarea placeholder="Motion sensitivity, mobility needs, or anything the instructor should know (optional)" value={data.medicalNotes} onChange={set('medicalNotes')} rows={2}
                  className="w-full mt-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none resize-none" />
              </div>
              <div className="bg-amber-400/5 border border-amber-400/15 rounded-xl p-3 space-y-1.5">
                <p className="text-amber-300/80 text-[10px] font-semibold">14 CFR Part 91 — General Operating Rules</p>
                <ul className="text-slate-500 text-[10px] leading-relaxed space-y-0.5">
                  <li>All flights operate under FAA regulations with an FAA-certified instructor (14 CFR 61).</li>
                  <li>Aircraft are maintained per 14 CFR 43 and inspected per 14 CFR 91.409.</li>
                  <li>Weight & balance is computed per the Pilot's Operating Handbook before every flight.</li>
                  <li>This is dual flight instruction — you are the student pilot, not a passenger.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Step 5: Anything else + confirm ── */}
          {step === 5 && (
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-base">Almost there!</h3>
                <p className="text-slate-500 text-[11px] mt-1">Anything else we should know? Special occasion, camera plans, questions?</p>
              </div>
              <textarea placeholder="Birthday flight? Want photos from the air? Nervous about anything? Tell us — we do this every day and we love it." value={data.notes} onChange={set('notes')} rows={3}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none resize-none" />
              <div>
                <label className="text-slate-500 text-[10px] uppercase tracking-wide">How did you hear about us?</label>
                <input placeholder="Google, friend, drove by, saw an airplane..." value={data.heardAbout} onChange={set('heardAbout')}
                  className="w-full mt-1 bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
              </div>
              {/* Summary */}
              <div className="bg-surface border border-surface-border rounded-xl p-3 space-y-1">
                <p className="text-slate-400 text-[10px] uppercase tracking-wide font-semibold">Your Discovery Flight</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                  {data.name && <><span className="text-slate-500">Name</span><span className="text-slate-200">{data.name}</span></>}
                  {data.email && <><span className="text-slate-500">Email</span><span className="text-slate-200">{data.email}</span></>}
                  {data.who && <><span className="text-slate-500">For</span><span className="text-slate-200">{WHO_OPTIONS.find((w) => w.id === data.who)?.label}</span></>}
                  {data.goal && <><span className="text-slate-500">Goal</span><span className="text-slate-200">{GOAL_OPTIONS.find((g) => g.id === data.goal)?.label}</span></>}
                  {data.preferredDate && <><span className="text-slate-500">Date</span><span className="text-slate-200">{data.preferredDate}</span></>}
                  {data.preferredTime && <><span className="text-slate-500">Time</span><span className="text-slate-200 capitalize">{data.preferredTime}</span></>}
                  <span className="text-slate-500">Price</span><span className="text-sky-400 font-semibold">${DISCOVERY_PRICE}{data.groupSize > 1 ? ` × ${data.groupSize} = $${DISCOVERY_PRICE * data.groupSize}` : ''}</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="px-6 pb-6 flex gap-3">
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="flex-1 border border-surface-border text-slate-300 hover:text-white py-2.5 rounded-xl text-sm transition-colors">← Back</button>
            )}
            <button onClick={() => {
                if (step === DISCOVERY_WIZARD_STEPS) { save(step); setData((d) => ({ ...d, _done: true })) }
                else next()
              }}
              className={`${step > 1 ? 'flex-[2]' : 'w-full'} ${step === DISCOVERY_WIZARD_STEPS ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-sky-500 hover:bg-sky-400'} text-white font-semibold py-2.5 rounded-xl text-sm transition-colors`}>
              {step === DISCOVERY_WIZARD_STEPS ? 'Request My Flight' : 'Continue →'}
            </button>
          </div>
        </div>

        <button onClick={onClose} className="w-full text-slate-600 hover:text-slate-400 text-xs py-3 transition-colors text-center">Cancel</button>
      </div>
    </div>
  )
}

/* ── Prominent Discovery Flight section for public visitors ── */
function DiscoveryFlightSection({ onBook }) {
  const [photoIdx, setPhotoIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setPhotoIdx((i) => (i + 1) % DISCOVERY_SLIDES.length), 5000)
    return () => clearInterval(t)
  }, [])

  const slide = DISCOVERY_SLIDES[photoIdx]

  return (
    <section id="sec-discovery" className="relative py-20 px-6 overflow-hidden">
      {/* Background photo — crossfade */}
      <div className="absolute inset-0">
        {DISCOVERY_SLIDES.map((s, i) => (
          <img key={i} src={s.img} alt="" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === photoIdx ? 'opacity-30' : 'opacity-0'}`} loading="lazy" />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-surface via-surface/80 to-surface" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 rounded-full px-4 py-1.5 mb-4">
            <IcPlane size={14} className="text-sky-400" />
            <span className="text-sky-300 text-xs font-semibold uppercase tracking-wide">Most Popular Experience</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Discovery Flight</h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto leading-relaxed">
            You at the controls of a real airplane, flying over the Rocky Mountains with a certified flight instructor. No experience needed — just show up and fly.
          </p>
        </div>

        {/* Photo + details card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Rotating photo */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-surface-border shadow-2xl">
            {DISCOVERY_SLIDES.map((s, i) => (
              <img key={i} src={s.img} alt={s.alt} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === photoIdx ? 'opacity-100' : 'opacity-0'}`} loading="lazy" />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white font-bold text-sm drop-shadow-lg">{slide.headline}</p>
              <p className="text-white/70 text-xs drop-shadow">{slide.sub}</p>
            </div>
            {/* Dots */}
            <div className="absolute top-3 right-3 flex gap-1">
              {DISCOVERY_SLIDES.map((_, i) => (
                <button key={i} onClick={() => setPhotoIdx(i)} className={`w-2 h-2 rounded-full transition-all ${i === photoIdx ? 'bg-white scale-110' : 'bg-white/40'}`} />
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4 flex flex-col justify-center">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-card border border-surface-border rounded-xl p-3 text-center">
                <div className="text-sky-400 text-xl font-bold">${DISCOVERY_PRICE}</div>
                <div className="text-slate-500 text-[10px]">per person</div>
              </div>
              <div className="bg-surface-card border border-surface-border rounded-xl p-3 text-center">
                <div className="text-white text-xl font-bold">~1 hr</div>
                <div className="text-slate-500 text-[10px]">briefing + flight</div>
              </div>
            </div>

            <div className="space-y-2">
              {[
                'You fly the airplane from takeoff area to landing',
                'FAA-certified instructor beside you the entire flight',
                'Fly a Cessna 172 or Pipistrel Alpha Trainer',
                'Log the time — it counts toward a pilot certificate',
                'No medical or experience required',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <IcShield size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300 text-xs">{item}</p>
                </div>
              ))}
            </div>

            <button onClick={onBook}
              className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-4 rounded-xl text-sm transition-all shadow-xl shadow-sky-500/20 hover:shadow-sky-400/25 hover:scale-[1.02]">
              Book Your Discovery Flight
            </button>

            <p className="text-slate-600 text-[10px] text-center leading-relaxed">
              Introductory instructional flight per 14 CFR 61. All operations under 14 CFR Part 91.
            </p>
          </div>
        </div>

        {/* Seasonal repeat CTA */}
        <div className="bg-surface-card/80 backdrop-blur border border-surface-border rounded-2xl p-6">
          <div className="text-center mb-4">
            <h3 className="text-white font-bold text-sm">Every Season. A Different Flight.</h3>
            <p className="text-slate-500 text-xs mt-1">The same airport, the same mountains — but never the same experience. Many guests come back season after season.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SEASON_HIGHLIGHTS.map((s) => (
              <div key={s.season} className="bg-surface border border-surface-border rounded-xl p-3 text-center hover:border-sky-400/20 transition-colors">
                <div className="text-white text-xs font-bold mb-1">{s.season}</div>
                <p className="text-slate-500 text-[9px] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <button onClick={onBook} className="text-sky-400 hover:text-sky-300 text-xs font-medium transition-colors">
              Book another flight — every one is unique →
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── MAINTENANCE SECTION (logged-in only) ─── */
function MaintenanceSection({ user }) {
  // Logged-in users have squawk on fleet cards and status in My Fleet — just show brief info
  if (user) return null

  // Non-logged-in: show services overview
  return (
    <section id="sec-maintenance" className="py-20 px-6 bg-gradient-to-b from-surface via-surface-card/30 to-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Aircraft Maintenance</h2>
          <p className="text-slate-400">A&P, IA, and Rotax iRMT certified · ROTAX iRC</p>
        </div>
        <div className="max-w-lg mx-auto bg-surface-card border border-surface-border rounded-2xl p-8 text-center">
          <div className="mb-4 text-slate-400"><IcMaint size={32} stroke={1} /></div>
          <h3 className="text-white font-bold text-lg mb-2">Full-Service Maintenance Shop</h3>
          <p className="text-slate-400 text-sm mb-4">Annual, 100-hour, conditional & pre-buy inspections. Rotax Independent Repair Centre. SLSA maintenance and repair.</p>
          <div className="grid grid-cols-2 gap-3 mb-6 text-xs">
            <div className="bg-surface border border-surface-border rounded-xl p-3">
              <div className="text-white font-semibold">Maintenance</div>
              <div className="text-sky-400">{JB_INFO.maintenancePhone}</div>
            </div>
            <div className="bg-surface border border-surface-border rounded-xl p-3">
              <div className="text-white font-semibold">FBO</div>
              <div className="text-sky-400">{JB_INFO.phone}</div>
            </div>
          </div>
          <p className="text-slate-500 text-xs">Sign in to report squawks, schedule inspections, and track maintenance status for your aircraft.</p>
        </div>
      </div>
    </section>
  )
}

/* ─── TOP NAV ─── */
function TopNav({ onSection, user, onLoginClick, onLogout }) {
  const hasOwnAircraft = (user?.ownedAircraft?.length > 0) || (() => { try { return JSON.parse(localStorage.getItem(`journeys_owned_${user?.id}`) || '[]').length > 0 } catch { return false } })()
  const navItems = !user
    ? ['discovery', 'fleet', 'instructors', 'training', 'school-visit', 'fbo', 'operations', 'noise-report', 'gallery', 'about']
    : user.role === 'student'
      ? ['dashboard', ...(hasOwnAircraft ? ['my-aircraft'] : []), 'schedule', 'fleet', 'instructors', 'log', 'operations']
      : user.role === 'mx_client'
        ? ['my-aircraft', 'fleet', 'fbo', 'operations', 'about']
        : user.role === 'cfi'
          ? ['schedule', 'fleet', 'instructors', 'prospects', 'operations']
          : [...(hasOwnAircraft ? ['my-aircraft'] : []), 'schedule', 'fleet', 'instructors', 'fbo', 'operations', 'about']

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <span className="text-white font-bold text-lg tracking-tight">Journeys Aviation</span>
          <div className="hidden md:flex items-center gap-4">
            {navItems.map((s) => {
              const labels = { dashboard: 'Dashboard', discovery: 'Discovery Flight', log: 'Flight Log', 'my-aircraft': 'My Aircraft', fleet: 'Fleet', instructors: 'Instructors', schedule: 'Schedule', training: 'Training', 'school-visit': 'School Visits', maintenance: 'Maintenance', fbo: 'FBO', operations: 'Ops', 'noise-report': 'Noise', gallery: 'Gallery', about: 'About', prospects: 'Prospects' }
              return (
                <button key={s} onClick={() => onSection(s)} className="text-white/70 hover:text-white text-xs uppercase tracking-wide transition-colors">{labels[s] || s}</button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href={`tel:${JB_INFO.phone.replace(/[^\d]/g, '')}`} className="text-white/70 hover:text-white text-xs transition-colors hidden sm:block">
            {JB_INFO.phone}
          </a>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sky-300 text-xs hidden sm:block">{user.name}</span>
              <span className="text-slate-500 text-[10px] hidden lg:block">({user.label})</span>
              <button onClick={onLogout} className="text-white/60 hover:text-white text-xs underline">Sign out</button>
            </div>
          ) : (
            <button onClick={onLoginClick}
              className="bg-white/10 hover:bg-white/20 text-white text-xs px-4 py-1.5 rounded-lg border border-white/20 transition-all">
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

/* ─── HERO (custom background for JourneysBoulder) ─── */
const JB_HERO_BG = (
  <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-blue-950 to-indigo-950">
    {/* Animated cloud layers */}
    <div className="absolute inset-0 opacity-25">
      <div className="absolute top-[15%] left-[5%] w-64 h-20 bg-white/25 rounded-full blur-3xl animate-[drift_22s_linear_infinite]" />
      <div className="absolute top-[25%] left-[35%] w-80 h-24 bg-white/15 rounded-full blur-3xl animate-[drift_35s_linear_infinite_reverse]" />
      <div className="absolute top-[10%] right-[8%] w-48 h-16 bg-white/20 rounded-full blur-2xl animate-[drift_28s_linear_infinite]" />
      <div className="absolute top-[35%] left-[65%] w-56 h-18 bg-white/10 rounded-full blur-3xl animate-[drift_40s_linear_infinite_reverse]" />
    </div>
    {/* Mountain silhouette */}
    <svg className="absolute bottom-0 left-0 right-0 w-full" viewBox="0 0 1400 260" preserveAspectRatio="none">
      <path d="M0,260 L0,180 L80,140 L160,160 L260,80 L350,120 L440,50 L530,95 L600,30 L700,85 L780,55 L880,100 L960,40 L1050,80 L1140,60 L1240,110 L1320,75 L1400,120 L1400,260 Z" fill="rgba(15,23,42,0.5)" />
      <path d="M0,260 L0,200 L120,175 L240,195 L360,140 L480,170 L600,120 L720,155 L840,130 L960,160 L1080,140 L1200,170 L1320,150 L1400,175 L1400,260 Z" fill="rgba(15,23,42,0.8)" />
    </svg>
    {/* Stars */}
    <div className="absolute top-[5%] left-[18%] w-1 h-1 bg-white/40 rounded-full" />
    <div className="absolute top-[8%] left-[42%] w-0.5 h-0.5 bg-white/30 rounded-full" />
    <div className="absolute top-[3%] left-[67%] w-1 h-1 bg-white/25 rounded-full" />
    <div className="absolute top-[12%] left-[85%] w-0.5 h-0.5 bg-white/35 rounded-full" />
    <div className="absolute top-[6%] left-[55%] w-0.5 h-0.5 bg-white/20 rounded-full" />
  </div>
)

/* ─── OPERATIONS ─── */
const JB_OPS_FIELDS = [
  { label: 'Field', key: 'fieldElevation', icon: '⛰️' },
  { label: 'Runway', key: 'runwayInUse', icon: '🛬' },
  { label: 'Wind', key: '_wind', icon: '💨' },
  { label: 'Temp', key: 'temp', icon: '🌡️' },
  { label: 'Density Alt', key: 'densityAltitude', icon: '📏' },
  { label: 'Visibility', key: 'visibility', icon: '👁️' },
  { label: 'Cloud Base', key: 'cloudBase', icon: '☁️' },
  { label: 'Sunset', key: 'nextSunset', icon: '🌅' },
]

const JB_WEATHER_LINKS = [
  { label: 'METAR / TAF', url: JB_INFO.metarUrl },
  { label: 'FAA WeatherCam', url: JB_INFO.webcamUrl },
  { label: 'Windy Forecast', url: JB_INFO.windyUrl },
  { label: 'AirNav (KBDU)', url: JB_INFO.airnav },
]

function getJBOps() {
  const ops = getJBTodayOps()
  return { ...ops, _wind: `${ops.windDir} @ ${ops.windSpeed}` }
}

/* ─── "Ready to Fly?" CTA for TeamSection ─── */
const ReadyToFlyCTA = (
  <div className="relative rounded-2xl overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-4 left-[20%] w-40 h-12 bg-white/40 rounded-full blur-2xl" />
        <div className="absolute bottom-4 right-[25%] w-56 h-14 bg-white/30 rounded-full blur-3xl" />
      </div>
    </div>
    <div className="relative z-10 px-8 py-12 text-center">
      <h3 className="text-3xl font-bold text-white mb-3">Ready to Fly?</h3>
      <p className="text-sky-100/80 text-base mb-6 max-w-lg mx-auto">
        Book a Discovery Flight — an introductory lesson with you at the controls over Boulder and the Rockies. No experience needed.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <a href={`tel:${JB_INFO.phone.replace(/[^\d]/g, '')}`}
          className="bg-white text-sky-700 font-bold px-8 py-4 rounded-xl text-sm hover:bg-sky-50 transition-colors shadow-xl">
          Call {JB_INFO.phone}
        </a>
        <a href={`mailto:${JB_INFO.email}?subject=Discovery%20Flight%20Inquiry`}
          className="border-2 border-white/50 text-white font-bold px-8 py-4 rounded-xl text-sm hover:bg-white/10 transition-colors">
          Email Us
        </a>
      </div>
    </div>
  </div>
)

/* ═══════════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════════ */

const JB_USER_KEY = 'journeys_user'

export function JourneysBoulder() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(JB_USER_KEY)) } catch { return null }
  })
  const [showLogin, setShowLogin] = useState(false)
  const [showSchoolVisit, setShowSchoolVisit] = useState(false)
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [trainingProgram, setTrainingProgram] = useState(null)
  const [bookingAircraft, setBookingAircraft] = useState(null)
  const [bookingInstructor, setBookingInstructor] = useState(null)
  const [squawkTail, setSquawkTail] = useState(null)
  const [squawkVersion, setSquawkVersion] = useState(0) // bumped when squawk submitted to re-render panels
  useEffect(() => { const u = subscribeSquawks(() => setSquawkVersion((v) => v + 1)); return u }, [])

  const isStudent = user?.role === 'student'
  const isCFI = user?.role === 'cfi' || user?.role === 'admin'

  const scrollTo = (id) => {
    // Update URL hash without scroll jump, then smooth-scroll
    history.replaceState(null, '', `#${id}`)
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth' })
  }

  // On mount (or hash change), scroll to the hash target
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.replace('#', '')
      if (!h) return
      // Small delay so sections render first
      setTimeout(() => {
        document.getElementById(`sec-${h}`)?.scrollIntoView({ behavior: 'smooth' })
      }, 300)
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = (persona) => {
    setUser(persona)
    localStorage.setItem(JB_USER_KEY, JSON.stringify(persona))
    setShowLogin(false)
  }

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <TopNav onSection={scrollTo} user={user} onLoginClick={() => setShowLogin(true)} onLogout={() => { setUser(null); localStorage.removeItem(JB_USER_KEY) }} />

      {isStudent ? (
        <>
          <StudentDashboard user={user} />
          {user && <ScheduleSection user={user} selectedAircraft={bookingAircraft} onSelectAircraft={setBookingAircraft} onClearAircraft={() => setBookingAircraft(null)} selectedInstructor={bookingInstructor} onClearInstructor={() => setBookingInstructor(null)} instructors={JB_INSTRUCTORS} />}
          {user && <MyFleetSection key={squawkVersion} user={user} onSquawk={setSquawkTail} maintenancePhone={JB_INFO.maintenancePhone} />}
          <MiniGalleryStrip gallery={JB_GALLERY} category="fleet" />
          <FleetSection user={user} onBookAircraft={setBookingAircraft} onSquawk={setSquawkTail} squawkVersion={squawkVersion} />
          {squawkTail && user && <SharedSquawkPanel tailNumber={squawkTail} user={user} aircraftLabel={(getAircraftByOperator('journeys').find((a) => a.tailNumber === squawkTail) || mockAircraft.find((a) => a.tailNumber === squawkTail))?.makeModel} onClose={() => setSquawkTail(null)} />}
          <InstructorsDisplay instructors={JB_INSTRUCTORS} brand="Journeys Aviation" user={user} onBookInstructor={setBookingInstructor} heading="Flight Instructors" subtitle="Experienced CFIs for every certificate and rating" />
          <section id="sec-log" className="py-10 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto">
              <FlightLog user={user} operator="journeys" />
            </div>
          </section>
          <MiniGalleryStrip gallery={JB_GALLERY} category="scenery" />
          <AirportOps getOps={getJBOps} title="Field Conditions" openLabel="FBO open — aircraft available" closedLabel="FBO closed — check back during business hours" weatherLinks={JB_WEATHER_LINKS} fields={JB_OPS_FIELDS} />
          <PortalFooter brand="Journeys Aviation" address={JB_INFO.address} airport={JB_INFO.airport} hours={JB_INFO.hours} contactLines={[{label:'FBO', value:JB_INFO.phone},{label:'Maintenance', value:JB_INFO.maintenancePhone},{label:'', value:JB_INFO.email}]} socialLinks={[{label:'Facebook',url:JB_INFO.facebook},{label:'LinkedIn',url:JB_INFO.linkedin},{label:'Yelp',url:JB_INFO.yelp},{label:'Website',url:JB_INFO.website}]} resources={JB_RESOURCES.slice(0,6)} copyright={`© ${new Date().getFullYear()} Journeys Aviation, Inc. · Boulder, Colorado · KBDU`} />
        </>
      ) : (
        <>
          <HeroSection
            brand="Journeys Aviation"
            subtitle={<>Learn to Fly<br />at Boulder</>}
            info={JB_INFO}
            tagline="Boulder Municipal Airport (KBDU) · Est. 2019"
            onBook={() => setShowDiscovery(true)}
            bookLabel="Book a Discovery Flight"
            secondaryLabel="Visit Website ↗"
            secondaryHref={JB_INFO.website}
            badges={['✈️ 12 aircraft', '🏔️ Mountain flying', '🎓 All certificates & ratings', '⛽ 100LL & Jet-A']}
            backgroundSlot={JB_HERO_BG}
          >
            <p className="text-white/60 text-lg md:text-xl mb-8 max-w-xl mx-auto leading-relaxed">
              Flight school, aircraft rental, FBO services, and aircraft maintenance at the base of the Rocky Mountains.
            </p>
          </HeroSection>
          <DiscoveryFlightSection onBook={() => setShowDiscovery(true)} />
          {user && <MyFleetSection key={squawkVersion} user={user} onSquawk={setSquawkTail} maintenancePhone={JB_INFO.maintenancePhone} />}
          <MiniGalleryStrip gallery={JB_GALLERY} category="fleet" />
          <FleetSection user={user} onBookAircraft={setBookingAircraft} onSquawk={setSquawkTail} squawkVersion={squawkVersion} />
          {squawkTail && user && <SharedSquawkPanel tailNumber={squawkTail} user={user} aircraftLabel={(getAircraftByOperator('journeys').find((a) => a.tailNumber === squawkTail) || mockAircraft.find((a) => a.tailNumber === squawkTail))?.makeModel} onClose={() => setSquawkTail(null)} />}
          <InstructorsDisplay instructors={JB_INSTRUCTORS} brand="Journeys Aviation" user={user} onBookInstructor={setBookingInstructor} heading="Flight Instructors" subtitle="Experienced CFIs for every certificate and rating" />
          {user && <ScheduleSection user={user} selectedAircraft={bookingAircraft} onSelectAircraft={setBookingAircraft} onClearAircraft={() => setBookingAircraft(null)} selectedInstructor={bookingInstructor} onClearInstructor={() => setBookingInstructor(null)} instructors={JB_INSTRUCTORS} />}
          {isCFI && <ProspectsBoard operator="journeys" heading="Sales Pipeline" subtitle="Journeys Aviation — prospect tracking & follow-up" />}
          <MiniGalleryStrip gallery={JB_GALLERY} category="training" />
          <TrainingSection
            programs={JB_TRAINING}
            rates={JB_INSTRUCTION_RATES}
            brand="Journeys Aviation"
            membership={JB_MEMBERSHIP}
            insurance={JB_INSURANCE}
            onSelectProgram={setTrainingProgram}
          />

          {/* ── School Visit CTA + STEM Panels Section ── */}
          <section id="sec-school-visit" className="py-20 px-6 bg-gradient-to-b from-surface via-emerald-950/20 to-surface">
            <div className="max-w-6xl mx-auto">
              {/* Header + CTA */}
              <div className="text-center mb-12">
                <IcScience size={36} className="text-slate-500 mx-auto mb-4" />
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">School & Group Visits</h2>
                <p className="text-slate-400 max-w-2xl mx-auto mb-6">
                  Bring your class to a working airport. Students explore real aircraft, meet pilots and mechanics,
                  and connect STEM concepts to hands-on career pathways — all at no cost.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 max-w-xl mx-auto">
                  {[
                    { Ic: IcPlane, label: 'Cockpit sit-ins' },
                    { Ic: IcScience, label: 'STEM stations' },
                    { Ic: IcCareer, label: 'Career talks' },
                    { Ic: IcSatellite, label: 'Glider soaring' },
                  ].map((b) => (
                    <div key={b.label} className="bg-surface-card border border-surface-border rounded-xl p-3 text-center flex flex-col items-center gap-1.5">
                      <b.Ic size={20} className="text-slate-400" />
                      <div className="text-slate-300 text-[10px] font-medium">{b.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button onClick={() => setShowSchoolVisit(true)} className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4 rounded-xl text-sm shadow-lg shadow-emerald-500/25 transition-all hover:scale-105">
                    Plan a Field Trip — Free
                  </button>
                  <a href={`tel:${JB_INFO.phone.replace(/[^\d]/g, '')}`} className="border-2 border-white/20 hover:border-white/40 text-white font-semibold px-8 py-4 rounded-xl text-sm transition-all">
                    Call {JB_INFO.phone}
                  </a>
                </div>
                <div className="flex flex-wrap gap-4 justify-center mt-6 text-slate-500 text-xs">
                  <span>K–12 & homeschool groups</span>
                  <span>·</span>
                  <span>Bus parking on-site</span>
                  <span>·</span>
                  <span>EAA Young Eagles partner</span>
                </div>
              </div>

              {/* ── 4 STEM Category Panels ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
                {/* Science */}
                <div className="bg-surface-card border border-surface-border rounded-2xl p-6 hover:border-sky-400/20 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-sky-400/10 flex items-center justify-center"><IcScience size={22} className="text-sky-400" /></div>
                    <div>
                      <h3 className="text-white font-bold text-sm">Science</h3>
                      <p className="text-slate-500 text-[10px]">Physics, Earth Science, Atmospheric Science</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed mb-3">
                    Every flight is a physics demonstration. Students observe Bernoulli's principle generating lift on a wing,
                    see how thermals form over sun-heated terrain, and read real METAR weather reports decoded in real time.
                    At Boulder, mountain wave turbulence reaches the stratosphere — the same phenomenon NOAA studies to understand climate.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Aerodynamics', 'Weather systems', 'Density altitude', 'Atmospheric pressure', 'NGSS PS2 · ESS2'].map((t) => (
                      <span key={t} className="bg-sky-400/10 text-sky-300/80 text-[9px] px-2 py-0.5 rounded-full border border-sky-400/15">{t}</span>
                    ))}
                  </div>
                </div>

                {/* Technology */}
                <div className="bg-surface-card border border-surface-border rounded-2xl p-6 hover:border-violet-400/20 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-400/10 flex items-center justify-center"><IcTechnology size={22} className="text-violet-400" /></div>
                    <div>
                      <h3 className="text-white font-bold text-sm">Technology</h3>
                      <p className="text-slate-500 text-[10px]">Navigation, Communication, Data Systems</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed mb-3">
                    Modern cockpits are data centers. Students see GPS navigation, glass-panel avionics displaying real-time engine data,
                    ADS-B traffic surveillance, and VHF radio systems. Air traffic control uses radar and satellite tracking to manage
                    45,000 flights per day across U.S. airspace — from the same technology that powers weather apps and mapping software.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {['GPS & WAAS', 'Glass cockpits', 'ADS-B surveillance', 'VHF radio', 'Radar systems'].map((t) => (
                      <span key={t} className="bg-violet-400/10 text-violet-300/80 text-[9px] px-2 py-0.5 rounded-full border border-violet-400/15">{t}</span>
                    ))}
                  </div>
                </div>

                {/* Engineering */}
                <div className="bg-surface-card border border-surface-border rounded-2xl p-6 hover:border-amber-400/20 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center"><IcEngineering size={22} className="text-amber-400" /></div>
                    <div>
                      <h3 className="text-white font-bold text-sm">Engineering</h3>
                      <p className="text-slate-500 text-[10px]">Mechanical, Aerospace, Systems Design</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed mb-3">
                    Students see engineering at every scale: the composite structure of a glider wing designed for a 40:1 glide ratio,
                    a Rotax engine disassembled for inspection, flight control linkages, and weight & balance calculations that determine
                    whether an aircraft can safely fly. Our maintenance shop holds FAA A&P and Rotax iRC certifications — students see the profession in action.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Airframe structures', 'Engine systems', 'Weight & balance', 'Control surfaces', 'Maintenance & inspection'].map((t) => (
                      <span key={t} className="bg-amber-400/10 text-amber-300/80 text-[9px] px-2 py-0.5 rounded-full border border-amber-400/15">{t}</span>
                    ))}
                  </div>
                </div>

                {/* Mathematics */}
                <div className="bg-surface-card border border-surface-border rounded-2xl p-6 hover:border-emerald-400/20 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center"><IcMath size={22} className="text-emerald-400" /></div>
                    <div>
                      <h3 className="text-white font-bold text-sm">Mathematics</h3>
                      <p className="text-slate-500 text-[10px]">Applied Math, Trigonometry, Statistics</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed mb-3">
                    Pilots do math constantly: fuel burn calculations, crosswind components using trigonometry, density altitude corrections,
                    distance-speed-time problems, and weight & balance envelopes. Navigation requires bearing calculations, descent planning,
                    and interpreting wind vectors. Every preflight is a real-world word problem.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Fuel planning', 'Wind correction angles', 'Descent rates', 'W&B calculations', 'Unit conversions'].map((t) => (
                      <span key={t} className="bg-emerald-400/10 text-emerald-300/80 text-[9px] px-2 py-0.5 rounded-full border border-emerald-400/15">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <MiniGalleryStrip gallery={JB_GALLERY} category="fbo" />
          <MaintenanceSection user={user} />
          <MiniGalleryStrip gallery={JB_GALLERY} category="fbo" />
          <FBOSection
            services={JB_FBO_SERVICES}
            fuel={JB_FUEL}
            brand="Journeys Aviation"
            info={JB_INFO}
          />
          <MiniGalleryStrip gallery={JB_GALLERY} category="scenery" />
          <AirportOps getOps={getJBOps} title="Field Conditions" openLabel="FBO open — aircraft available" closedLabel="FBO closed — check back during business hours" weatherLinks={JB_WEATHER_LINKS} fields={JB_OPS_FIELDS} />
          <AirportsCriticalSection />
          <MiniGalleryStrip gallery={JB_GALLERY} category="flights" />
          <GalleryGrid gallery={JB_GALLERY} />
          <TeamSection
            staff={JB_STAFF}
            brand="Journeys Aviation"
            mission={JB_INFO.mission}
            cols="md:grid-cols-2 lg:grid-cols-3"
          >
            {ReadyToFlyCTA}
          </TeamSection>
          <PortalFooter brand="Journeys Aviation" address={JB_INFO.address} airport={JB_INFO.airport} hours={JB_INFO.hours} contactLines={[{label:'FBO', value:JB_INFO.phone},{label:'Maintenance', value:JB_INFO.maintenancePhone},{label:'', value:JB_INFO.email}]} socialLinks={[{label:'Facebook',url:JB_INFO.facebook},{label:'LinkedIn',url:JB_INFO.linkedin},{label:'Yelp',url:JB_INFO.yelp},{label:'Website',url:JB_INFO.website}]} resources={JB_RESOURCES.slice(0,6)} copyright={`© ${new Date().getFullYear()} Journeys Aviation, Inc. · Boulder, Colorado · KBDU`} />
        </>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />}
      {showSchoolVisit && <SchoolVisitFunnel onClose={() => setShowSchoolVisit(false)} />}
      {showDiscovery && <DiscoveryFlightWizard onClose={() => setShowDiscovery(false)} />}
      {trainingProgram && <TrainingInterestWizard program={trainingProgram} onClose={() => setTrainingProgram(null)} />}
    </div>
  )
}
