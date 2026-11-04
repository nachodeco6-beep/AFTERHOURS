/**
 * The ledger behind every limit (D6, D7). Knows nothing about Workers: it takes SQL storage and
 * a clock, so the tests run the same SQL against real SQLite with a clock they control.
 *
 * Every row of `charges` is one generation, held or charged, and only counts while
 * `expires_at` is in the future:
 *   - held:    in progress. Expires at the end of the hold, in case the Worker dies.
 *   - charged: valid brandbook delivered. Expires 24 h later: that is the rolling window.
 *
 * `global_calls` counts calls to Gemini per UTC day. A reservation sets aside the worst case and
 * settling gives back what was not used, so the cap holds under concurrency, and a Worker that
 * dies leaves the worst case counted, because what it spent is unknown.
 *
 * Nothing here awaits: each method runs whole inside one transaction of one single-threaded object.
 */

const DAY_MS = 24 * 60 * 60 * 1000
export const WINDOW_MS = DAY_MS

export interface LedgerStorage {
  sql: { exec(query: string, ...bindings: (string | number)[]): { toArray(): unknown[] } }
  transactionSync<T>(closure: () => T): T
}

export interface Limits {
  /** FREE_PER_24H: valid generations per browser in the rolling window */
  perClient: number
  /** IP_PER_DAY: valid generations per IP in the rolling window */
  perIp: number
  /** GLOBAL_PER_DAY: calls to Gemini per UTC day */
  globalCalls: number
  /** The most calls one generation can make */
  callsPerGeneration: number
  /** QUOTA_HOLD_MS: how long a reservation lasts if nobody settles it */
  holdMs: number
}

export interface Who {
  clientId: string
  ipKey: string
}

export interface Quota {
  remaining: number
  /** When the next attempt comes back, in UTC; null if the quota is full */
  resetAt: string | null
}

export type LimitCode = 'quota_exceeded' | 'global_limit'

export type Reservation =
  | { ok: true; holdId: string; quota: Quota }
  | { ok: false; code: LimitCode; quota: Quota }

export interface Settlement {
  /** `none`: the hold had already expired or been settled, so nothing changes */
  outcome: 'charged' | 'released' | 'none'
  quota: Quota
  globalCallsToday: number
}

const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const nextUtcMidnight = (ms: number): number => (Math.floor(ms / DAY_MS) + 1) * DAY_MS

interface SlotRow {
  expires_at: number
  charged: number
}

interface HoldRow {
  charged: number
  expires_at: number
  day: string
  held_calls: number
}

/** A hold counts as if it were charged right now: the answer stays on the safe side until it settles. */
function slotTimes(rows: SlotRow[], now: number): number[] {
  return rows.map((row) => (row.charged ? row.expires_at : now + WINDOW_MS)).sort((a, b) => a - b)
}

/** When a counter gains its next free slot. Above the limit (it was lowered), it takes several to expire. */
const nextFree = (times: number[], limit: number): number | undefined => times[Math.max(0, times.length - limit)]

export class Ledger {
  private readonly storage: LedgerStorage
  private readonly clock: () => number

  constructor(storage: LedgerStorage, clock: () => number) {
    this.storage = storage
    this.clock = clock
    const { sql } = storage
    sql.exec(`CREATE TABLE IF NOT EXISTS charges (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      ip_key TEXT NOT NULL,
      day TEXT NOT NULL,
      held_calls INTEGER NOT NULL,
      charged INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    ) WITHOUT ROWID`)
    sql.exec('CREATE INDEX IF NOT EXISTS charges_client ON charges(client_id)')
    sql.exec('CREATE INDEX IF NOT EXISTS charges_ip ON charges(ip_key)')
    sql.exec('CREATE INDEX IF NOT EXISTS charges_expiry ON charges(expires_at)')
    sql.exec('CREATE TABLE IF NOT EXISTS global_calls (day TEXT PRIMARY KEY, calls INTEGER NOT NULL) WITHOUT ROWID')
  }

  private rows<T>(query: string, ...bindings: (string | number)[]): T[] {
    return this.storage.sql.exec(query, ...bindings).toArray() as T[]
  }

  private run(query: string, ...bindings: (string | number)[]): void {
    this.storage.sql.exec(query, ...bindings)
  }

