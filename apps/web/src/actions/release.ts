"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema/releases";
import { eq } from "drizzle-orm";
import { apiRateLimit , safeLimit} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getReviewsForRelease } from "@/lib/community/queries";
import { releaseIdSchema, getMoreReviewsSchema } from "@/lib/validations/release";

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

/**
 * Lazy-cache YouTube video for a release.
 * On first call: searches YouTube Data API v3, caches result in DB.
 * On subsequent calls: returns cached videoId immediately.
 *
 * Requires authentication for rate limiting.
 * Gracefully degrades when YOUTUBE_API_KEY is not set or quota is exceeded.
 */
export async function searchYouTubeForRelease(
  releaseInternalId: string,
): Promise<{ videoId: string | null; error?: string }> {
  try {
    const parsed = releaseIdSchema.safeParse({ releaseInternalId });
    if (!parsed.success) {
      return { videoId: null, error: "Invalid release ID" };
    }

    // Authenticate user (rate limiting requires user ID)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { videoId: null, error: "Authentication required" };

    // Rate limit
    const { success } = await safeLimit(apiRateLimit, user.id, false);
    if (!success) return { videoId: null, error: "Rate limited" };

    // Fetch release data
    const [release] = await db
      .select({
        id: releases.id,
        title: releases.title,
        artist: releases.artist,
        youtubeVideoId: releases.youtubeVideoId,
      })
      .from(releases)
      .where(eq(releases.id, parsed.data.releaseInternalId))
      .limit(1);

    if (!release) return { videoId: null, error: "Release not found" };

    // Cache hit -- return immediately
    if (release.youtubeVideoId) return { videoId: release.youtubeVideoId };

    // No API key configured -- skip gracefully
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return { videoId: null };

    // Call YouTube Data API v3 search.list
    const params = new URLSearchParams({
      part: "snippet",
      q: `${release.artist} ${release.title}`,
      type: "video",
      videoCategoryId: "10", // Music
      maxResults: "1",
      key: apiKey,
    });

    const response = await fetch(`${YOUTUBE_SEARCH_URL}?${params}`);
    if (!response.ok) return { videoId: null }; // Quota exceeded or API error -- fail gracefully

    const data = await response.json();
    const videoId: string | null = data.items?.[0]?.id?.videoId ?? null;

    // Cache result in DB via admin client (only when video found)
    // Do NOT store null results -- leave column null so future searches can retry
    if (videoId) {
      const admin = createAdminClient();
      await admin
        .from("releases")
        .update({
          youtube_video_id: videoId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", release.id);
    }

    return { videoId };
  } catch (err) {
    console.error("[searchYouTubeForRelease] error:", err);
    return { videoId: null, error: "Failed to search YouTube. Please try again." };
  }
}

/**
 * Load more reviews for a release with cursor-based pagination.
 * Wraps getReviewsForRelease for client component consumption.
 */
export async function getMoreReviews(releaseId: string, cursor: string, limit = 10) {
  try {
    const parsed = getMoreReviewsSchema.safeParse({ releaseId, cursor, limit });
    if (!parsed.success) {
      return [];
    }

    // Auth check — reviews are public but require authentication to paginate
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    return await getReviewsForRelease(parsed.data.releaseId, parsed.data.cursor, parsed.data.limit);
  } catch (err) {
    console.error("[getMoreReviews] error:", err);
    return [];
  }
}
