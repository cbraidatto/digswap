import type { Metadata } from "next";
import { GroupCreateForm } from "./_components/group-create-form";

export const metadata: Metadata = {
	title: "Create group — DigSwap",
	description: "Start a new vinyl collector community group.",
};

export default function NewGroupPage() {
	return (
		<div className="max-w-[640px] mx-auto px-4 md:px-8 py-8">
			<h1 className="font-mono text-xs uppercase tracking-[0.2em] text-outline mb-8">
				NEW_GROUP
			</h1>
			<GroupCreateForm />
		</div>
	);
}
