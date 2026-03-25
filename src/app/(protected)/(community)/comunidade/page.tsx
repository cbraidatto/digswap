import { Users } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";

export default function ComunidadePage() {
	return (
		<EmptyState
			icon={Users}
			heading="Find your people"
			body="Connect with diggers who share your taste"
		/>
	);
}
