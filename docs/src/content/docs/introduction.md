---
title: Introduction
description: What the Drizzle Cloudflare KV cache adapter is, and when to reach for it.
---

![Drizzle Cloudflare KV Cache Adapter — Cloudflare KV-backed query caching for Drizzle ORM](../../assets/banner.png)

A [Cloudflare KV](https://developers.cloudflare.com/kv/)-backed implementation of Drizzle ORM's [cache](https://orm.drizzle.team/docs/cache) interface. It caches read-heavy Drizzle queries at the edge using the KV namespace you already have bound to your Worker.

:::note
This is **not** a database driver. It only implements Drizzle's query cache layer — `.$withCache()` and `db.$cache.invalidate(...)`.
:::

## Why

Drizzle's cache layer ships with a Redis/Upstash adapter out of the box. On Cloudflare Workers + D1 you usually don't want to add a Redis dependency just to cache a few hot queries. KV is already there, globally replicated, and free-tier friendly — so use it.

## When it fits

- Read-heavy queries that tolerate brief staleness (config, catalogs, public profiles).
- Workers / D1 apps that want caching without new infrastructure.
- Anything where a 60-second-or-more TTL is acceptable.

## When it does **not** fit

- Read-after-write strong consistency. KV is eventually consistent.
- Sub-60-second freshness. KV enforces a 60s minimum TTL.
- Per-row caching with high write churn — invalidation is table-scoped.

## Requirements

- `drizzle-orm >= 0.44.0`
- A bound `KVNamespace` in your Worker (`env.CACHE` or similar).
