# FlightSafe Domain Ontology

Entity relationships across the system. No field-level detail — just what things are and how they connect.

## Core Entities

```
AIRCRAFT ─────────── the fleet (gliders, tow planes, powered aircraft)
PERSONNEL ────────── all people (pilots, mechanics, dispatchers, instructors, ground crew)
FLIGHT ───────────── a scheduled or completed flight operation
SQUAWK ───────────── an aircraft discrepancy report (maintenance defect)
WORK ORDER ───────── a maintenance task assigned to resolve squawks or perform inspections
PART ─────────────── a physical component ordered/installed for a work order
```

## Operational Entities

```
TOW SESSION ──────── a tow plane duty block (a type of FLIGHT with missionType 'tow_session')
GLIDER SESSION ───── a glider flight reservation (a type of FLIGHT requesting tows)
PILOT SCHEDULE ───── recurring weekly availability for tow pilots (base + date adjustments)
MOVEMENT LOG ─────── aircraft location change history (ground tow, repositioning)
INVOICE ──────────── billing record grouping line items for a client on a date
SERVICE RATE ─────── pricing configuration for tows, rental, and instruction
CLIENT AIRCRAFT ──── non-fleet aircraft using this airport (own gliders, transients, tenants)
```

## Safety & Compliance Entities

```
PILOT REPORT ─────── safety observation filed by a crew member (PAVE-categorized)
HAZARD ───────────── SMS risk register entry with mitigations
SAFETY COMM ──────── briefings, debriefs, bulletins, management reports
COMPLIANCE PKG ───── regulatory filing package (quarterly, annual, incident)
RISK SNAPSHOT ────── point-in-time risk assessment captured at flight scheduling
ACK (acknowledgment) crew and supervisor sign-off on individual risk items
```

## Relationships

```
AIRCRAFT
  ├── has many FLIGHTS (via tailNumber)
  ├── has many SQUAWKS (via tailNumber)
  ├── has many WORK ORDERS (via tailNumber)
  ├── has many MOVEMENT LOG entries (via tailNumber)
  ├── has many PARTS consumed (via tailNumber)
  └── checked out to many PERSONNEL (tow pilots, via towCheckouts)

PERSONNEL
  ├── flies as PIC or SIC on FLIGHTS
  ├── supervises other PERSONNEL (self-referencing)
  ├── assigned to WORK ORDERS (as mechanic or supervisor)
  ├── reports SQUAWKS
  ├── moves AIRCRAFT (movement log)
  ├── authors SAFETY COMMS
  ├── acknowledges RISK items on FLIGHTS
  ├── has a PILOT SCHEDULE (tow pilots only)
  └── checked out in specific AIRCRAFT (tow pilots)

FLIGHT
  ├── operated by PERSONNEL (PIC, SIC)
  ├── uses one AIRCRAFT
  ├── contains a RISK SNAPSHOT with risk items
  ├── risk items receive ACKs from PERSONNEL
  ├── may reference SAFETY COMMS (debriefs)
  ├── glider flights carry TOW INFO (tow requests, standby status)
  ├── status lifecycle: planned → billed | no_show | cancelled
  └── billing creates INVOICE line items (tow, rental, instruction)

SQUAWK
  ├── reported against one AIRCRAFT
  ├── may generate one WORK ORDER
  ├── severity 'grounding' → grounds the AIRCRAFT
  └── unified store: seed data (maintenance/mockDb) + user-added (localStorage)

WORK ORDER
  ├── addresses one or more SQUAWKS
  ├── assigned to PERSONNEL (mechanics)
  ├── supervised by PERSONNEL (A&P / IA)
  ├── targets one AIRCRAFT
  └── consumes PARTS

PART
  ├── ordered for one WORK ORDER
  └── installed on one AIRCRAFT

PILOT SCHEDULE
  ├── belongs to one PERSONNEL (tow pilot)
  ├── base schedule: abstract weekly pattern (Mon-Sun, AM/PM)
  ├── adjustments: date-specific additions or removals
  ├── no-shows: date-specific unavailability
  └── combined with AIRCRAFT airworthiness → tow capacity (via bipartite matching)

HAZARD
  └── may link to one PILOT REPORT

SAFETY COMM
  ├── may reference one FLIGHT (debriefs)
  └── may reference one AIRCRAFT

INVOICE
  ├── belongs to one client (PERSONNEL — first listed pilot)
  ├── scoped to one date + one AIRCRAFT (tailNumber)
  ├── contains LINE ITEMS (tow, rental, instruction)
  ├── each line item references one FLIGHT
  ├── upserted: same client + date → items accumulate on one invoice
  └── status lifecycle: open → paid

SERVICE RATE
  ├── tow pricing: per 1,000 ft of tow height
  ├── glider rental: per hour (club aircraft only)
  ├── instruction: per hour (dual flights only)
  └── applied at billing time from GLIDER_PRICING config

CLIENT AIRCRAFT
  ├── any non-fleet aircraft that uses this airport
  ├── keyed by tail number (primary identifier)
  ├── owner/operator: name, phone, email
  ├── aircraft details: make/model, ICAO type, FBO category, fuel type
  ├── basedHere flag: hangared tenant vs transient visitor
  ├── shared across FBO, Glider Ops, and Maintenance (entered once)
  ├── upserted by tail — new info merges with existing record
  ├── auto-created when scheduling an own-aircraft glider flight
  ├── provides autocomplete for returning visitors
  └── use cases: own gliders for tow, transient fuel/hangar, based tenants, maintenance customers
```

## Capacity Model

```
TOW CAPACITY (per time block)
  = min(available tow PILOTS, airworthy tow AIRCRAFT they can fly)
  
  Available pilots = PILOT SCHEDULE (base + adjustments - no-shows)
  Airworthy aircraft = AIRCRAFT where airworthy=true AND no grounding SQUAWKS
  Assignment = bipartite matching (pilot → aircraft via towCheckouts)
```

## Data Flow

```
Mock seed data (static)          localStorage (user mutations)
  mockAircraft ──────────────┐
  mockPersonnel ─────────────┤
  mockFlights ───────────────┤     scheduled flights ──────┐
  mockGliderTowFlights ──────┤     sim flights ────────────┤
  mockSquawks ───────────────┤     user squawks ───────────┤
                             │     schedule adjustments ───┤
                             │     no-shows ───────────────┤
                             │     invoices ────────────────┤
                             │     clients ─────────────────┤
                             ▼                             ▼
                        Unified stores (merge seed + user)
                          getAllFlights()
                          getSquawks()
                          getInvoices()
                             │
                             ▼
                     UI components consume
                     unified data globally
```

## Key Design Principles

1. **Aircraft identified by both `id` and `tailNumber`** — internal refs use `id`, cross-module refs use `tailNumber`
2. **Squawks are global** — single unified store merges maintenance seed data with user-submitted squawks; grounding squawks override aircraft airworthiness
3. **Flights are global** — single store merges mock seed, simulator-generated, and user-scheduled flights
4. **Personnel are multi-role** — same person can be PIC, instructor, mechanic supervisor, or squawk reporter depending on context
5. **Schedule → Capacity is derived** — pilot schedules + aircraft airworthiness → bipartite matching → available tow minutes per time block
6. **Invoices upsert by client + date** — billing a flight finds or creates an invoice for that pilot on that day; tow, rental, and instruction line items accumulate on a single invoice
7. **Service rates are configuration** — pricing lives in GLIDER_PRICING constants, applied at billing time; rates shown in Services tab for transparency
