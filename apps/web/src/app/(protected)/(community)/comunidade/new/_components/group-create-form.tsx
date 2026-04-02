"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import Link from "next/link";

import { createGroupAction } from "@/actions/community";

const groupSchema = z.object({
	name: z
		.string()
		.min(1, "GROUP_NAME_REQUIRED")
		.max(80, "NAME_TOO_LONG (max 80 chars)"),
	description: z.string().optional(),
	category: z.string().optional(),
	visibility: z.enum(["public", "private"]),
});

type GroupFormData = z.infer<typeof groupSchema>;

export function GroupCreateForm() {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const {
		register,
		handleSubmit,
		watch,
		formState: { errors },
	} = useForm<GroupFormData>({
		resolver: zodResolver(groupSchema),
		defaultValues: {
			name: "",
			description: "",
			category: "",
			visibility: "public",
		},
	});

	const nameValue = watch("name", "");

	async function onSubmit(data: GroupFormData) {
		setIsSubmitting(true);
		try {
			const result = await createGroupAction({
				name: data.name,
				description: data.description || undefined,
				category: data.category || undefined,
				visibility: data.visibility,
			});
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			toast("Group created.");
			router.push(`/comunidade/${result.slug}`);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to create group.",
			);
		} finally {
			setIsSubmitting(false);
		}
	}

	const inputClass =
		"w-full bg-surface-container-low border border-outline-variant/20 focus:border-primary rounded px-3 py-2 text-sm font-sans text-on-surface placeholder:text-on-surface-variant/50 outline-none transition-colors";

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			{/* Group Name */}
			<div>
				<label
					htmlFor="name"
					className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline block mb-2"
				>
					GROUP_NAME
				</label>
				<input
					id="name"
					type="text"
					maxLength={80}
					className={inputClass}
					placeholder="e.g. Blue Note Originals SP"
					{...register("name")}
				/>
				<div className="flex items-center justify-between mt-1">
					{errors.name ? (
						<span className="font-mono text-[10px] text-destructive">
							{errors.name.message}
						</span>
					) : (
						<span />
					)}
					<span className="font-mono text-[10px] text-on-surface-variant">
						{nameValue.length}/80
					</span>
				</div>
			</div>

			{/* Description */}
			<div>
				<label
					htmlFor="description"
					className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline block mb-2"
				>
					DESCRIPTION (optional)
				</label>
				<textarea
					id="description"
					className={`${inputClass} min-h-[80px] resize-none`}
					placeholder="What is this group about?"
					{...register("description")}
				/>
			</div>

			{/* Category */}
			<div>
				<label
					htmlFor="category"
					className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline block mb-2"
				>
					CATEGORY{" "}
					<span className="normal-case tracking-normal text-on-surface-variant">
						(genre, era, region, style...)
					</span>
				</label>
				<input
					id="category"
					type="text"
					className={inputClass}
					placeholder="e.g. Jazz, 1960s, Brazil"
					{...register("category")}
				/>
			</div>

			{/* Visibility */}
			<div>
				<label
					htmlFor="visibility"
					className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline block mb-2"
				>
					VISIBILITY
				</label>
				<select
					id="visibility"
					className={`${inputClass} appearance-none cursor-pointer`}
					{...register("visibility")}
				>
					<option value="public">Public (anyone can join)</option>
					<option value="private">Private (invite only)</option>
				</select>
			</div>

			{/* Button Row */}
			<div className="flex items-center justify-between mt-8">
				<Link
					href="/comunidade"
					className="font-mono text-[10px] text-on-surface-variant hover:text-on-surface px-4 py-2 transition-colors"
				>
					[Cancel]
				</Link>
				<button
					type="submit"
					disabled={isSubmitting}
					className="font-mono text-[10px] bg-primary text-primary-foreground px-4 py-2 rounded disabled:opacity-50 transition-colors hover:bg-primary/90"
				>
					{isSubmitting ? "[Creating...]" : "[Create Group]"}
				</button>
			</div>
		</form>
	);
}
