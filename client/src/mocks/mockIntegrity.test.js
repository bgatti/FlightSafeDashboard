import { describe, test, expect } from 'vitest'
import { mockAircraft } from './aircraft'
import { mockPersonnel } from './personnel'

// ─── Derived sets ─────────────────────────────────────────────────────────────

const towAircraft   = mockAircraft.filter((ac) => ac.is_tow)
const airworthyTow  = towAircraft.filter((ac) => ac.airworthy)
const towPilots     = mockPersonnel.filter((p) => p.towCertified)
const tdTowPilots   = towPilots.filter((p) => p.taildragherEndorsement)

// ─── Tow fleet coverage ───────────────────────────────────────────────────────

describe('tow fleet — mock data integrity', () => {
  test('at least one airworthy tow aircraft exists', () => {
    expect(airworthyTow.length).toBeGreaterThan(0)
  })

  test('at least one towCertified pilot exists', () => {
    expect(towPilots.length).toBeGreaterThan(0)
  })

  // Every airworthy tow plane needs at least one towCertified pilot assigned to it.
  // All tow planes are taildraggers, so the pilot also needs a tailwheel endorsement.
  describe('each airworthy tow aircraft has a qualified pilot', () => {
    airworthyTow.forEach((ac) => {
      const isTaildragger = ac.riskProfile?.taildragger === true

      if (isTaildragger) {
        test(`${ac.tailNumber} (${ac.makeModel}) — towCertified + taildragherEndorsement`, () => {
          expect(
            tdTowPilots.length,
            `No pilot holds both towCertified and taildragherEndorsement — ${ac.tailNumber} cannot be staffed`,
          ).toBeGreaterThan(0)
        })
      } else {
        test(`${ac.tailNumber} (${ac.makeModel}) — towCertified`, () => {
          expect(
            towPilots.length,
            `No towCertified pilot exists — ${ac.tailNumber} cannot be staffed`,
          ).toBeGreaterThan(0)
        })
      }
    })
  })

  test('towCertified pilots are pilots (role starting with pilot_)', () => {
    const nonPilots = towPilots.filter((p) => !p.role?.startsWith('pilot_'))
    expect(nonPilots, `Non-pilot roles marked towCertified: ${nonPilots.map((p) => p.name).join(', ')}`).toHaveLength(0)
  })

  test('taildragherEndorsement pilots are also towCertified', () => {
    const tdOnly = mockPersonnel.filter((p) => p.taildragherEndorsement && !p.towCertified)
    expect(
      tdOnly,
      `Pilots with taildragger endorsement but not towCertified — cannot fly tow planes: ${tdOnly.map((p) => p.name).join(', ')}`,
    ).toHaveLength(0)
  })
})
