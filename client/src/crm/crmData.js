/**
 * Shared Sales CRM data — pipeline stages, sources, and sample prospects
 * per operator (glider, skydiving, flight training).
 */

export const PIPELINE_STAGES = [
  { id: 'new',       label: 'New Lead',    color: 'sky' },
  { id: 'contacted', label: 'Contacted',   color: 'violet' },
  { id: 'quoted',    label: 'Quoted',      color: 'amber' },
  { id: 'booked',    label: 'Booked',      color: 'green' },
  { id: 'completed', label: 'Completed',   color: 'emerald' },
  { id: 'lost',      label: 'Lost',        color: 'red' },
]

export const STAGE_COLOR = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.id, {
  bg:     `bg-${s.color}-400/15`,
  border: `border-${s.color}-400/30`,
  text:   `text-${s.color}-400`,
  dot:    `bg-${s.color}-400`,
  ring:   `ring-${s.color}-400/20`,
}]))

export const LEAD_SOURCES = ['website', 'phone', 'walk-in', 'referral', 'social', 'event', 'portal-booking']

/** Contact log entry types */
export const CONTACT_TYPES = [
  { id: 'email',       label: 'Email',          icon: '✉️' },
  { id: 'phone',       label: 'Phone Call',     icon: '📞' },
  { id: 'text',        label: 'Text / SMS',     icon: '💬' },
  { id: 'campaign-ad', label: 'Ad Campaign',    icon: '📣' },
  { id: 'campaign-dm', label: 'Direct Mail',    icon: '📮' },
]

/** Operator-specific package catalogs keyed by operator slug */
export const OPERATOR_PACKAGES = {
  mhg: [
    { id: 'boulder-view', name: 'Boulder View Ride', price: 175 },
    { id: 'mile-high',    name: 'Mile High Flight',  price: 300 },
    { id: 'adventure',    name: 'Adventure Flight',  price: 500 },
    { id: 'glider-rating', name: 'Glider Rating Program', price: 4000 },
  ],
  skydiving: [
    { id: 'tandem-14k',     name: 'Tandem Skydive (14k)',  price: 250 },
    { id: 'tandem-video',   name: 'Tandem + Handcam',      price: 325 },
    { id: 'tandem-full',    name: 'Tandem + Full Video',   price: 400 },
    { id: 'halo-18k',       name: 'HALO Tandem (18k)',     price: 450 },
    { id: 'aff-program',    name: 'AFF Program',           price: 3500 },
  ],
  journeys: [
    { id: 'discovery',      name: 'Discovery Flight',    price: 225 },
    { id: 'ppl-program',    name: 'Private Pilot',       price: 12000 },
    { id: 'ifr-program',    name: 'Instrument Rating',   price: 9000 },
    { id: 'commercial',     name: 'Commercial Pilot',    price: 15000 },
    { id: 'aircraft-rental', name: 'Aircraft Rental',    price: 180 },
    { id: 'school-visit',    name: 'School / Group Visit', price: 0 },
  ],
}

export const OPERATOR_LABELS = {
  mhg:       'Mile High Gliding',
  skydiving: 'Mile Hi Skydiving',
  journeys:  'Journeys Aviation',
}

