# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-20

### Added

- `cloudflareKVCache(kv, options?)` factory and `CloudflareKVCache` class — a
  Cloudflare KV-backed implementation of Drizzle ORM's query cache interface.
- `explicit` (default) and `all` caching strategies.
- Per-table reverse index for invalidation on mutation, storing full storage keys.
- Tag-based caching and invalidation: `.$withCache({ tag })` entries are stored
  under `{prefix}:t:{tag}` and dropped via `invalidate({ tags })`.
- TTL resolution from `ex` (seconds) and `px` (milliseconds), clamped to KV's
  60-second minimum; configurable `defaultTtlSeconds` and key `prefix`.
- Documentation site (Astro + Starlight) deployed to Cloudflare Workers.

[Unreleased]: https://github.com/BitByBit-B3/drizzle-cloudflare-kv-cache-adapter/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/BitByBit-B3/drizzle-cloudflare-kv-cache-adapter/releases/tag/v0.1.0
