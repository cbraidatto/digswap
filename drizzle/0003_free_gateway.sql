ALTER TABLE "profiles" ADD COLUMN "trades_tos_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade_requests" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade_requests" ADD COLUMN "file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "trade_requests" ADD COLUMN "file_format" varchar(50);--> statement-breakpoint
ALTER TABLE "trade_requests" ADD COLUMN "declared_bitrate" varchar(50);--> statement-breakpoint
ALTER TABLE "trade_requests" ADD COLUMN "file_size_bytes" integer;--> statement-breakpoint
DROP POLICY "user_rankings_update_own" ON "user_rankings" CASCADE;--> statement-breakpoint
DROP POLICY "trade_requests_update_participant" ON "trade_requests" CASCADE;--> statement-breakpoint
ALTER POLICY "trade_reviews_insert_own" ON "trade_reviews" TO authenticated WITH CHECK ("trade_reviews"."reviewer_id" = (select auth.uid())
        AND EXISTS (
          SELECT 1 FROM trade_requests tr
          WHERE tr.id = "trade_reviews"."trade_id"
            AND tr.status = 'completed'
            AND (tr.requester_id = (select auth.uid()) OR tr.provider_id = (select auth.uid()))
            AND "trade_reviews"."reviewed_id" = CASE
              WHEN tr.requester_id = (select auth.uid()) THEN tr.provider_id
              ELSE tr.requester_id
            END
        ));