/** Generate sample prospects for a given operator */
export function getSampleProspects(operator) {
  const now = new Date()
  const d = (daysAgo) => new Date(now - daysAgo * 86400000).toISOString()

  // Sample contact log entries
  const cl = (daysAgo, type, body, direction = 'outbound') => ({ id: `cl-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, type, body, direction, at: d(daysAgo) })

  const common = {
    mhg: [
      { id: 'p-mhg-01', name: 'Sarah Mitchell',   email: 'smitchell@gmail.com',    phone: '303-555-0142', source: 'website',        stage: 'new',       package: 'mile-high',    groupSize: 2, value: 600,   created: d(1),  notes: 'Anniversary gift — wants weekend morning', nextAction: 'Send availability for next Saturday', contactLog: [cl(1, 'email', 'Website inquiry received — auto-reply sent', 'inbound')] },
      { id: 'p-mhg-02', name: 'James Park',        email: 'jpark@outlook.com',      phone: '720-555-0199', source: 'phone',          stage: 'contacted', package: 'adventure',    groupSize: 1, value: 500,   created: d(3),  notes: 'Experienced powered pilot, curious about soaring', nextAction: 'Follow up with pricing sheet', contactLog: [cl(3, 'phone', 'Inbound call — asked about soaring vs powered flight, 10 min', 'inbound'), cl(2, 'email', 'Sent adventure flight pricing and schedule PDF', 'outbound')] },
      { id: 'p-mhg-03', name: 'Linda Chen',        email: 'lchen@yahoo.com',        phone: '303-555-0387', source: 'referral',       stage: 'quoted',    package: 'glider-rating', groupSize: 1, value: 4000, created: d(7),  notes: 'Referred by Jim Murray — wants to start in May', nextAction: 'Send training schedule PDF', contactLog: [cl(7, 'phone', 'Jim Murray referral — called to introduce program', 'outbound'), cl(5, 'email', 'Sent glider rating program details and pricing', 'outbound'), cl(3, 'phone', 'Follow-up — very interested, checking May schedule', 'outbound')] },
      { id: 'p-mhg-04', name: 'Mike & Tanya Ross',  email: 'rossmt@gmail.com',      phone: '720-555-0245', source: 'social',         stage: 'booked',    package: 'boulder-view', groupSize: 4, value: 700,   created: d(10), notes: 'Family of 4 — booked for April 12', nextAction: null, contactLog: [cl(10, 'campaign-ad', 'Facebook spring promo — family glider ride', 'outbound'), cl(8, 'email', 'Inquiry from FB ad — sent family package info', 'outbound'), cl(6, 'phone', 'Confirmed 4 pax, all under weight limit', 'outbound'), cl(4, 'email', 'Booking confirmation sent — April 12 @ 10 AM', 'outbound')] },
      { id: 'p-mhg-05', name: 'David Okafor',      email: 'dokafor@proton.me',      phone: '303-555-0511', source: 'event',          stage: 'completed', package: 'mile-high',    groupSize: 2, value: 600,   created: d(21), notes: 'Flew March 16 — loved it, wants to come back', nextAction: 'Send thank-you + referral discount', contactLog: [cl(21, 'campaign-dm', 'Open house postcard mailing — Boulder zip codes', 'outbound'), cl(19, 'phone', 'Met at open house — booked 2 rides on the spot', 'inbound'), cl(5, 'email', 'Post-flight thank you + referral code SOAR25', 'outbound')] },
      { id: 'p-mhg-06', name: 'Rachel Gibbons',    email: 'rgibbons@email.com',     phone: '720-555-0633', source: 'portal-booking', stage: 'lost',      package: 'adventure',    groupSize: 1, value: 500,   created: d(14), notes: 'Wanted weekday only — no availability matched', nextAction: null, contactLog: [cl(14, 'email', 'Portal booking attempt — no weekday slots', 'inbound'), cl(12, 'phone', 'Called to discuss options — weekday only, no luck', 'outbound')] },
    ],
    skydiving: [
      { id: 'p-sky-01', name: 'Tyler Brooks',      email: 'tbrooks@gmail.com',      phone: '720-555-0821', source: 'website',        stage: 'new',       package: 'tandem-14k',   groupSize: 3, value: 750,   created: d(0),  notes: 'Bachelor party group — wants Saturday', nextAction: 'Call to confirm group size & weight limits', contactLog: [cl(0, 'email', 'Website form — bachelor party inquiry', 'inbound')] },
      { id: 'p-sky-02', name: 'Anika Sharma',      email: 'asharma@outlook.com',    phone: '303-555-0944', source: 'social',         stage: 'contacted', package: 'tandem-full',   groupSize: 2, value: 800,   created: d(2),  notes: 'Instagram inquiry — wants content-ready jump', nextAction: 'Send video samples & booking link', contactLog: [cl(2, 'campaign-ad', 'Instagram story ad — spring tandem promo', 'outbound'), cl(1, 'text', 'DM reply — interested in full video package for 2', 'inbound')] },
      { id: 'p-sky-03', name: 'Chris Donovan',     email: 'cdonovan@proton.me',     phone: '720-555-0177', source: 'walk-in',        stage: 'quoted',    package: 'aff-program',  groupSize: 1, value: 3500,  created: d(5),  notes: 'Walked in after watching loads — very motivated', nextAction: 'Schedule ground school', contactLog: [cl(5, 'phone', 'Walk-in — watched 3 loads, asked about getting licensed', 'inbound'), cl(3, 'email', 'Sent AFF program details, pricing, and schedule', 'outbound')] },
      { id: 'p-sky-04', name: 'Emma & Kyle Diaz',  email: 'ediaz@gmail.com',        phone: '303-555-0388', source: 'referral',       stage: 'booked',    package: 'halo-18k',     groupSize: 2, value: 900,   created: d(8),  notes: 'Referred by Aaron Pollock — booked Twin Otter HALO', nextAction: null, contactLog: [cl(8, 'phone', 'Aaron Pollock referral call — couple wants HALO', 'inbound'), cl(6, 'email', 'Sent HALO package details + waiver forms', 'outbound'), cl(4, 'phone', 'Confirmed booking — Twin Otter HALO for 2', 'outbound')] },
      { id: 'p-sky-05', name: 'Marcus Webb',       email: 'mwebb@yahoo.com',        phone: '720-555-0655', source: 'phone',          stage: 'completed', package: 'tandem-video',  groupSize: 1, value: 325,   created: d(18), notes: 'Jumped March 19 — purchased USB drive after', nextAction: 'Send 30-day AFF promo email', contactLog: [cl(18, 'phone', 'Inbound call — booked tandem + video', 'inbound'), cl(1, 'email', 'Post-jump thank you + 30-day AFF enrollment discount', 'outbound')] },
      { id: 'p-sky-06', name: 'Priya Nguyen',      email: 'pnguyen@email.com',      phone: '303-555-0722', source: 'website',        stage: 'lost',      package: 'tandem-14k',   groupSize: 1, value: 250,   created: d(12), notes: 'Over weight limit — referred to DZ with higher limit', nextAction: null, contactLog: [cl(12, 'email', 'Website booking — flagged weight limit', 'inbound'), cl(11, 'phone', 'Called to discuss — over limit, referred to Skydive CO', 'outbound')] },
    ],
    journeys: [
      { id: 'p-jb-01', name: 'Nathan Cole',       email: 'ncole@gmail.com',        phone: '720-555-0133', source: 'website',        stage: 'new',       package: 'discovery',     groupSize: 1, value: 225,   created: d(1),  notes: 'Interested in discovery flight before committing to PPL', nextAction: 'Send discovery flight availability', contactLog: [cl(1, 'email', 'Website contact form — discovery flight inquiry', 'inbound')] },
      { id: 'p-jb-02', name: 'Olivia Tran',       email: 'otran@outlook.com',      phone: '303-555-0266', source: 'referral',       stage: 'contacted', package: 'ppl-program',   groupSize: 1, value: 12000, created: d(4),  notes: 'CU student — flexible weekday schedule, budget-conscious', nextAction: 'Send financing options & timeline estimate', contactLog: [cl(4, 'phone', 'Referral from CU aviation club — called to introduce', 'outbound'), cl(2, 'email', 'Sent PPL program overview + financing options', 'outbound')] },
      { id: 'p-jb-03', name: 'Robert Hughes',     email: 'rhughes@proton.me',      phone: '720-555-0499', source: 'phone',          stage: 'quoted',    package: 'ifr-program',   groupSize: 1, value: 9000,  created: d(6),  notes: 'PPL holder, wants instrument rating before fall', nextAction: 'Match with IFR-CFII and propose schedule', contactLog: [cl(6, 'phone', 'Inbound — PPL holder asking about IFR timeline', 'inbound'), cl(4, 'email', 'Sent instrument rating pricing and CFII availability', 'outbound'), cl(2, 'phone', 'Follow-up — wants to start June, needs fall completion', 'outbound')] },
      { id: 'p-jb-04', name: 'Samantha Lee',      email: 'slee@gmail.com',         phone: '303-555-0577', source: 'event',          stage: 'booked',    package: 'ppl-program',   groupSize: 1, value: 12000, created: d(12), notes: 'Signed up at KBDU open house — starts April 14', nextAction: null, contactLog: [cl(12, 'campaign-dm', 'Open house flyer — KBDU neighborhood mailing', 'outbound'), cl(12, 'phone', 'Met at open house — signed enrollment form on site', 'inbound'), cl(10, 'email', 'Welcome packet + medical exam info + April 14 start', 'outbound')] },
      { id: 'p-jb-05', name: 'Victor Alvarez',    email: 'valvarez@yahoo.com',     phone: '720-555-0688', source: 'walk-in',        stage: 'completed', package: 'discovery',     groupSize: 2, value: 450,   created: d(20), notes: 'Dad + son discovery — son now enrolled in PPL', nextAction: 'Follow up on son enrollment paperwork', contactLog: [cl(20, 'phone', 'Walk-in — dad wants discovery for himself + 16yo son', 'inbound'), cl(1, 'email', 'Post-flight follow-up — son enrollment paperwork attached', 'outbound')] },
      { id: 'p-jb-06', name: 'Karen Whitfield',   email: 'kwhitfield@email.com',   phone: '303-555-0811', source: 'website',        stage: 'lost',      package: 'commercial',    groupSize: 1, value: 15000, created: d(15), notes: 'Went with ATP flight school instead — pricing', nextAction: null, contactLog: [cl(15, 'email', 'Website inquiry — commercial pilot program', 'inbound'), cl(13, 'phone', 'Discussed program — price-shopping vs ATP', 'outbound'), cl(10, 'email', 'Sent competitive comparison sheet', 'outbound'), cl(8, 'phone', 'Final follow-up — chose ATP for accelerated timeline', 'inbound')] },
    ],
  }

  return common[operator] || []
}
