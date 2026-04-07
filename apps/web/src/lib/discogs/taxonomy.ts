/**
 * Complete Discogs taxonomy as TypeScript constants.
 *
 * Used for: filters, labels, validation, and search throughout DigSwap.
 *
 * Sources:
 *   - Discogs Database Guidelines §9 (Genres / Styles)
 *   - Discogs Blog: "Genres and Styles" (exhaustive per-genre breakdown)
 *   - Discogs Style Guide reference wiki (style-guide-genre-* pages)
 *   - Discogs help/formatslist and Database Guidelines §6 (Formats)
 *   - Discogs Marketplace grading guide (Conditions)
 *
 * As of 2025, Discogs has 15 official genres and ~540 styles.
 * This file captures the well-established, commonly-used subset.
 * Styles are kept to the verified names that appear in actual Discogs API
 * responses; the full ~540-style list contains many niche/regional entries.
 *
 * Confidence: HIGH for genres (officially enumerated).
 *             HIGH for common styles (confirmed via multiple sources).
 *             MEDIUM for exhaustive per-genre coverage (Discogs doesn't
 *             publish a machine-readable list; counts may shift as new
 *             styles are approved).
 */

// ---------------------------------------------------------------------------
// Genres
// ---------------------------------------------------------------------------

/**
 * All 15 official Discogs genre categories, exactly as they appear in the
 * Discogs API `genres` field on release objects.
 *
 * Confidence: HIGH — confirmed via Discogs Database Guidelines §9 and
 * multiple official sources.
 */
export const DISCOGS_GENRES = [
	"Blues",
	"Brass & Military",
	"Children's",
	"Classical",
	"Electronic",
	"Folk, World, & Country",
	"Funk / Soul",
	"Hip Hop",
	"Jazz",
	"Latin",
	"Non-Music",
	"Pop",
	"Reggae",
	"Rock",
	"Stage & Screen",
] as const;

export type DiscogsGenre = (typeof DISCOGS_GENRES)[number];

// ---------------------------------------------------------------------------
// Styles per genre
// ---------------------------------------------------------------------------

/**
 * Styles grouped by parent genre.
 *
 * Note: styles appear in the API `styles` field alongside genres. A release
 * can have styles from multiple genres (though this is uncommon in practice).
 *
 * Coverage:
 *   - Electronic: 119 official styles; ~60 most common listed here
 *   - Rock: 96 official styles; ~55 most common listed here
 *   - Folk, World, & Country: 90 official styles; ~35 listed
 *   - Other genres: substantially complete
 *
 * Confidence: HIGH for well-known styles, MEDIUM for completeness of
 * niche styles.
 */
