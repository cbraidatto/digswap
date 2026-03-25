import { Disc3 } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";

export default function FeedPage() {
	return (
		<EmptyState
			icon={Disc3}
			heading="Your feed is warming up"
			body="Drops when you follow other diggers"
		/>
	);
}
