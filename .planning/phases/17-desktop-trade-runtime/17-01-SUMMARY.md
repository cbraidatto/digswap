---
phase: 17-desktop-trade-runtime
plan: 17-01
subsystem: workspace
tags: [pnpm-workspaces, monorepo, electron, trade-domain, zod, bootstrap]

# Dependency graph
requires: [ADR-002]
provides:
  - "pnpm workspace monorepo with apps/web, apps/desktop, and packages/trade-domain"
  - "Existing Next.js app relocated under apps/web with workspace-aware package and tsconfig"
  - "Desktop workspace placeholder package ready for Electron shell work in 17-02"
  - "Pure trade-domain contract package with protocol constants, trade statuses, and Zod schemas"
affects: [17-02, 17-03, 17-04, 17-05, 17-06]

# Tech tracking
tech-stack:
  added: [pnpm-workspaces, typescript-project-references, zod-trade-domain-package]
  patterns: [apps-packages-monorepo, pure-domain-contracts, workspace-script-delegation]

key-files:
  created:
    - "pnpm-workspace.yaml"
    - "tsconfig.base.json"
    - "apps/web/package.json"
    - "apps/web/tsconfig.json"
    - "apps/desktop/package.json"
    - "apps/desktop/tsconfig.json"
    - "apps/desktop/src/index.ts"
    - "packages/trade-domain/package.json"
    - "packages/trade-domain/tsconfig.json"
    - "packages/trade-domain/src/index.ts"
    - "packages/trade-domain/src/constants.ts"
    - "packages/trade-domain/src/status.ts"
    - "packages/trade-domain/src/protocol.ts"
    - "packages/trade-domain/src/runtime.ts"
  modified:
    - "package.json"
    - "tsconfig.json"
    - "biome.json"
    - ".gitignore"
    - "drizzle.config.ts"
  moved:
    - "src -> apps/web/src"
    - "public -> apps/web/public"
    - "tests -> apps/web/tests"
    - "scripts -> apps/web/scripts"
    - "next.config.ts -> apps/web/next.config.ts"
    - "next-env.d.ts -> apps/web/next-env.d.ts"
    - "postcss.config.mjs -> apps/web/postcss.config.mjs"
    - "components.json -> apps/web/components.json"
    - "vitest.config.ts -> apps/web/vitest.config.ts"
    - "playwright.config.ts -> apps/web/playwright.config.ts"
    - ".env.local.example -> apps/web/.env.local.example"

key-decisions:
  - "Converted the repository root into a workspace container and delegated app scripts to workspace packages"
  - "Kept infra roots (supabase/, drizzle/, drizzle.config.ts) at repository root for now to avoid coupling this bootstrap with backend relocation"
  - "Kept packages/trade-domain framework-free: only TypeScript + Zod imports, no Next.js, Supabase, Drizzle, or React"
  - "Scoped apps/desktop to a minimal placeholder package so 17-02 can focus on the Electron shell instead of repository plumbing"

patterns-established:
  - "Shared compiler options live in tsconfig.base.json; root tsconfig.json is references-only"
  - "apps/web owns all existing Next.js runtime code and its app-local tooling configs"
  - "packages/trade-domain exports only contract modules via a flat index.ts barrel"
  - "Protocol and runtime policy constants are centralized in trade-domain rather than spread across apps"

requirements-completed: [DESK-01]

# Metrics
duration: 1h
completed: 2026-03-31
---

# Phase 17 Plan 01: Monorepo Bootstrap + trade-domain Skeleton Summary

**Repository restructured into a pnpm workspace monorepo, existing web app moved to `apps/web`, `apps/desktop` scaffolded as a placeholder package, and `packages/trade-domain` created as a pure shared contract boundary.**

## Accomplishments

- Replaced the root app package with a workspace container and added `pnpm-workspace.yaml` plus shared TypeScript base config.
- Relocated the current Next.js app into `apps/web` without changing its runtime code structure, and added workspace-local `package.json` and `tsconfig.json`.
- Added `apps/desktop` as a minimal package that already depends on `@digswap/trade-domain`, giving Phase 17-02 a stable starting point.
- Created the initial `packages/trade-domain` surface with protocol versioning, transfer constants, trade status transitions, wire-message Zod schemas, runtime lease schemas, handoff schemas, and received-file-store descriptors.
- Updated root tooling paths so workspace linting and Drizzle schema resolution still work after the move.

## Verification

- `pnpm --dir packages/trade-domain exec tsc --noEmit` passes.
- `pnpm --dir apps/desktop exec tsc --noEmit` passes.
- `pnpm --filter @digswap/desktop dev` resolves and runs the placeholder script successfully.
- `Select-String -Path 'packages\\trade-domain\\src\\*.ts' -Pattern 'next/|drizzle|supabase|react'` returns no matches.
- `pnpm install --lockfile-only` succeeds and produces `pnpm-lock.yaml`.

## Deviations from Plan

### Verification gap: apps/web typecheck still fails on pre-existing issues

- **Planned check:** `pnpm --dir apps/web exec tsc --noEmit`
- **Result:** fails due to existing application/test typing issues that were surfaced from the relocated web package, not introduced by the workspace bootstrap.
- **Representative errors:**
  - `apps/web/src/app/(protected)/(community)/comunidade/[slug]/_components/group-detail-header.tsx`: missing exported `Group` member from `@/lib/community/queries`
  - `apps/web/src/app/(protected)/(profile)/perfil/_components/edit-profile-modal.tsx`: `string | undefined` assignment mismatch
  - multiple existing test typing failures under `apps/web/tests/integration` and `apps/web/tests/unit`
- **Impact:** does not block Phase 17-02 desktop shell work or the use of `packages/trade-domain`, but the web package is not yet clean under standalone `tsc`.

## Files Created/Modified

- `package.json` - workspace root scripts delegating to `@digswap/web` and `@digswap/desktop`
- `pnpm-workspace.yaml` - workspace discovery for `apps/*` and `packages/*`
- `tsconfig.base.json` - shared compiler options for all workspace packages
- `tsconfig.json` - project references for `apps/web`, `apps/desktop`, and `packages/trade-domain`
- `biome.json` - workspace-aware include globs
- `drizzle.config.ts` - schema path updated to `apps/web/src/lib/db/schema`
- `apps/web/package.json` - existing Next.js app converted into `@digswap/web`
- `apps/web/tsconfig.json` - local Next.js TypeScript config extending the workspace base
- `apps/desktop/package.json` - placeholder desktop package with dependency on `@digswap/trade-domain`
- `packages/trade-domain/src/*.ts` - initial shared trade contracts and validation schemas

## Next Phase Readiness

- Phase 17-02 can start on the Electron shell without reopening repository structure decisions.
- `packages/trade-domain` is ready for Claude-owned contract expansion as new runtime needs appear.
- The web handoff/version-gate work in 17-05 can target `apps/web` directly.
- A future cleanup pass is still needed to bring `apps/web` back to a clean standalone `tsc` state.

## Self-Check: PASSED WITH ONE KNOWN VERIFICATION GAP

Workspace bootstrap, desktop placeholder scaffolding, and trade-domain purity checks all passed. The only failed verification is the pre-existing `apps/web` TypeScript debt noted above.

---
*Phase: 17-desktop-trade-runtime*
*Completed: 2026-03-31*
