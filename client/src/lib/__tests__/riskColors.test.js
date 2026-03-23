import { getRiskLevel, computeCompositeRisk, PAVE_DIMENSIONS } from '../riskColors'

describe('getRiskLevel', () => {
  test.each([
    [-5,  'LOW'],
    [0,   'LOW'],
    [20,  'LOW'],
    [39,  'LOW'],
    [40,  'MED'],
    [55,  'MED'],
    [69,  'MED'],
    [70,  'HIGH'],
    [77,  'HIGH'],
    [84,  'HIGH'],
    [85,  'CRITICAL'],
    [92,  'CRITICAL'],
    [100, 'CRITICAL'],
    [110, 'CRITICAL'],
  ])('score %i → %s', (score, expected) => {
    expect(getRiskLevel(score).label).toBe(expected)
  })

  test('returns an object with hex, textClass, bgClass, borderClass', () => {
    const level = getRiskLevel(50)
    expect(level).toHaveProperty('hex')
    expect(level).toHaveProperty('textClass')
    expect(level).toHaveProperty('bgClass')
    expect(level).toHaveProperty('borderClass')
    expect(level).toHaveProperty('icon')
  })

  test('boundary: 39 is LOW, 40 is MED', () => {
    expect(getRiskLevel(39).label).toBe('LOW')
    expect(getRiskLevel(40).label).toBe('MED')
  })

  test('boundary: 69 is MED, 70 is HIGH', () => {
    expect(getRiskLevel(69).label).toBe('MED')
    expect(getRiskLevel(70).label).toBe('HIGH')
  })

  test('boundary: 84 is HIGH, 85 is CRITICAL', () => {
    expect(getRiskLevel(84).label).toBe('HIGH')
    expect(getRiskLevel(85).label).toBe('CRITICAL')
  })
})

describe('computeCompositeRisk', () => {
  test('all-zero input → 0', () => {
    expect(computeCompositeRisk({ P: 0, A: 0, V: 0, E: 0 })).toBe(0)
  })

  test('all-100 input → 100', () => {
    expect(computeCompositeRisk({ P: 100, A: 100, V: 100, E: 100 })).toBe(100)
  })

  test('weights: V (40%) dominates', () => {
    const highV = computeCompositeRisk({ P: 0, A: 0, V: 100, E: 0 })
    const highP = computeCompositeRisk({ P: 100, A: 0, V: 0, E: 0 })
    expect(highV).toBeGreaterThan(highP)
  })

  test('sample flight flt-001 scores compute correctly', () => {
    // P=65, A=20, V=85, E=55 → 65*0.25 + 20*0.20 + 85*0.40 + 55*0.15
    // = 16.25 + 4 + 34 + 8.25 = 62.5 → round → 63
    // (note: mock has 71, that's a hand-set value; this tests the formula)
    const score = computeCompositeRisk({ P: 65, A: 20, V: 85, E: 55 })
    expect(score).toBe(63)
  })
})

describe('PAVE_DIMENSIONS', () => {
  test('has exactly 4 dimensions', () => {
    expect(PAVE_DIMENSIONS).toHaveLength(4)
  })

  test('keys are P, A, V, E in order', () => {
    expect(PAVE_DIMENSIONS.map((d) => d.key)).toEqual(['P', 'A', 'V', 'E'])
  })

  test('weights sum to 1.0', () => {
    const sum = PAVE_DIMENSIONS.reduce((acc, d) => acc + d.weight, 0)
    expect(sum).toBeCloseTo(1.0)
  })

  test('V dimension has highest weight (0.40)', () => {
    const v = PAVE_DIMENSIONS.find((d) => d.key === 'V')
    expect(v.weight).toBe(0.40)
  })
})
