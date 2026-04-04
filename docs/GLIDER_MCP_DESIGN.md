# Glider Ops MCP Server — Design Document

## 1. Proposed Interface

### Resources (read-only data exposed to LLM clients)

| URI | Description |
|-----|-------------|
| `glider://settings` | Base airport, alt TAF airport, region bounds, pricing config |
| `glider://fleet/gliders` | All glider aircraft (needs_tow + glider flags), airworthiness, squawk status |
| `glider://fleet/tow-planes` | All tow planes (is_tow flag), airworthiness, squawk status |
| `glider://pilots/tow-certified` | Tow-certified personnel with schedule, checkouts, currency |
| `glider://pilots/instructors` | CFI/CFIG-rated personnel for dual glider flights |
| `glider://reservations?date={iso}` | Glider reservations for a given date (default: today) |
| `glider://tow-sessions?date={iso}` | Tow plane duty blocks for a given date |
| `glider://invoices?date={iso}&clientId={id}` | Invoice lookup by date and/or client |
| `glider://clients` | Registered client aircraft (own gliders, transients) |
| `glider://weather` | Current METAR/TAF/SIGMET/AIRMET for base + alt airports |
| `glider://schedule/capacity?date={iso}` | Pilot schedule + bipartite-matched tow capacity for date |

### Tools (actions the LLM can invoke)

| Tool | Parameters | Returns |
|------|-----------|---------|
| `get_tow_schedule` | `date: string` | Full tow timeline: per-event actualStart/End, assigned plane, wait times |
| `get_tow_availability` | `date: string, time: HH:MM` | 30-min window deficiency check: demand/supply/isStandby/color |
| `get_period_waits` | `date: string` | 15-min period grid: avgWait, color, count per period |
| `create_reservation` | `picId, aircraftType: 'own'\|'club'\|'none', tailNumber?, instructorId?, departureOffset: min, sessionDurationMin, numTows, towHeights: number[], towPlaneId?, towPilotId?` | Created reservation with tow slots, wait estimate, standby status |
| `cancel_reservation` | `flightId: string` | Cancellation confirmation + any standby promotions triggered |
| `update_reservation` | `flightId, updates: Partial<Reservation>` | Updated reservation |
| `create_tow_duty_block` | `towPlaneId, towPilotId, startTime: ISO, durationMin` | Duty block record + any standby promotions triggered |
| `bill_flight` | `flightId, towsBilled: {height, amount}[], rentalHours?, instructionHours?` | Invoice line items added, invoice total |
| `mark_no_show` | `flightId` | Status updated, capacity recalculated |
| `add_squawk` | `aircraftId, description, severity: 'grounding'\|'non-grounding'` | Squawk created; if grounding, affected reservations flagged |
| `resolve_squawk` | `squawkId, resolution, mechanicId` | Squawk resolved, aircraft returned to service |
| `register_client_aircraft` | `tailNumber, ownerName, make, model, glider: bool` | Client record created/updated |
| `adjust_pilot_schedule` | `pilotId, date: ISO, block: 'am'\|'pm', available: bool` | Schedule adjustment saved, capacity recalculated |
| `promote_standby` | `flightId` | Manual standby-to-confirmed promotion |

### Prompts (reusable prompt templates)

| Prompt | Description |
|--------|-------------|
| `daily_briefing` | Generates morning ops brief: weather, capacity, reservations, squawk status, standby queue |
| `tow_demand_analysis` | Analyzes demand vs supply for a date range, identifies bottleneck periods |
| `billing_summary` | Summarizes unbilled flights, open invoices, revenue for date range |

---

## 2. Identified Issues in Current API Layer

### 2.1 No Server-Side Persistence for Glider Data

**Problem:** All glider state (reservations, invoices, clients, schedules, squawks) lives in browser localStorage. The MCP server cannot read or write localStorage.

**Impact:** Critical blocker. An MCP server has no data to serve and no way to persist mutations.

**Current stores affected:**
- `flights.js` → `localStorage('flightsafe_scheduled')`
- `invoices.js` → `localStorage('flightsafe_glider_invoices')`
- `clients.js` → `localStorage('flightsafe_clients')`
- `squawks.js` → `localStorage('flightsafe_squawks')`
- `gliderSettings.js` → `localStorage('flightsafe:gliderSettings')`
- Pilot schedule adjustments/no-shows → localStorage keys

### 2.2 Seed Data Merged at Read Time

**Problem:** `getAllFlights()` merges mock seed data + localStorage on every call. There's no canonical "database" — the truth is a runtime merge of two sources.

**Impact:** The MCP server would need to replicate this merge logic or risk returning stale/incomplete data. Mock data divergence between server and client becomes a source of bugs.

### 2.3 No REST API for Glider Operations

