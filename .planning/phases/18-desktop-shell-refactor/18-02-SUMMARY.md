---
phase: 18-desktop-shell-refactor
plan: 18-02
subsystem: renderer-trade
tags: [electron, renderer-trade, lobby, transfer, completion, tailwind]

requires: [18-01]
provides:
  - "Dedicated local trade renderer at src/renderer/renderer-trade/ with lobby/transfer/completion flow"
  - "Second Vite build entry point producing out/renderer/renderer-trade/index.html"
  - "Trade window loads renderer-trade in both dev and prod"
affects: [18-03]

tech-stack:
  added: []
  patterns: [multi-page-vite, dedicated-trade-renderer, state-machine-lobby-transfer-completion]

key-files:
  created:
    - "apps/desktop/src/renderer/renderer-trade/index.html"
    - "apps/desktop/src/renderer/renderer-trade/main.tsx"
    - "apps/desktop/src/renderer/renderer-trade/app.tsx"
    - "apps/desktop/src/renderer/renderer-trade/LobbyScreen.tsx"
    - "apps/desktop/src/renderer/renderer-trade/TransferScreen.tsx"
    - "apps/desktop/src/renderer/renderer-trade/CompletionScreen.tsx"
    - "apps/desktop/src/renderer/renderer-trade/styles.css"
    - ".planning/phases/18-desktop-shell-refactor/18-02-SUMMARY.md"
  modified:
    - "apps/desktop/electron.vite.config.ts"
    - "apps/desktop/src/main/window.ts"
  deleted: []

key-decisions:
  - "renderer-trade placed inside src/renderer/ so it shares the electron-vite renderer root without config changes"
  - "Dev mode: trade window loads ${ELECTRON_RENDERER_URL}/renderer-trade/index.html"
  - "Prod mode: trade window loads out/renderer/renderer-trade/index.html via loadFile"
  - "app.tsx bootstraps from getBootstrapState() and subscribes to onProtocolPayload for live handoffs"
  - "No auth/login/inbox/settings in renderer-trade — those live in the remote main window"

patterns-established:
  - "Trade renderer consumes only window.desktopBridge (privileged preload) — no Electron imports"
  - "State machine: idle → lobby → transfer → completion, collapsing back to idle on close/done"

requirements-completed: [DESK-09]

completed: 2026-03-31
---

# Phase 18 Plan 02 Summary

## Outcome

Dedicated local trade renderer created at `apps/desktop/src/renderer/renderer-trade/`. The trade window now loads this focused entry point instead of the old all-purpose mini-app.

## Delivered

- `renderer-trade/index.html` — HTML entry with tight CSP (no remote scripts)
- `renderer-trade/main.tsx` — React entry point
- `renderer-trade/app.tsx` — state machine: loading → idle → lobby → transfer → completion. Bootstraps from `getBootstrapState()`, subscribes to `onProtocolPayload` for live handoffs
- `renderer-trade/LobbyScreen.tsx` — lobby UI (from existing renderer, no changes needed)
- `renderer-trade/TransferScreen.tsx` — transfer progress UI
- `renderer-trade/CompletionScreen.tsx` — completion + rating UI
- `renderer-trade/styles.css` — `@import "tailwindcss"` + base resets

`electron.vite.config.ts` updated with multi-page input:
```
input: {
  main: src/renderer/index.html,
  trade: src/renderer/renderer-trade/index.html,
}
```

`window.ts` updated:
- `resolveTradeRendererFilePath()` → `../renderer/renderer-trade/index.html`
- Dev URL → `${ELECTRON_RENDERER_URL}/renderer-trade/index.html`

## Verification

- `pnpm --dir apps/desktop exec tsc --noEmit` — passes
- `pnpm --dir apps/desktop build` — passes, outputs both `out/renderer/index.html` and `out/renderer/renderer-trade/index.html`

## Notes for 18-03

The old standalone screens (LoginScreen, InboxScreen, SettingsScreen) remain in `src/renderer/src/` but are no longer the content of any active window. Session sync (18-03) will complete the flow so the trade runtime gets auth from the web app login instead of the local magic link flow.
