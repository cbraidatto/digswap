import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4">
			<h1 className="font-heading text-[28px] font-normal leading-[1.1] tracking-[-0.03em] sm:text-[36px]">
				Dig<span className="text-primary">Swap</span>
			</h1>

			<p className="mt-2 text-muted-foreground">A social network for vinyl diggers</p>

			<Card className="mt-8 w-full max-w-[420px]">
				<CardHeader>
					<CardTitle className="font-heading text-[24px] font-semibold leading-[1.2] tracking-[-0.02em]">
						Welcome
					</CardTitle>
					<CardDescription>
						Import your Discogs library, discover who has what you are looking for, and trade audio
						rips via secure peer-to-peer connections.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<Link href="/signup" className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-2.5 h-9 text-sm font-medium text-primary-foreground transition-all">
						Get Started
					</Link>
					<Button variant="secondary" size="lg" className="w-full">
						Learn More
					</Button>
				</CardContent>
			</Card>

			<p className="mt-6 text-sm text-muted-foreground">
				Gamified rankings reward both collection rarity and community contribution.
			</p>
		</div>
	);
}
