// The ledger, on real SQLite with a clock the test controls. No Gemini and no Worker here.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Ledger, WINDOW_MS } from '../src/limits.ts'
import { sqliteStorage } from './support/sqlite-do.mjs'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const NOON = Date.UTC(2026, 10, 3, 12, 0, 0)
const LIMITS = { perClient: 3, perIp: 10, globalCalls: 600, callsPerGeneration: 6, holdMs: 35_000 }
const WHO = { clientId: 'browser-a', ipKey: 'ip-a' }

function setup(start = NOON) {
  const time = { now: start }
  const storage = sqliteStorage()
  const ledger = new Ledger(storage, () => time.now)
  const globalCalls = (day = '2026-11-03') =>
    storage.sql.exec('SELECT calls FROM global_calls WHERE day = ?', day).toArray()[0]?.calls ?? 0
  const rowCount = () => storage.sql.exec('SELECT COUNT(*) AS n FROM charges').toArray()[0].n
  /** One whole generation that came out valid, with `calls` calls to Gemini. */
  const spend = (who = WHO, limits = LIMITS, calls = 1) => {
    const hold = ledger.reserve(who, limits)
    assert.equal(hold.ok, true, 'la reserva tendría que pasar')
    return ledger.settle(hold.holdId, who, { valid: true, calls }, limits)
  }
  return { time, ledger, globalCalls, rowCount, spend }
}

const iso = (ms) => new Date(ms).toISOString()

// ─── Browser: rolling 24 h ──────────────────────────────────────────────────

test('3 valid generations go through and the 4th is refused, with the time the first comes back', () => {
  const { time, ledger, spend } = setup()
  assert.equal(spend().quota.remaining, 2)
  time.now += HOUR
  assert.equal(spend().quota.remaining, 1)
  time.now += HOUR
  assert.equal(spend().quota.remaining, 0)

  time.now += MINUTE
  const fourth = ledger.reserve(WHO, LIMITS)
  assert.equal(fourth.ok, false)
  assert.equal(fourth.code, 'quota_exceeded')
  assert.deepEqual(fourth.quota, { remaining: 0, resetAt: iso(NOON + DAY) })
})

test('the window is 24 h: at 23:59 it is still blocked, at 24:01 it passes again', () => {
  const { time, ledger, spend } = setup()
  spend()
  spend()
  spend()

  time.now = NOON + DAY - MINUTE
  assert.equal(ledger.reserve(WHO, LIMITS).ok, false)
  assert.equal(ledger.peek(WHO, LIMITS).remaining, 0)

  time.now = NOON + DAY + MINUTE
  assert.equal(ledger.peek(WHO, LIMITS).remaining, 3)
  assert.equal(ledger.reserve(WHO, LIMITS).ok, true)
})

test('the window starts when the generation is charged, not when it was reserved', () => {
  const { time, ledger } = setup()
  const hold = ledger.reserve(WHO, LIMITS)
  time.now += 30_000
  const settled = ledger.settle(hold.holdId, WHO, { valid: true, calls: 1 }, LIMITS)
  assert.equal(settled.quota.resetAt, iso(NOON + 30_000 + WINDOW_MS))
})

test('the window is rolling: attempts come back one by one, and crossing midnight returns nothing', () => {
  const { time, ledger, spend } = setup(Date.UTC(2026, 10, 3, 23, 50))
  spend()
  time.now = Date.UTC(2026, 10, 3, 23, 55)
  spend()
  time.now = Date.UTC(2026, 10, 3, 23, 59)
  spend()

  time.now = Date.UTC(2026, 10, 4, 0, 1)
  assert.equal(ledger.peek(WHO, LIMITS).remaining, 0, 'pasar la medianoche no devuelve nada')

  time.now = Date.UTC(2026, 10, 4, 23, 51)
  assert.deepEqual(ledger.peek(WHO, LIMITS), { remaining: 1, resetAt: iso(Date.UTC(2026, 10, 4, 23, 55)) })
  time.now = Date.UTC(2026, 10, 4, 23, 56)
  assert.deepEqual(ledger.peek(WHO, LIMITS), { remaining: 2, resetAt: iso(Date.UTC(2026, 10, 4, 23, 59)) })
  time.now = Date.UTC(2026, 10, 5, 0, 0)
  assert.deepEqual(ledger.peek(WHO, LIMITS), { remaining: 3, resetAt: null })
})

test('a full quota has no resetAt; one spent has the time it comes back', () => {
  const { ledger, spend } = setup()
  assert.deepEqual(ledger.peek(WHO, LIMITS), { remaining: 3, resetAt: null })
  assert.deepEqual(spend().quota, { remaining: 2, resetAt: iso(NOON + DAY) })
})

