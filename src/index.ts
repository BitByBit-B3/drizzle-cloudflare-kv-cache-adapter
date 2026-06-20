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
 * Cached entries live under `{prefix}:q:{hash}` for hashed queries and
 * `{prefix}:t:{tag}` for tagged queries (`.$withCache({ tag })`). Each table a
 * query references keeps a reverse index under `{prefix}:tindex:{table}` listing
 * the full storage keys to drop, so mutations can invalidate every dependent
 * entry. Tagged entries are additionally invalidated directly via their tag.
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
    isTag: boolean,
    _isAutoInvalidate?: boolean,
  ): Promise<unknown[] | undefined> {
    const cached = await this.kv.get<unknown[]>(this.storageKey(key, isTag), 'json')
    return cached ?? undefined
  }

  override async put(
    key: string,
    response: unknown,
    tables: string[],
    isTag: boolean,
    config?: CacheConfig,
  ): Promise<void> {
    const ttl = resolveTtlSeconds(config) ?? this.defaultTtl
    const storageKey = this.storageKey(key, isTag)
    await this.kv.put(storageKey, JSON.stringify(response), {
      expirationTtl: ttl,
    })
    if (tables.length === 0) return
    await Promise.all(tables.map((table) => this.appendToTableIndex(table, storageKey, ttl)))
  }

  override async onMutate(params: MutationOption): Promise<void> {
    const tables = resolveTables(params.tables)
    const tags = resolveTags(params.tags)
    await Promise.all([
      // Tag-scoped invalidation: the tag itself is the cache key.
      ...tags.map((tag) => this.kv.delete(this.storageKey(tag, true))),
      // Table-scoped invalidation: drop every entry the reverse index points at.
      ...tables.map(async (table) => {
        const indexKey = this.tableIndexKey(table)
        const storageKeys = await this.kv.get<string[]>(indexKey, 'json')
        if (storageKeys?.length) {
          await Promise.all(storageKeys.map((storageKey) => this.kv.delete(storageKey)))
        }
        await this.kv.delete(indexKey)
      }),
    ])
  }

  private storageKey(key: string, isTag: boolean): string {
    return `${this.prefix}:${isTag ? 't' : 'q'}:${key}`
  }

  private tableIndexKey(table: string): string {
    return `${this.prefix}:tindex:${table}`
  }

  private async appendToTableIndex(table: string, storageKey: string, ttl: number): Promise<void> {
    const indexKey = this.tableIndexKey(table)
    const existing = (await this.kv.get<string[]>(indexKey, 'json')) ?? []
    if (existing.includes(storageKey)) return
    existing.push(storageKey)
    // Index outlives the queries it points at so late writers don't lose entries.
    await this.kv.put(indexKey, JSON.stringify(existing), { expirationTtl: ttl * 2 })
  }
}

function clampTtl(seconds: number): number {
  return Math.max(KV_MIN_TTL_SECONDS, Math.floor(seconds))
}

/**
 * Resolve a Drizzle {@link CacheConfig} to a KV TTL in seconds, preferring the
 * relative-expiry options. Returns `undefined` when no expiry is set so the
 * caller can fall back to its default. KV only supports second-granularity
 * relative TTLs, so `px` (ms) is converted; absolute `exat`/`pxat` are not
 * expressible here and are ignored.
 */
function resolveTtlSeconds(config?: CacheConfig): number | undefined {
  if (!config) return undefined
  if (config.ex && config.ex > 0) return clampTtl(config.ex)
  if (config.px && config.px > 0) return clampTtl(config.px / 1000)
  return undefined
}

function resolveTables(input: MutationOption['tables']): string[] {
  if (!input) return []
  if (typeof input === 'string') return [input]
  if (Array.isArray(input)) {
    return input.map((item) => (typeof item === 'string' ? item : extractTableName(item)))
  }
  return [extractTableName(input)]
}

function resolveTags(input: MutationOption['tags']): string[] {
  if (!input) return []
  return typeof input === 'string' ? [input] : input
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
