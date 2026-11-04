// Real SQLite (node:sqlite) behind the storage interface of a Durable Object, so the tests run
// the same SQL as production with a clock they control. Simultaneity is also tested on the real
// object, in workerd: test/limits.workerd.test.mjs.
import { DatabaseSync } from 'node:sqlite'

export function sqliteStorage() {
  const db = new DatabaseSync(':memory:')
  return {
    db,
    sql: {
      exec: (query, ...bindings) => {
        const rows = db.prepare(query).all(...bindings)
        return { toArray: () => rows }
      },
    },
    transactionSync(closure) {
      db.exec('BEGIN')
      try {
        const result = closure()
        db.exec('COMMIT')
        return result
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
  }
}

/** A namespace with one object in it: what `env.LIMITS` looks like to the Worker. */
export function limitsNamespace(LimitsDO, clock) {
  const storage = sqliteStorage()
  const object = new LimitsDO({ storage }, {}, clock)
  return {
    storage,
    idFromName: (name) => name,
    get: () => ({ fetch: (url, init) => object.fetch(new Request(url, init)) }),
  }
}
