-- =============================================================================
-- FlightSafe Unified Database Schema
-- Combines maintenance (FAA 14 CFR Part 43 & 91), operational, and business tables
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Aircraft Registry
-- Central aircraft table — every aircraft (fleet + client) referenced by tail.
-- Required as FK target for maintenance, flights, and client_aircraft tables.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aircraft (
  id                    TEXT PRIMARY KEY,
  operator              TEXT,             -- flightsafe | journeys | mhg | ssb | null (client)
  tail_number           TEXT NOT NULL UNIQUE,
  make_model            TEXT,
  icao_type             TEXT,
  icao_hex              TEXT,             -- Mode-S transponder address (e.g. 'a59663')
  passenger_capacity    INTEGER,
  op_cost_per_hour      REAL,
  fuel_capacity_gal     REAL,
  fuel_burn_gal_hr      REAL,
  empty_weight_lbs      REAL,
  max_gross_weight_lbs  REAL,
  cruise_speed_kts      REAL,
  service_ceiling       INTEGER,
  year                  INTEGER,
  serial_number         TEXT,
  airworthy             INTEGER DEFAULT 1,
  inspection_status     TEXT DEFAULT 'current',
  total_airframe_hours  REAL,
  last_annual_date      TEXT,
  next_annual_due       TEXT,
  last_100hr_date       TEXT,
  next_100hr_due        TEXT,
  last_flight_date      TEXT,
  assigned_base         TEXT,
  current_location      TEXT DEFAULT 'ramp',
  location_updated_at   TEXT,
  location_updated_by   TEXT,
  fuel_type             TEXT,
  fbo_category          TEXT,
  equipment             TEXT,             -- JSON blob
  risk_profile          TEXT,             -- JSON blob
  weight_balance        TEXT,             -- JSON blob
  mel_items_open        TEXT,             -- JSON array
  open_squawks          TEXT,             -- JSON array
  airworthiness_directives TEXT,          -- JSON array
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_aircraft_tail ON aircraft(tail_number);
CREATE INDEX IF NOT EXISTS idx_aircraft_operator ON aircraft(operator);

-- =============================================================================
-- MAINTENANCE SCHEMA (from client/src/maintenance/schema.sql)
-- FAA 14 CFR Part 43 & 91 Compliant
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Squawks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS squawks (
  id                TEXT PRIMARY KEY,
  tail_number       TEXT    NOT NULL,
  reported_by       TEXT    NOT NULL,
  reported_date     TEXT    NOT NULL,
  description       TEXT    NOT NULL,
  severity          TEXT    NOT NULL
                    CHECK(severity IN ('grounding','ops_limiting','deferred','monitoring')),
  status            TEXT    NOT NULL
                    CHECK(status IN ('open','in_progress','deferred_mel','closed')),
  mel_reference     TEXT,
  mel_expiry_date   TEXT,
  airframe_hours    REAL,
  resolved_date     TEXT,
  resolved_by       TEXT,
  resolution_notes  TEXT,
  work_order_id     TEXT,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

-- -----------------------------------------------------------------------------
-- Work Orders
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_orders (
  id               TEXT PRIMARY KEY,
  tail_number      TEXT    NOT NULL,
  created_date     TEXT    NOT NULL,
  priority         TEXT    NOT NULL
                   CHECK(priority IN ('aog','urgent','routine','scheduled')),
  type             TEXT    NOT NULL
                   CHECK(type IN ('inspection','repair','ad_compliance','overhaul','preventive','squawk')),
  title            TEXT    NOT NULL,
  description      TEXT    NOT NULL,
  assigned_to      TEXT,
  status           TEXT    NOT NULL
                   CHECK(status IN ('open','in_progress','parts_on_order','completed','deferred','cancelled')),
  location         TEXT    NOT NULL DEFAULT 'ramp'
                   CHECK(location IN ('hangar','ramp','maintenance_bay','remote','shop')),
  hold_reason      TEXT,
  queue_position   INTEGER,
  estimated_hours  REAL,
  actual_hours     REAL,
  parts_cost       REAL    DEFAULT 0,
  labor_cost       REAL    DEFAULT 0,
  completed_date   TEXT,
  deferred_to      TEXT,
  notes            TEXT,
  -- Extra fields from mockDb
  assigned_personnel_ids TEXT,            -- JSON array
  supervisor_id          TEXT,
  supervisor_certificate_id TEXT,
  accruing_hours         INTEGER DEFAULT 0,
  started_at             TEXT
);

-- -----------------------------------------------------------------------------
-- Parts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parts (
  id               TEXT PRIMARY KEY,
  work_order_id    TEXT NOT NULL,
  tail_number      TEXT NOT NULL,
  part_number      TEXT NOT NULL,
  description      TEXT NOT NULL,
  quantity         INTEGER NOT NULL DEFAULT 1,
  unit_cost        REAL    DEFAULT 0,
  supplier         TEXT,
  po_number        TEXT,
  ordered_date     TEXT,
  eta_date         TEXT,
  arrived_date     TEXT,
  installed_date   TEXT,
  status           TEXT NOT NULL
                   CHECK(status IN (
                     'not_ordered','ordered','in_transit',
                     'arrived','backordered','installed','cancelled'
                   )),
  notes            TEXT,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_parts_wo     ON parts(work_order_id);
CREATE INDEX IF NOT EXISTS idx_parts_status ON parts(status);
CREATE INDEX IF NOT EXISTS idx_wo_location  ON work_orders(location);
CREATE INDEX IF NOT EXISTS idx_wo_hold      ON work_orders(hold_reason);

-- Junction: work orders may resolve one or more squawks
CREATE TABLE IF NOT EXISTS work_order_squawks (
  work_order_id TEXT NOT NULL,
  squawk_id     TEXT NOT NULL,
  PRIMARY KEY (work_order_id, squawk_id),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (squawk_id)     REFERENCES squawks(id)
);

-- -----------------------------------------------------------------------------
-- Required Inspection Schedule
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_schedule (
  id                       TEXT PRIMARY KEY,
  tail_number              TEXT    NOT NULL,
  inspection_type          TEXT    NOT NULL,
  regulatory_ref           TEXT,
  interval_months          INTEGER,
  interval_hours           REAL,
  due_soon_threshold_days  INTEGER,
  last_completed_date      TEXT,
  last_completed_hours     REAL,
  next_due_date            TEXT,
  next_due_hours           REAL,
  frequency_days           INTEGER,
  frequency_hours          REAL,
  next_recurrence          TEXT,
  overdue                  INTEGER DEFAULT 0,
  status                   TEXT    DEFAULT 'current',
  notes                    TEXT
);

-- -----------------------------------------------------------------------------
-- Maintenance Records (Logbook Entries)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_records (
  id                        TEXT PRIMARY KEY,
  tail_number               TEXT NOT NULL,
  work_order_id             TEXT,
  record_date               TEXT,
  completed_date            TEXT,
  type                      TEXT,
  work_type                 TEXT,
  description               TEXT NOT NULL,
  findings                  TEXT,
  corrective_action         TEXT,
  airframe_hours_at_service REAL,
  mechanic_name             TEXT,
  technician                TEXT,
  mechanic_certificate      TEXT,
  certification_level       TEXT,
  certificate_number        TEXT,
  return_to_service_date    TEXT,
  parts_replaced            TEXT,            -- JSON
  hours_worked              REAL,
  materials_cost            REAL,
  labor_cost                REAL,
  regulatory_ref            TEXT,
  notes                     TEXT
);

-- -----------------------------------------------------------------------------
-- Component TBO Tracking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS component_tbo (
  id                          TEXT PRIMARY KEY,
  tail_number                 TEXT    NOT NULL,
  component                   TEXT    NOT NULL,
  component_label             TEXT,
  manufacturer                TEXT,
  model                       TEXT,
  serial_number               TEXT,
  install_date                TEXT,
  installed_date              TEXT,
  hours_at_install            REAL,
  installed_hours             REAL,
  tbo_hours                   REAL    NOT NULL,
  tbo_months                  INTEGER,
  tbo_calendar_months         INTEGER,
  next_tbo_date               TEXT,
  next_overhaul_due           TEXT,
  due_soon_threshold_hours    REAL DEFAULT 100,
  status                      TEXT    DEFAULT 'normal',
  notes                       TEXT
);

-- -----------------------------------------------------------------------------
-- AD Compliance Tracking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_compliance (
  id                         TEXT PRIMARY KEY,
  tail_number                TEXT NOT NULL,
  ad_number                  TEXT NOT NULL,
  ad_title                   TEXT NOT NULL,
  issuing_authority          TEXT DEFAULT 'FAA',
  effective_date             TEXT NOT NULL,
  applicability              TEXT NOT NULL,
  compliance_type            TEXT NOT NULL
                             CHECK(compliance_type IN ('one_time','recurring','terminating')),
  compliance_interval_hours  REAL,
  compliance_interval_months INTEGER,
  initial_compliance_date    TEXT,
  last_compliance_date       TEXT,
  next_compliance_due        TEXT,
  compliance_method          TEXT,
  status                     TEXT NOT NULL
                             CHECK(status IN ('complied','open','deferred','not_applicable')),
  work_order_id              TEXT,
  notes                      TEXT
);

-- -----------------------------------------------------------------------------
-- Personnel
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personnel (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  weight_lbs            REAL,
  role                  TEXT NOT NULL,
  role_label            TEXT,
  department            TEXT DEFAULT 'Operations',
  certificate_number    TEXT,
  cert_type             TEXT,
  cfi_cert              TEXT,
  cfi_ratings           TEXT,             -- JSON array
  medical_class         TEXT,
  medical_expiry        TEXT,
  last_flight_review    TEXT,
  ifr_currency_expiry   TEXT,
  night_currency_expiry TEXT,
  duty_hours_last_30d   REAL,
  flight_hours_ytd      REAL,
  training              TEXT,             -- JSON
  can_return_to_service INTEGER DEFAULT 0,
  supervisor_id         TEXT,
  current_location      TEXT DEFAULT 'on_prem',
  capacity_hours_week   REAL,
  assigned_hours_week   REAL DEFAULT 0,
  specializations       TEXT,             -- JSON array
  years_experience      INTEGER,
  notes                 TEXT
);

-- -----------------------------------------------------------------------------
-- Mechanic Certificates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mechanic_certificates (
  id                 TEXT PRIMARY KEY,
  personnel_id       TEXT NOT NULL,
  cert_type          TEXT NOT NULL,
  certificate_number TEXT NOT NULL,
  issued_date        TEXT,
  status             TEXT NOT NULL DEFAULT 'active',
  status_date        TEXT,
  status_notes       TEXT,
  FOREIGN KEY (personnel_id) REFERENCES personnel(id)
);

CREATE INDEX IF NOT EXISTS idx_certs_person ON mechanic_certificates(personnel_id);
CREATE INDEX IF NOT EXISTS idx_certs_status ON mechanic_certificates(status);

-- Junction: work order personnel assignments
CREATE TABLE IF NOT EXISTS work_order_personnel (
  work_order_id  TEXT NOT NULL,
  personnel_id   TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'assigned',
  certificate_id TEXT,
  PRIMARY KEY (work_order_id, personnel_id, role),
  FOREIGN KEY (work_order_id)  REFERENCES work_orders(id),
  FOREIGN KEY (personnel_id)   REFERENCES personnel(id),
  FOREIGN KEY (certificate_id) REFERENCES mechanic_certificates(id)
);

-- -----------------------------------------------------------------------------
-- Location Log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location_log (
  id             TEXT PRIMARY KEY,
  tail_number    TEXT NOT NULL,
  move_type      TEXT NOT NULL,
  from_location  TEXT NOT NULL,
  to_location    TEXT NOT NULL,
  moved_by       TEXT,
  authorized_by  TEXT,
  moved_at       TEXT NOT NULL,
  notes          TEXT
);

CREATE INDEX IF NOT EXISTS idx_location_log_tail ON location_log(tail_number, moved_at DESC);

-- =============================================================================
-- OPERATIONAL & BUSINESS TABLES (new for MCP migration)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Flights
-- Unified flight table — replaces localStorage store + mock seed merge.
-- source: 'seed' (mock data), 'user' (scheduled by user), 'sim' (sim-generated)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flights (
  id                    TEXT PRIMARY KEY,
  source                TEXT NOT NULL DEFAULT 'user'
                        CHECK(source IN ('user','sim','seed','mcp')),
  callsign              TEXT,
  tail_number           TEXT,
  aircraft_type         TEXT,
  departure             TEXT,
  arrival               TEXT,
  airport               TEXT,
  waypoints             TEXT,             -- JSON array
  planned_departure_utc TEXT,
  planned_arrival_utc   TEXT,
  status                TEXT DEFAULT 'scheduled',
  pic                   TEXT,
  pic_id                TEXT,
  sic                   TEXT,
  sic_id                TEXT,
  passengers            TEXT,             -- JSON (count or array)
  mission_type          TEXT,
  part                  TEXT,
  part91_type           TEXT,
  risk_score            REAL,
  risk_p                REAL,
  risk_a                REAL,
  risk_v                REAL,
  risk_e                REAL,
  risk_snapshot         TEXT,             -- JSON blob
  tow_info              TEXT,             -- JSON blob
  terrain_profile       TEXT,             -- JSON blob
  metadata              TEXT,             -- JSON blob for extra fields

  -- IACRA / FAA Form 8710-1 logbook fields
  total_hours           REAL,             -- block-to-block time
  pic_hours             REAL,             -- pilot in command
  sic_hours             REAL,             -- second in command
  dual_hours            REAL,             -- dual instruction received
  dual_given_hours      REAL,             -- dual instruction given (CFI)
  solo_hours            REAL,
  night_hours           REAL,
  instrument_hours      REAL,
  instrument_actual     INTEGER,          -- 1 = actual IMC, 0 = simulated/hood
  cross_country         INTEGER,          -- 1 = XC (>50 NM)
  cross_country_hours   REAL,
  ground_hours          REAL,
  category_class        TEXT,             -- ASEL | AMEL | Glider | ASES | RH | etc.
  flight_purpose        TEXT,             -- training | currency | proficiency | checkride_prep | commercial
  stage_name            TEXT,             -- lesson/stage from training program
  maneuvers_covered     TEXT,             -- JSON array
  endorsement_type      TEXT,             -- first_solo | xc_solo | checkride | null
  state                 TEXT,             -- US state of departure (e.g. "CO")

  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_flights_source ON flights(source);
CREATE INDEX IF NOT EXISTS idx_flights_status ON flights(status);
CREATE INDEX IF NOT EXISTS idx_flights_departure ON flights(departure);
CREATE INDEX IF NOT EXISTS idx_flights_tail ON flights(tail_number);

-- -----------------------------------------------------------------------------
-- Client Aircraft
-- Non-fleet aircraft that use this airport (gliders, transients, tenants).
-- Replaces localStorage store/clients.js
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_aircraft (
  id           TEXT PRIMARY KEY,
  tail_number  TEXT NOT NULL UNIQUE,
  owner_name   TEXT,
  phone        TEXT,
  email        TEXT,
  make_model   TEXT,
  icao_type    TEXT,
  fbo_category TEXT,
  fuel_type    TEXT,
  based_here   INTEGER DEFAULT 0,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen    TEXT
);

CREATE INDEX IF NOT EXISTS idx_client_aircraft_tail ON client_aircraft(tail_number);

-- -----------------------------------------------------------------------------
-- Invoices
-- Glider operations billing — replaces localStorage store/invoices.js
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,
  tail_number TEXT,
  client_name TEXT,
  client_id   TEXT,
  status      TEXT DEFAULT 'open' CHECK(status IN ('open','paid')),
  line_items  TEXT,                -- JSON array
  total       REAL DEFAULT 0,
  paid_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
-- Service Requests
-- FBO service orders — replaces localStorage store/serviceRequests.js
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_requests (
  id          TEXT PRIMARY KEY,
  tail_number TEXT,
  type        TEXT,
  description TEXT,
  priority    TEXT,
  status      TEXT DEFAULT 'open',
  requested_by TEXT,
  metadata    TEXT,               -- JSON blob
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
-- Acknowledgments
-- Risk item sign-offs — replaces localStorage store/ackStore.js
-- Flattened from nested {flightId: {riskItemId: {role: ...}}} to relational
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acks (
  flight_id    TEXT NOT NULL,
  risk_item_id TEXT NOT NULL,
  role         TEXT NOT NULL CHECK(role IN ('crew','supervisor')),
  signed_by    TEXT NOT NULL,
  signer_name  TEXT NOT NULL,
  signed_at    TEXT NOT NULL,
  PRIMARY KEY (flight_id, risk_item_id, role)
);

CREATE INDEX IF NOT EXISTS idx_acks_flight ON acks(flight_id);

-- -----------------------------------------------------------------------------
-- Settings
-- Key-value settings store — replaces localStorage store/gliderSettings.js
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL              -- JSON-encoded value
);

-- -----------------------------------------------------------------------------
-- Pricing
-- Configurable pricing — extracted from component constants
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing (
  category TEXT NOT NULL,          -- 'glider' | 'skydiving'
  key      TEXT NOT NULL,
  value    REAL NOT NULL,
  label    TEXT,
  PRIMARY KEY (category, key)
);

-- =============================================================================
-- Additional Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_squawks_tail_status   ON squawks(tail_number, status);
CREATE INDEX IF NOT EXISTS idx_wo_tail_status        ON work_orders(tail_number, status);
CREATE INDEX IF NOT EXISTS idx_wo_priority           ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_insp_tail             ON inspection_schedule(tail_number);
CREATE INDEX IF NOT EXISTS idx_insp_status           ON inspection_schedule(status);
CREATE INDEX IF NOT EXISTS idx_tbo_tail              ON component_tbo(tail_number);
CREATE INDEX IF NOT EXISTS idx_ad_tail_status        ON ad_compliance(tail_number, status);
CREATE INDEX IF NOT EXISTS idx_records_tail_date     ON maintenance_records(tail_number);
CREATE INDEX IF NOT EXISTS idx_personnel_dept        ON personnel(department);
CREATE INDEX IF NOT EXISTS idx_wo_personnel_wo       ON work_order_personnel(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_personnel_pers     ON work_order_personnel(personnel_id);