test('one browser spending does not touch another on a different IP', () => {
  const { ledger, spend } = setup()
  spend()
  spend()
  spend()
  assert.deepEqual(ledger.peek({ clientId: 'browser-b', ipKey: 'ip-b' }, LIMITS), { remaining: 3, resetAt: null })
})

// ─── D7: only a valid brandbook charges ─────────────────────────────────────

test('a failed generation charges nothing, however many times it happens', () => {
  const { ledger, rowCount } = setup()
  for (let i = 0; i < 10; i++) {
    const hold = ledger.reserve(WHO, LIMITS)
    assert.equal(hold.ok, true, `intento ${i}`)
    const settled = ledger.settle(hold.holdId, WHO, { valid: false, calls: 2 }, LIMITS)
    assert.equal(settled.outcome, 'released')
    assert.deepEqual(settled.quota, { remaining: 3, resetAt: null })
  }
  assert.equal(rowCount(), 0)
})

test('a valid generation is charged once, even if it is settled twice', () => {
  const { ledger, globalCalls } = setup()
  const hold = ledger.reserve(WHO, LIMITS)
  assert.equal(ledger.settle(hold.holdId, WHO, { valid: true, calls: 2 }, LIMITS).outcome, 'charged')
  assert.equal(globalCalls(), 2)
  const again = ledger.settle(hold.holdId, WHO, { valid: true, calls: 1 }, LIMITS)
  assert.equal(again.outcome, 'none')
  assert.equal(again.quota.remaining, 2)
  assert.equal(globalCalls(), 2, 'repetir no devuelve llamadas')
})

test('releasing twice does not give calls back twice, and a hold that never existed changes nothing', () => {
  const { ledger, globalCalls } = setup()
  const hold = ledger.reserve(WHO, LIMITS)
  ledger.settle(hold.holdId, WHO, { valid: false, calls: 2 }, LIMITS)
  assert.equal(ledger.settle(hold.holdId, WHO, { valid: false, calls: 0 }, LIMITS).outcome, 'none')
  assert.equal(ledger.settle('no-existe', WHO, { valid: true, calls: 0 }, LIMITS).outcome, 'none')
  assert.equal(globalCalls(), 2)
})

// ─── Reservations ───────────────────────────────────────────────────────────

test('a hold takes the last attempt while it lasts: a second request with 1 left is refused', () => {
  const { ledger, spend } = setup()
  spend()
  spend()
  const first = ledger.reserve(WHO, LIMITS)
  assert.equal(first.ok, true)
  assert.equal(first.quota.remaining, 0)

  const second = ledger.reserve(WHO, LIMITS)
  assert.equal(second.ok, false)
  assert.equal(second.code, 'quota_exceeded')

  // If the first one fails, the attempt is free again.
  ledger.settle(first.holdId, WHO, { valid: false, calls: 1 }, LIMITS)
  assert.equal(ledger.reserve(WHO, LIMITS).ok, true)
})

test('a hold nobody settled expires: it charges nothing, and its calls stay counted', () => {
  const { time, ledger, globalCalls } = setup()
  const hold = ledger.reserve(WHO, LIMITS)
  assert.equal(ledger.peek(WHO, LIMITS).remaining, 2)
  assert.equal(globalCalls(), 6)

  time.now += LIMITS.holdMs - 1
  assert.equal(ledger.peek(WHO, LIMITS).remaining, 2, 'todavía vigente')
  time.now += 1
  assert.deepEqual(ledger.peek(WHO, LIMITS), { remaining: 3, resetAt: null })
  assert.equal(globalCalls(), 6, 'lo que gastó es desconocido: el peor caso queda contado')

  // A settle that arrives late neither charges nor gives calls back.
  assert.equal(ledger.settle(hold.holdId, WHO, { valid: true, calls: 1 }, LIMITS).outcome, 'none')
  assert.equal(ledger.peek(WHO, LIMITS).remaining, 3)
  assert.equal(globalCalls(), 6)
})

test('peek writes nothing, however many times it is called', () => {
  const { ledger, rowCount, globalCalls } = setup()
  for (let i = 0; i < 5; i++) assert.deepEqual(ledger.peek(WHO, LIMITS), { remaining: 3, resetAt: null })
  assert.equal(rowCount(), 0)
  assert.equal(globalCalls(), 0)
})

test('expired rows are purged when a new reservation comes in', () => {
  const { time, ledger, rowCount, spend } = setup()
  spend()
  spend()
  assert.equal(rowCount(), 2)
  time.now = NOON + DAY + MINUTE
  ledger.reserve({ clientId: 'otro', ipKey: 'otra' }, LIMITS)
  assert.equal(rowCount(), 1)
})

