// =============================================================================
// Aircraft Movement Log — every time an aircraft changes physical location
// Records ground tows, completed flights (return to ramp), and repositioning.
//
// moveType: ground_tow | flight | repositioned | ferry
// Locations: hangar | ramp | maintenance_bay | remote | shop
//
// movedBy:      personnel ID (or null for external/unknown)
// authorizedBy: supervising personnel ID who authorized the move
// =============================================================================

export const mockMovementLog = [
  // ── N33333 — towed to maintenance bay when oil squawk confirmed AOG ──
  {
    id: 'mvt-001',
    tailNumber: 'N33333',
    moveType: 'ground_tow',
    fromLocation: 'ramp',
    toLocation: 'maintenance_bay',
    movedBy: 'prs-010',       // Sam Nguyen — ground handler
    authorizedBy: 'prs-011',  // Sarah Cole — supervising IA
    movedAt: '2026-03-20T08:30:00',
    notes: 'Aircraft grounded following oil pressure squawk during run-up. Towed to bay #1 for engine investigation.',
  },

  // ── N33333 — final attempted departure the morning of grounding ──
  {
    id: 'mvt-002',
    tailNumber: 'N33333',
    moveType: 'ground_tow',
    fromLocation: 'hangar',
    toLocation: 'ramp',
    movedBy: 'prs-010',
    authorizedBy: null,
    movedAt: '2026-03-20T06:00:00',
    notes: 'Pulled from overnight hangar for 0700 departure. Aircraft did not fly — oil squawk found during run-up.',
  },

  // ── N22222 — moved to hangar for autopilot troubleshooting ──
  {
    id: 'mvt-003',
    tailNumber: 'N22222',
    moveType: 'ground_tow',
    fromLocation: 'ramp',
    toLocation: 'hangar',
    movedBy: 'prs-010',
    authorizedBy: 'prs-012',  // Mike Ferris authorized
    movedAt: '2026-03-19T10:00:00',
    notes: 'Moved to hangar 2 for GFC 700 autopilot troubleshooting. Garmin avionics tech scheduled 2026-04-02.',
  },

  // ── N55555 — returned from KDFW-KAUS charter today ──
  {
    id: 'mvt-004',
    tailNumber: 'N55555',
    moveType: 'flight',
    fromLocation: 'ramp',
    toLocation: 'ramp',
    movedBy: 'prs-003',   // Marcus Davis — PIC
    authorizedBy: null,
    movedAt: '2026-03-28T14:20:00',
    notes: 'KDFW→KAUS→KDFW charter. 3.4 flight hours. Aircraft parked at ramp spot 7.',
  },

  // ── N12345 — returned from KDEN-KDFW charter yesterday ──
  {
    id: 'mvt-005',
    tailNumber: 'N12345',
    moveType: 'flight',
    fromLocation: 'ramp',
    toLocation: 'ramp',
    movedBy: 'prs-001',   // James Smith — Chief Pilot
    authorizedBy: null,
    movedAt: '2026-03-27T16:45:00',
    notes: 'KDEN→KDFW charter return. 2.1 flight hours.',
  },

  // ── N67890 — training flight, returned with MEL active ──
  {
    id: 'mvt-006',
    tailNumber: 'N67890',
    moveType: 'flight',
    fromLocation: 'ramp',
    toLocation: 'ramp',
    movedBy: 'prs-002',   // Rachel Jones — SIC on training flight
    authorizedBy: null,
    movedAt: '2026-03-26T11:30:00',
    notes: 'Training flight KBOS-KLWM-KBOS. 1.8 hrs. Operating under MEL 34-11-1 (pitot heat). Part on order ETA 2026-03-31.',
  },

  // ── N11111 — returned from training, now awaiting inspection ──
  {
    id: 'mvt-007',
    tailNumber: 'N11111',
    moveType: 'flight',
    fromLocation: 'ramp',
    toLocation: 'ramp',
    movedBy: 'prs-004',   // Anika Patel
    authorizedBy: null,
    movedAt: '2026-03-25T13:45:00',
    notes: 'Training flight KORD local area. 1.2 hrs. Aircraft will remain on ramp — 100hr due in 5 days.',
  },

  // ── N44444 — pulled from overnight hangar for morning ops ──
  {
    id: 'mvt-008',
    tailNumber: 'N44444',
    moveType: 'ground_tow',
    fromLocation: 'hangar',
    toLocation: 'ramp',
    movedBy: 'prs-010',
    authorizedBy: null,
    movedAt: '2026-03-24T07:15:00',
    notes: 'Pulled from hangar for morning departure. Aircraft returned same day.',
  },

  // ── Historical — N55555 towed for annual inspection (Feb 2026) ──
  {
    id: 'mvt-009',
    tailNumber: 'N55555',
    moveType: 'ground_tow',
    fromLocation: 'ramp',
    toLocation: 'hangar',
    movedBy: 'prs-010',
    authorizedBy: 'prs-011',
    movedAt: '2026-02-15T08:00:00',
    notes: 'Towed to hangar 1 for annual/100hr combined inspection (wo-010).',
  },

  // ── Historical — N55555 returned from annual ──
  {
    id: 'mvt-010',
    tailNumber: 'N55555',
    moveType: 'repositioned',
    fromLocation: 'hangar',
    toLocation: 'ramp',
    movedBy: 'prs-010',
    authorizedBy: 'prs-011',
    movedAt: '2026-02-19T16:00:00',
    notes: 'Annual/100hr complete. Return-to-service signed by S. Cole (A&P/IA AME-991055). Aircraft returned to ramp.',
  },

  // ── Historical — N44444 completed gear door repair ──
  {
    id: 'mvt-011',
    tailNumber: 'N44444',
    moveType: 'repositioned',
    fromLocation: 'maintenance_bay',
    toLocation: 'hangar',
    movedBy: 'prs-010',
    authorizedBy: 'prs-011',
    movedAt: '2026-01-18T15:30:00',
    notes: 'Gear door squawk repair complete (wo-008). Functional check passed. Moved to hangar overnight.',
  },

  // ── Historical — N44444 moved to maintenance bay for gear door work ──
  {
    id: 'mvt-012',
    tailNumber: 'N44444',
    moveType: 'ground_tow',
    fromLocation: 'ramp',
    toLocation: 'maintenance_bay',
    movedBy: 'prs-010',
    authorizedBy: 'prs-012',  // Mike Ferris
    movedAt: '2026-01-12T09:00:00',
    notes: 'Towed to bay #2 for right main gear door inspection (wo-008).',
  },
]

// Latest location per tail (derived; mirrors aircraft.currentLocation)
export function latestLocationForTail(tailNumber) {
  const sorted = mockMovementLog
    .filter((m) => m.tailNumber === tailNumber)
    .sort((a, b) => b.movedAt.localeCompare(a.movedAt))
  return sorted[0] ?? null
}

// All movements for a specific tail, newest first
export function movementsForTail(tailNumber) {
  return mockMovementLog
    .filter((m) => m.tailNumber === tailNumber)
    .sort((a, b) => b.movedAt.localeCompare(a.movedAt))
}
