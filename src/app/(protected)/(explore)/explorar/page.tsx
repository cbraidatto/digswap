import { Search } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";

export default function ExplorarPage() {
	return (
		<EmptyState
			icon={Search}
			heading="Discover what's out there"
			body="Search across every collection on the platform"
		/>
	);
}
