-- =============================================================================
-- FlightSafe FBO Operations Database Schema
-- Fixed Base Operator: fueling, ground handling, arrivals, fees, ramp management
-- =============================================================================
-- Fuel type reference:
--   Avgas 100LL (blue dye) — piston aircraft; smaller filler nozzle
--   Jet-A (straw/clear)   — turbine/turboprop; large nozzle physically CANNOT
--                            enter an Avgas filler port
--   Critical risk: Avgas nozzle IS smaller and CAN enter a Jet-A filler port.
--   Turboprops with propellers (Caravan, King Air, TBM, PC-12) are routinely
--   confused for piston aircraft by inexperienced staff — always verify fuel
--   type from placard/POH before opening any filler cap.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- Aircraft categories for fee computation.
-- Mirrors aircraft.fboCategory in the client mock / aircraft table.
-- piston_single | piston_twin | turboprop_single | turboprop_twin |
-- jet_light | jet_midsize | jet_heavy

-- Service types (FBO operations):
-- fueling | tow | repositioning | tie_down | cleaning | hangaring |
-- preheat | gpu | oxygen_service | lavatory_service | catering |
-- ramp_fee | hangar_fee

-- =============================================================================
-- FBO Service Orders
-- One order per ground service event.  Risk score and DEFCON level are
-- computed at query time (composite of base_task_risk + fuel_confusion_risk
-- + experience_delta + weather_delta; see fboUtils.js for algorithm).
-- cross_module_ref: optional FK to maintenance work_orders.id — used when
-- a preheat or tow request originates from or notifies Maintenance.
-- =============================================================================
CREATE TABLE IF NOT EXISTS fbo_service_orders (
  id                  TEXT PRIMARY KEY,
  tail_number         TEXT    NOT NULL,
  service_type        TEXT    NOT NULL
                      CHECK(service_type IN (
                        'fueling','tow','repositioning','tie_down','cleaning',
                        'hangaring','preheat','gpu','oxygen_service',
                        'lavatory_service','catering','ramp_fee','hangar_fee'
                      )),
  fuel_type           TEXT    CHECK(fuel_type IN ('avgas_100ll','jet_a','mogas')),
  fuel_quantity_gal   REAL,
  cleaning_type       TEXT    CHECK(cleaning_type IN ('interior_detail','full_detail','exterior_wash')),
  assigned_to         TEXT,            -- personnel.id (FBO line staff)
  weather_condition   TEXT    NOT NULL DEFAULT 'clear'
                      CHECK(weather_condition IN (
                        'clear','overcast','fog','light_rain','heavy_rain',
                        'high_wind','thunderstorm','ice','snow'
                      )),
  status              TEXT    NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','in_progress','completed','cancelled','on_hold')),
  priority            TEXT    NOT NULL DEFAULT 'normal'
                      CHECK(priority IN ('urgent','normal','low')),
  requested_at        TEXT    NOT NULL,   -- ISO datetime
  completed_at        TEXT,
  fee                 REAL,              -- NULL until completed; then total charge
  cross_module        TEXT    CHECK(cross_module IN ('maintenance','fbo',NULL)),
  cross_module_ref    TEXT,              -- work_orders.id when cross_module = 'maintenance'
  notes               TEXT,
  FOREIGN KEY (tail_number) REFERENCES aircraft(tail_number)
);

CREATE INDEX IF NOT EXISTS idx_fbo_so_tail       ON fbo_service_orders(tail_number);
CREATE INDEX IF NOT EXISTS idx_fbo_so_status     ON fbo_service_orders(status);
CREATE INDEX IF NOT EXISTS idx_fbo_so_type       ON fbo_service_orders(service_type);
CREATE INDEX IF NOT EXISTS idx_fbo_so_requested  ON fbo_service_orders(requested_at DESC);

