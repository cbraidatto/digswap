CREATE TABLE "collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"release_id" uuid,
	"discogs_instance_id" integer,
	"condition_grade" varchar(10),
	"notes" text,
	"added_via" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"icon_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badges_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "badges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_badges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rarity_score" real DEFAULT 0 NOT NULL,
	"contribution_score" real DEFAULT 0 NOT NULL,
	"global_rank" integer,
	"title" varchar(100),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_rankings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_rankings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "group_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"category" varchar(100),
	"visibility" varchar(20) DEFAULT 'public' NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"total_items" integer DEFAULT 0,
	"processed_items" integer DEFAULT 0,
	"current_page" integer DEFAULT 1,
	"total_pages" integer,
	"current_record" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(50),
	"username" varchar(30),
	"avatar_url" text,
	"bio" text,
	"discogs_username" varchar(100),
	"discogs_connected" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp with time zone,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"subscription_tier" varchar(20) DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "backup_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "backup_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"device_info" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "user_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discogs_id" integer,
	"title" varchar(500) NOT NULL,
	"artist" varchar(500) NOT NULL,
	"year" integer,
	"genre" text[],
	"style" text[],
	"country" varchar(100),
	"format" varchar(100),
	"label" varchar(500),
	"cover_image_url" text,
	"discogs_have" integer DEFAULT 0 NOT NULL,
	"discogs_want" integer DEFAULT 0 NOT NULL,
	"rarity_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "releases_discogs_id_unique" UNIQUE("discogs_id")
);
--> statement-breakpoint
ALTER TABLE "releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "activity_feed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"target_type" varchar(50),
	"target_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_feed" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" uuid NOT NULL,
	"following_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_unique_pair" UNIQUE("follower_id","following_id")
);
--> statement-breakpoint
ALTER TABLE "follows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trade_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"release_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trade_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"reviewed_id" uuid NOT NULL,
	"quality_rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trade_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wantlist_match_inapp" boolean DEFAULT true NOT NULL,
	"wantlist_match_email" boolean DEFAULT true NOT NULL,
	"trade_request_inapp" boolean DEFAULT true NOT NULL,
	"trade_request_email" boolean DEFAULT true NOT NULL,
	"trade_completed_inapp" boolean DEFAULT true NOT NULL,
	"ranking_change_inapp" boolean DEFAULT true NOT NULL,
	"new_badge_inapp" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50),
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"trades_this_month" integer DEFAULT 0 NOT NULL,
	"trades_month_reset" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wantlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"release_id" uuid,
	"notes" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"added_via" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wantlist_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(200),
	"body" text,
	"is_pressing_specific" boolean DEFAULT false NOT NULL,
	"pressing_details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_posts" ADD CONSTRAINT "group_posts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_requests" ADD CONSTRAINT "trade_requests_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_reviews" ADD CONSTRAINT "trade_reviews_trade_id_trade_requests_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wantlist_items" ADD CONSTRAINT "wantlist_items_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "collection_items_select_all" ON "collection_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "collection_items_insert_own" ON "collection_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("collection_items"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "collection_items_update_own" ON "collection_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("collection_items"."user_id" = (select auth.uid())) WITH CHECK ("collection_items"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "collection_items_delete_own" ON "collection_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("collection_items"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "badges_select_all" ON "badges" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "user_badges_select_all" ON "user_badges" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "user_badges_insert_service" ON "user_badges" AS PERMISSIVE FOR INSERT TO "supabase_auth_admin" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_rankings_select_all" ON "user_rankings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "user_rankings_update_own" ON "user_rankings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("user_rankings"."user_id" = (select auth.uid())) WITH CHECK ("user_rankings"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "group_members_select_all" ON "group_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "group_members_insert_own" ON "group_members" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("group_members"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "group_members_delete_own" ON "group_members" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("group_members"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "group_posts_select_all" ON "group_posts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "group_posts_insert_own" ON "group_posts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("group_posts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "group_posts_update_own" ON "group_posts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("group_posts"."user_id" = (select auth.uid())) WITH CHECK ("group_posts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "group_posts_delete_own" ON "group_posts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("group_posts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "groups_select_all" ON "groups" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "groups_insert_authenticated" ON "groups" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("groups"."creator_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "groups_update_creator" ON "groups" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("groups"."creator_id" = (select auth.uid())) WITH CHECK ("groups"."creator_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "groups_delete_creator" ON "groups" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("groups"."creator_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "import_jobs_select_own" ON "import_jobs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("import_jobs"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "import_jobs_insert_service" ON "import_jobs" AS PERMISSIVE FOR INSERT TO "supabase_auth_admin" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "import_jobs_update_service" ON "import_jobs" AS PERMISSIVE FOR UPDATE TO "supabase_auth_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "profiles_select_policy" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("profiles"."id" = (select auth.uid())) WITH CHECK ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_insert_own" ON "profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_delete_own" ON "profiles" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "backup_codes_select_own" ON "backup_codes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("backup_codes"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "backup_codes_update_own" ON "backup_codes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("backup_codes"."user_id" = (select auth.uid())) WITH CHECK ("backup_codes"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "backup_codes_insert_authenticated" ON "backup_codes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("backup_codes"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_sessions_select_own" ON "user_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_sessions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_sessions_insert_authenticated" ON "user_sessions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("user_sessions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_sessions_delete_own" ON "user_sessions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("user_sessions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "releases_select_all" ON "releases" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "releases_insert_service" ON "releases" AS PERMISSIVE FOR INSERT TO "supabase_auth_admin" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "releases_update_service" ON "releases" AS PERMISSIVE FOR UPDATE TO "supabase_auth_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "activity_feed_select_all" ON "activity_feed" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "activity_feed_insert_own" ON "activity_feed" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("activity_feed"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "follows_select_all" ON "follows" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "follows_insert_own" ON "follows" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("follows"."follower_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "follows_delete_own" ON "follows" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("follows"."follower_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "trade_requests_select_participant" ON "trade_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("trade_requests"."requester_id" = (select auth.uid()) OR "trade_requests"."provider_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "trade_requests_insert_authenticated" ON "trade_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("trade_requests"."requester_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "trade_requests_update_participant" ON "trade_requests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("trade_requests"."requester_id" = (select auth.uid()) OR "trade_requests"."provider_id" = (select auth.uid())) WITH CHECK ("trade_requests"."requester_id" = (select auth.uid()) OR "trade_requests"."provider_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "trade_reviews_select_all" ON "trade_reviews" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "trade_reviews_insert_own" ON "trade_reviews" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("trade_reviews"."reviewer_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notification_prefs_select_own" ON "notification_preferences" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("notification_preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notification_prefs_insert_own" ON "notification_preferences" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("notification_preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notification_prefs_update_own" ON "notification_preferences" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("notification_preferences"."user_id" = (select auth.uid())) WITH CHECK ("notification_preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notifications_select_own" ON "notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("notifications"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notifications_insert_own" ON "notifications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("notifications"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notifications_update_own" ON "notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("notifications"."user_id" = (select auth.uid())) WITH CHECK ("notifications"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "subscriptions_select_own" ON "subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "subscriptions_insert_service" ON "subscriptions" AS PERMISSIVE FOR INSERT TO "supabase_auth_admin" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "subscriptions_update_service" ON "subscriptions" AS PERMISSIVE FOR UPDATE TO "supabase_auth_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "wantlist_items_select_all" ON "wantlist_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "wantlist_items_insert_own" ON "wantlist_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("wantlist_items"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "wantlist_items_delete_own" ON "wantlist_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("wantlist_items"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "reviews_select_all" ON "reviews" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "reviews_insert_own" ON "reviews" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("reviews"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "reviews_update_own" ON "reviews" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("reviews"."user_id" = (select auth.uid())) WITH CHECK ("reviews"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "reviews_delete_own" ON "reviews" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("reviews"."user_id" = (select auth.uid()));