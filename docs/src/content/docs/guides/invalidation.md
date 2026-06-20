---
title: Invalidation
description: How cached queries are invalidated on writes, and how to do it manually.
---

## Automatic

Writes through Drizzle — `insert`, `update`, `delete` — automatically invalidate every cached query that references the affected tables. You don't have to do anything:

```ts
// Cached:
await db.select().from(usersTable).$withCache()

// This write invalidates the query above:
await db.insert(usersTable).values({ name: 'ada' })

// Next read misses the cache and refreshes:
await db.select().from(usersTable).$withCache()
```

## Manual

Invalidate by table name when you mutate data outside Drizzle (or want to force a refresh):

```ts
// Single table:
await db.$cache.invalidate({ tables: 'users' })

// Multiple tables:
await db.$cache.invalidate({ tables: ['users', 'posts'] })

// By tag (see Usage → Tagged queries):
await db.$cache.invalidate({ tags: 'daily-report' })
await db.$cache.invalidate({ tags: ['daily-report', 'weekly-report'] })
```

## Scope

Invalidation is **table-scoped**, not row-scoped. Mutating one row in `users` invalidates *every* cached query that reads `users`. That keeps correctness simple and cheap — at the cost of some over-invalidation on hot tables.

:::tip
For a table with frequent writes and a few expensive reads, prefer short TTLs over relying on invalidation alone — KV's eventual consistency means an invalidate may take a moment to propagate globally.
:::
