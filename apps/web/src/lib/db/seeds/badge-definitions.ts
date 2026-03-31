import { db } from "@/lib/db";
import { badges } from "@/lib/db/schema/gamification";

const BADGE_DEFINITIONS = [
	{
		slug: "first_dig",
		name: "FIRST_DIG",
		description: "Completed your first Discogs import",
	},
	{
		slug: "century_club",
		name: "CENTURY_CLUB",
		description: "100 records in your collection",
	},
	{
		slug: "rare_find",
		name: "RARE_FIND",
		description: "Added an Ultra Rare record (rarity >= 2.0)",
	},
	{
		slug: "critic",
		name: "CRITIC",
		description: "Wrote your first review",
	},
	{
		slug: "connector",
		name: "CONNECTOR",
		description: "Completed your first trade",
	},
	{
		slug: "crew_member",
		name: "CREW_MEMBER",
		description: "Joined your first community group",
	},
];

async function seedBadges() {
	await db.insert(badges).values(BADGE_DEFINITIONS).onConflictDoNothing();
	console.log(`Seeded ${BADGE_DEFINITIONS.length} badge definitions.`);
}

seedBadges()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
