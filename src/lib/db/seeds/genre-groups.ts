import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema/groups";
import { DISCOGS_GENRES } from "@/lib/discogs/taxonomy";
import { slugify } from "@/lib/community/slugify";

const SYSTEM_USER_ID =
	process.env.SYSTEM_USER_ID ?? "00000000-0000-0000-0000-000000000000";

const GENRE_DESCRIPTIONS: Record<string, string> = {
	Blues: "Blues diggers and collectors",
	"Brass & Military": "Brass band and military music collectors",
	"Children's": "Children's music collectors",
	Classical: "Classical music diggers",
	Electronic: "All things electronic music",
	"Folk, World, & Country": "Folk, world music, and country collectors",
	"Funk / Soul": "Funk and soul crate diggers",
	"Hip Hop": "Hip hop heads and crate diggers",
	Jazz: "Jazz diggers unite",
	Latin: "Latin music collectors",
	"Non-Music": "Non-music audio collectors",
	Pop: "Pop music collectors",
	Reggae: "Reggae and dub collectors",
	Rock: "Rock vinyl diggers",
	"Stage & Screen": "Soundtrack and musical theatre collectors",
};

async function seedGenreGroups() {
	const values = DISCOGS_GENRES.map((genre) => ({
		creatorId: SYSTEM_USER_ID,
		name: genre,
		slug: slugify(genre),
		description: GENRE_DESCRIPTIONS[genre] ?? `${genre} collectors`,
		category: genre,
		visibility: "public" as const,
		memberCount: 0,
	}));

	await db.insert(groups).values(values).onConflictDoNothing();
	console.log(`Seeded ${values.length} genre groups.`);
}

seedGenreGroups()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