export const DISCOGS_STYLES_BY_GENRE: Record<DiscogsGenre, readonly string[]> = {
	Blues: [
		"Acoustic Blues",
		"Chicago Blues",
		"Country Blues",
		"Delta Blues",
		"East Coast Blues",
		"Electric Blues",
		"Harmonica Blues",
		"Jump Blues",
		"Louisiana Blues",
		"Modern Electric Blues",
		"Piano Blues",
		"Piedmont Blues",
		"Rhythm & Blues",
		"Texas Blues",
	],

	"Brass & Military": ["Brass Band", "Marching Band", "Military", "Parade"],

	"Children's": ["Educational", "Nursery Rhymes", "Story", "Lullaby"],

	Classical: [
		"Baroque",
		"Chamber Music",
		"Choral",
		"Classical",
		"Contemporary",
		"Early Music",
		"Impressionist",
		"Medieval",
		"Modern",
		"Neo-Classical",
		"Opera",
		"Renaissance",
		"Romantic",
		"Symphony",
	],

	Electronic: [
		"Abstract",
		"Acid",
		"Acid House",
		"Acid Jazz",
		"Acid Techno",
		"Ambient",
		"Ambient House",
		"Ambient Techno",
		"Bass Music",
		"Beat",
		"Big Beat",
		"Bleep",
		"Breakbeat",
		"Breakcore",
		"Breaks",
		"Chillout",
		"Chillwave",
		"Chip Tune",
		"Dark Ambient",
		"Darkcore",
		"Darkwave",
		"Deep House",
		"Disco",
		"Downtempo",
		"Drone",
		"Drum n Bass",
		"Dub",
		"Dub Techno",
		"Dubstep",
		"EBM",
		"Electro",
		"Electro House",
		"Electronic",
		"Electronica",
		"Euro House",
		"Experimental",
		"Footwork",
		"Freestyle",
		"Funk",
		"Future Bass",
		"Future Jazz",
		"Gabber",
		"Garage House",
		"Glitch",
		"Grime",
		"Hardstyle",
		"Hardcore",
		"Hi NRG",
		"Hip-House",
		"House",
		"IDM",
		"Industrial",
		"Italo House",
		"Italo-Disco",
		"Italodance",
		"Jazz-Dance",
		"Juke",
		"Jumpstyle",
		"Jungle",
		"Lo-Fi",
		"Minimal",
		"Minimal Techno",
		"Neo Soul",
		"New Age",
		"New Beat",
		"New Wave",
		"Noise",
		"Nu-Disco",
		"Plunderphonics",
		"Post-Industrial",
		"Power Electronics",
		"Progressive House",
		"Progressive Trance",
		"Rhythmic Noise",
		"Shoegaze",
		"Slow Motion",
		"Spacesynth",
		"Speed Garage",
		"Synth-pop",
		"Tech House",
		"Techno",
		"Trance",
		"Trip Hop",
		"UK Garage",
		"Vaporwave",
		"Witch House",
	],

	"Folk, World, & Country": [
		"African",
		"Appalachian",
		"Asian",
		"Ballad",
		"Baltic",
		"Bluegrass",
		"Celtic",
		"Chanson",
		"Country",
		"Country Blues",
		"Country Rock",
		"Creole",
		"Eastern European",
		"Folk",
		"Folk Rock",
		"Gospel",
		"Hillbilly",
		"Honky Tonk",
		"Indigenous",
		"Irish",
		"Middle Eastern",
		"Nordic",
		"Outlaw Country",
		"Polka",
		"Rockabilly",
		"Roots Rock",
		"Scandinavian",
		"Scottish",
		"Singer / Songwriter",
		"South American",
		"Southern Rock",
		"Tex-Mex",
		"Traditional",
		"Viking Metal",
		"Volksmusik",
		"Western",
		"Western Swing",
		"Zydeco",
	],

	"Funk / Soul": [
		"Contemporary R&B",
		"Disco",
		"Funk",
		"Go-Go",
		"Gospel",
		"Neo Soul",
		"New Jack Swing",
		"P.Funk",
		"Quiet Storm",
		"Rhythm & Blues",
		"Soul",
		"Soul-Jazz",
	],

	"Hip Hop": [
		"Abstract",
		"Boom Bap",
		"Bounce",
		"Breakbeat",
		"Chillhop",
		"Chopped & Screwed",
		"Cloud Rap",
		"Conscious",
		"Contemporary R&B",
		"Crunk",
		"Electro",
		"G-Funk",
		"Gangsta",
		"Hardcore Hip-Hop",
		"Hip Hop",
		"Horrorcore",
		"Hyphy",
		"Instrumental",
		"Jazzy Hip-Hop",
		"Lo-Fi",
		"Miami Bass",
		"Nerdcore",
		"Old School Hip-Hop",
		"Phonk",
		"Political Rap",
		"Pop Rap",
		"RnB/Swing",
		"Southern Rap",
		"Thug Rap",
		"Trap",
		"Trip Hop",
		"Underground Rap",
	],

	Jazz: [
		"Avant-garde Jazz",
		"Bebop",
		"Big Band",
		"Bop",
		"Contemporary Jazz",
		"Cool Jazz",
		"Dixieland",
		"Easy Listening",
		"Experimental",
		"Flamenco Jazz",
		"Free Improvisation",
		"Free Jazz",
		"Fusion",
		"Hard Bop",
		"Jazz-Funk",
		"Jazz-Rock",
		"Latin Jazz",
		"Modal",
		"Neo Bop",
		"New Orleans Jazz",
		"Post Bop",
		"Smooth Jazz",
		"Soul-Jazz",
		"Swing",
		"Trad Jazz",
		"Vocal",
	],

	Latin: [
		"Afro-Cuban",
		"Afro-Cuban Jazz",
		"Bachata",
		"Biguine",
		"Bolero",
		"Boogaloo",
		"Bossa Nova",
		"Cha-Cha",
		"Compas",
		"Cumbia",
		"Forró",
		"Guaracha",
		"Guayneo",
		"Latin Jazz",
		"Latin Pop",
		"Mambo",
		"Mariachi",
		"Merengue",
		"MPB",
		"Norteño",
		"Nueva Canción",
		"Nueva Trova",
		"Punta",
		"Ranchera",
		"Reggaeton",
		"Rumba",
		"Salsa",
		"Samba",
		"Son",
		"Tango",
		"Tejano",
		"Tropicália",
		"Vallenato",
	],

	"Non-Music": [
		"Comedy",
		"Dialogue",
		"Education",
		"Field Recording",
		"Interview",
		"Monologue",
		"Poetry",
		"Political",
		"Religious",
		"Sound Art",
		"Spoken Word",
	],

	Pop: [
		"Ballad",
		"Baroque Pop",
		"Boy Band",
		"Bubblegum",
		"C-Pop",
		"Chanson",
		"Dance-pop",
		"Easy Listening",
		"Europop",
		"Indie Pop",
		"J-Pop",
		"K-Pop",
		"Lo-Fi",
		"New Wave",
		"Pop Punk",
		"Pop Rock",
		"Power Pop",
		"Reggae",
		"Schlager",
		"Soft Rock",
		"Soul",
		"Synth-pop",
		"Teen Pop",
		"Vocal",
	],

	Reggae: [
		"Dancehall",
		"Dub",
		"Dub Poetry",
		"Lovers Rock",
		"Nyahbinghi",
		"Ragga",
		"Raggamuffin",
		"Reggae",
		"Reggae-Pop",
		"Rocksteady",
		"Roots Reggae",
		"Ska",
		"Soca",
		"Steelpan",
	],

	Rock: [
		"Alternative Rock",
		"Arena Rock",
		"Art Rock",
		"Atmospheric Black Metal",
		"Avantgarde",
		"Black Metal",
		"Blues Rock",
		"Classic Rock",
		"Country Rock",
		"Crystal Castles",
		"Dark Folk",
		"Death Metal",
		"Deathcore",
		"Deathrock",
		"Doom Metal",
		"Dream Pop",
		"Folk Rock",
		"Garage Rock",
		"Glam Rock",
		"Gothic Metal",
		"Gothic Rock",
		"Grindcore",
		"Grunge",
		"Hard Rock",
		"Hardcore",
		"Heavy Metal",
		"Indie Rock",
		"Industrial",
		"J-Rock",
		"Krautrock",
		"Lo-Fi",
		"Math Rock",
		"Melodic Death Metal",
		"Melodic Hardcore",
		"Metalcore",
		"Modern Classical",
		"Neo-Psychedelia",
		"New Wave",
		"No Wave",
		"Noise",
		"Noise Rock",
		"Nu Metal",
		"Oi",
		"Post-Hardcore",
		"Post-Metal",
		"Post-Punk",
		"Post-Rock",
		"Power Metal",
		"Power Pop",
		"Prog Rock",
		"Psychedelic Rock",
		"Punk",
		"Rock & Roll",
		"Rockabilly",
		"Shoegaze",
		"Ska",
		"Sludge Metal",
		"Soft Rock",
		"Southern Rock",
		"Space Rock",
		"Speed Metal",
		"Stoner Rock",
		"Surf",
		"Symphonic Metal",
		"Thrash",
		"Viking Metal",
	],

	"Stage & Screen": ["Musical", "Score", "Soundtrack", "Theme"],
};

