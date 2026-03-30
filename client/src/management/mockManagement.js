// =============================================================================
// Management Mock Data — 2-week resource planning window
// Planning horizon: 2026-03-30 through 2026-04-12 (14 days)
// =============================================================================

// ── 14-day weather forecast (KDFW area, spring) ───────────────────────────────
// weatherScore: VFR=0.95, MVFR=0.70, IFR=0.35, LIFR=0.10
export const WEATHER_FORECAST = [
  { date:'2026-03-30', label:'Mon 3/30', dow:'Mon', category:'VFR',  windDir:180, windKt:10, gustKt:null, tempC:18, visibilitySm:10,  ceilingFt:null, precip:null,   weatherScore:0.95 },
  { date:'2026-03-31', label:'Tue 3/31', dow:'Tue', category:'VFR',  windDir:200, windKt:12, gustKt:null, tempC:17, visibilitySm:10,  ceilingFt:null, precip:null,   weatherScore:0.95 },
  { date:'2026-04-01', label:'Wed 4/1',  dow:'Wed', category:'MVFR', windDir:140, windKt:15, gustKt:22,   tempC:14, visibilitySm:4,   ceilingFt:2500, precip:null,   weatherScore:0.70 },
  { date:'2026-04-02', label:'Thu 4/2',  dow:'Thu', category:'IFR',  windDir:110, windKt:18, gustKt:28,   tempC:11, visibilitySm:1,   ceilingFt:700,  precip:'RA',   weatherScore:0.35 },
  { date:'2026-04-03', label:'Fri 4/3',  dow:'Fri', category:'MVFR', windDir:160, windKt:13, gustKt:null, tempC:15, visibilitySm:5,   ceilingFt:3000, precip:null,   weatherScore:0.70 },
  { date:'2026-04-04', label:'Sat 4/4',  dow:'Sat', category:'VFR',  windDir:220, windKt:8,  gustKt:null, tempC:19, visibilitySm:10,  ceilingFt:null, precip:null,   weatherScore:0.95 },
  { date:'2026-04-05', label:'Sun 4/5',  dow:'Sun', category:'VFR',  windDir:240, windKt:6,  gustKt:null, tempC:21, visibilitySm:10,  ceilingFt:null, precip:null,   weatherScore:0.95 },
  { date:'2026-04-06', label:'Mon 4/6',  dow:'Mon', category:'VFR',  windDir:210, windKt:9,  gustKt:null, tempC:22, visibilitySm:10,  ceilingFt:null, precip:null,   weatherScore:0.95 },
  { date:'2026-04-07', label:'Tue 4/7',  dow:'Tue', category:'VFR',  windDir:190, windKt:11, gustKt:null, tempC:20, visibilitySm:10,  ceilingFt:null, precip:null,   weatherScore:0.95 },
  { date:'2026-04-08', label:'Wed 4/8',  dow:'Wed', category:'MVFR', windDir:150, windKt:16, gustKt:24,   tempC:17, visibilitySm:3,   ceilingFt:2000, precip:null,   weatherScore:0.70 },
  { date:'2026-04-09', label:'Thu 4/9',  dow:'Thu', category:'IFR',  windDir:120, windKt:22, gustKt:34,   tempC:12, visibilitySm:0.5, ceilingFt:500,  precip:'TSRA', weatherScore:0.30 },
  { date:'2026-04-10', label:'Fri 4/10', dow:'Fri', category:'MVFR', windDir:170, windKt:14, gustKt:20,   tempC:16, visibilitySm:4,   ceilingFt:2500, precip:null,   weatherScore:0.70 },
  { date:'2026-04-11', label:'Sat 4/11', dow:'Sat', category:'VFR',  windDir:230, windKt:9,  gustKt:null, tempC:20, visibilitySm:10,  ceilingFt:null, precip:null,   weatherScore:0.95 },
  { date:'2026-04-12', label:'Sun 4/12', dow:'Sun', category:'VFR',  windDir:250, windKt:7,  gustKt:null, tempC:22, visibilitySm:10,  ceilingFt:null, precip:null,   weatherScore:0.95 },
]

