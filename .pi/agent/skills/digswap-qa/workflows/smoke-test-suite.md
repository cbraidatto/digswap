# Smoke Test Suite

## Objective

Post-deploy verification to confirm production is healthy. Run immediately after every deploy. Must complete in under 15 minutes.

## Automated Checks

Run these programmatically or via CI right after deploy.

### Health Endpoints

| Endpoint | Expected | Timeout |
|----------|----------|---------|
| `GET /` (homepage) | 200 OK, HTML body contains "DigSwap" | 5s |
| `GET /signin` | 200 OK, login form renders | 5s |
| `GET /signup` | 200 OK, signup form renders | 5s |
| `GET /api/health` (if exists) | 200 OK, JSON response | 3s |

### Auth Redirect

| Action | Expected |
|--------|----------|
| Visit `/colecao` unauthenticated | Redirect to `/signin` |
| Visit `/perfil` unauthenticated | Redirect to `/signin` |
| Visit `/configuracoes` unauthenticated | Redirect to `/signin` |

### Critical API Routes

| Route | Method | Expected |
|-------|--------|----------|
| `/api/webhooks/stripe` | POST with invalid signature | 400 or 401 (not 500) |

## Manual Checks

Perform these in a real browser on the production URL.

### Auth Flow (2 minutes)

1. Open homepage — loads without errors, no console errors
2. Click "Sign In" — form renders, fields are interactive
3. Sign in with test account — redirects to `/colecao`
4. Verify session persists across page refresh
5. Sign out — redirects to homepage

### Collection (2 minutes)

1. Navigate to collection page — records display in grid
2. Sort by different criteria — order updates
3. Open a record detail — metadata renders correctly
4. Check Discogs connection status badge

### Navigation (1 minute)

1. Bottom bar visible on mobile viewport
2. All nav links work (collection, discovery, community, profile)
3. Back button behavior is correct

## Third-Party Integration Checks

### Discogs (1 minute)

- Discogs OAuth settings page loads
- "Connect Discogs" button points to correct OAuth URL
- If connected: connection status shows username

### Stripe (1 minute)

- Pricing page loads with plan cards
- "Subscribe" button initiates Stripe Checkout redirect
- Stripe webhook endpoint responds to ping (not 500)

### Sentry / Error Monitoring (1 minute)

- Trigger a known safe error (e.g., visit `/404-test-page`)
- Verify error appears in Sentry dashboard within 60 seconds

## Smoke Test Failure Protocol

1. **Any automated check fails:** Roll back deploy immediately. Investigate before redeploying.
2. **Auth flow broken:** P0 incident. Roll back. Auth is the front door.
3. **Collection not loading:** P1 incident. Check Supabase connection, RLS policies, env vars.
4. **Third-party integration broken:** Assess impact. If Discogs-only, deploy can stay. If Stripe-only, P0 if billing features are live.
5. **Sentry not receiving errors:** Not a rollback trigger, but fix within 24h. Flying blind is dangerous.

## Duration Target

| Section | Time |
|---------|------|
| Automated checks | 1 minute |
| Manual auth flow | 2 minutes |
| Manual collection | 2 minutes |
| Manual navigation | 1 minute |
| Third-party checks | 3 minutes |
| **Total** | **< 10 minutes** |