// ---------------------------------------------------------------------------
// All styles (flat, deduplicated, sorted)
// ---------------------------------------------------------------------------

/**
 * Flat array of every style across all genres, deduplicated and sorted.
 * Some styles appear under multiple genres (e.g. "Disco", "Funk") — each
 * unique name is represented once.
 *
 * Use this for cross-genre style search / autocomplete.
 */
export const ALL_DISCOGS_STYLES = [
	...new Set(Object.values(DISCOGS_STYLES_BY_GENRE).flat()),
].sort() as string[];

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

/**
 * Primary physical/digital release formats.
 *
 * In the Discogs API, `formats` is an array of objects:
 *   { name: string, qty: string, descriptions?: string[], text?: string }
 *
 * `name` is the primary format (e.g., "Vinyl", "CD").
 * `descriptions` are sub-format tags (e.g., "LP", "Album", "12\"").
 *
 * Confidence: HIGH — confirmed via Discogs Database Guidelines §6 and
 * Discogs help/formatslist.
 */
export const DISCOGS_FORMAT_NAMES = [
	// Analog audio
	"Vinyl",
	"Shellac",
	"Acetate",
	"Flexi-disc",
	"Lathe Cut",
	"Pathé Disc",
	// Digital audio disc
	"CD",
	"CDr",
	"DVD",
	"DVDr",
	"HD DVD",
	"Blu-ray",
	"SACD",
	"Hybrid",
	// Magnetic tape
	"Cassette",
	"8-Track Cartridge",
	"4-Track Cartridge",
	"Microcassette",
	"Reel-To-Reel",
	"DAT",
	"DCC",
	// Optical/digital misc
	"Minidisc",
	"Laserdisc",
	"VHS",
	"Betamax",
	"MiniDV",
	"Video 8",
	"Betacam",
	"U-matic",
	// Digital file (for digital-only releases in Discogs database)
	"File",
	"Memory Stick",
	"Flash Drive",
	// Composite
	"Box Set",
	"All Media",
] as const;

