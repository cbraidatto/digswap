ALTER TABLE "profiles" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "cover_position_y" text DEFAULT '50' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "location" varchar(100);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "showcase_searching_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "showcase_rarest_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "showcase_favorite_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "youtube_url" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "instagram_url" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "soundcloud_url" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "discogs_url" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "beatport_url" text;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "youtube_video_id" varchar(20);--> statement-breakpoint
ALTER TABLE "wantlist_items" ADD COLUMN "found_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_badge_unique" UNIQUE("user_id","badge_id");--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_youtube_video_id_unique" UNIQUE("youtube_video_id");--> statement-breakpoint
CREATE POLICY "user_rankings_insert_service" ON "user_rankings" AS PERMISSIVE FOR INSERT TO "supabase_auth_admin" WITH CHECK (true);