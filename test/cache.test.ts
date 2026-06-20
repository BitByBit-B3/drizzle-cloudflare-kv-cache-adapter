import { describe, expect, test } from 'bun:test'
import { CloudflareKVCache, cloudflareKVCache } from '../src/index'
import { MockKV } from './kv-mock'

function setup(options?: ConstructorParameters<typeof CloudflareKVCache>[1]) {
  const kv = new MockKV()
  const cache = cloudflareKVCache(kv.asNamespace(), options)
  return { kv, cache }
}

describe('strategy', () => {
  test('defaults to explicit', () => {
    const { cache } = setup()
    expect(cache.strategy()).toBe('explicit')
  })

  test('honours the all override', () => {
    const { cache } = setup({ strategy: 'all' })
    expect(cache.strategy()).toBe('all')
  })
})

describe('get', () => {
  test('returns undefined on a miss', async () => {
    const { cache } = setup()
    expect(await cache.get('missing', [], false)).toBeUndefined()
  })

  test('round-trips a stored query result', async () => {
    const { cache } = setup()
    const rows = [{ id: 1, name: 'ada' }]
    await cache.put('h1', rows, ['users'], false)
    expect(await cache.get('h1', ['users'], false)).toEqual(rows)
  })
})

describe('put', () => {
  test('namespaces keys with the prefix', async () => {
    const { kv, cache } = setup({ prefix: 'app' })
    await cache.put('h1', [1], ['users'], false)
    expect(kv.store.has('app:q:h1')).toBe(true)
    expect(kv.store.has('app:tindex:users')).toBe(true)
  })

  test('clamps the default ttl to the KV minimum', async () => {
    const { kv, cache } = setup({ defaultTtlSeconds: 5 })
    await cache.put('h1', [1], [], false)
    const call = kv.putCalls.find((c) => c.key === 'drizzle:q:h1')
    expect(call?.expirationTtl).toBe(60)
  })

  test('uses the per-query ex ttl when provided', async () => {
    const { kv, cache } = setup()
    await cache.put('h1', [1], [], false, { ex: 120 })
    const call = kv.putCalls.find((c) => c.key === 'drizzle:q:h1')
    expect(call?.expirationTtl).toBe(120)
  })

  test('writes a table index entry per referenced table', async () => {
    const { kv, cache } = setup()
    await cache.put('h1', [1], ['users', 'posts'], false)
    expect(kv.store.has('drizzle:tindex:users')).toBe(true)
    expect(kv.store.has('drizzle:tindex:posts')).toBe(true)
  })

  test('does not duplicate a hash already in the table index', async () => {
    const { kv, cache } = setup()
    await cache.put('h1', [1], ['users'], false)
    await cache.put('h1', [2], ['users'], false)
    const index = JSON.parse(kv.store.get('drizzle:tindex:users')!.value)
    expect(index).toEqual(['h1'])
  })

  test('skips index writes when no tables are referenced', async () => {
    const { kv, cache } = setup()
    await cache.put('h1', [1], [], false)
    expect([...kv.store.keys()]).toEqual(['drizzle:q:h1'])
  })
})

describe('onMutate', () => {
  test('invalidates every query tied to a mutated table', async () => {
    const { kv, cache } = setup()
    await cache.put('h1', [1], ['users'], false)
    await cache.put('h2', [2], ['users'], false)
    await cache.put('h3', [3], ['posts'], false)

    await cache.onMutate({ tables: 'users' })

    expect(await cache.get('h1', ['users'], false)).toBeUndefined()
    expect(await cache.get('h2', ['users'], false)).toBeUndefined()
    expect(kv.store.has('drizzle:tindex:users')).toBe(false)
    // Unrelated table is untouched.
    expect(await cache.get('h3', ['posts'], false)).toEqual([3])
  })

  test('accepts an array of table names', async () => {
    const { cache } = setup()
    await cache.put('h1', [1], ['users'], false)
    await cache.put('h2', [2], ['posts'], false)
    await cache.onMutate({ tables: ['users', 'posts'] })
    expect(await cache.get('h1', ['users'], false)).toBeUndefined()
    expect(await cache.get('h2', ['posts'], false)).toBeUndefined()
  })

  test('resolves table objects that carry a name', async () => {
    const { cache } = setup()
    await cache.put('h1', [1], ['users'], false)
    // drizzle passes table objects; the adapter reads `.name`.
    await cache.onMutate({ tables: [{ name: 'users' }] as never })
    expect(await cache.get('h1', ['users'], false)).toBeUndefined()
  })

  test('is a no-op when no tables are given', async () => {
    const { kv, cache } = setup()
    await cache.put('h1', [1], ['users'], false)
    await cache.onMutate({ tables: [] })
    expect(await cache.get('h1', ['users'], false)).toEqual([1])
  })
})