// ─── IP ─────────────────────────────────────────────────────────────────────

test('the IP cap is shared by every browser behind it, and does not reach other IPs', () => {
  const { ledger, spend } = setup()
  const limits = { ...LIMITS, perIp: 4 }
  const browser = (n) => ({ clientId: `browser-${n}`, ipKey: 'facultad' })
  spend(browser(1), limits)
  spend(browser(2), limits)
  spend(browser(3), limits)
  assert.equal(ledger.peek(browser(4), limits).remaining, 1, 'el navegador nuevo ve lo que le queda a la IP')
  spend(browser(4), limits)

  const blocked = ledger.reserve(browser(5), limits)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.code, 'quota_exceeded')
  assert.equal(blocked.quota.resetAt, iso(NOON + DAY))

  assert.equal(ledger.reserve({ clientId: 'browser-5', ipKey: 'otra-red' }, limits).ok, true)
})

test('the IP window is rolling too', () => {
  const { time, ledger, spend } = setup()
  const limits = { ...LIMITS, perIp: 1 }
  spend({ clientId: 'a', ipKey: 'red' }, limits)
  time.now = NOON + DAY - MINUTE
  assert.equal(ledger.reserve({ clientId: 'b', ipKey: 'red' }, limits).ok, false)
  time.now = NOON + DAY + MINUTE
  assert.equal(ledger.reserve({ clientId: 'b', ipKey: 'red' }, limits).ok, true)
})

test('resetAt follows whichever limit is holding `remaining` down', () => {
  const { time, ledger, spend } = setup()
  const limits = { ...LIMITS, perIp: 2 }
  spend({ clientId: 'otro', ipKey: 'red' }, limits)
  time.now += HOUR
  spend({ clientId: 'yo', ipKey: 'red' }, limits)

  // The browser still has 2, the IP has none: what matters is when the IP gets one back (the other's).
  time.now += HOUR
  assert.deepEqual(ledger.peek({ clientId: 'yo', ipKey: 'red' }, limits), { remaining: 0, resetAt: iso(NOON + DAY) })
})

test('a browser with its quota full on a busy IP reports a full quota', () => {
  const { ledger, spend } = setup()
  spend({ clientId: 'otro', ipKey: 'red' })
  assert.deepEqual(ledger.peek({ clientId: 'yo', ipKey: 'red' }, LIMITS), { remaining: 3, resetAt: null })
})

test('lowering a limit below what is already used does not break the count', () => {
  const { time, ledger, spend } = setup()
  spend()
  time.now += HOUR
  spend()
  time.now += HOUR
  spend()
  const lowered = { ...LIMITS, perClient: 1 }
  assert.deepEqual(ledger.peek(WHO, lowered), { remaining: 0, resetAt: iso(NOON + 2 * HOUR + DAY) })
})

// ─── Global: calls to Gemini per UTC day ────────────────────────────────────

test('a reservation sets aside the worst case and settling gives back the calls not made', () => {
  const { ledger, globalCalls } = setup()
  const hold = ledger.reserve(WHO, LIMITS)
  assert.equal(globalCalls(), 6)
  const settled = ledger.settle(hold.holdId, WHO, { valid: true, calls: 2 }, LIMITS)
  assert.equal(globalCalls(), 2)
  assert.equal(settled.globalCallsToday, 2)
})

test('every call counts, whatever came of it: a failed generation also spends the global cap', () => {
  const { ledger, globalCalls } = setup()
  const hold = ledger.reserve(WHO, LIMITS)
  ledger.settle(hold.holdId, WHO, { valid: false, calls: 6 }, LIMITS)
  assert.equal(globalCalls(), 6)
})

test('the global cap refuses when the worst case does not fit, for any browser, and never goes over', () => {
  const { ledger, globalCalls } = setup()
  const limits = { ...LIMITS, globalCalls: 8 }
  const first = ledger.reserve(WHO, limits)
  ledger.settle(first.holdId, WHO, { valid: true, calls: 3 }, limits)
  assert.equal(globalCalls(), 3, 'quedan 5 libres: menos que el peor caso')

  const other = { clientId: 'otro', ipKey: 'otra' }
  const refused = ledger.reserve(other, limits)
  assert.equal(refused.ok, false)
  assert.equal(refused.code, 'global_limit')
  assert.deepEqual(refused.quota, { remaining: 0, resetAt: '2026-11-04T00:00:00.000Z' })
  assert.deepEqual(ledger.peek(other, limits), { remaining: 0, resetAt: '2026-11-04T00:00:00.000Z' })
  assert.equal(globalCalls(), 3, 'un rechazo no aparta nada')
})

