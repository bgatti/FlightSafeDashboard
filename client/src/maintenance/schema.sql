-- =============================================================================
-- FlightSafe Maintenance Database Schema
-- FAA 14 CFR Part 43 & 91 Compliant
-- =============================================================================
-- Regulatory references:
--   14 CFR 91.409(a)  — Annual inspection (12 calendar months)
--   14 CFR 91.409(b)  — 100-hour inspection (for hire / flight instruction)
--   14 CFR 91.409(e)  — Airworthiness Directives
--   14 CFR 91.411     — Altimeter / static system (24 calendar months, IFR)
--   14 CFR 91.413     — ATC transponder (24 calendar months)
--   14 CFR 91.207     — ELT inspection (12 months), battery replacement
--   14 CFR 91.171     — VOR check (30 days, IFR flight)
--   14 CFR 43.9       — Maintenance record requirements
--   14 CFR 43.11      — Return-to-service record requirements
--   14 CFR 43.13      — Performance standards
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Squawks
-- Pilot-reported discrepancies. Every squawk must be dispositioned before
-- return to service. Grounding squawks ground the aircraft immediately.
-- Reference: FAR 91.7 (airworthiness), 91.213 (inoperative instruments/equipment)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS squawks (
  id                TEXT PRIMARY KEY,
  tail_number       TEXT    NOT NULL,
  reported_by       TEXT    NOT NULL,         -- pilot name
  reported_date     TEXT    NOT NULL,         -- ISO date YYYY-MM-DD
  description       TEXT    NOT NULL,
  severity          TEXT    NOT NULL          -- grounding | ops_limiting | deferred | monitoring
                    CHECK(severity IN ('grounding','ops_limiting','deferred','monitoring')),
  status            TEXT    NOT NULL          -- open | in_progress | deferred_mel | closed
                    CHECK(status IN ('open','in_progress','deferred_mel','closed')),
  mel_reference     TEXT,                     -- MEL section/item number
  mel_expiry_date   TEXT,                     -- ISO date
  airframe_hours    REAL,                     -- Hobbs at time of report
  resolved_date     TEXT,
  resolved_by       TEXT,
  resolution_notes  TEXT,
  work_order_id     TEXT,
  FOREIGN KEY (tail_number)   REFERENCES aircraft(tail_number),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

-- -----------------------------------------------------------------------------
-- Work Orders
-- Maintenance tasks from squawk resolution, scheduled inspections, AD
-- compliance, and preventive/corrective work. Closed work orders produce a
-- maintenance_record entry (14 CFR 43.9 / 43.11).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_orders (
  id               TEXT PRIMARY KEY,
  tail_number      TEXT    NOT NULL,
  created_date     TEXT    NOT NULL,
  priority         TEXT    NOT NULL           -- aog | urgent | routine | scheduled
                   CHECK(priority IN ('aog','urgent','routine','scheduled')),
  type             TEXT    NOT NULL           -- inspection | repair | ad_compliance | overhaul | preventive | squawk
                   CHECK(type IN ('inspection','repair','ad_compliance','overhaul','preventive','squawk')),
  title            TEXT    NOT NULL,
  description      TEXT    NOT NULL,
  assigned_to      TEXT,
  status           TEXT    NOT NULL           -- open | in_progress | parts_on_order | completed | deferred | cancelled
                   CHECK(status IN ('open','in_progress','parts_on_order','completed','deferred','cancelled')),
  location         TEXT    NOT NULL DEFAULT 'ramp'   -- where the aircraft currently is
                   CHECK(location IN ('hangar','ramp','maintenance_bay','remote','shop')),
  hold_reason      TEXT,                      -- why the WO is blocked / pending
                   -- queued | awaiting_hangar | awaiting_tech | parts_hold |
                   -- priority_hold | awaiting_approval | weather | deferred_ops
  queue_position   INTEGER,                   -- position in maintenance queue (1 = next up)
  estimated_hours  REAL,
  actual_hours     REAL,
  parts_cost       REAL    DEFAULT 0,
  labor_cost       REAL    DEFAULT 0,
  completed_date   TEXT,
  deferred_to      TEXT,                      -- ISO date when deferred to
  notes            TEXT,
  FOREIGN KEY (tail_number) REFERENCES aircraft(tail_number)
);

-- -----------------------------------------------------------------------------
-- Parts
-- Individual part line items attached to a work order.
-- A work order may have zero or many parts.  Each part has its own lifecycle:
--   not_ordered → ordered → in_transit → arrived → installed
-- backordered and cancelled are terminal-branch statuses.
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
  po_number        TEXT,                      -- purchase order / quote number
  ordered_date     TEXT,                      -- ISO date
  eta_date         TEXT,                      -- ISO date — expected arrival
  arrived_date     TEXT,                      -- ISO date — actual arrival
  installed_date   TEXT,                      -- ISO date — installed on aircraft
  status           TEXT NOT NULL
                   CHECK(status IN (
                     'not_ordered','ordered','in_transit',
                     'arrived','backordered','installed','cancelled'
                   )),
  notes            TEXT,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (tail_number)   REFERENCES aircraft(tail_number)
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
-- One row per aircraft per inspection type. FAA-mandated intervals.
-- Due-soon threshold triggers amber warning; overdue triggers red.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_schedule (
  id                       TEXT PRIMARY KEY,
  tail_number              TEXT    NOT NULL,
  inspection_type          TEXT    NOT NULL   -- annual | 100hr | altimeter_static | transponder
                           -- | elt_battery | elt_inspection | vor_check | pitot_static
                           CHECK(inspection_type IN (
                             'annual','100hr','altimeter_static','transponder',
                             'elt_battery','elt_inspection','vor_check','pitot_static'
                           )),
  regulatory_ref           TEXT    NOT NULL,  -- e.g. "14 CFR 91.409(a)"
  interval_months          INTEGER,           -- calendar month interval
  interval_hours           REAL,              -- flight hour interval (100hr only)
  due_soon_threshold_days  INTEGER NOT NULL,  -- amber warning N days before due
  last_completed_date      TEXT,
  last_completed_hours     REAL,
  next_due_date            TEXT    NOT NULL,
  status                   TEXT    NOT NULL
                           CHECK(status IN ('current','due_soon','overdue')),
  notes                    TEXT,
  FOREIGN KEY (tail_number) REFERENCES aircraft(tail_number)
);

-- -----------------------------------------------------------------------------
-- Maintenance Records (Logbook Entries)
-- 14 CFR 43.9 requires: description of work, date, signature, certificate #.
-- 14 CFR 43.11 requires return-to-service statement for annual/100hr inspections.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_records (
  id                       TEXT PRIMARY KEY,
  tail_number              TEXT NOT NULL,
  record_date              TEXT NOT NULL,     -- ISO date
  type                     TEXT NOT NULL      -- annual | 100hr | repair | altimeter_static |
                           -- transponder | elt | ad_compliance | preventive | overhaul
                           CHECK(type IN (
                             'annual','100hr','repair','altimeter_static','transponder',
                             'elt','ad_compliance','preventive','overhaul','squawk_repair'
                           )),
  description              TEXT NOT NULL,
  findings                 TEXT,
  corrective_action        TEXT,
  airframe_hours_at_service REAL NOT NULL,
  mechanic_name            TEXT NOT NULL,
  mechanic_certificate     TEXT NOT NULL,     -- A&P | IA | A&P/IA | Repairman
  certificate_number       TEXT NOT NULL,
  return_to_service_date   TEXT NOT NULL,
  parts_replaced           TEXT,              -- JSON: [{partNumber, description, quantity, cost}]
  work_order_id            TEXT,
  regulatory_ref           TEXT,
  FOREIGN KEY (tail_number)   REFERENCES aircraft(tail_number),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

-- -----------------------------------------------------------------------------
-- Component TBO Tracking
-- Tracks time between overhaul (TBO) for engines, props, and major components.
-- Engine TBO per manufacturer service instruction; mandatory under Part 121/135;
-- advisory under Part 91 but best practice for SMS.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS component_tbo (
  id                    TEXT PRIMARY KEY,
  tail_number           TEXT    NOT NULL,
  component             TEXT    NOT NULL,     -- engine_1 | engine_2 | prop_1 | prop_2 |
                        -- magneto_l | magneto_r | vacuum_pump | starter | alternator | governor
  component_label       TEXT    NOT NULL,
  manufacturer          TEXT,
  model                 TEXT,
  serial_number         TEXT,
  install_date          TEXT    NOT NULL,
  hours_at_install      REAL    NOT NULL,     -- airframe hours when this component was installed
  tbo_hours             REAL    NOT NULL,     -- manufacturer TBO in hours
  tbo_calendar_months   INTEGER,             -- calendar TBO (some components have both)
  next_tbo_date         TEXT,               -- based on calendar TBO from install date
  due_soon_threshold_hours REAL DEFAULT 100, -- warn when N hours remain
  status                TEXT    NOT NULL
                        CHECK(status IN ('normal','monitoring','due_soon','overdue')),
  notes                 TEXT,
  FOREIGN KEY (tail_number) REFERENCES aircraft(tail_number)
);

-- Computed view: component life percentage (recalculate with current airframe hours at query time)
-- life_pct = (current_airframe_hours - hours_at_install) / tbo_hours * 100
-- hours_remaining = tbo_hours - (current_airframe_hours - hours_at_install)

-- -----------------------------------------------------------------------------
-- AD Compliance Tracking
-- 14 CFR 39.x (Airworthiness Directives), per 14 CFR 91.409(e).
-- All applicable ADs must be complied with before flight.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_compliance (
  id                         TEXT PRIMARY KEY,
  tail_number                TEXT NOT NULL,
  ad_number                  TEXT NOT NULL,   -- e.g. "AD 2024-11-03"
  ad_title                   TEXT NOT NULL,
  issuing_authority          TEXT DEFAULT 'FAA',
  effective_date             TEXT NOT NULL,
  applicability              TEXT NOT NULL,
  compliance_type            TEXT NOT NULL    -- one_time | recurring | terminating
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
  notes                      TEXT,
  FOREIGN KEY (tail_number)   REFERENCES aircraft(tail_number),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

-- -----------------------------------------------------------------------------
-- Personnel
-- Maintenance staff: A&P mechanics, IA inspectors, avionics technicians.
-- can_return_to_service = 1 only for IA certificate holders (sign-off authority).
-- capacity_hours_week = available hours/week (NULL for external contractors).
-- current_location: on_prem | off_site | on_leave | in_flight
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personnel (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  role                  TEXT NOT NULL
                        CHECK(role IN ('mechanic','avionics_tech','inspector','ground_crew','supervisor')),
  role_label            TEXT NOT NULL,
  department            TEXT NOT NULL DEFAULT 'Maintenance',
  certificate_number    TEXT,
  cert_type             TEXT,          -- A&P | A&P/IA | Avionics
  can_return_to_service INTEGER NOT NULL DEFAULT 0,  -- 1 if IA qualified
  supervisor_id         TEXT REFERENCES personnel(id),  -- default org supervisor for scheduling only;
                                                        -- task-level A&P supervisor is on work_order_personnel
  current_location      TEXT NOT NULL DEFAULT 'on_prem'
                        CHECK(current_location IN ('on_prem','off_site','on_leave','in_flight')),
  capacity_hours_week   REAL,          -- NULL for external contractors
  assigned_hours_week   REAL DEFAULT 0,
  specializations       TEXT,          -- JSON array e.g. ["piston","turbine","avionics"]
  years_experience      INTEGER,
  notes                 TEXT
);

-- -----------------------------------------------------------------------------
-- Mechanic Certificates
-- FAA traceability requires recording the specific certificate under which
-- maintenance was performed, not just the person.  A person may hold multiple
-- certificates, and any individual certificate may be acquired, suspended,
-- reinstated, or revoked at any time independently of other certificates.
--
-- Per 14 CFR 43.9(a)(3) the maintenance record must include the certificate
-- type and number of the person approving the work for return to service.
-- References: 14 CFR 65.71–65.95 (A&P), 14 CFR 65.91–65.95 (IA),
--             49 U.S.C. § 44702, 14 CFR Part 13 (certificate actions).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mechanic_certificates (
  id               TEXT PRIMARY KEY,
  personnel_id     TEXT NOT NULL,
  cert_type        TEXT NOT NULL         -- A_and_P | IA | Repairman | Avionics
                   CHECK(cert_type IN ('A_and_P','IA','Repairman','Avionics')),
  certificate_number TEXT NOT NULL,
  issued_date      TEXT,                  -- ISO date; NULL if unknown
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK(status IN ('active','suspended','revoked','expired','surrendered')),
  status_date      TEXT,                  -- ISO date when current status took effect
  status_notes     TEXT,                  -- reason for suspension/revocation etc.
  FOREIGN KEY (personnel_id) REFERENCES personnel(id)
);

CREATE INDEX IF NOT EXISTS idx_certs_person ON mechanic_certificates(personnel_id);
CREATE INDEX IF NOT EXISTS idx_certs_status ON mechanic_certificates(status);

-- Junction: multiple technicians can be assigned to one work order.
-- role='assigned'   — person performing the work
-- role='supervisor' — A&P certificated mechanic supervising this specific task
--   per 14 CFR 43.3(d): maintenance must be performed by or under the direct
--   supervision of a certificated A&P.  This is a task-level designation that
--   changes per work order — it is NOT an organizational reporting hierarchy.
--   For annual/100hr inspections the supervisor must hold an IA (14 CFR 65.95).
-- certificate_id    — FK to mechanic_certificates: records the specific,
--   currently-valid certificate under which this assignment was made.
--   Required by 14 CFR 43.9(a)(3) for return-to-service sign-offs.
CREATE TABLE IF NOT EXISTS work_order_personnel (
  work_order_id  TEXT NOT NULL,
  personnel_id   TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'assigned'
                 CHECK(role IN ('assigned','supervisor')),
  certificate_id TEXT,                   -- mechanic_certificates.id; required for supervisor role
  PRIMARY KEY (work_order_id, personnel_id, role),
  FOREIGN KEY (work_order_id)  REFERENCES work_orders(id),
  FOREIGN KEY (personnel_id)   REFERENCES personnel(id),
  FOREIGN KEY (certificate_id) REFERENCES mechanic_certificates(id)
);

-- -----------------------------------------------------------------------------
-- Location Log
-- Authoritative record of every aircraft move: ground tow, flight, reposition.
-- moved_by / authorized_by reference personnel.id (NULL = external/self-authorized).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location_log (
  id             TEXT PRIMARY KEY,
  tail_number    TEXT NOT NULL,
  move_type      TEXT NOT NULL
                 CHECK(move_type IN ('ground_tow','flight','repositioned','ferry')),
  from_location  TEXT NOT NULL,
  to_location    TEXT NOT NULL,
  moved_by       TEXT,            -- personnel.id of tow operator / PIC
  authorized_by  TEXT,            -- personnel.id of supervising mechanic who released
  moved_at       TEXT NOT NULL,   -- ISO datetime YYYY-MM-DDTHH:MM:SS
  notes          TEXT,
  FOREIGN KEY (tail_number) REFERENCES aircraft(tail_number)
);

CREATE INDEX IF NOT EXISTS idx_location_log_tail ON location_log(tail_number, moved_at DESC);
CREATE INDEX IF NOT EXISTS idx_personnel_dept    ON personnel(department);
CREATE INDEX IF NOT EXISTS idx_wo_personnel_wo   ON work_order_personnel(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_personnel_pers ON work_order_personnel(personnel_id);

-- -----------------------------------------------------------------------------
-- Useful indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_squawks_tail_status   ON squawks(tail_number, status);
CREATE INDEX IF NOT EXISTS idx_wo_tail_status        ON work_orders(tail_number, status);
CREATE INDEX IF NOT EXISTS idx_wo_priority           ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_insp_tail             ON inspection_schedule(tail_number);
CREATE INDEX IF NOT EXISTS idx_insp_status           ON inspection_schedule(status);
CREATE INDEX IF NOT EXISTS idx_tbo_tail              ON component_tbo(tail_number);
CREATE INDEX IF NOT EXISTS idx_ad_tail_status        ON ad_compliance(tail_number, status);
CREATE INDEX IF NOT EXISTS idx_records_tail_date     ON maintenance_records(tail_number, record_date DESC);
