#!/usr/bin/env node
// scripts/drizzle-prod-guard.mjs
// Phase 33 SYSTEMIC #0 fix — refuses drizzle-kit push/migrate if DATABASE_URL
// points at the prod Supabase project. See ADR-003.
//
// Prod Supabase connection strings contain the project ref in the host, e.g.
//   postgresql://postgres.<prod-ref>:password@aws-0-<region>.pooler.supabase.com:6543/postgres
//
// The guard fires when the URL contains any ref listed in DRIZZLE_PROD_REFS
// (comma-separated env var set once on the dev machine after Phase 34 creates the prod project).

const url = process.env.DATABASE_URL ?? "";
const prodRefs = (process.env.DRIZZLE_PROD_REFS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const looksLikeProd = prodRefs.some((ref) => ref && url.includes(ref));

if (looksLikeProd) {
  console.error(
    "\u2717 drizzle-kit is NEVER used against prod. Apply migrations via `supabase db push`. See ADR-003.",
  );
  process.exit(1);
}

console.log("\u2713 drizzle-kit guard: DATABASE_URL is not prod.");
