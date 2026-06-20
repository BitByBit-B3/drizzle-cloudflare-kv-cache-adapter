# Contributing to drizzle-cloudflare-kv-cache-adapter

Thank you for considering contributing! This project is maintained by the **BitByBit (B3)** organization (lead maintainer: **prdai**), and we welcome contributions from the community.

## How to Contribute

### Reporting Bugs

If you encounter a bug, please [open an issue](https://github.com/BitByBit-B3/drizzle-cloudflare-kv-cache-adapter/issues) with:

- A clear and descriptive title
- A detailed description of the bug
- Steps to reproduce it (ideally a minimal repro)
- Your `drizzle-orm` version and runtime (Workers, Node, etc.)
- Any relevant logs or code snippets

### Suggesting Enhancements

Have an idea to improve the project? Open an issue with:

- A clear and descriptive title
- A detailed description of the enhancement and the problem it solves
- Any relevant examples or API sketches

### Submitting Pull Requests

1. Fork the repository and create your branch from `main`.
2. Make your change. If you add or change behavior, **add tests**.
3. Run the full check suite locally (see below) and make sure it passes.
4. Open a pull request with a clear description and reference any related issues.

## Development Setup

This project uses [Bun](https://bun.sh) as the package manager.

```sh
# install dependencies (also installs the git hooks via lefthook)
bun install

# run the test suite
bun test

# type-check
bun run typecheck

# lint + format check
bun run lint

# auto-fix formatting and safe lint issues
bun run format

# build the library (ESM + types)
bun run build
```

The documentation site lives in [`docs/`](./docs) and is a separate package:

```sh
cd docs
bun install
bun run dev      # local preview
bun run build    # static build
```

## Git Hooks

[Lefthook](https://lefthook.dev) is installed automatically on `bun install`:

- **pre-commit** — runs [Biome](https://biomejs.dev) on staged files (lint + format, auto-fixing where safe).
- **pre-push** — runs `typecheck`, `test`, and `build`.

If you ever need to bypass a hook in an emergency, use `git commit --no-verify` (please don't make a habit of it).

## Code Style

Code style is enforced by Biome (single quotes, no semicolons, 2-space indent). Run `bun run format` before committing — the pre-commit hook will also handle it. Match the conventions already present in the surrounding code.

## Changelog

User-facing changes should be noted in [`CHANGELOG.md`](./CHANGELOG.md) under the `[Unreleased]` section, following the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it.

Thank you for contributing! 🙌
