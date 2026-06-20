---
title: API & options
description: The cloudflareKVCache factory and its options.
---

## `cloudflareKVCache(kv, options?)`

Creates a Drizzle cache adapter backed by a Cloudflare KV namespace.

```ts
import { cloudflareKVCache } from 'drizzle-cloudflare-kv-cache-adapter'

const cache = cloudflareKVCache(env.CACHE, {
  strategy: 'explicit',
  prefix: 'drizzle',
  defaultTtlSeconds: 300,
})

const db = drizzle(env.DB, { cache })
```

### Parameters

| Param     | Type                        | Description                                          |
| --------- | --------------------------- | ---------------------------------------------------- |
| `kv`      | `KVNamespace`               | A bound KV namespace, e.g. `env.CACHE`.              |
| `options` | `CloudflareKVCacheOptions?` | Optional configuration (below).                     |

### `CloudflareKVCacheOptions`

| Option              | Type                    | Default      | Description                                                              |
| ------------------- | ----------------------- | ------------ | ----------------------------------------------------------------------- |
| `strategy`          | `'explicit' \| 'all'`   | `'explicit'` | `'explicit'` caches only `.$withCache()` queries; `'all'` caches all.   |
| `prefix`            | `string`                | `'drizzle'`  | Key namespace prefix; lets multiple apps share one KV namespace.        |
| `defaultTtlSeconds` | `number`                | `300`        | Fallback TTL when a query sets no `ex`. Clamped to KV's 60s minimum.    |

## Exports

```ts
import {
  cloudflareKVCache,     // factory (recommended)
  CloudflareKVCache,     // the class, if you need to extend it
  type CloudflareKVCacheOptions,
} from 'drizzle-cloudflare-kv-cache-adapter'
```

## Per-query config

Passed through Drizzle's `.$withCache({ config })`:

| Field | Type     | Description                                                   |
| ----- | -------- | ------------------------------------------------------------ |
| `ex`  | `number` | TTL in **seconds**. Clamped to ≥ 60.                         |
| `px`  | `number` | TTL in **milliseconds**; converted to seconds, clamped to ≥ 60. |
| `tag` | `string` | Cache under a stable tag; invalidate via `invalidate({ tags })`. |

`ex` takes precedence over `px`. Absolute-time options (`exat` / `pxat`) aren't expressible as a KV relative TTL and are ignored.
