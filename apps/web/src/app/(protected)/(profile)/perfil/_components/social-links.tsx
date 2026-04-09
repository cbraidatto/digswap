interface SocialLinksProps {
	youtube: string | null;
	instagram: string | null;
	soundcloud: string | null;
	discogs: string | null;
	beatport: string | null;
}

const PLATFORMS = [
	{
		key: "youtube" as const,
		label: "YouTube",
		hoverColor: "hover:text-[#FF0000] hover:border-[#FF0000]/30 hover:bg-[#FF0000]/8",
		icon: (
			<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
				<title>YouTube</title>
				<path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z" />
			</svg>
		),
	},
	{
		key: "instagram" as const,
		label: "Instagram",
		hoverColor: "hover:text-[#E1306C] hover:border-[#E1306C]/30 hover:bg-[#E1306C]/8",
		icon: (
			<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
				<title>Instagram</title>
				<path d="M12 2.2c3.2 0 3.6 0 4.9.1 3.3.2 4.8 1.7 5 5 .1 1.3.1 1.6.1 4.8 0 3.2 0 3.6-.1 4.8-.2 3.3-1.7 4.8-5 5-1.3.1-1.6.1-4.9.1-3.2 0-3.6 0-4.8-.1-3.3-.2-4.8-1.7-5-5C2.1 15.6 2 15.2 2 12c0-3.2 0-3.6.1-4.8.2-3.3 1.7-4.8 5-5C8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12c0 3.3 0 3.7.1 4.9.2 4.4 2.6 6.8 7 7C8.3 24 8.7 24 12 24c3.3 0 3.7 0 4.9-.1 4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9 0-3.3 0-3.7-.1-4.9C23.7 2.7 21.3.3 16.9.1 15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 12 5.8zm0 10.2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z" />
			</svg>
		),
	},
	{
		key: "soundcloud" as const,
		label: "SoundCloud",
		hoverColor: "hover:text-[#FF5500] hover:border-[#FF5500]/30 hover:bg-[#FF5500]/8",
		icon: (
			<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
				<title>SoundCloud</title>
				<path d="M1.2 13.2c-.1 0-.2.1-.2.2l-.3 1.8.3 1.7c0 .1.1.2.2.2s.2-.1.2-.2l.3-1.7-.3-1.8c0-.1-.1-.2-.2-.2zm1.7-.8c-.1 0-.3.1-.3.3L2.3 15l.3 1.9c0 .2.1.3.3.3.1 0 .3-.1.3-.3l.4-1.9-.4-1.5c0-.2-.2-.3-.3-.3zm1.8-.5c-.2 0-.3.1-.3.3l-.4 1.8.4 2c0 .2.2.3.3.3.2 0 .3-.1.3-.3l.4-2-.4-1.8c0-.2-.2-.3-.3-.3zm1.8-.3c-.2 0-.4.2-.4.4l-.3 1.7.3 2c0 .2.2.4.4.4s.4-.2.4-.4l.4-2-.4-1.7c0-.2-.2-.4-.4-.4zm1.8.1c-.2 0-.4.2-.4.4l-.3 1.6.3 2c0 .2.2.4.4.4s.4-.2.4-.4l.4-2-.4-1.6c0-.2-.2-.4-.4-.4zm1.8-.4c-.3 0-.5.2-.5.5l-.3 1.5.3 2c0 .3.2.5.5.5s.5-.2.5-.5l.3-2-.3-1.5c0-.3-.2-.5-.5-.5zm1.9-.4c-.3 0-.5.2-.5.5l-.2 1.5.2 2c0 .3.2.5.5.5s.5-.2.5-.5l.3-2-.3-1.5c0-.3-.2-.5-.5-.5zm1.9 0c-.3 0-.6.2-.6.6l-.2 1.4.2 2c0 .3.3.6.6.6.3 0 .6-.3.6-.6l.2-2-.2-1.4c0-.4-.3-.6-.6-.6zm7.3-4.1a5.3 5.3 0 0 0-5.3 5.3v.5l-.2 3.6c0 .3.3.6.6.6.3 0 .6-.3.6-.6l.2-3.6V13c0-2.3 1.8-4.1 4.1-4.1 2.3 0 4.1 1.8 4.1 4.1l.2 4.2-.2.5c0 .3-.3.6-.6.6-.3 0-.6-.3-.6-.6l-.2-.5V13c0-1.6-1.3-2.9-2.9-2.9-1.6 0-2.9 1.3-2.9 2.9" />
			</svg>
		),
	},
	{
		key: "discogs" as const,
		label: "Discogs",
		hoverColor: "hover:text-[#333] dark:hover:text-white hover:border-white/20 hover:bg-white/8",
		icon: (
			<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
				<title>Discogs</title>
				<path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm0 18.9c-3.8 0-6.9-3.1-6.9-6.9S8.2 5.1 12 5.1s6.9 3.1 6.9 6.9-3.1 6.9-6.9 6.9zm0-11.5c-2.5 0-4.6 2.1-4.6 4.6s2.1 4.6 4.6 4.6 4.6-2.1 4.6-4.6S14.5 7.4 12 7.4zm0 6.9c-1.3 0-2.3-1-2.3-2.3s1-2.3 2.3-2.3 2.3 1 2.3 2.3-1 2.3-2.3 2.3z" />
			</svg>
		),
	},
	{
		key: "beatport" as const,
		label: "Beatport",
		hoverColor: "hover:text-[#01FF95] hover:border-[#01FF95]/30 hover:bg-[#01FF95]/8",
		icon: (
			<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
				<title>Beatport</title>
				<path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm4.6 14.8c0 2-1.6 3.6-3.6 3.6H7.4V5.6H13c2 0 3.6 1.6 3.6 3.6 0 1-.4 1.9-1.1 2.6.7.7 1.1 1.6 1.1 2.6V14.8zM13 9.6H9.8V7.9H13c.5 0 .8.4.8.8s-.3.9-.8.9zm.2 5.1H9.8v-1.8H13c.5 0 .9.4.9.9s-.3.9-.7.9z" />
			</svg>
		),
	},
] as const;

type PlatformKey = (typeof PLATFORMS)[number]["key"];

export function SocialLinks({
	youtube,
	instagram,
	soundcloud,
	discogs,
	beatport,
}: SocialLinksProps) {
	const values: Record<PlatformKey, string | null> = {
		youtube,
		instagram,
		soundcloud,
		discogs,
		beatport,
	};

	const hasAny = PLATFORMS.some((p) => values[p.key]);

	if (!hasAny) return null;

	return (
		<div className="flex items-center justify-between w-full gap-1.5">
			{PLATFORMS.map((p) => {
				const url = values[p.key];

				if (!url) return null;

				return (
					<a
						key={p.key}
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						title={p.label}
						className={`flex-1 h-10 flex items-center justify-center rounded-md border border-outline/15 text-on-surface-variant transition-all duration-200 ${p.hoverColor}`}
					>
						{p.icon}
					</a>
				);
			})}
		</div>
	);
}
