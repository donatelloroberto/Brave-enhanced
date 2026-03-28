# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the **BrowseHere Stream Player** — a TCL TV-style streaming video player web app that scans any webpage for video sources and plays them in a custom HTML5 player.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Zustand, Framer Motion, hls.js, Tailwind CSS

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (detect + playlist routes)
│   └── tcl-player/         # React + Vite frontend (TCL TV-style UI)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## App Features

- **URL Scanner**: Paste any webpage URL → backend fetches the page and detects all video sources (MP4, HLS, DASH, WebM, iframes)
- **Direct stream support**: Paste a `.m3u8` or `.mp4` URL directly to play it instantly
- **Dynamic Playlist**: Detected videos show in the sidebar with type badges
- **Persistent Playlist**: Save detected videos to the DB; they persist across sessions
- **Custom HTML5 Player**: Full-screen capable, play/pause, seek, volume, CC toggle, keyboard shortcuts
- **HLS Streaming**: Uses `hls.js` for HLS (`.m3u8`) streams
- **TCL TV-inspired UI**: Dark cinematic interface with cyan accents

## API Endpoints

All routes under `/api/`:
- `GET /api/healthz` — health check
- `POST /api/detect` — scan a URL for video sources
- `GET /api/playlist` — fetch saved playlist
- `POST /api/playlist` — add video to playlist
- `DELETE /api/playlist/:id` — remove from playlist

## Database Schema

- `playlist` table: `id`, `url`, `type`, `title`, `quality`, `duration`, `thumbnail`, `source_host`, `added_at`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/tcl-player run dev` — run the frontend
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API clients from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm run typecheck` — full type check