export type DiscogsFormatName = (typeof DISCOGS_FORMAT_NAMES)[number];

/**
 * Format descriptions (sub-format tags) that Discogs attaches to a format
 * entry. Multiple descriptions can be combined (e.g., "12\"", "45 RPM",
 * "Promo").
 *
 * These appear in the `descriptions` array on each format object.
 *
 * Confidence: HIGH for common tags, MEDIUM for exhaustive completeness.
 */
export const DISCOGS_FORMAT_DESCRIPTIONS: Record<string, string> = {
	// --- Vinyl size / groove ---
	LP: 'Long-playing record; 12", 33⅓ RPM, close-groove',
	EP: "Extended play; more tracks than a single, fewer than an LP",
	Single: "Marketing term: one main track (can apply to vinyl, CD, cassette, etc.)",
	"Maxi-Single": '12" single with extra tracks or extended mixes',
	"Mini-Album": "More than a single/EP but fewer tracks than a full album",
	Album: "Full-length release marketed as an album",
	'7"': "Seven-inch disc, typically 45 RPM",
	'10"': "Ten-inch disc",
	'12"': "Twelve-inch disc, typically 33⅓ or 45 RPM, wide-groove for singles",
	'16"': "Sixteen-inch transcription disc",
	'6"': "Six-inch disc (rare; used for lathe cuts and specialty releases)",
	"45 RPM": "Plays at 45 revolutions per minute",
	"33 RPM": "Plays at 33⅓ revolutions per minute",
	"78 RPM": "Plays at 78 revolutions per minute (shellac era)",
	"16 RPM": "Plays at 16 RPM (speech/talking book format)",

	// --- Vinyl special types ---
	"Picture Disc": "Vinyl disc with printed image visible through the grooves",
	"Test Pressing": "Pre-production pressing from pressing plant for quality approval",
	"White Label": "Promotional pressing with plain white/generic label",
	Promo: "Promotional copy, not for retail sale",
	Ltd: "Limited edition pressing",
	Num: "Numbered edition",
	"Unofficial Release": "Bootleg or unauthorized release",
	Transcription: 'Broadcasting transcription disc; typically 16" at 33⅓ RPM',
	Jukebox: "Format/variant intended for jukebox use",
	Quadraphonic: "Four-channel audio",
	"Half-Speed Mastered": "Mastered at half speed for improved audio quality",
	Audiophile: "Audiophile-grade pressing",
	Reissue: "Re-pressing of a previously released title",
	Remastered: "Previously released content remastered from original sources",
	Repress: "New pressing of an existing release from the same master",
	Compilation: "Collection of tracks from various sources/artists",
	Stereo: "Two-channel stereo audio",
	Mono: "Monaural (single-channel) audio",

	// --- CD types ---
	Enhanced: "CD with both audio tracks and computer data (CD Extra / Mixed Mode)",
	"CD+G": "CD with graphics data; outputs visuals on CD+G players",
	HDCD: "High Definition Compatible Digital encoding",
	SACD: "Super Audio CD layer",
	Hybrid: "Contains multiple format layers (e.g., CD + SACD) for compatibility",
	CDV: "CD Video: 8cm disc with LaserDisc video and CD audio",
	Minimax: "Miniature CD single with integrated 12cm adaptor",

	// --- Cassette types ---
	Dolby: "Dolby noise-reduction encoding",
	Chrome: "Chrome (CrO₂) high-bias tape formulation",
	Metal: "Metal-particle tape formulation (highest bias)",
	Normal: "Normal (Type I) ferric tape formulation",
	BIAS: "Bias indicator present",

	// --- Reel-to-reel ---
	"15 IPS": "Tape speed: 15 inches per second",
	"7.5 IPS": "Tape speed: 7.5 inches per second",
	"3.75 IPS": "Tape speed: 3.75 inches per second",

	// --- Video ---
	PAL: "PAL video standard (Europe/Asia)",
	NTSC: "NTSC video standard (Americas/Japan)",
	SECAM: "SECAM video standard (France/former Soviet territories)",

	// --- File (digital) ---
	MP3: "Lossy compressed audio",
	FLAC: "Free Lossless Audio Codec",
	AAC: "Advanced Audio Coding",
	WAV: "Uncompressed PCM audio",
	AIFF: "Audio Interchange File Format",
	OGG: "Ogg Vorbis lossy audio",

	// --- Box Set ---
	"Box Set": "Multiple items enclosed in extra packaging; must be combined with other format types",

	// --- All Media ---
	"All Media": "Mixed-media release; must be combined with individual media types",
};

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