test('a free slot of exactly the worst case is enough', () => {
  const { ledger } = setup()
  const limits = { ...LIMITS, globalCalls: 6 }
  assert.equal(ledger.reserve(WHO, limits).ok, true)
  assert.equal(ledger.reserve({ clientId: 'otro', ipKey: 'otra' }, limits).code, 'global_limit')
})

test('holds in progress count towards the cap, so simultaneous requests can not go over it', () => {
  const { ledger, globalCalls } = setup()
  const limits = { ...LIMITS, globalCalls: 12 }
  assert.equal(ledger.reserve({ clientId: 'a', ipKey: 'a' }, limits).ok, true)
  assert.equal(ledger.reserve({ clientId: 'b', ipKey: 'b' }, limits).ok, true)
  assert.equal(ledger.reserve({ clientId: 'c', ipKey: 'c' }, limits).code, 'global_limit')
  assert.equal(globalCalls(), 12)
})

test('the global cap reopens at the next UTC day, and not before', () => {
  const { time, ledger } = setup()
  const limits = { ...LIMITS, globalCalls: 6 }
  const hold = ledger.reserve(WHO, limits)
  ledger.settle(hold.holdId, WHO, { valid: false, calls: 6 }, limits)

  const other = { clientId: 'otro', ipKey: 'otra' }
  time.now = Date.UTC(2026, 10, 3, 23, 59, 59)
  assert.equal(ledger.reserve(other, limits).code, 'global_limit')
  time.now = Date.UTC(2026, 10, 4, 0, 0, 0)
  assert.equal(ledger.reserve(other, limits).ok, true)
})

test('a hold taken before midnight gives its calls back to the day it was taken', () => {
  const { time, ledger, globalCalls } = setup(Date.UTC(2026, 10, 3, 23, 59, 50))
  const hold = ledger.reserve(WHO, LIMITS)
  assert.equal(globalCalls('2026-11-03'), 6)
  time.now = Date.UTC(2026, 10, 4, 0, 0, 5)
  ledger.settle(hold.holdId, WHO, { valid: true, calls: 1 }, LIMITS)
  assert.equal(globalCalls('2026-11-03'), 1)
  assert.equal(globalCalls('2026-11-04'), 0)
})

test('old days are purged, and yesterday stays', () => {
  const { time, ledger, globalCalls } = setup()
  ledger.reserve(WHO, LIMITS)
  time.now += DAY
  ledger.reserve({ clientId: 'b', ipKey: 'b' }, LIMITS)
  assert.equal(globalCalls('2026-11-03'), 6, 'ayer sigue')
  time.now += DAY
  ledger.reserve({ clientId: 'c', ipKey: 'c' }, LIMITS)
  assert.equal(globalCalls('2026-11-03'), 0, 'anteayer se borró')
  assert.equal(globalCalls('2026-11-04'), 6)
})

test('when the browser and the global cap both block, resetAt is the later of the two', () => {
  const { time, ledger, spend } = setup(Date.UTC(2026, 10, 3, 23, 0))
  const limits = { ...LIMITS, globalCalls: 8 }
  spend(WHO, limits)
  spend(WHO, limits)
  spend(WHO, limits, 2)
  assert.equal(ledger.peek(WHO, limits).remaining, 0)
  time.now += MINUTE
  // Browser: back in 24 h. Global: at midnight, sooner. The later one decides.
  assert.equal(ledger.peek(WHO, limits).resetAt, iso(Date.UTC(2026, 10, 4, 23, 0)))
})

test('out of attempts and global cap closed: it says quota_exceeded, not global_limit', () => {
  const { ledger, spend } = setup()
  const limits = { ...LIMITS, globalCalls: 8 }
  spend(WHO, limits)
  spend(WHO, limits)
  spend(WHO, limits)
  assert.equal(ledger.reserve(WHO, limits).code, 'quota_exceeded')
})

test('an error inside a reservation leaves nothing half done', () => {
  const time = { now: NOON }
  const storage = sqliteStorage()
  const ledger = new Ledger(storage, () => time.now)
  const realExec = storage.sql.exec
  storage.sql.exec = (query, ...bindings) => {
    if (query.startsWith('INSERT INTO global_calls')) throw new Error('falla simulada')
    return realExec(query, ...bindings)
  }
  assert.throws(() => ledger.reserve(WHO, LIMITS), /falla simulada/)
  storage.sql.exec = realExec
  assert.deepEqual(ledger.peek(WHO, LIMITS), { remaining: 3, resetAt: null }, 'la reserva se deshizo')
})
