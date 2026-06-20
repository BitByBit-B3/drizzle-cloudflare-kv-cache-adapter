import type { KVNamespace } from '@cloudflare/workers-types'
import { Cache, type MutationOption } from 'drizzle-orm/cache/core'
import type { CacheConfig } from 'drizzle-orm/cache/core/types'

/**
 * Options for {@link cloudflareKVCache}.
 */
export interface CloudflareKVCacheOptions {
  /**
   * Caching strategy passed to Drizzle.
   *
   * - `'explicit'` (default): only queries with `.$withCache()` are cached.
   * - `'all'`: every read query is cached automatically.
   */
  strategy?: 'explicit' | 'all'
  /**
   * Key namespace prefix. Lets multiple apps share one KV namespace safely.
   * @default 'drizzle'
   */
  prefix?: string
  /**
   * Fallback TTL in seconds when a query does not set its own `ex`.
   * Clamped to the KV minimum of 60s.
   * @default 300
   */
  defaultTtlSeconds?: number
}

/** Cloudflare KV enforces a 60-second minimum on `expirationTtl`. */
const KV_MIN_TTL_SECONDS = 60
const DEFAULT_TTL_SECONDS = 300

/**
 * Drizzle ORM query cache backed by a Cloudflare KV namespace.
 *
 * Cached query results live under `{prefix}:q:{hash}`. Each table referenced by
 * a query keeps a reverse index under `{prefix}:tindex:{table}` so that
 * mutations can invalidate every dependent query.
 */
export class CloudflareKVCache extends Cache {
  private readonly kv: KVNamespace
  private readonly prefix: string
  private readonly defaultTtl: number
  private readonly strategyMode: 'explicit' | 'all'

  constructor(kv: KVNamespace, options: CloudflareKVCacheOptions = {}) {
    super()
    this.kv = kv
    this.prefix = options.prefix ?? 'drizzle'
    this.defaultTtl = clampTtl(options.defaultTtlSeconds ?? DEFAULT_TTL_SECONDS)
    this.strategyMode = options.strategy ?? 'explicit'
  }

  override strategy(): 'explicit' | 'all' {
    return this.strategyMode
  }

  override async get(
    key: string,
    _tables: string[],
    _isTag: boolean,
    _isAutoInvalidate?: boolean,
  ): Promise<unknown[] | undefined> {
    const cached = await this.kv.get<unknown[]>(this.queryKey(key), 'json')
    return cached ?? undefined
  }

  override async put(
    hashedQuery: string,
    response: unknown,
    tables: string[],
    _isTag: boolean,
    config?: CacheConfig,
  ): Promise<void> {
    const ttl = config?.ex && config.ex > 0 ? clampTtl(config.ex) : this.defaultTtl
    await this.kv.put(this.queryKey(hashedQuery), JSON.stringify(response), {
      expirationTtl: ttl,
    })
    if (tables.length === 0) return
    await Promise.all(tables.map((table) => this.appendToTableIndex(table, hashedQuery, ttl)))
  }

  override async onMutate(params: MutationOption): Promise<void> {
    const tables = resolveTables(params.tables)
    if (tables.length === 0) return
    await Promise.all(
      tables.map(async (table) => {
        const indexKey = this.tableIndexKey(table)
        const queryHashes = await this.kv.get<string[]>(indexKey, 'json')
        if (queryHashes?.length) {
          await Promise.all(queryHashes.map((hash) => this.kv.delete(this.queryKey(hash))))
        }
        await this.kv.delete(indexKey)
      }),
    )
  }

  private queryKey(hashedQuery: string): string {
    return `${this.prefix}:q:${hashedQuery}`
  }

  private tableIndexKey(table: string): string {
    return `${this.prefix}:tindex:${table}`
  }

  private async appendToTableIndex(table: string, hashedQuery: string, ttl: number): Promise<void> {
    const indexKey = this.tableIndexKey(table)
    const existing = (await this.kv.get<string[]>(indexKey, 'json')) ?? []
    if (existing.includes(hashedQuery)) return
    existing.push(hashedQuery)
    // Index outlives the queries it points at so late writers don't lose entries.
    await this.kv.put(indexKey, JSON.stringify(existing), { expirationTtl: ttl * 2 })
  }
}

function clampTtl(seconds: number): number {
  return Math.max(KV_MIN_TTL_SECONDS, Math.floor(seconds))
}

function resolveTables(input: MutationOption['tables']): string[] {
  if (!input) return []
  if (typeof input === 'string') return [input]
  if (Array.isArray(input)) {
    return input.map((item) => (typeof item === 'string' ? item : extractTableName(item)))
  }
  return [extractTableName(input)]
}

function extractTableName(table: unknown): string {
  if (typeof table === 'object' && table !== null && 'name' in (table as Record<string, unknown>)) {
    return String((table as Record<string, unknown>).name)
  }
  return String(table)
}

/**
 * Create a Cloudflare KV-backed cache adapter for Drizzle ORM.
 *
 * @example
 * ```ts
 * import { drizzle } from 'drizzle-orm/d1'
 * import { cloudflareKVCache } from 'drizzle-cloudflare-kv-cache-adapter'
 *
 * const db = drizzle(env.DB, { cache: cloudflareKVCache(env.CACHE) })
 * ```
 *
 * @param kv A bound `KVNamespace` (e.g. `env.CACHE`).
 * @param options See {@link CloudflareKVCacheOptions}.
 */
export function cloudflareKVCache(
  kv: KVNamespace,
  options?: CloudflareKVCacheOptions,
): CloudflareKVCache {
  return new CloudflareKVCache(kv, options)
}