**Problem:** The Express server (`server/index.js`) only serves sim state and event streaming. Zero CRUD endpoints for flights, invoices, clients, squawks, or schedules.

**Impact:** The MCP server has no backend to proxy. It would need to either:
- Embed its own data layer (duplicating client logic), or
- Call a REST API that doesn't exist yet

### 2.4 Aircraft Identified by Both `id` and `tailNumber`

**Problem:** Some stores key by `id` (e.g., `ac-008`), others by `tailNumber` (e.g., `N8001G`). The clients store keys by `tailNumber`. Flights reference both. Cross-referencing requires scanning the full aircraft array.

**Impact:** MCP tools need a consistent identifier. Callers shouldn't need to know which ID scheme a given endpoint expects.

### 2.5 Tow Schedule is Compute-Only, Not Persisted

**Problem:** `buildTowSchedule()` and `computeTowReservations()` are pure functions that recompute from flight data on every render. Actual tow times (actualStartMs, assignedPlaneId) are never stored.

**Impact:** The MCP server would need to run `gliderUtils.js` to answer "when is my tow?" — tight coupling to client-side utility code. No audit trail of what actually happened vs. what was scheduled.

### 2.6 Pricing Hardcoded in Component

**Problem:** `GLIDER_PRICING` lives inside `GliderOps.jsx` (a 3,000-line React component). `TOW_SETTINGS` lives in `gliderUtils.js`. Neither is importable by a server module without pulling in React dependencies.

**Impact:** MCP billing tools can't reference pricing without duplicating constants.

### 2.7 No Authentication or Authorization Model

**Problem:** No user identity, roles, or permissions. Any caller can bill flights, cancel reservations, or resolve squawks.

**Impact:** An MCP server exposing these tools to an LLM agent needs at minimum role-based guards (dispatcher vs. pilot vs. billing).

### 2.8 Weather Fetched Client-Side Only

**Problem:** `WeatherBar.jsx` fetches from `/weather-api` (proxied to FlightSafeWeather on port 3000). No server-side caching or weather store.

**Impact:** The MCP `glider://weather` resource would need its own fetch + cache layer, or the weather API must be called per-request (10-min staleness window wasted).

### 2.9 No Event Sourcing / Audit Trail

**Problem:** Mutations (add flight, resolve squawk, bill tow) overwrite localStorage in place. No history of who changed what or when.

**Impact:** MCP tools that modify state have no way to provide an audit log — critical for flight ops where regulatory traceability matters.

### 2.10 Standby Promotion Logic Embedded in UI

**Problem:** `promoteStandbyReservations()` is called from the `NewReservationPanel` submit handler inside the React component. It's not a standalone function.

**Impact:** The MCP `create_tow_duty_block` tool needs to trigger the same promotion logic but can't import it from the UI component.

---

## 3. Proposed Improvements Before Building the MCP

### 3.1 Extract a Shared Domain Library

**Create `shared/gliderDomain.js`** (or a `shared/` package) containing:
- `GLIDER_PRICING`, `TOW_SETTINGS`, `TOW_HEIGHTS` — all configuration constants
- `towPrice()`, `towCycleMin()`, `timeAloftMin()` — pricing and scheduling math
- `buildTowSchedule()`, `computeTowReservations()`, `computePeriodWaits()`, `towDeficiencyMin()` — scheduling engine
- `promoteStandbyReservations()` — extracted from component into a pure function
- Flight/reservation/invoice type definitions (JSDoc or TypeScript interfaces)

Both the React client and the MCP server import from this shared module. Zero duplication.

### 3.2 Build a REST API on the Express Server (port 4000)

Add CRUD endpoints that the MCP server proxies (or the MCP server *is* the Express server):

```
GET    /api/glider/reservations?date=
POST   /api/glider/reservations
PATCH  /api/glider/reservations/:id
DELETE /api/glider/reservations/:id

GET    /api/glider/tow-sessions?date=
POST   /api/glider/tow-sessions

GET    /api/glider/tow-schedule?date=
GET    /api/glider/tow-availability?date=&time=
GET    /api/glider/period-waits?date=

GET    /api/glider/invoices?date=&clientId=
POST   /api/glider/invoices/:id/line-items
PATCH  /api/glider/invoices/:id/pay

GET    /api/glider/clients
POST   /api/glider/clients

GET    /api/glider/squawks?aircraftId=
POST   /api/glider/squawks
PATCH  /api/glider/squawks/:id/resolve

GET    /api/glider/schedule/capacity?date=
PATCH  /api/glider/schedule/:pilotId/adjust

GET    /api/glider/fleet/gliders
GET    /api/glider/fleet/tow-planes
GET    /api/glider/pilots/tow-certified
GET    /api/glider/pilots/instructors

GET    /api/glider/settings
GET    /api/glider/weather
```