// ── Shift definitions ─────────────────────────────────────────────────────────
export const SHIFT_DEFS = {
  D: { label: 'Day',     time: '0600–1400', color: 'bg-sky-400/20 text-sky-300 border-sky-400/40' },
  M: { label: 'Mid',     time: '0800–1600', color: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40' },
  A: { label: 'Aftn',    time: '1200–2000', color: 'bg-amber-400/20 text-amber-300 border-amber-400/40' },
  E: { label: 'Eve',     time: '1400–2200', color: 'bg-violet-400/20 text-violet-300 border-violet-400/40' },
  S: { label: 'Standby', time: 'On call',   color: 'bg-orange-400/20 text-orange-300 border-orange-400/40' },
  O: { label: 'Off',     time: '—',         color: 'bg-transparent text-slate-600 border-transparent' },
}

// ── 2-week schedule (14 shifts per person) ────────────────────────────────────
// Week 1 idx 0–6: Mar30(Mon) Mar31(Tue) Apr1(Wed) Apr2(Thu) Apr3(Fri) Apr4(Sat) Apr5(Sun)
// Week 2 idx 7–13: Apr6(Mon) Apr7(Tue) Apr8(Wed) Apr9(Thu) Apr10(Fri) Apr11(Sat) Apr12(Sun)
export const SCHEDULE = [
  // ── Flight Operations ───────────────────────────────────────────────────────
  { id:'prs-001', name:'James Smith',   role:'Chief Pilot',       dept:'Flight Ops',
    shifts:['M','M','M','O','M','O','O', 'M','M','S','O','M','O','O'] },
  { id:'prs-002', name:'Rachel Jones',  role:'Pilot SIC',         dept:'Flight Ops',
    shifts:['D','D','O','D','D','D','O', 'D','D','O','D','D','D','O'] },
  { id:'prs-003', name:'Marcus Davis',  role:'Pilot PIC',         dept:'Flight Ops',
    shifts:['O','M','M','M','A','O','A', 'O','M','M','O','A','O','A'] },
  { id:'prs-004', name:'Anika Patel',   role:'Pilot SIC',         dept:'Flight Ops',
    shifts:['A','A','O','O','A','A','M', 'A','A','O','S','A','A','O'] },
  { id:'prs-005', name:'Carlos Rivera', role:'Pilot PIC ⚠',      dept:'Flight Ops',
    shifts:['S','S','S','S','S','O','O', 'S','S','S','S','S','O','O'] },
  // ── Operations ─────────────────────────────────────────────────────────────
  { id:'prs-006', name:'Alex Torres',   role:'Dispatcher',        dept:'Operations',
    shifts:['D','D','M','M','D','O','O', 'D','D','M','O','D','O','O'] },
  { id:'prs-007', name:'Jordan Lee',    role:'Safety Manager',    dept:'Operations',
    shifts:['M','M','M','M','M','O','O', 'M','M','M','O','M','O','O'] },
  // ── Maintenance ────────────────────────────────────────────────────────────
  { id:'prs-008', name:'Tyler Brooks',  role:'A&P Mechanic',      dept:'Maintenance',
    shifts:['D','D','D','O','D','O','O', 'D','D','D','O','D','O','O'] },
  { id:'prs-009', name:'Diane Wu',      role:'A&P / IA',          dept:'Maintenance',
    shifts:['M','M','O','M','M','O','O', 'M','M','O','M','M','O','O'] },
  { id:'prs-011', name:'Sarah Cole',    role:'Chief Inspector',   dept:'Maintenance',
    shifts:['D','D','D','D','O','O','D', 'D','D','D','O','O','D','D'] },
  { id:'prs-012', name:'Mike Ferris',   role:'A&P Mechanic',      dept:'Maintenance',
    shifts:['O','D','D','D','D','D','O', 'O','D','D','D','D','O','O'] },
  { id:'prs-013', name:'T. Huang',      role:'Avionics Tech',     dept:'Maintenance',
    shifts:['O','O','M','M','O','O','O', 'O','O','M','M','O','O','O'] },
  // ── FBO / Ground ────────────────────────────────────────────────────────────
  { id:'prs-010', name:'Sam Nguyen',    role:'Ground Handler',    dept:'FBO',
    shifts:['D','D','D','O','D','D','O', 'D','D','D','O','D','D','O'] },
  { id:'prs-014', name:'Devon Park',    role:'Line Svc Tech',     dept:'FBO',
    shifts:['A','O','A','A','A','A','O', 'A','O','A','O','A','A','O'] },
  { id:'prs-015', name:'Jordan Kim',    role:'Senior Line Tech',  dept:'FBO',
    shifts:['M','M','O','M','M','O','M', 'M','M','O','M','M','O','M'] },
  { id:'prs-016', name:'Rosa Mendez',   role:'FBO Coordinator',   dept:'FBO',
    shifts:['D','D','D','O','D','D','O', 'D','D','O','O','D','D','O'] },
]

export const DEPT_COLORS = {
  'Flight Ops':  'text-sky-400',
  'Operations':  'text-emerald-400',
  'Maintenance': 'text-amber-400',
  'FBO':         'text-violet-400',
}

export function shiftCapacity(shift) {
  if (shift === 'O') return 0
  if (shift === 'S') return 0.5
  return 1.0
}
