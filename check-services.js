#!/usr/bin/env node
// check-services.js — verify all FlightSafe backend services are reachable
// Usage:  node check-services.js
//         npm run check-services   (after adding the script to package.json)
//
// Exit code 0 = all services up
// Exit code 1 = one or more services unreachable

const SERVICES = [
  {
    name:    'FlightSafeWeather',
    port:    3000,
    method:  'POST',
    path:    '/api/flight-weather',
    body:    JSON.stringify({ dept: 'KBDU', arr: 'KDEN' }),
    // A 400/422 (bad input) still means the server is up
    okCodes: [200, 400, 422],
    note:    'Node/Express — route corridor weather, METARs, TAFs, AIRMETs, winds aloft',
  },
  {
    name:    'AirSafe',
    port:    5000,
    method:  'POST',
    path:    '/query',
    body:    JSON.stringify({ narrative: 'health check', top_k: 1 }),
    okCodes: [200, 400, 422],
    note:    'Python/Flask — NTSB accident similarity search',
  },
  {
    name:    'KnownRisks',
    port:    5001,
    method:  'POST',
    path:    '/api/assess',
    body:    JSON.stringify({ factors: [] }),
    okCodes: [200, 400, 422],
    note:    'Node/Express — 21-factor exposure-adjusted risk engine',
  },
  {
    name:    'PilotRisk',
    port:    5002,
    method:  'POST',
    path:    '/api/assess-crew',
    body:    JSON.stringify({ aircraft: [], conditions: {} }),
    okCodes: [200, 400, 422],
    note:    'Node/Express — pilot currency, medical, and recency scoring',
  },
]

const TIMEOUT_MS = 4000

function check(svc) {
  return new Promise((resolve) => {
    const url     = `http://127.0.0.1:${svc.port}${svc.path}`
    const timeout = setTimeout(() => {
      resolve({ svc, ok: false, reason: `Timed out after ${TIMEOUT_MS}ms` })
    }, TIMEOUT_MS)

    fetch(url, {
      method:  svc.method,
      headers: { 'Content-Type': 'application/json' },
      body:    svc.body,
    })
      .then((res) => {
        clearTimeout(timeout)
        const ok = svc.okCodes.includes(res.status)
        resolve({ svc, ok, reason: ok ? null : `Unexpected HTTP ${res.status}` })
      })
      .catch((err) => {
        clearTimeout(timeout)
        const reason = err.cause?.code === 'ECONNREFUSED'
          ? 'Connection refused — service not running'
          : err.message
        resolve({ svc, ok: false, reason })
      })
  })
}

const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'

async function main() {
  console.log(`\n${BOLD}FlightSafe — Service Health Check${RESET}`)
  console.log(`${'─'.repeat(52)}`)

  const results = await Promise.all(SERVICES.map(check))

  let allOk = true
  for (const { svc, ok, reason } of results) {
    const icon   = ok ? `${GREEN}●${RESET}` : `${RED}✗${RESET}`
    const status = ok ? `${GREEN}UP${RESET}` : `${RED}DOWN${RESET}`
    console.log(`${icon}  ${BOLD}${svc.name.padEnd(22)}${RESET} :${svc.port}  ${status}`)
    console.log(`   ${DIM}${svc.note}${RESET}`)
    if (!ok) {
      console.log(`   ${YELLOW}↳ ${reason}${RESET}`)
      allOk = false
    }
  }

  console.log(`${'─'.repeat(52)}`)
  if (allOk) {
    console.log(`${GREEN}${BOLD}All services reachable.${RESET}\n`)
    process.exit(0)
  } else {
    const down = results.filter((r) => !r.ok).map((r) => r.svc.name)
    console.log(`${RED}${BOLD}${down.length} service(s) unreachable: ${down.join(', ')}${RESET}`)
    console.log(`${DIM}Start the missing service(s) and re-run:  node check-services.js${RESET}\n`)
    process.exit(1)
  }
}

main()
