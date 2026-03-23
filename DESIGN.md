# FlightSafe SMS Dashboard — Design Document

**Version:** 1.0
**Date:** 2026-03-21
**Project:** Multi-Aircraft Flight Operation Safety Management System

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [P.A.V.E. Framework & SMS Integration](#3-pave-framework--sms-integration)
4. [Page Inventory & Layout](#4-page-inventory--layout)
5. [Feature Specifications](#5-feature-specifications)
   - 5.1 [SMS Status Overview (Home)](#51-sms-status-overview-home)
   - 5.2 [Live Operations Map](#52-live-operations-map)
   - 5.3 [Flight Risk List](#53-flight-risk-list)
   - 5.4 [Compliance Center](#54-compliance-center)
   - 5.5 [Pilot Disclosure Reports](#55-pilot-disclosure-reports)
6. [Data Architecture](#6-data-architecture)
7. [API Integration](#7-api-integration)
8. [Real-Time & Historic Data Strategy](#8-real-time--historic-data-strategy)
9. [Risk Scoring Model](#9-risk-scoring-model)
10. [Tech Stack](#10-tech-stack)
11. [UI/UX Principles](#11-uiux-principles)
12. [Component Tree](#12-component-tree)
13. [State Management](#13-state-management)
14. [File Structure](#14-file-structure)
15. [Open Questions / Future Work](#15-open-questions--future-work)

---

## 1. Overview

The FlightSafe SMS Dashboard is a browser-based web application providing a centralized Safety Management System (SMS) for multi-aircraft flight operations. It integrates live weather intelligence (via **FlightSafeWeather API**) and historical accident similarity matching (via **AirSafe API**) to present actionable safety information to dispatchers, safety officers, and flight crew.

### Core Design Principles

- **P.A.V.E. as the organizing spine** — every risk surface is framed through Pilot, Aircraft, enVironment, External pressures.
- **Real-time + historic duality** — every PAVE dimension shows both live current state and trended historical performance.
- **ICAO SMS four-pillar compliance** — dashboard directly maps to Policy, Risk Management, Safety Assurance, Safety Promotion.
- **Progressive disclosure** — top-level panels show status; drill-downs surface details, accidents, and compliance artifacts.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  BROWSER (React SPA)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ SMS Home │ │  Live    │ │ Risk     │ │Compliance│  │
│  │(4 pillars│ │  Map     │ │  List    │ │ Center   │  │
│  │  + PAVE) │ │          │ │          │ │          │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Pilot Disclosure Reports                  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ REST + WebSocket / Polling
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌────────────────┐ ┌────────────┐ ┌────────────────┐
│FlightSafeWeather│ │  AirSafe  │ │  Dashboard API │
│  (port 3000)   │ │ (port 5000)│ │  (port 4000)   │
└────────────────┘ └────────────┘ └────────────────┘
         │                                │
         ▼                                ▼
  Aviation Weather              Local SQLite / JSON store
  Center (AWC)                  (flights, compliance, reports)
```

### Dashboard API (Backend-for-Frontend)

A lightweight Express.js server (`/server`) that:
- Aggregates FlightSafeWeather + AirSafe data into unified flight risk payloads
- Persists flights, compliance records, and pilot reports to a local SQLite database
- Serves the React frontend static build
- Provides Server-Sent Events (SSE) for live flight status updates

---

## 3. P.A.V.E. Framework & SMS Integration

P.A.V.E. is the primary risk-organizing principle. Each dimension integrates both live/real-time data and historical performance data.

### PAVE × SMS Four Pillars Matrix

| PAVE Dimension | Real-Time Data | Historic Data | SMS Pillar Alignment |
|---|---|---|---|
| **P — Pilot** | Current duty time, currency, medical status, active certifications | Disclosure report trends, training completion history, incident involvement, fatigue patterns | Safety Assurance (pilot performance monitoring) + Safety Promotion (training) |
| **A — Aircraft** | Airworthiness status, MEL items, last squawk, current flight hours | Maintenance event history, fleet AOG rates, recurring discrepancy patterns, accident similarity by aircraft type (AirSafe) | Safety Assurance (continuing airworthiness) + Risk Management (MEL/dispatch deviations) |
| **V — enVironment** | Live weather (METAR, TAF, AIRMETs, SIGMETs), winds aloft, flight category per route | Historical accident weather flags (AirSafe: icing, IMC, turbulence rates), seasonal risk trends by route | Risk Management (hazard identification) |
| **E — External pressures** | Schedule pressure indicator, passenger load, commercial pressure flags, regulatory NOTAMs | Compliance filing history, audit findings, NASA ASRS trend patterns from org | Policy (safety culture) + Compliance |

### SMS Four Pillars — Dashboard Sections

| ICAO SMS Pillar | Dashboard Location | Key Indicators |
|---|---|---|
| **1. Safety Policy** | SMS Home → Policy panel | Policy currency, management commitment metrics, safety objectives status |
| **2. Risk Management** | SMS Home → Risk panel + Live Map + Risk List | Active hazards, risk register, flight-level risk scores |
| **3. Safety Assurance** | SMS Home → Assurance panel + Compliance Center | Audit status, KPIs, safety performance indicators (SPIs) |
| **4. Safety Promotion** | SMS Home → Promotion panel + Disclosure Reports | Training status, disclosure report rates, lessons-learned publication |

---

## 4. Page Inventory & Layout

### Navigation (Sidebar, always visible)

```
[Logo / Org Name]
─────────────────
🏠  SMS Overview
🗺️  Live Operations
📋  Flight Risk List
📁  Compliance Center
📝  Pilot Reports
─────────────────
⚙️  Settings
```

### Global Header

- Organization name + ICAO identifier
- Clock (Zulu / local toggle)
- Active alert badge (count of active SIGMETs / risk-red flights)
- User role badge (Dispatcher / Safety Officer / Pilot / Admin)

---

## 5. Feature Specifications

### 5.1 SMS Status Overview (Home)

**Purpose:** Single-glance SMS health across all four pillars, organized within P.A.V.E. context.

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  SAFETY POLICY          │  RISK MANAGEMENT                  │
│  [status indicator]     │  [status indicator]               │
│  Policy last reviewed:  │  Open hazards: N                  │
│  Next review: date      │  Active risk controls: N          │
│  Management commitment  │  Risk register age: N days        │
│  [PAVE breakdown bar]   │  [PAVE breakdown bar]             │
├─────────────────────────┼───────────────────────────────────┤
│  SAFETY ASSURANCE       │  SAFETY PROMOTION                 │
│  [status indicator]     │  [status indicator]               │
│  Last internal audit:   │  Disclosure reports (30d): N      │
│  KPI trend sparkline    │  NASA ASRS filed (YTD): N         │
│  Findings open: N       │  Training compliance: N%          │
│  [PAVE breakdown bar]   │  [PAVE breakdown bar]             │
└─────────────────────────┴───────────────────────────────────┘

PAVE STATUS STRIP (real-time + historic dual view)
┌──────────┬──────────┬──────────┬──────────┐
│  PILOT   │ AIRCRAFT │  ENVIRO  │ EXTERNAL │
│  🟡 Med  │  🟢 Low  │  🔴 High │  🟡 Med  │
│ 2 near   │ MEL: 1   │ 2 active │ Schedule │
│ currency │ open sqk │ SIGMETs  │ pressure │
│ [detail] │ [detail] │ [detail] │ [detail] │
└──────────┴──────────┴──────────┴──────────┘
```

Each PAVE card expands to show:
- **Real-Time tab:** Current values pulled from live sources
- **Historic tab:** 30/90/365-day trend charts, benchmarks, accident rate overlays from AirSafe

#### Safety Policy Panel
- Policy document status (current / expiring / expired) with expiry date
- Management review schedule and last completion date
- Safety objectives: list with RAG status
- Safety accountabilities matrix summary (who is responsible for what)
- **Historic:** Year-over-year policy review compliance

#### Risk Management Panel
- Open items in risk register: count by risk level (red/amber/green)
- Active hazards identified this month
- Mitigations overdue
- **Real-time:** Count of flights currently operating in elevated-risk corridors (from Live Map)
- **Historic:** Risk register aging trends, recurring hazard categories

#### Safety Assurance Panel
- Next scheduled internal audit (days until)
- Last audit findings: open / closed counts
- Safety Performance Indicators (SPIs): mini sparklines for each SPI
  - Accident rate (per 1,000 flight hours)
  - Incident rate
- Compliance filing rate (% on time, rolling 12 months)
- **Historic:** SPI trend chart (configurable date range)

#### Safety Promotion Panel
- Disclosure reports submitted (last 30 days) vs. target
- NASA ASRS submissions year-to-date
- Training completion rate (fleet-wide, by PAVE category)
- Lessons-learned items published this quarter
- **Historic:** Disclosure report rate trend (healthy safety culture indicator)

---

### 5.2 Live Operations Map

**Purpose:** Visual, real-time flight tracking with integrated weather hazards and clickable risk polygons. Shows all current and planned flights within N hours (configurable, default = 4 hours).

#### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  LIVE OPERATIONS  [Zulu clock]  [N-hour window: 4h ▼]       │
│  Active: 3 flights  │  Planned (≤4h): 2 flights             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │           INTERACTIVE MAP (Leaflet.js)                 │ │
│  │                                                        │ │
│  │   [Flight routes as colored lines by risk level]       │ │
│  │   [Aircraft position markers with callsigns]           │ │
│  │   [SIGMET polygons - red, semi-transparent]            │ │
│  │   [AIRMET polygons - amber, semi-transparent]          │ │
│  │   [High-risk AirSafe polygons - deep red, pulsing]     │ │
│  │   [Weather stations with flight category color]        │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  MAP CONTROLS: [Layers ▼] [Weather ▼] [Risk ▼] [Fit All]   │
└──────────────────────────────────────────────────────────────┘
  FLIGHT STRIP TRAY (horizontal scroll, below map)
  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
  │ N12345      │ │ N67890      │ │ N11111      │
  │ KDFW→KLAX   │ │ KBOS→KJFK  │ │ KORD→KDEN  │
  │ 🔴 HIGH     │ │ 🟡 MED     │ │ 🟢 LOW     │
  │ En Route    │ │ Dep in 1h  │ │ Dep in 3h  │
  └─────────────┘ └─────────────┘ └─────────────┘
```

#### Map Layers (toggleable)

| Layer | Source | Color | Description |
|---|---|---|---|
| Flight routes | Dashboard DB | Risk-colored line | Great-circle route with corridor |
| Aircraft positions | Dashboard DB (user-entered or ADS-B) | Aircraft icon, callsign label | Real position or planned |
| SIGMETs | FlightSafeWeather `/api/sigmets` | Red polygon, 60% opacity | Significant meteorological info |
| AIRMETs | FlightSafeWeather `/api/airmets` | Amber polygon, 50% opacity | Airmen's met info |
| High-risk zones | AirSafe historical + weather overlay | Deep red polygon, pulsing border | Areas with high historical accident density matching current weather |
| METAR stations | FlightSafeWeather `/api/metar/:station` | Circle: VFR=green, MVFR=blue, IFR=red, LIFR=magenta | Flight category at stations |
| Winds aloft | FlightSafeWeather `/api/winds-aloft` | Wind barbs at altitude | Select altitude layer |

#### Clickable Risk Polygon Popout

When a high-risk polygon is clicked, a modal appears:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ HIGH RISK ZONE — [Hazard Type]              [✕ Close]│
├─────────────────────────────────────────────────────────┤
│ SOURCE: SIGMET / AIRMET / AirSafe Historical Pattern    │
│ VALID: 1800Z – 0000Z                                    │
│                                                         │
│ WEATHER CONDITIONS                                      │
│  • Severe turbulence (flight level 240-380)            │
│  • Embedded thunderstorms                              │
│                                                         │
│ HISTORICAL ACCIDENT CONTEXT  (via AirSafe)              │
│  Similar conditions have been associated with:          │
│  • 12 accidents in this region (2010–2024)             │
│  • Primary accident types: Loss of Control (42%),      │
│    Structural Failure (25%), CFIT (33%)                │
│  • Risk trend: ▲ Increasing (+8% per decade)           │
│                                                         │
│ AFFECTED FLIGHTS                                        │
│  • N12345 (KDFW→KLAX) — route intersects zone         │
│  • N11111 (KORD→KDEN) — planned, 2h until zone entry  │
│                                                         │
│ P.A.V.E. RISK BREAKDOWN                               │
│  [P] Pilot:    Fatigue risk elevated (duty time)       │
│  [A] Aircraft: No MEL items — nominal                  │
│  [V] Enviro:   🔴 SIGMET active, icing reported       │
│  [E] External: Destination wx marginal — go pressure   │
│                                                         │
│ [View Full Risk Report]  [File Hazard Report]          │
└─────────────────────────────────────────────────────────┘
```

#### Flight Strip Detail (click strip → right panel)

- Callsign, aircraft type, tail number
- Route: departure → waypoints → arrival
- ETE / ETA
- Crew: PIC name, SIC name, total crew duty time
- PAVE risk summary for this specific flight (color-coded per dimension)
- Live weather at current position / next waypoint
- AirSafe top 3 similar accidents with scores
- Quick actions: [View Full Risk] [Contact Crew] [File Report]

#### Data Refresh

- Weather data: auto-refresh every 5 minutes
- Flight positions: auto-refresh every 60 seconds (or real-time if ADS-B fed)
- Risk polygons: recalculated on each weather refresh
- Visual refresh indicator (last updated timestamp + spinner)

---

### 5.3 Flight Risk List

**Purpose:** Tabular view of all planned future flights, color-coded by composite risk score. Covers flights beyond the live map window (>4 hours) and provides pre-departure planning.

#### Layout

```
┌────────────────────────────────────────────────────────────────┐
│ PLANNED FLIGHTS RISK ASSESSMENT                 [+ Add Flight] │
│ Filter: [All ▼]  Sort: [Departure ▼]  [Export CSV]            │
├────┬────────┬──────────┬──────────┬──────────┬────────┬───────┤
│ RK │ Flight │  Route   │  Dept    │  P.A.V.E │  Risk  │ Detail│
├────┼────────┼──────────┼──────────┼──────────┼────────┼───────┤
│ 🔴 │ N12345 │ DFW→LAX  │ +2h      │ P🟡A🟢V🔴E🟡│  HIGH  │  [→] │
│ 🟡 │ N67890 │ BOS→ORD  │ +6h      │ P🟢A🟡V🟡E🟢│  MED   │  [→] │
│ 🟡 │ N11111 │ ORD→DEN  │ +12h     │ P🟢A🟢V🟡E🟡│  MED   │  [→] │
│ 🟢 │ N22222 │ DEN→PHX  │ +18h     │ P🟢A🟢V🟢E🟢│  LOW   │  [→] │
│ 🟢 │ N33333 │ PHX→LAX  │ +24h     │ P🟢A🟢V🟢E🟢│  LOW   │  [→] │
└────┴────────┴──────────┴──────────┴──────────┴────────┴───────┘

  Risk color: 🔴 HIGH ≥70  🟡 MEDIUM 40–69  🟢 LOW <40
```

#### Row Expansion / Detail Drawer

Clicking [→] opens a right-side drawer:

```
N12345 — KDFW → KLAX
Departure: 2026-03-21 16:00Z (+2h)  Aircraft: BE58  Crew: Smith / Jones

PAVE RISK DETAIL
┌─────────────────────────────────────────────────────────┐
│ P — PILOT                                          🟡 65│
│   PIC Duty Time: 6.5h / 12h limit                      │
│   PIC Currency: IFR current, Night current              │
│   Last Medical: Class 2, expires 2026-09                │
│   Historic: PIC avg risk: LOW (last 6 months)           │
├─────────────────────────────────────────────────────────┤
│ A — AIRCRAFT                                       🟢 20│
│   Status: Airworthy — no MEL items                     │
│   Last 100hr: 2026-03-10                               │
│   Open squawks: None                                    │
│   Historic: 0 AOG events last 90 days                  │
├─────────────────────────────────────────────────────────┤
│ V — ENVIRONMENT                                    🔴 85│
│   Departure wx: KDFW VFR (1800Z METAR)                 │
│   En-route: AIRMET Sierra (IFR conds, mts terrain)     │
│   Active SIGMET: Convective, valid 1800Z-0000Z         │
│   Arrival: KLAX MVFR, marine layer forecast             │
│   AirSafe similar accidents (environment-matched):     │
│     Score 0.84 — B58 approach IMC, 2019, serious       │
│     Score 0.79 — B58 icing encounter, 2021, minor      │
├─────────────────────────────────────────────────────────┤
│ E — EXTERNAL PRESSURES                             🟡 55│
│   Schedule: Hard departure (pax connecting flight)      │
│   Alternates: KVNY available (wx: VFR)                 │
│   Regulatory: No TFRs on route                         │
│   Fuel: Filed w/ 45 min reserve                        │
└─────────────────────────────────────────────────────────┘

COMPOSITE RISK SCORE: 71 / 100  [🔴 HIGH — Recommend brief]

TOP SIMILAR ACCIDENTS (AirSafe)
  #1 Score: 0.84  — [WPR19FA147] BE58, approach IMC, CFIT, 2019 →
  #2 Score: 0.79  — [CEN21LA200] BE58, icing, loss of control, 2021 →
  #3 Score: 0.71  — [ERA20FA112] B58 twin, night IMC, fatal, 2020 →

ACTIONS
[Approve Dispatch]  [Request Crew Briefing]  [Hold / Delay]  [File Hazard]
```

#### Adding a Flight

Modal form:
- Tail number / callsign
- Aircraft type (auto-populated from fleet database)
- Departure (ICAO)
- Waypoints (optional)
- Arrival (ICAO)
- Planned departure time (UTC)
- PIC / SIC (dropdown from pilot roster)
- Mission type (charter / cargo / training / positioning)

On save: triggers FlightSafeWeather and AirSafe queries in background; risk score computed asynchronously.

---

### 5.4 Compliance Center

**Purpose:** Manage and document SMS compliance artifacts. Provides a structured multi-page wizard for filing compliance packages.

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ COMPLIANCE CENTER                    [+ File New Package]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  COMPLIANCE STATUS                                          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Regulatory   ████████████░░░░░  78%  🟡 Due 4/15  │  │
│  │  SMS Manual   ████████████████░  94%  🟢 Current   │  │
│  │  Training     ████████░░░░░░░░░  51%  🔴 Overdue   │  │
│  │  Maintenance  ████████████████░  88%  🟢 Current   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  RECENT PACKAGES                                            │
│  ┌────────────┬──────────┬────────────┬─────────┬────────┐ │
│  │ Package ID │ Type     │ Filed      │ Status  │ Action │ │
│  ├────────────┼──────────┼────────────┼─────────┼────────┤ │
│  │ CP-2026-03 │ Quarterly│ 2026-03-01 │ ✅ Filed │ View  │ │
│  │ CP-2026-02 │ Incident │ 2026-02-14 │ ✅ Filed │ View  │ │
│  │ CP-2026-01 │ Annual   │ 2026-01-05 │ ✅ Filed │ View  │ │
│  │ CP-2025-12 │ Quarterly│ 2025-12-31 │ ✅ Filed │ View  │ │
│  └────────────┴──────────┴────────────┴─────────┴────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Compliance Filing Wizard

Multi-page step-through (6 steps):

**Step 1 — Package Type & Period**
- Select package type: Annual / Quarterly / Incident-Triggered / Regulatory Response
- Reporting period: start date → end date
- Regulatory framework: FAA Part 135 / Part 91 / Part 121 / IOSA / Custom
- Filing officer (signed-in user, editable)

**Step 2 — Safety Policy**
- Policy document: current version + date + upload attachment
- Management commitment statement: free text + sign-off
- Safety objectives review: list with "Met / Partially Met / Not Met" status
- Accountabilities: confirm safety manager + accountable executive
- _P.A.V.E. note: External pressure acknowledgment — management confirms non-punitive reporting culture_

**Step 3 — Risk Management**
- Hazard register summary: count by category, new hazards identified this period
- Risk assessments completed: list (auto-pulled from database)
- Mitigations implemented: list with effectiveness rating
- Residual risk sign-off
- _P.A.V.E. auto-populate: pulls V (environment) incidents from this period, A (aircraft) MEL events, P (pilot) incidents_

**Step 4 — Safety Assurance**
- Internal audits completed: list with findings
- Open findings from prior period: resolved / carried forward
- Safety Performance Indicators (SPIs): enter values or auto-calculate from flight data
  - Accident rate (per 1,000 FH)
  - Serious incident rate
  - Disclosure report rate
  - Training completion rate
- Investigation summaries: brief (link to full reports)

**Step 5 — Safety Promotion**
- Training completed this period: courses, pilots, completion rates
- Lessons-learned distributed: count + topics
- Safety communications issued: newsletters, bulletins, briefings
- Disclosure report participation trend
- NASA ASRS filings count

**Step 6 — Review & Sign**
- Full summary of all entered data
- Attachments list
- Digital signature (typed name + date + role)
- Submit → generates PDF package
- Option: Export as PDF / Print / Archive only

---

### 5.5 Pilot Disclosure Reports (Safe Reporting)

**Purpose:** Non-punitive pilot safety reporting (internal) with NASA ASRS voluntary reporting integration.

#### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ PILOT SAFETY REPORTS                          [+ New Report] │
│ [All Reports ▼]  [Date Range ▼]  [PAVE Category ▼]          │
├──────────────────────────────────────────────────────────────┤
│  REPORT TREND                                                │
│  [sparkline: reports per month, 12 months]                   │
│  This month: 4   vs. 30d avg: 3.2  ↗ Healthy culture        │
├────────────────────────────────────────────────────────────── │
│                                                              │
│  REPORT #  │ DATE  │ PAVE CATEGORY │ TYPE       │ STATUS    │
│  ──────────┼───────┼───────────────┼────────────┼─────────  │
│  RPT-047   │ 03/18 │ V Environment │ Weather    │ Reviewed  │
│  RPT-046   │ 03/12 │ P Pilot       │ Fatigue    │ NASA Sent │
│  RPT-045   │ 03/05 │ A Aircraft    │ Squawk     │ Reviewed  │
│  RPT-044   │ 02/28 │ E External    │ Pressure   │ Open      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### New Report Form

**Page 1 — Incident Details**
- Date / time of event (UTC)
- Aircraft tail number (dropdown)
- Flight: departure → arrival (or ground event)
- Phase of flight at time of event (matches AirSafe vocabulary: takeoff / climb / cruise / descent / approach / landing)
- Brief title (< 100 chars)

**Page 2 — P.A.V.E. Classification**
The pilot selects which PAVE dimension(s) apply:
- **P — Pilot factors:** Fatigue, currency gap, distraction, workload, health
- **A — Aircraft factors:** Mechanical issue, squawk, equipment failure, unfamiliar system
- **V — enVironment factors:** Weather encounter, airspace, terrain, traffic (TCAS)
- **E — External pressures:** Schedule/commercial pressure, passenger request, ATC, fuel concern

**Page 3 — Narrative**
- What happened: free text (required, min 50 chars)
- What you did: corrective action taken
- Contributing factors: multi-select list
- What should change: suggestions / recommendations
- Were injuries / damage: Y/N (if Y → incident report branch)

**Page 4 — NASA ASRS**
- Informational text: "NASA ASRS is a voluntary, confidential aviation safety reporting system. Filing provides immunity under FAA regulations for certain violations."
- Toggle: **[Flag for NASA ASRS Submission]**
- If flagged:
  - Pre-populated fields from pages 1–3
  - NASA ASRS form fields (ACN not available pre-submission)
  - Acknowledgment: reporter identity removed before submission
  - [Generate NASA Report Draft] — opens NASA ASRS form pre-filled for manual submission at asrs.arc.nasa.gov, or copies structured data to clipboard
  - Status tracking: "NASA ASRS Pending / Submitted / ACN Received"

**Page 5 — Review & Submit**
- Summary of all entered data
- Non-punitive disclosure acknowledgment text
- Submit (report visible to Safety Officer only)
- _Reporter identity not shared in aggregated reports unless voluntarily disclosed_

#### Report Review (Safety Officer View)

Each submitted report can be:
- Marked as: Open → Under Review → Action Required → Closed
- Linked to a risk register hazard
- Linked to a compliance package
- Annotated with safety officer notes
- Escalated to incident investigation
- Tagged for lessons-learned publication

---

## 6. Data Architecture

### Local Database Schema (SQLite via better-sqlite3)

```sql
-- Flights
CREATE TABLE flights (
  id TEXT PRIMARY KEY,
  callsign TEXT,
  tail_number TEXT NOT NULL,
  aircraft_type TEXT NOT NULL,
  departure_icao TEXT NOT NULL,
  arrival_icao TEXT NOT NULL,
  waypoints TEXT,             -- JSON array of ICAO strings
  planned_departure_utc TEXT, -- ISO 8601
  actual_departure_utc TEXT,
  status TEXT,                -- planned | active | completed | cancelled
  pic_id TEXT,
  sic_id TEXT,
  mission_type TEXT,
  risk_score INTEGER,         -- composite 0-100
  risk_p INTEGER,
  risk_a INTEGER,
  risk_v INTEGER,
  risk_e INTEGER,
  weather_payload TEXT,       -- JSON: last FlightSafeWeather response
  airsafe_payload TEXT,       -- JSON: last AirSafe response
  last_risk_calc_utc TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Pilots
CREATE TABLE pilots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  certificate_number TEXT,
  ratings TEXT,               -- JSON array
  medical_class INTEGER,
  medical_expiry TEXT,
  last_flight_review TEXT,
  ifr_currency_expiry TEXT,
  night_currency_expiry TEXT,
  duty_time_today_hours REAL DEFAULT 0,
  created_at TEXT
);

-- Aircraft
CREATE TABLE aircraft (
  id TEXT PRIMARY KEY,
  tail_number TEXT UNIQUE NOT NULL,
  aircraft_type TEXT NOT NULL,
  make_model TEXT,
  airworthy BOOLEAN DEFAULT 1,
  mel_items TEXT,             -- JSON array
  open_squawks TEXT,          -- JSON array
  last_100hr_date TEXT,
  last_annual_date TEXT,
  total_hours REAL,
  created_at TEXT
);

-- Compliance Packages
CREATE TABLE compliance_packages (
  id TEXT PRIMARY KEY,
  package_type TEXT,          -- annual | quarterly | incident | regulatory
  period_start TEXT,
  period_end TEXT,
  regulatory_framework TEXT,
  filed_by TEXT,
  filed_at TEXT,
  status TEXT,                -- draft | filed | accepted | rejected
  payload TEXT,               -- JSON: all wizard fields
  pdf_path TEXT,
  created_at TEXT
);

-- Pilot Reports
CREATE TABLE pilot_reports (
  id TEXT PRIMARY KEY,
  pilot_id TEXT,
  flight_id TEXT,
  event_date_utc TEXT,
  tail_number TEXT,
  phase_of_flight TEXT,
  title TEXT,
  pave_categories TEXT,       -- JSON array: P, A, V, E
  narrative_what_happened TEXT,
  narrative_action_taken TEXT,
  contributing_factors TEXT,  -- JSON array
  suggestions TEXT,
  injuries_damage BOOLEAN,
  nasa_flagged BOOLEAN DEFAULT 0,
  nasa_status TEXT,           -- null | pending | submitted | acn_received
  nasa_acn TEXT,
  status TEXT,                -- open | review | action | closed
  safety_officer_notes TEXT,
  risk_register_link TEXT,
  compliance_link TEXT,
  created_at TEXT
);

-- Hazard Register
CREATE TABLE hazards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  pave_category TEXT,
  severity INTEGER,           -- 1-5
  likelihood INTEGER,         -- 1-5
  risk_level TEXT,            -- low | medium | high | critical
  status TEXT,                -- open | mitigated | closed
  mitigations TEXT,           -- JSON array
  source TEXT,                -- report_id | audit_id | observation
  identified_at TEXT,
  closed_at TEXT,
  created_at TEXT
);

-- Safety Performance Indicators
CREATE TABLE spi_entries (
  id TEXT PRIMARY KEY,
  period TEXT,                -- YYYY-MM
  flight_hours REAL,
  accidents INTEGER,
  serious_incidents INTEGER,
  incidents INTEGER,
  disclosure_reports INTEGER,
  training_completion_pct REAL,
  nasa_asrs_filed INTEGER,
  created_at TEXT
);
```

---

## 7. API Integration

### FlightSafeWeather — Integration Points

| Dashboard Feature | Endpoint | Notes |
|---|---|---|
| Live Map weather layers | `GET /api/airmets`, `GET /api/sigmets` | Poll every 5 min |
| METAR station circles | `GET /api/metar/:station` | Per route station |
| Winds aloft layer | `GET /api/winds-aloft?region=X` | Multiple regions |
| Per-flight weather | `POST /api/flight-weather` | On flight creation + refresh |
| Route corridor geometry | Response: `corridor.polygon` | Used to spatially filter hazards |
| Risk polygon generation | Response: `airmets.route`, `sigmets.route` | GeoJSON features → map layer |

### AirSafe — Integration Points

| Dashboard Feature | Endpoint | Notes |
|---|---|---|
| Flight risk score (V factor) | `POST /query` | Per flight, uses weather narrative |
| Risk polygon popout | `POST /query` | Contextual results for clicked zone |
| Flight detail PAVE breakdown | `POST /query` | Top 3 similar accidents |
| Risk List drawer | `POST /query` | All planned flights, queued |
| Compliance — Risk period summary | Historical records | Aggregated by period |

### AirSafe Query Construction

For each flight, build the `narrative` field from FlightSafeWeather response:

```javascript
function buildAirSafeNarrative(weatherPayload) {
  const parts = [];

  // Active SIGMETs on route
  const sigmets = weatherPayload.sigmets?.route?.features ?? [];
  if (sigmets.length > 0) {
    parts.push(`Active SIGMETs on route: ${sigmets.map(f => f.properties?.hazard).join(', ')}`);
  }

  // Active AIRMETs on route
  const airmets = weatherPayload.airmets?.route?.features ?? [];
  if (airmets.length > 0) {
    parts.push(`Active AIRMETs: ${airmets.map(f => f.properties?.hazard).join(', ')}`);
  }

  // Departure METAR flight category
  const deptMetar = weatherPayload.metars?.data?.[0];
  if (deptMetar) {
    parts.push(`Departure conditions: ${deptMetar.flightCategory} at ${deptMetar.stationId}`);
  }

  // Winds aloft
  const winds = weatherPayload.windsAloft?.data?.[0]?.stations?.[0]?.winds;
  if (winds) {
    const alt = Object.keys(winds)[0];
    parts.push(`Winds at ${alt}ft: ${winds[alt].display}`);
  }

  return parts.join('. ') || 'VFR conditions, no active hazards';
}
```

---

## 8. Real-Time & Historic Data Strategy

### Real-Time Data Sources (per PAVE dimension)

| Dimension | Real-Time Source | Refresh Rate |
|---|---|---|
| **P — Pilot** | Dashboard DB (duty time updated on flight state changes) | On event |
| **A — Aircraft** | Dashboard DB (maintenance entries, MEL, squawks) | On entry |
| **V — Environment** | FlightSafeWeather API → AWC | Every 5 min |
| **E — External** | Dashboard DB (schedule, alternates, NOTAMs user-entered) | On entry |

### Historic Data Sources (per PAVE dimension)

| Dimension | Historic Source | Lookback |
|---|---|---|
| **P — Pilot** | `pilot_reports` table, `flights` table, `spi_entries` | Configurable: 30/90/365d |
| **A — Aircraft** | `aircraft` table events, `flights` by tail, `pilot_reports` (A category) | Fleet lifetime |
| **V — Environment** | AirSafe similarity scores (weather-flag dimension), AWC historical if available | Database depth |
| **E — External** | `pilot_reports` (E category), `compliance_packages`, `hazards` | Org lifetime |

### Caching Strategy

- FlightSafeWeather responses: cached 5 minutes in memory (node-cache), keyed by route hash
- AirSafe results: cached 60 minutes, keyed by {departure, arrival, aircraft_type, narrative_hash}
- Map tile cache: Leaflet default (browser)
- SIGMET/AIRMET polygons: shared cache across all flights requesting same time window

---

## 9. Risk Scoring Model

### Composite Risk Score (0–100)

Each PAVE dimension scored 0–100, then weighted:

| Dimension | Weight | Score Sources |
|---|---|---|
| P — Pilot | 25% | Duty time ratio, currency status, medical validity, recent incidents |
| A — Aircraft | 20% | MEL items count/severity, open squawks, maintenance compliance |
| V — Environment | 40% | SIGMET/AIRMET presence, flight category, AirSafe similarity score (highest match) |
| E — External | 15% | Schedule pressure flag, alternate availability, fuel reserve status |

```
Composite = (P × 0.25) + (A × 0.20) + (V × 0.40) + (E × 0.15)
```

### Risk Level Thresholds

| Score | Level | Color | Action |
|---|---|---|---|
| 0–39 | LOW | 🟢 Green | Standard dispatch |
| 40–69 | MEDIUM | 🟡 Amber | Recommend crew briefing |
| 70–84 | HIGH | 🔴 Red | Required safety briefing before dispatch |
| 85–100 | CRITICAL | 🟣 Purple | Safety officer sign-off required |

### V (Environment) Scoring Detail

```
V Score = base + sigmet_bonus + airmet_bonus + airsafe_bonus

base = flight_category_score(worst_along_route)
  VFR=0, MVFR=20, IFR=50, LIFR=80

sigmet_bonus = count(route_sigmets) × 15  (cap at 40)

airmet_bonus = count(route_airmets) × 8   (cap at 20)

airsafe_bonus = airsafe_top_score × 20   (0.0–1.0 → 0–20)
  # Uses highest AirSafe similarity score in results
```

---

## 10. Tech Stack

### Frontend
- **React 18** (Vite build)
- **React Router v6** (page navigation)
- **Leaflet.js + React-Leaflet** (interactive map)
- **Recharts** (SPIs, sparklines, trend charts)
- **Tailwind CSS** (utility-first styling, dark mode)
- **Zustand** (global state: flights, weather, user)
- **React Query (TanStack Query)** (server state, polling, cache)
- **React Hook Form + Zod** (wizard form validation)

### Backend (Dashboard API)
- **Node.js + Express** (REST endpoints, SSE)
- **better-sqlite3** (synchronous SQLite, zero-config)
- **node-cache** (in-memory TTL caching for weather responses)
- **pdfkit** (compliance package PDF generation)
- **dayjs** (date/time calculations, UTC handling)
- **cors, helmet, morgan** (security, logging)

### Infrastructure
- **Vite dev server** (frontend dev, proxies /api to backend)
- All three services (FlightSafeWeather, AirSafe, Dashboard API) run locally
- Single `npm run dev` starts all three via concurrently

---

## 11. UI/UX Principles

1. **Dark theme default** — aviation operations are often in low-light environments; dark mode reduces eye strain.
2. **Risk-color consistency** — Green/Amber/Red/Purple are used exclusively for risk levels; no other meaning.
3. **Zulu time prominently displayed** — all times shown in UTC/Zulu with local in parentheses where helpful.
4. **Progressive disclosure** — overview → drill-down; never show raw data at the top level.
5. **Non-punitive framing** — pilot report UI uses language that emphasizes confidentiality and safety culture.
6. **PAVE always visible** — any risk-related display always labels which P/A/V/E dimension it relates to.
7. **Mobile-aware** — map and risk list must be usable on a tablet (dispatch desk, iPad); full mobile not required.
8. **Accessible** — WCAG 2.1 AA: all color-coded statuses also have icons/text labels (not color-only).

---

## 12. Component Tree

```
App
├── Layout
│   ├── Sidebar (navigation)
│   └── Header (clock, alerts, user)
│
├── pages/
│   ├── SmsOverview
│   │   ├── PillarCard (×4: Policy, Risk, Assurance, Promotion)
│   │   └── PaveStatusStrip
│   │       └── PaveCard (×4: P, A, V, E) — [realtime tab | historic tab]
│   │
│   ├── LiveOperations
│   │   ├── MapControls
│   │   ├── OperationsMap (Leaflet)
│   │   │   ├── FlightRouteLayer
│   │   │   ├── AircraftMarkerLayer
│   │   │   ├── SigmetPolygonLayer
│   │   │   ├── AirmetPolygonLayer
│   │   │   ├── HighRiskZoneLayer
│   │   │   ├── MetarStationLayer
│   │   │   └── RiskPolygonPopout (modal)
│   │   └── FlightStripTray
│   │       └── FlightStrip (×n)
│   │
│   ├── FlightRiskList
│   │   ├── FlightListToolbar (filters, sort, add)
│   │   ├── FlightRiskTable
│   │   │   └── FlightRiskRow (×n)
│   │   ├── FlightDetailDrawer
│   │   │   ├── PaveRiskDetail (×4)
│   │   │   └── AirSafeAccidentList
│   │   └── AddFlightModal
│   │
│   ├── ComplianceCenter
│   │   ├── ComplianceStatusBars
│   │   ├── CompliancePackageList
│   │   └── ComplianceWizard (6 steps)
│   │       ├── Step1_PackageType
│   │       ├── Step2_SafetyPolicy
│   │       ├── Step3_RiskManagement
│   │       ├── Step4_SafetyAssurance
│   │       ├── Step5_SafetyPromotion
│   │       └── Step6_ReviewSign
│   │
│   └── PilotReports
│       ├── ReportTrendChart
│       ├── ReportList
│       └── NewReportWizard (5 steps)
│           ├── Step1_IncidentDetails
│           ├── Step2_PaveClassification
│           ├── Step3_Narrative
│           ├── Step4_NasaAsrs
│           └── Step5_ReviewSubmit
│
└── shared/
    ├── RiskBadge
    ├── PaveBadge
    ├── SparklineChart
    ├── StatusIndicator
    ├── ZuluClock
    └── ConfirmDialog
```

---

## 13. State Management

### Zustand Stores

```typescript
// Flight store
{
  flights: Flight[]
  activeFlight: Flight | null
  setFlights: (flights: Flight[]) => void
  addFlight: (flight: Flight) => void
  updateFlightRisk: (id: string, risk: RiskPayload) => void
}

// Weather store
{
  sigmets: GeoJSON.FeatureCollection
  airmets: GeoJSON.FeatureCollection
  lastWeatherRefresh: Date | null
  weatherLoading: boolean
  refreshWeather: () => Promise<void>
}

// UI store
{
  selectedFlightId: string | null
  mapCenter: [number, number]
  mapZoom: number
  activeMapLayers: string[]
  lookaheadHours: number  // default 4
  sidebarOpen: boolean
}

// Auth store
{
  user: { name: string; role: 'dispatcher' | 'safety_officer' | 'pilot' | 'admin' }
}
```

### React Query Keys

```typescript
['flights']                          // all flights list
['flights', id]                      // single flight detail
['flight-weather', departure, arrival, waypoints, deptTime]
['flight-risk', flightId]
['sigmets']                          // global SIGMET list, 5 min refetch
['airmets']                          // global AIRMET list, 5 min refetch
['pilots']
['aircraft']
['compliance-packages']
['pilot-reports']
['spi-entries']
```

---

## 14. File Structure

```
FlightSafeDashboard/
├── DESIGN.md                    ← This document
├── package.json                 ← Root: concurrently for all services
├── .env.example
│
├── server/                      ← Dashboard API (Express)
│   ├── package.json
│   ├── index.js                 ← Entry point, port 4000
│   ├── db/
│   │   ├── database.js          ← SQLite connection + migrations
│   │   └── schema.sql
│   ├── routes/
│   │   ├── flights.js
│   │   ├── pilots.js
│   │   ├── aircraft.js
│   │   ├── compliance.js
│   │   ├── reports.js
│   │   ├── hazards.js
│   │   └── spi.js
│   ├── services/
│   │   ├── weatherService.js    ← FlightSafeWeather proxy + cache
│   │   ├── airsafeService.js    ← AirSafe proxy + cache
│   │   └── riskCalculator.js   ← Composite PAVE risk scoring
│   └── utils/
│       └── pdfGenerator.js      ← Compliance package PDF
│
└── client/                      ← React frontend (Vite)
    ├── package.json
    ├── vite.config.js           ← Proxy /api → localhost:4000
    ├── index.html
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── router.jsx
        ├── pages/
        │   ├── SmsOverview.jsx
        │   ├── LiveOperations.jsx
        │   ├── FlightRiskList.jsx
        │   ├── ComplianceCenter.jsx
        │   └── PilotReports.jsx
        ├── components/
        │   ├── layout/
        │   │   ├── Sidebar.jsx
        │   │   └── Header.jsx
        │   ├── map/
        │   │   ├── OperationsMap.jsx
        │   │   ├── FlightRouteLayer.jsx
        │   │   ├── SigmetPolygonLayer.jsx
        │   │   ├── AirmetPolygonLayer.jsx
        │   │   ├── HighRiskZoneLayer.jsx
        │   │   ├── MetarStationLayer.jsx
        │   │   └── RiskPolygonPopout.jsx
        │   ├── sms/
        │   │   ├── PillarCard.jsx
        │   │   └── PaveStatusStrip.jsx
        │   ├── flights/
        │   │   ├── FlightRiskTable.jsx
        │   │   ├── FlightDetailDrawer.jsx
        │   │   ├── FlightStrip.jsx
        │   │   └── AddFlightModal.jsx
        │   ├── compliance/
        │   │   └── ComplianceWizard/
        │   │       ├── index.jsx
        │   │       ├── Step1_PackageType.jsx
        │   │       ├── Step2_SafetyPolicy.jsx
        │   │       ├── Step3_RiskManagement.jsx
        │   │       ├── Step4_SafetyAssurance.jsx
        │   │       ├── Step5_SafetyPromotion.jsx
        │   │       └── Step6_ReviewSign.jsx
        │   ├── reports/
        │   │   └── NewReportWizard/
        │   │       ├── index.jsx
        │   │       ├── Step1_IncidentDetails.jsx
        │   │       ├── Step2_PaveClassification.jsx
        │   │       ├── Step3_Narrative.jsx
        │   │       ├── Step4_NasaAsrs.jsx
        │   │       └── Step5_ReviewSubmit.jsx
        │   └── shared/
        │       ├── RiskBadge.jsx
        │       ├── PaveBadge.jsx
        │       ├── SparklineChart.jsx
        │       ├── StatusIndicator.jsx
        │       └── ZuluClock.jsx
        ├── stores/
        │   ├── flightStore.js
        │   ├── weatherStore.js
        │   └── uiStore.js
        ├── hooks/
        │   ├── useFlights.js
        │   ├── useWeather.js
        │   ├── useRisk.js
        │   └── usePilotReports.js
        └── lib/
            ├── queryClient.js
            ├── apiClient.js      ← Axios instance → /api proxy
            └── riskColors.js     ← Shared risk color constants
```

---

## 15. Open Questions / Future Work

### Open Questions (Require Client Input)

1. **Pilot duty time source** — Will duty time be manually entered, or is there an existing crew scheduling system to integrate?
2. **Aircraft position tracking** — Is ADS-B data available (e.g., FlightAware, ADS-B Exchange API), or will aircraft positions be manually updated?
3. **Fleet database** — Is there an existing aircraft/pilot roster to import, or will it be built from scratch?
4. **Regulatory framework** — Which FAA operating rules apply (91, 135, 121)? Determines compliance wizard content.
5. **Multi-user authentication** — Standalone user management, or integrate with an existing identity provider?
6. **NASA ASRS submission** — Direct API submission (if NASA provides one) or PDF/clipboard workflow?
7. **N-hour lookahead** — Confirm default of 4 hours for live map; configurable per user or org-wide setting?

### Future Enhancements

- **ADS-B live feed integration** — real aircraft position tracking
- **Push notifications** — alert dispatcher when a flight enters a newly-issued SIGMET corridor
- **Mobile app** (React Native) — pilot self-reporting in the field
- **Investigation module** — structured incident/accident investigation workflow
- **Crew resource management (CRM)** scoring integration
- **Weather trend analytics** — identify high-risk seasonal route periods from historical data
- **Role-based access control** — granular permissions per page/action
- **API for airline operations software** — export risk scores to existing dispatch systems
- **AirSafe risk rate integration** — display `risk_clusters[].recent_rate` as trend lines on SMS Overview
- **Scheduled risk recalculation** — nightly job refreshes risk scores for all planned flights as new weather comes in

---

*End of Design Document*
