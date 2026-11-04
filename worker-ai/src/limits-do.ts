/**
 * The single Durable Object that holds the ledger (D17), and how the Worker talks to it.
 * Browser, IP and global limits live in one object so they are checked in one transaction.
 *
 * A plain class with fetch(): extending DurableObject means importing `cloudflare:workers`,
 * which doesn't load in the Node tests. The Worker never holds the object open while it waits
 * for Gemini: it only asks to reserve and to settle.
 */
import { Ledger } from './limits.ts'
import type { LedgerStorage, Limits, Quota, Reservation, Settlement, Who } from './limits.ts'

type LimitsMessage =
  | { op: 'peek'; who: Who; limits: Limits }
  | { op: 'reserve'; who: Who; limits: Limits }
  | { op: 'settle'; holdId: string; who: Who; result: { valid: boolean; calls: number }; limits: Limits }

export class LimitsDO {
  private readonly ledger: Ledger

  /** The clock is for the tests; the runtime only passes the first two arguments. */
  constructor(state: { storage: LedgerStorage }, _env: unknown, clock: () => number = Date.now) {
    this.ledger = new Ledger(state.storage, clock)
  }

  async fetch(request: Request): Promise<Response> {
    const message = (await request.json()) as LimitsMessage
    switch (message.op) {
      case 'peek':
        return Response.json(this.ledger.peek(message.who, message.limits))
      case 'reserve':
        return Response.json(this.ledger.reserve(message.who, message.limits))
      case 'settle':
        return Response.json(this.ledger.settle(message.holdId, message.who, message.result, message.limits))
    }
  }
}

interface LimitsNamespace {
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId): { fetch(url: string, init: RequestInit): Promise<Response> }
}

/** Failures reach the caller as exceptions: without the ledger, Gemini is not called. */
export class LimitsClient {
  private readonly namespace: LimitsNamespace
  private readonly limits: Limits

  constructor(namespace: LimitsNamespace, limits: Limits) {
    this.namespace = namespace
    this.limits = limits
  }

  private async post<T>(message: LimitsMessage): Promise<T> {
    const stub = this.namespace.get(this.namespace.idFromName('global'))
    const response = await stub.fetch('https://limits.internal/', { method: 'POST', body: JSON.stringify(message) })
    if (!response.ok) throw new Error(`LimitsDO respondió ${response.status}`)
    return (await response.json()) as T
  }

  peek(who: Who): Promise<Quota> {
    return this.post({ op: 'peek', who, limits: this.limits })
  }

  reserve(who: Who): Promise<Reservation> {
    return this.post({ op: 'reserve', who, limits: this.limits })
  }

  settle(holdId: string, who: Who, result: { valid: boolean; calls: number }): Promise<Settlement> {
    return this.post({ op: 'settle', holdId, who, result, limits: this.limits })
  }
}
