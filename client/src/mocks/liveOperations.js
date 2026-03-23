export const mockFlightStrips = [
  {
    id: 'flt-001',
    callsign: 'N12345',
    route: 'KDFW→KLAX',
    riskScore: 71,
    status: 'En Route',
  },
  {
    id: 'flt-002',
    callsign: 'N67890',
    route: 'KBOS→KJFK',
    riskScore: 52,
    status: 'Dep in 1h',
  },
  {
    id: 'flt-003',
    callsign: 'N11111',
    route: 'KORD→KDEN',
    riskScore: 47,
    status: 'Dep in 3h',
  },
]

export const mockSigmets = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        hazard: 'Convective SIGMET',
        validFrom: '1800Z',
        validTo: '0000Z',
        severity: 'Severe turbulence, embedded TS',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-110, 30], [-100, 30], [-100, 40], [-110, 40], [-110, 30],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: {
        hazard: 'Turbulence SIGMET',
        validFrom: '1600Z',
        validTo: '2200Z',
        severity: 'Moderate-to-severe turbulence FL240-380',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-95, 35], [-85, 35], [-85, 45], [-95, 45], [-95, 35],
        ]],
      },
    },
  ],
}

export const mockAirmets = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        hazard: 'Sierra — IFR conditions',
        validFrom: '1500Z',
        validTo: '2100Z',
        severity: 'Ceilings below 1000ft, vis below 3sm',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-120, 32], [-115, 32], [-115, 36], [-120, 36], [-120, 32],
        ]],
      },
    },
  ],
}
