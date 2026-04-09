# Release Notes Template

## Release vX.Y.Z — Milestone MXXX

**Date:** YYYY-MM-DD
**Branch:** milestone/MXXX -> master
**Tag:** vX.Y.Z

---

### Highlights

_User-facing summary of what is new in this release. Write for someone who uses DigSwap, not someone who builds it._

- Highlight 1
- Highlight 2
- Highlight 3

### Changelog

#### Added
- Description of new feature (#PR)

#### Changed
- Description of changed behavior (#PR)

#### Fixed
- Description of bug fix (#PR)

#### Security
- Description of security improvement (#PR)

#### Removed
- Description of removed feature (#PR)

### Migration Notes

_List any actions required before or after deployment. Leave blank if none._

- [ ] Database migration: `supabase db push --linked` (apply BEFORE merge)
- [ ] New environment variable: `VARIABLE_NAME` — configure in Vercel dashboard
- [ ] Stripe webhook endpoint updated — verify in Stripe dashboard

### Known Issues

_Issues discovered during testing that are accepted for this release._

- None

### Rollback Instructions

If this release causes production issues:

1. **Immediate:** Promote the previous Vercel deployment via dashboard (Deployments > select last good > Promote to Production)
2. **If database migration was applied:** Assess whether a reverse migration is needed. Do NOT drop columns/tables without confirming no data loss.
3. **Notify:** Update any status page or team channel.
4. **Follow up:** Create a hotfix branch from master and follow [hotfix-flow.md](../workflows/hotfix-flow.md).