  private callsOn(day: string): number {
    return this.rows<{ calls: number }>('SELECT calls FROM global_calls WHERE day = ?', day)[0]?.calls ?? 0
  }

  private assess({ clientId, ipKey }: Who, limits: Limits, now: number) {
    const active = 'SELECT expires_at, charged FROM charges WHERE expires_at > ? AND'
    const client = slotTimes(this.rows<SlotRow>(`${active} client_id = ?`, now, clientId), now)
    const ip = slotTimes(this.rows<SlotRow>(`${active} ip_key = ?`, now, ipKey), now)

    const clientLeft = Math.max(0, limits.perClient - client.length)
    const ipLeft = Math.max(0, limits.perIp - ip.length)
    const globalOpen = this.callsOn(dayOf(now)) + limits.callsPerGeneration <= limits.globalCalls
    const remaining = globalOpen ? Math.min(clientLeft, ipLeft) : 0

    // What has to happen for `remaining` to go up. If several things hold it down, the latest one decides.
    const waits: (number | undefined)[] = []
    if (remaining < limits.perClient) {
      if (clientLeft === remaining) waits.push(nextFree(client, limits.perClient))
      if (ipLeft === remaining) waits.push(nextFree(ip, limits.perIp))
      if (!globalOpen) waits.push(nextUtcMidnight(now))
    }
    const known = waits.filter((time) => time !== undefined)
    const quota: Quota = {
      remaining,
      resetAt: known.length ? new Date(Math.max(...known)).toISOString() : null,
    }
    return { quota, clientLeft, ipLeft, globalOpen }
  }

  /** Writes nothing. */
  peek(who: Who, limits: Limits): Quota {
    return this.assess(who, limits, this.clock()).quota
  }

  reserve(who: Who, limits: Limits): Reservation {
    return this.storage.transactionSync(() => {
      const now = this.clock()
      this.run('DELETE FROM charges WHERE expires_at <= ?', now)
      // Yesterday stays: a hold taken before midnight can still give calls back after it.
      this.run('DELETE FROM global_calls WHERE day < ?', dayOf(now - DAY_MS))

      const { quota, clientLeft, ipLeft, globalOpen } = this.assess(who, limits, now)
      if (clientLeft === 0 || ipLeft === 0) return { ok: false, code: 'quota_exceeded', quota }
      if (!globalOpen) return { ok: false, code: 'global_limit', quota }

      const holdId = crypto.randomUUID()
      const day = dayOf(now)
      this.run(
        'INSERT INTO charges (id, client_id, ip_key, day, held_calls, charged, expires_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
        holdId, who.clientId, who.ipKey, day, limits.callsPerGeneration, now + limits.holdMs,
      )
      this.run(
        'INSERT INTO global_calls (day, calls) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET calls = calls + excluded.calls',
        day, limits.callsPerGeneration,
      )
      return { ok: true, holdId, quota: this.assess(who, limits, now).quota }
    })
  }

  /**
   * D7: only a valid brandbook charges. Whatever the result, the calls not made go back to the
   * global count. A hold that already expired changes nothing: those calls stay counted, and
   * repeating a settle can't give them back twice.
   */
  settle(holdId: string, who: Who, result: { valid: boolean; calls: number }, limits: Limits): Settlement {
    return this.storage.transactionSync(() => {
      const now = this.clock()
      const hold = this.rows<HoldRow>('SELECT charged, expires_at, day, held_calls FROM charges WHERE id = ?', holdId)[0]

      let outcome: Settlement['outcome'] = 'none'
      if (hold && !hold.charged) {
        if (hold.expires_at <= now) {
          this.run('DELETE FROM charges WHERE id = ?', holdId)
        } else {
          this.run('UPDATE global_calls SET calls = calls - ? WHERE day = ?', Math.max(0, hold.held_calls - result.calls), hold.day)
          if (result.valid) {
            this.run('UPDATE charges SET charged = 1, expires_at = ? WHERE id = ?', now + WINDOW_MS, holdId)
            outcome = 'charged'
          } else {
            this.run('DELETE FROM charges WHERE id = ?', holdId)
            outcome = 'released'
          }
        }
      }
      return { outcome, quota: this.assess(who, limits, now).quota, globalCallsToday: this.callsOn(dayOf(now)) }
    })
  }
}