### 3.3 Add a Persistence Layer (SQLite or JSON files)

Replace localStorage with server-side storage. Options:

| Option | Pros | Cons |
|--------|------|------|
| **SQLite via better-sqlite3** | Real queries, transactions, concurrent access, audit trail | Schema migration overhead |
| **JSON files (lowdb)** | Zero schema, matches current data shape | No concurrency, no queries |
| **In-memory + JSONL append log** | Fast, event-sourced, replayable | Lost on restart without snapshot |

**Recommendation:** SQLite. The data is relational (flights reference aircraft, pilots, invoices). The MCP server needs reliable concurrent reads. SQLite is already listed in Phase 2 plans.

Minimal schema:
```sql
reservations (id, pic_id, aircraft_id, tail_number, departure_utc, status, tow_info_json, ...)
tow_sessions (id, tow_plane_id, tow_pilot_id, start_utc, duration_min, ...)
invoices (id, date, client_id, status, ...)
invoice_line_items (id, invoice_id, flight_id, type, amount, ...)
squawks (id, aircraft_id, description, severity, status, resolved_by, resolved_at, ...)
clients (tail_number PK, owner_name, make, model, ...)
schedule_adjustments (pilot_id, date, block, available, ...)
audit_log (id, entity_type, entity_id, action, actor, timestamp, diff_json)
```

### 3.4 Normalize Aircraft Identity

Adopt a single canonical key strategy:
- **Internal:** always `id` (e.g., `ac-008`)
- **External/display:** always `tailNumber` (e.g., `N8001G`)
- All API endpoints accept *either* and resolve internally
- Add a lookup index: `Map<tailNumber, id>` built once at startup

### 3.5 Persist Computed Tow Schedules

When a reservation is created or modified, compute and **store** the tow schedule result:
- `reservations.first_slot_utc`, `reservations.wait_min`, `reservations.assigned_tow_plane_id`
- Recompute only on relevant mutations (new reservation, cancellation, duty block change)
- Enables historical queries: "what was the average wait time last Saturday?"

### 3.6 Server-Side Weather Cache

Add a weather cache in the Express server:
```
GET /api/glider/weather  →  cache(10min) → FlightSafeWeather API
```
Both the React client and MCP server consume the same cached endpoint. Avoids duplicate API calls.

### 3.7 Add Audit Logging

Every mutation appends to `audit_log`:
```json
{ "entity": "reservation", "id": "res-001", "action": "create", "actor": "mcp:claude", "ts": "...", "diff": {...} }
```
The MCP server automatically tags mutations with `actor: "mcp:<session>"`. The UI tags with `actor: "ui:<browser>"`.

### 3.8 Extract Standby Promotion as a Domain Event

Refactor promotion from an imperative UI callback to a domain rule:
```javascript
// shared/gliderDomain.js
function onCapacityChange(allReservations, allDutyBlocks) {
  const promoted = [];
  // ... promotion logic ...
  return promoted; // [{flightId, promotedFrom: 'standby', promotedTo: 'confirmed'}]
}
```
Called by both `POST /api/glider/tow-sessions` and the UI submit handler.

---

## 4. Recommended Build Order

```
Phase A — Foundation (no MCP yet)
  1. Extract shared/gliderDomain.js from GliderOps.jsx + gliderUtils.js
  2. Add SQLite schema + seed migration
  3. Build REST API endpoints on Express server
  4. Refactor React client to fetch from REST API instead of localStorage
  5. Add audit_log table and middleware

Phase B — MCP Server
  6. Scaffold MCP server (stdio transport) using @modelcontextprotocol/sdk
  7. Implement Resources (read-only, proxying REST GET endpoints)
  8. Implement Tools (mutations, proxying REST POST/PATCH/DELETE)
  9. Implement Prompts (daily_briefing, demand_analysis, billing_summary)
  10. Add MCP ↔ REST auth header (service token)

Phase C — Polish
  11. Server-side weather cache
  12. Persisted tow schedule snapshots
  13. Aircraft ID normalization across all stores
  14. Integration tests (MCP tool → REST → SQLite → verify state)
```

---

## 5. MCP Server Technical Shape

```
server/mcp/
  index.js          — MCP server entry (stdio transport)
  resources.js      — Resource handlers (glider://*)
  tools.js          — Tool handlers (create_reservation, etc.)
  prompts.js        — Prompt templates
  apiClient.js      — HTTP client for REST API (localhost:4000)
```

Transport: **stdio** (standard for Claude Code / Claude Desktop integration).
Protocol: MCP SDK `@modelcontextprotocol/sdk` with `Server` class.

The MCP server is a thin adapter: it translates MCP protocol into REST calls against the Express API. All business logic lives in `shared/gliderDomain.js` and the REST handlers — the MCP layer is stateless.
