import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { releases } from "@/lib/db/schema/releases";
import { eq, isNotNull, sql } from "drizzle-orm";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://digswap.com";

	// Static pages
	const staticPages: MetadataRoute.Sitemap = [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 1,
		},
		{
			url: `${baseUrl}/pricing`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.8,
		},
		{
			url: `${baseUrl}/signup`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.7,
		},
	];

	// Dynamic: public profiles (users with a username who completed onboarding)
	let profilePages: MetadataRoute.Sitemap = [];
	try {
		const publicProfiles = await db
			.select({
				username: profiles.username,
				updatedAt: profiles.updatedAt,
			})
			.from(profiles)
			.where(
				sql`${profiles.username} IS NOT NULL AND ${profiles.onboardingCompleted} = true`,
			)
			.limit(5000);

		profilePages = publicProfiles
			.filter((p) => p.username)
			.map((p) => ({
				url: `${baseUrl}/perfil/${p.username}`,
				lastModified: p.updatedAt ?? new Date(),
				changeFrequency: "weekly" as const,
				priority: 0.6,
			}));
	} catch {
		// Non-fatal: sitemap still works without dynamic profiles
	}

	// Dynamic: release pages (releases with a discogs_id)
	let releasePages: MetadataRoute.Sitemap = [];
	try {
		const publicReleases = await db
			.select({
				discogsId: releases.discogsId,
				updatedAt: releases.updatedAt,
			})
			.from(releases)
			.where(isNotNull(releases.discogsId))
			.limit(10000);

		releasePages = publicReleases
			.filter((r) => r.discogsId)
			.map((r) => ({
				url: `${baseUrl}/release/${r.discogsId}`,
				lastModified: r.updatedAt ?? new Date(),
				changeFrequency: "monthly" as const,
				priority: 0.5,
			}));
	} catch {
		// Non-fatal
	}

	return [...staticPages, ...profilePages, ...releasePages];
}
