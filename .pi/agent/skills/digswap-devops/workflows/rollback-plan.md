# Workflow: Rollback Plan

## Objective

Revert a broken DigSwap production deployment quickly and safely. Use when a deploy introduces critical errors, data corruption, or service degradation.

## Read First

- [references/vercel-deploy-patterns.md](../references/vercel-deploy-patterns.md)
- [references/supabase-production.md](../references/supabase-production.md)
- [references/monitoring-observability.md](../references/monitoring-observability.md)

## Decision Tree: Rollback vs Hotfix

```
Is the app completely down or losing user data?
  YES --> Immediate rollback (Section 1)
  NO  --> Is the bug isolated to one feature?
           YES --> Can you ship a fix in < 15 minutes?
                    YES --> Hotfix (Section 5)
                    NO  --> Rollback (Section 1)
           NO  --> Rollback (Section 1)
```

## 1. Vercel: Instant Rollback

Vercel keeps every deployment immutable. Rollback is instant:

1. Open Vercel dashboard > Deployments.
2. Find the last known-good deployment.
3. Click the three-dot menu > "Promote to Production".
4. The previous deployment is live immediately (no rebuild needed).
5. **Verify**: Hit the production URL and confirm the broken behavior is gone.

No DNS changes, no rebuild, no downtime. This is the fastest recovery path.

## 2. Supabase: Database Recovery

If the broken deploy included a database migration:

### Option A: Rollback SQL (preferred)
1. Locate the rollback SQL file prepared during the deploy-readiness workflow.
2. Connect to the production database via Supabase SQL Editor or `psql`.
3. Run the rollback SQL within a transaction: `BEGIN; <rollback SQL>; COMMIT;`
4. **Verify**: Query the affected tables to confirm schema/data is restored.

### Option B: Point-in-Time Recovery (Pro plan only)
1. In Supabase dashboard > Database > Backups > Point-in-Time Recovery.
2. Select a timestamp before the migration was applied.
3. Restore to a new project or branch to verify first.
4. If verified, restore the production database.
5. **Warning**: PITR rolls back ALL changes since that timestamp, not just the migration.

### Option C: Daily Backup Restore (Free tier)
1. In Supabase dashboard > Database > Backups.
2. Download the most recent daily backup.
3. Restore to a branch database to verify.
4. Apply the restore to production only if PITR is not available.

## 3. Upstash Redis: Cache Recovery

If corrupted cache data is causing issues:

1. Identify the affected key patterns (e.g., `handoff:*`, `ratelimit:*`, leaderboard keys).
2. Use Upstash console > Data Browser to inspect keys.
3. Delete specific key patterns: use `DEL` for individual keys or `SCAN` + `DEL` for patterns.
4. **Do not FLUSHALL** unless absolutely certain no other data matters. Rate limit state and handoff tokens are ephemeral and will regenerate.
5. **Verify**: Confirm the app behavior returns to normal after cache clear.

## 4. Stripe: Webhook Recovery

If a broken deploy caused webhook processing failures:

1. Stripe automatically retries failed webhooks for up to 72 hours with exponential backoff.
2. In Stripe dashboard > Developers > Webhooks > select endpoint > view failed events.
3. After the rollback or fix is deployed, manually retry failed events from the Stripe dashboard.
4. Check the `subscriptions` table in Supabase for any drift between Stripe state and DB state.
5. **Verify**: Compare subscription status in Stripe with the corresponding rows in the database.

## 5. Hotfix Path

If a rollback is not needed and a quick fix is viable:

1. Create a branch from `main` (not from the broken branch).
2. Apply the minimal fix.
3. Run `npm run build && npm run test && npm run typecheck` locally.
4. Push directly to `main` (or merge a fast PR).
5. Vercel will auto-deploy. Monitor Sentry for the error resolution.
6. **Verify**: The specific error no longer appears in Sentry within 5 minutes of deploy.

## Post-Incident

After any rollback or hotfix:

1. Document what broke and why in a brief incident note.
2. Identify the gap in the deploy-readiness checklist that allowed it through.
3. Add a test or check to prevent recurrence.
