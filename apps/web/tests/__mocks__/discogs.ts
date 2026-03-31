import type {
	DiscogsCollectionResponse,
	DiscogsCollectionItem,
	DiscogsBasicInformation,
	DiscogsPagination,
} from "@/lib/discogs/types";

/**
 * Mock factory for Discogs API responses.
 * Used across all Phase 03 test files.
 */

function createMockBasicInformation(
	overrides: Partial<DiscogsBasicInformation> = {},
): DiscogsBasicInformation {
	return {
		id: 1234,
		title: "Kind of Blue",
		year: 1959,
		artists: [{ name: "Miles Davis", id: 23755 }],
		genres: ["Jazz"],
		styles: ["Modal"],
		formats: [{ name: "Vinyl", descriptions: ["LP", "Album"] }],
		cover_image: "https://img.discogs.com/kind-of-blue-cover.jpg",
		thumb: "https://img.discogs.com/kind-of-blue-thumb.jpg",
		resource_url: "https://api.discogs.com/releases/1234",
		...overrides,
	};
}

function createMockCollectionItem(
	overrides: Partial<DiscogsCollectionItem> = {},
): DiscogsCollectionItem {
	return {
		id: 1234,
		instance_id: 56789,
		date_added: "2024-01-15T10:30:00-08:00",
		basic_information: createMockBasicInformation(),
		...overrides,
	};
}

/**
 * Creates a mock collection page response with realistic data.
 */
export function mockCollectionPage(
	page = 1,
	perPage = 50,
	totalItems = 150,
	totalPages = 3,
): DiscogsCollectionResponse {
	const itemCount = Math.min(perPage, totalItems - (page - 1) * perPage);
	const releases: DiscogsCollectionItem[] = [];

	const albums = [
		{
			id: 1234,
			title: "Kind of Blue",
			artist: "Miles Davis",
			year: 1959,
			genres: ["Jazz"],
			styles: ["Modal"],
		},
		{
			id: 2345,
			title: "A Love Supreme",
			artist: "John Coltrane",
			year: 1965,
			genres: ["Jazz"],
			styles: ["Free Jazz", "Post Bop"],
		},
		{
			id: 3456,
			title: "Head Hunters",
			artist: "Herbie Hancock",
			year: 1973,
			genres: ["Jazz", "Funk / Soul"],
			styles: ["Jazz-Funk", "Fusion"],
		},
		{
			id: 4567,
			title: "Bitches Brew",
			artist: "Miles Davis",
			year: 1970,
			genres: ["Jazz"],
			styles: ["Jazz-Rock", "Fusion"],
		},
		{
			id: 5678,
			title: "Maiden Voyage",
			artist: "Herbie Hancock",
			year: 1965,
			genres: ["Jazz"],
			styles: ["Post Bop"],
		},
	];

	for (let i = 0; i < itemCount; i++) {
		const albumIndex = ((page - 1) * perPage + i) % albums.length;
		const album = albums[albumIndex];
		releases.push(
			createMockCollectionItem({
				id: album.id + (page - 1) * perPage + i,
				instance_id: 10000 + (page - 1) * perPage + i,
				date_added: new Date(
					2024,
					0,
					15 - ((page - 1) * perPage + i),
				).toISOString(),
				basic_information: createMockBasicInformation({
					id: album.id,
					title: album.title,
					artists: [{ name: album.artist, id: album.id * 10 }],
					year: album.year,
					genres: album.genres,
					styles: album.styles,
				}),
			}),
		);
	}

	const pagination: DiscogsPagination = {
		page,
		pages: totalPages,
		per_page: perPage,
		items: totalItems,
	};

	return { releases, pagination };
}

/**
 * Creates a mock wantlist page response.
 */
export function mockWantlistPage(
	page = 1,
	perPage = 50,
	totalItems = 75,
	totalPages = 2,
): DiscogsCollectionResponse {
	const itemCount = Math.min(perPage, totalItems - (page - 1) * perPage);
	const releases: DiscogsCollectionItem[] = [];

	const wanted = [
		{
			id: 9001,
			title: "Abraxas",
			artist: "Santana",
			year: 1970,
			genres: ["Rock", "Latin"],
			styles: ["Latin Rock"],
		},
		{
			id: 9002,
			title: "Songs in the Key of Life",
			artist: "Stevie Wonder",
			year: 1976,
			genres: ["Funk / Soul"],
			styles: ["Soul"],
		},
		{
			id: 9003,
			title: "What's Going On",
			artist: "Marvin Gaye",
			year: 1971,
			genres: ["Funk / Soul"],
			styles: ["Soul"],
		},
	];

	for (let i = 0; i < itemCount; i++) {
		const albumIndex = ((page - 1) * perPage + i) % wanted.length;
		const album = wanted[albumIndex];
		releases.push(
			createMockCollectionItem({
				id: album.id + (page - 1) * perPage + i,
				instance_id: 20000 + (page - 1) * perPage + i,
				date_added: new Date(
					2024,
					5,
					1 - ((page - 1) * perPage + i),
				).toISOString(),
				basic_information: createMockBasicInformation({
					id: album.id,
					title: album.title,
					artists: [{ name: album.artist, id: album.id * 10 }],
					year: album.year,
					genres: album.genres,
					styles: album.styles,
				}),
			}),
		);
	}

	const pagination: DiscogsPagination = {
		page,
		pages: totalPages,
		per_page: perPage,
		items: totalItems,
	};

	return { releases, pagination };
}

/**
 * Creates a mock Discogs identity response.
 */
export function mockDiscogsIdentity(username = "vinyldigger42") {
	return {
		data: {
			username,
			resource_url: `https://api.discogs.com/users/${username}`,
			consumer_name: "VinylDig",
			id: 42,
		},
	};
}

/**
 * Creates a mock request token response for OAuth 1.0a flow.
 */
export function mockRequestTokenResponse(
	token = "mock_request_token",
	tokenSecret = "mock_request_token_secret",
	authorizeUrl = "https://www.discogs.com/oauth/authorize?oauth_token=mock_request_token",
) {
	return {
		token,
		tokenSecret,
		authorizeUrl,
	};
}

/**
 * Creates a mock access token response for OAuth 1.0a flow.
 */
export function mockAccessTokenResponse(
	accessToken = "mock_access_token",
	accessTokenSecret = "mock_access_token_secret",
) {
	return {
		accessToken,
		accessTokenSecret,
	};
}