-- =============================================================================
-- Arrivals
-- Scheduled or inbound aircraft requiring FBO handling.
-- isOwnFleet distinguishes fleet aircraft from transient / visiting aircraft.
-- fuel_request_gal may be NULL if the pilot will determine at arrival.
-- =============================================================================
CREATE TABLE IF NOT EXISTS arrivals (
  id                    TEXT PRIMARY KEY,
  tail_number           TEXT    NOT NULL,
  make_model            TEXT    NOT NULL,
  icao_type             TEXT    NOT NULL,
  fuel_type             TEXT    NOT NULL
                        CHECK(fuel_type IN ('avgas_100ll','jet_a','mogas')),
  is_own_fleet          INTEGER NOT NULL DEFAULT 0,   -- 1 = own fleet aircraft
  fbo_category          TEXT    NOT NULL,
  is_turboprop_with_prop INTEGER NOT NULL DEFAULT 0,  -- 1 = HIGHEST fuel confusion risk
  eta                   TEXT    NOT NULL,             -- ISO datetime
  from_icao             TEXT,
  pilot_name            TEXT,
  passenger_count       INTEGER DEFAULT 0,
  crew_count            INTEGER DEFAULT 1,
  services_requested    TEXT    NOT NULL,             -- JSON array of service_type strings
  fuel_request_gal      REAL,
  handling_instructions TEXT,
  status                TEXT    NOT NULL DEFAULT 'confirmed'
                        CHECK(status IN ('confirmed','inbound','arrived','departed','cancelled','no_show')),
  assigned_to           TEXT,                        -- personnel.id (FBO coordinator)
  notes                 TEXT,
  FOREIGN KEY (assigned_to) REFERENCES personnel(id)
);

CREATE INDEX IF NOT EXISTS idx_arrivals_eta    ON arrivals(eta);
CREATE INDEX IF NOT EXISTS idx_arrivals_status ON arrivals(status);

-- =============================================================================
-- Fee Schedule
-- Rates by aircraft category and service type.
-- unit: 'day' | 'night' | 'hour' | 'gallon' | 'each' | 'event' | 'fill'
-- category: 'all' = applies to any aircraft category
-- =============================================================================
CREATE TABLE IF NOT EXISTS fee_schedule (
  id           TEXT PRIMARY KEY,
  category     TEXT    NOT NULL,   -- aircraft fbo_category or 'all'
  service_type TEXT    NOT NULL,
  label        TEXT    NOT NULL,
  fee_per_unit REAL    NOT NULL,
  unit         TEXT    NOT NULL
               CHECK(unit IN ('day','night','hour','gallon','each','event','fill')),
  notes        TEXT
);

-- =============================================================================
-- FBO–Maintenance Cross-Module Links
-- Bridges FBO service orders and maintenance work orders.
-- Use cases:
--   1. Maintenance requests a tow/reposition → FBO creates service order
--   2. FBO performs engine preheat → Maintenance needs to inspect result
--   3. Aircraft heating: FBO places ground heater (preheat service order);
--      Maintenance evaluates engine oil and signs off if airworthiness concern.
-- requested_by: 'maintenance' | 'fbo'
-- authorized_by: personnel.id (A&P or IA who authorized the tow/preheat)
-- =============================================================================
CREATE TABLE IF NOT EXISTS fbo_maintenance_links (
  id                  TEXT PRIMARY KEY,
  request_type        TEXT    NOT NULL
                      CHECK(request_type IN ('tow_request','preheat','repositioning','other')),
  description         TEXT    NOT NULL,
  requested_by        TEXT    NOT NULL CHECK(requested_by IN ('maintenance','fbo')),
  fbo_service_id      TEXT    NOT NULL REFERENCES fbo_service_orders(id),
  maintenance_wo_id   TEXT,               -- work_orders.id; NULL if no WO yet
  authorized_by       TEXT,               -- personnel.id (mechanic who authorized)
  status              TEXT    NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','in_progress','completed','cancelled')),
  notes               TEXT,
  FOREIGN KEY (authorized_by) REFERENCES personnel(id)
);

-- =============================================================================
-- Weather Log
-- Authoritative record of FBO-relevant weather condition changes.
-- Current conditions affect risk scoring for all active and pending service orders.
-- set_by: personnel.id of the ops coordinator or supervisor who changed condition.
-- =============================================================================
CREATE TABLE IF NOT EXISTS fbo_weather_log (
  id               TEXT PRIMARY KEY,
  condition        TEXT    NOT NULL
                   CHECK(condition IN (
                     'clear','overcast','fog','light_rain','heavy_rain',
                     'high_wind','thunderstorm','ice','snow'
                   )),
  ops_status       TEXT    NOT NULL DEFAULT 'normal'
                   CHECK(ops_status IN ('normal','caution','ops_hold','stop')),
  recorded_at      TEXT    NOT NULL,     -- ISO datetime
  set_by           TEXT,                 -- personnel.id
  notes            TEXT,
  FOREIGN KEY (set_by) REFERENCES personnel(id)
);

-- =============================================================================
-- Useful indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_fbo_mx_service ON fbo_maintenance_links(fbo_service_id);
CREATE INDEX IF NOT EXISTS idx_fbo_mx_wo      ON fbo_maintenance_links(maintenance_wo_id);
CREATE INDEX IF NOT EXISTS idx_weather_time   ON fbo_weather_log(recorded_at DESC);
