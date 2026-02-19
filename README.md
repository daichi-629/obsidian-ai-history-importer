# Obsidian Sample Monorepo Plugin

Two-package monorepo template based on the Obsidian sample plugin:

- `packages/core`: Obsidian-independent logic.
- `packages/plugin`: Obsidian plugin that depends on `core`.

## Quick start

```bash
pnpm install
pnpm run dev --filter plugin
```

When the plugin build starts, it also ensures the `hot-reload` plugin is installed into the local vault plugin directory from <https://github.com/pjeby/hot-reload>.

## Run Obsidian in Docker

A local vault directory is included at `./vault` and mounted into the container at `/config/vault`.

```bash
docker compose up -d
```

This uses `linuxserver/obsidian` via `docker-compose.yml`.

## Build

```bash
pnpm run build
```

## Notes

- Plugin entry: `packages/plugin/src/main.ts`
- Build output: `packages/plugin/main.js`
- On build/watch, `main.js`, `manifest.json`, and `styles.css` are copied to:
  - `vault/.obsidian/plugins/sample-monorepo-plugin/`
- On first build/watch run, `hot-reload` is cloned and copied to:
  - `vault/.obsidian/plugins/hot-reload/`

## Lint

```bash
pnpm run lint
```

## Test

```bash
pnpm --filter @sample/core run test
```

Tests live under `packages/core/__tests__` and are configured by
`packages/core/vitest.config.mts`.

## Releasing

- Update `packages/plugin/manifest.json` version and minimum app version.
- Push a tag like `v1.2.3` to trigger the release workflow.
- The release workflow uploads `packages/plugin/manifest.json`, `packages/plugin/main.js`,
  and `packages/plugin/styles.css`.