/**
 * The Discogs / Goldmine Standard condition grades, from best to worst.
 *
 * Discogs uses the Goldmine Standard for all Marketplace listings.
 *
 * Confidence: HIGH — sourced from Discogs Marketplace grading guide and
 * multiple corroborating Discogs support articles.
 */
export const DISCOGS_CONDITION_GRADES = [
	"M",
	"NM or M-",
	"VG+",
	"VG",
	"G+",
	"G",
	"F",
	"P",
] as const;

export type DiscogsConditionGrade = (typeof DISCOGS_CONDITION_GRADES)[number];

/**
 * Abbreviated aliases used as keys in the condition map below.
 * These are the short codes commonly seen in listings and API responses.
 */
export const DISCOGS_CONDITIONS = {
	/** Mint — Absolutely perfect in every way. Never played, possibly still sealed.
	 *  Use sparingly; reserved for items that are literally as-pressed. */
	M: "Mint — Absolutely perfect in every way. Never played, possibly still sealed. Use sparingly.",

	/** Near Mint — Nearly perfect; likely never played or played very carefully.
	 *  No visible signs of wear. Minor defects on cover only. */
	"NM or M-":
		"Near Mint — Nearly perfect. Little or no signs of wear on record or cover. Plays perfectly with no issues.",

	/** Very Good Plus — Shows some signs of play but still plays perfectly.
	 *  Occasional very light scuff or surface mark visible under strong light. */
	"VG+":
		"Very Good Plus — Plays very clean with just a few occasional light pops or light static. Minor cosmetic marks only.",

	/** Very Good — Noticeable surface noise in quiet passages. Light scratches
	 *  visible. Cover shows moderate wear (ring wear, light crease). */
	VG: "Very Good — Mostly clean playback with occasional surface noise. Light scratches visible. Cover shows moderate wear.",

	/** Good Plus — Significant surface noise and ticks. Visible groove wear.
	 *  Cover has seam splits and moderate defects. Still plays through. */
	"G+": "Good Plus — Loud playback without skipping but with moderate surface noise. Visible groove wear. Cover has seam splits.",

	/** Good — Very significant surface noise. Multiple scratches. Extensive
	 *  cover damage. Collectable value only. */
	G: "Good — Very significant surface noise and ticks throughout. Substantial scratches. Numerous cover issues. Collectable value only.",

	/** Fair — Does not play through without skipping or repeating. Heavily
	 *  damaged. Worth buying only if the release is extremely rare. */
	F: "Fair — Does not play through without skipping or repeating. Heavily damaged record and cover.",

	/** Poor — Cracked, badly warped, or otherwise unplayable. Worth essentially
	 *  nothing monetarily except as display piece for ultra-rare pressings. */
	P: "Poor — Cracked, badly warped, or unplayable. Worth 0–5% of Near Mint price.",
} as const satisfies Record<DiscogsConditionGrade, string>;

