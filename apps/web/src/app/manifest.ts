import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "DigSwap",
		short_name: "DigSwap",
		description:
			"The social network for vinyl diggers. Import your Discogs collection, discover matches, and connect with collectors.",
		start_url: "/feed",
		display: "standalone",
		background_color: "#10141a",
		theme_color: "#10141a",
		icons: [
			{
				src: "/icon-192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				src: "/icon-512.png",
				sizes: "512x512",
				type: "image/png",
			},
		],
	};
}
