import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
	const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL ?? "https://digswap.com";

	return {
		rules: [
			{
				userAgent: "*",
				allow: ["/", "/pricing", "/release/"],
				disallow: [
					"/api/",
					"/feed",
					"/perfil",
					"/explorar",
					"/comunidade",
					"/settings",
					"/trades",
					"/crates",
					"/radar",
					"/notifications",
					"/onboarding",
					"/import-progress",
				],
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
