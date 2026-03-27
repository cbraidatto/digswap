ALTER TABLE "profiles" ADD COLUMN "showcase_searching_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "showcase_rarest_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "showcase_favorite_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_showcase_searching_fk" FOREIGN KEY ("showcase_searching_id") REFERENCES "public"."releases"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_showcase_rarest_fk" FOREIGN KEY ("showcase_rarest_id") REFERENCES "public"."releases"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_showcase_favorite_fk" FOREIGN KEY ("showcase_favorite_id") REFERENCES "public"."releases"("id") ON DELETE SET NULL ON UPDATE no action;
