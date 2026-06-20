<p align="center">
  <img src="./assets/banner.png" alt="Drizzle Cloudflare KV Cache Adapter — Cloudflare KV-backed query caching for Drizzle ORM" />
</p>

# Drizzle Cloudflare KV Cache Adapter

[![npm version](https://img.shields.io/npm/v/drizzle-cloudflare-kv-cache-adapter.svg?logo=npm)](https://www.npmjs.com/package/drizzle-cloudflare-kv-cache-adapter)
[![npm downloads](https://img.shields.io/npm/dm/drizzle-cloudflare-kv-cache-adapter.svg)](https://www.npmjs.com/package/drizzle-cloudflare-kv-cache-adapter)
[![CI](https://github.com/BitByBit-B3/drizzle-cloudflare-kv-cache-adapter/actions/workflows/ci.yml/badge.svg)](https://github.com/BitByBit-B3/drizzle-cloudflare-kv-cache-adapter/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/npm/l/drizzle-cloudflare-kv-cache-adapter.svg)](./LICENSE)

Cloudflare KV query caching for Drizzle ORM — cache read-heavy Drizzle queries on Workers/D1 without adding Redis.

📦 **[npm](https://www.npmjs.com/package/drizzle-cloudflare-kv-cache-adapter)** · 📖 **[Docs](https://drizzle-kv-cache.bbyb.dev)**

A [Cloudflare KV](https://developers.cloudflare.com/kv/)-backed implementation of Drizzle ORM's [cache](https://orm.drizzle.team/docs/cache) interface. Designed for Cloudflare Workers, D1, and read-heavy serverless apps that want Drizzle query caching without standing up Redis or Upstash.

> This is **not** a database driver. It only implements Drizzle's query cache layer (`.$withCache()` and `db.$cache.invalidate(...)`).

## Install

```sh
bun add drizzle-cloudflare-kv-cache-adapter
# or: npm i drizzle-cloudflare-kv-cache-adapter
```

`drizzle-orm >= 0.44.0` is a peer dependency.

## Setup

Create a KV namespace (if you don't have one):

```sh
wrangler kv namespace create CACHE
```

Bind it in your Wrangler config — `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "<your-kv-namespace-id>"
```

…or `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "<your-kv-namespace-id>"
    }
  ]
}
```

Wire it into Drizzle (D1 example):

```ts
import { drizzle } from 'drizzle-orm/d1'
import { cloudflareKVCache } from 'drizzle-cloudflare-kv-cache-adapter'

export default {
  async fetch(request: Request, env: Env) {
    const db = drizzle(env.DB, {
      cache: cloudflareKVCache(env.CACHE),
    })

    // ...use db
  },
}
```

## Usage

### Explicit caching (default)

Only queries you opt in with `.$withCache()` are cached:

```ts
const users = await db.select().from(usersTable).$withCache()

// Custom TTL (seconds) for this query:
const posts = await db.select().from(postsTable).$withCache({ config: { ex: 600 } })
```

### Cache everything

```ts
const db = drizzle(env.DB, {
  cache: cloudflareKVCache(env.CACHE, { strategy: 'all' }),
})
```

With `strategy: 'all'`, every read query is cached and auto-invalidated when its tables are mutated through Drizzle.

### Invalidation

Writes through Drizzle (`insert` / `update` / `delete`) automatically invalidate cached queries that reference the affected tables. You can also invalidate manually:

```ts
await db.$cache.invalidate({ tables: 'users' })
await db.$cache.invalidate({ tables: ['users', 'posts'] })
```

## Options

```ts
cloudflareKVCache(env.CACHE, {
  strategy: 'explicit',     // 'explicit' (default) | 'all'
  prefix: 'drizzle',        // KV key namespace prefix
  defaultTtlSeconds: 300,   // fallback TTL when a query sets no `ex`
})
```

| Option              | Type                      | Default     | Notes                                                                 |
| ------------------- | ------------------------- | ----------- | --------------------------------------------------------------------- |
| `strategy`          | `'explicit'` \| `'all'`   | `'explicit'`| `'explicit'` caches only `.$withCache()` queries; `'all'` caches all. |
| `prefix`            | `string`                  | `'drizzle'` | Lets multiple apps share one KV namespace safely.                     |
| `defaultTtlSeconds` | `number`                  | `300`       | Clamped to Cloudflare KV's 60s minimum.                               |

## How it works

- Each cached query result is stored at `{prefix}:q:{hash}`.
- Each referenced table keeps a reverse index at `{prefix}:tindex:{table}` listing the query hashes that depend on it.
- On mutation, the adapter reads the table index, deletes every dependent query key, then deletes the index.

### Caveats

Cloudflare KV is **eventually consistent** and enforces a **60-second minimum TTL**. KV is the right fit for read-heavy data that tolerates brief staleness — not for read-after-write strong consistency. The table index is a best-effort list and uses last-write-wins, so under heavy concurrent writes a few entries may be missed; TTLs guarantee everything still expires.

## Development

```sh
bun install
bun test
bun run typecheck
bun run build
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for the dev setup and PR workflow, and our [Code of Conduct](./CODE_OF_CONDUCT.md). Notable changes are tracked in [CHANGELOG.md](./CHANGELOG.md).

## Disclaimer

This is an independent, community-maintained project. It is **not affiliated with, endorsed by, or sponsored by** Drizzle ORM or Cloudflare, Inc. "Drizzle", "Cloudflare", "Cloudflare Workers", "Workers KV", and "D1" are trademarks of their respective owners and are used here for identification purposes only.

## License

[MIT](./LICENSE) © BitByBit-B3