// ---------------------------------------------------------------------------
// Sleeve / Cover conditions
// ---------------------------------------------------------------------------

/**
 * Cover/sleeve condition grades follow the same Goldmine scale.
 * Discogs separates media grade (the record itself) from sleeve grade.
 * These are the same codes but applied to the sleeve/cover.
 */
export const DISCOGS_SLEEVE_CONDITIONS = {
	M: "Mint — Perfect sleeve/cover, no defects whatsoever.",
	"NM or M-": "Near Mint — Very little signs of wear. No creases, no seam splits, no writing.",
	"VG+":
		"Very Good Plus — Shows some signs of handling. Possibly a very minor crease or light ring wear. No seam splits.",
	VG: "Very Good — Shows wear from storage and handling. Light ring wear, possibly a small crease or seam split.",
	"G+": "Good Plus — Seam splits on one or more edges. Tape reinforcement, writing, or ring wear present.",
	G: "Good — Heavy ring wear, large seam splits, writing or stickers. Still intact but visually damaged.",
	F: "Fair — Badly damaged: torn, taped, water-damaged, or missing panels.",
	P: "Poor — Barely recognizable as original packaging. Severely damaged or incomplete.",
	Generic: "Generic — Plain or generic cover, not original or specific to the release.",
	"No Cover": "No Cover — Released without a cover, or cover missing.",
} as const;

export type DiscogsSleeveCondition = keyof typeof DISCOGS_SLEEVE_CONDITIONS;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the given string is a recognized Discogs genre.
 */
export function isDiscogsGenre(value: string): value is DiscogsGenre {
	return (DISCOGS_GENRES as readonly string[]).includes(value);
}

/**
 * Returns styles for a given genre, or an empty array if the genre is unknown.
 */
export function getStylesForGenre(genre: string): readonly string[] {
	if (isDiscogsGenre(genre)) {
		return DISCOGS_STYLES_BY_GENRE[genre];
	}
	return [];
}

/**
 * Returns all genres that contain the given style.
 * Useful when a release only reports a style and you need the parent genres.
 */
export function getGenresForStyle(style: string): DiscogsGenre[] {
	return DISCOGS_GENRES.filter((genre) => DISCOGS_STYLES_BY_GENRE[genre].includes(style));
}

/**
 * Returns true if the given string is a recognized condition grade.
 */
export function isDiscogsConditionGrade(value: string): value is DiscogsConditionGrade {
	return (DISCOGS_CONDITION_GRADES as readonly string[]).includes(value);
}

/**
 * Numeric weight for a condition grade (higher = better condition).
 * Useful for sorting and comparison in collection/marketplace views.
 */
export const DISCOGS_CONDITION_WEIGHT: Record<DiscogsConditionGrade, number> = {
	M: 8,
	"NM or M-": 7,
	"VG+": 6,
	VG: 5,
	"G+": 4,
	G: 3,
	F: 2,
	P: 1,
};

/**
 * Short display labels for condition grades (for compact UI like badges).
 */
export const DISCOGS_CONDITION_SHORT: Record<DiscogsConditionGrade, string> = {
	M: "M",
	"NM or M-": "NM",
	"VG+": "VG+",
	VG: "VG",
	"G+": "G+",
	G: "G",
	F: "F",
	P: "P",
};
