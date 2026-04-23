CREATE TABLE "group_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"token" varchar(36) NOT NULL,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "group_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_posts" ADD COLUMN "release_id" uuid;--> statement-breakpoint
ALTER TABLE "group_posts" ADD COLUMN "review_id" uuid;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "slug" varchar(250) NOT NULL;--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_posts" ADD CONSTRAINT "group_posts_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_posts" ADD CONSTRAINT "group_posts_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_release" UNIQUE("user_id","release_id");--> statement-breakpoint
CREATE POLICY "group_invites_select_all" ON "group_invites" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "group_invites_insert_own" ON "group_invites" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("group_invites"."created_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "group_invites_delete_own" ON "group_invites" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("group_invites"."created_by" = (select auth.uid()));