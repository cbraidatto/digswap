# BUILD-01 React Alignment

## Objective

Align the desktop workspace to React 19 so the monorepo no longer compiles the web app with split React type majors.

## Diagnosis

- `apps/web` depends on `react@19` / `@types/react@19`
- `apps/desktop` depends on `react@18` / `@types/react@18`
- `tsc --traceResolution` for `apps/web` resolves both `@types/react@18` and `@types/react@19`
- The mixed major types produce the `import("@types/react@19").ReactNode` vs `React.ReactNode` mismatch and the widespread JSX invalid-component errors

## Plan

1. Bump `apps/desktop` to React 19 and matching type packages
2. Run `pnpm install` at the workspace root to consolidate the virtual store
3. Re-run `apps/web` typecheck to measure the remaining real errors
4. Only after that, address the smaller straggler errors one by one
