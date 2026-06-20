---
title: How it works
description: The KV key layout and the table-index invalidation model.
---

## Key layout

Two kinds of keys live in your KV namespace, both under the configurable `prefix` (default `drizzle`):

| Key                      | Holds                                              |
| ------------------------ | -------------------------------------------------- |
| `{prefix}:q:{hash}`      | The JSON-serialized result of one cached query.    |
| `{prefix}:tindex:{table}`| A reverse index: the query hashes that read `table`.|

## Read path

1. Drizzle hashes the query and calls `get(hash)`.
2. The adapter reads `{prefix}:q:{hash}` as JSON.
3. Hit → return rows. Miss → Drizzle runs the query, then calls `put(...)`.

## Write path (`put`)

1. Store the result at `{prefix}:q:{hash}` with the resolved TTL.
2. For each table the query referenced, append the hash to `{prefix}:tindex:{table}`.

The table index is written with **double the query TTL**, so a late-arriving index write never outlives its usefulness while still surviving its queries.

## Invalidation path (`onMutate`)

1. Resolve the mutated table names.
2. For each, read its `{prefix}:tindex:{table}` list.
3. Delete every query key in the list, then delete the index itself.

## Trade-offs

- **Eventual consistency.** KV propagates globally with a short delay. A just-invalidated key may serve a stale value for a moment in another region.
- **60s minimum TTL.** Enforced by KV; the adapter clamps anything lower.
- **Best-effort index.** The reverse index uses last-write-wins. Under heavy concurrent writes to the same table, a racing index update can drop an entry — but TTLs guarantee everything still expires, so caches never leak indefinitely.
