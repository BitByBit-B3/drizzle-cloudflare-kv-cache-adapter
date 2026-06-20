import type { KVNamespace } from '@cloudflare/workers-types'

interface StoredEntry {
  value: string
  expirationTtl?: number
}

/**
 * Minimal in-memory stand-in for a Cloudflare KV namespace, covering only the
 * `get('json')` / `put({ expirationTtl })` / `delete` surface the adapter uses.
 * TTLs are recorded (for assertions) but entries do not auto-expire.
 */
export class MockKV {
  readonly store = new Map<string, StoredEntry>()
  readonly putCalls: Array<{ key: string; expirationTtl?: number }> = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get(key: string, _type?: 'json' | 'text'): Promise<any> {
    const entry = this.store.get(key)
    if (!entry) return null
    return _type === 'json' ? JSON.parse(entry.value) : entry.value
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void> {
    this.store.set(key, { value, expirationTtl: options?.expirationTtl })
    this.putCalls.push({ key, expirationTtl: options?.expirationTtl })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  asNamespace(): KVNamespace {
    return this as unknown as KVNamespace
  }
}
