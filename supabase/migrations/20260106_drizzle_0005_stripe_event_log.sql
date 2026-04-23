-- Migration: stripe_event_log — idempotency table for Stripe webhook events
-- Prevents double-processing on Stripe retries and duplicate deliveries.
-- The webhook handler inserts the event_id after successful processing;
-- on the next delivery of the same event it finds the row and returns 200 early.

CREATE TABLE IF NOT EXISTS stripe_event_log (
  event_id    TEXT        PRIMARY KEY,
  event_type  TEXT        NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);--> statement-breakpoint

-- RLS: authenticated users have zero access — only the service-role admin client
-- (used by the webhook handler) ever touches this table.
ALTER TABLE stripe_event_log ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "stripe_event_log_no_user_access"
  ON stripe_event_log
  FOR ALL
  TO authenticated
  USING (false);--> statement-breakpoint

-- Optional cleanup: remove events older than 30 days to bound table growth.
-- Enable with pg_cron: SELECT cron.schedule('cleanup-stripe-event-log', '0 3 * * *',
--   $$DELETE FROM stripe_event_log WHERE processed_at < NOW() - INTERVAL '30 days'$$);
