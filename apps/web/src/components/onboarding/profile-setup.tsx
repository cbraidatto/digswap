"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { updateProfile } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface ProfileSetupProps {
	onComplete: () => void;
}

/**
 * Onboarding Step 1: Profile setup.
 *
 * Per UI-SPEC:
 * - Title: "Set Up Your Profile"
 * - Body: "Choose a display name and avatar. This is how other diggers will find you."
 * - CTA: "Continue Setup" (primary amber)
 *
 * Loading skeleton: avatar circle (64px) + 2 skeleton text lines + skeleton button.
 */
export function ProfileSetup({ onComplete }: ProfileSetupProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// Simulate brief loading state for skeleton display
	if (isLoading) {
		// Use setTimeout-free approach: set loading false on next tick
		setTimeout(() => setIsLoading(false), 0);
		return (
			<div className="space-y-6">
				<div className="flex flex-col items-center gap-4">
					<Skeleton className="size-16 rounded-full" />
					<Skeleton className="h-4 w-48" />
					<Skeleton className="h-4 w-36" />
				</div>
				<Skeleton className="h-11 w-full rounded-md" />
			</div>
		);
	}

	async function handleSubmit(formData: FormData) {
		setIsSubmitting(true);
		setError(null);

		const result = await updateProfile(formData);

		if (!result.success) {
			setError(result.error ?? "An error occurred.");
			setIsSubmitting(false);
			return;
		}

		onComplete();
	}

	return (
		<form action={handleSubmit} className="space-y-6">
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="display_name">Display Name</Label>
					<Input
						id="display_name"
						name="display_name"
						type="text"
						placeholder="your-display-name"
						required
						minLength={3}
						maxLength={50}
						className="h-11"
						autoFocus
					/>
					<p className="text-xs text-muted-foreground">
						3-50 characters. Letters, numbers, hyphens, and underscores only.
					</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor="avatar_url">Avatar URL (optional)</Label>
					<Input
						id="avatar_url"
						name="avatar_url"
						type="url"
						placeholder="https://example.com/avatar.jpg"
						className="h-11"
					/>
					<p className="text-xs text-muted-foreground">
						Link to your avatar image. You can change this later.
					</p>
				</div>
			</div>

			{error && (
				<div
					className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
					role="alert"
				>
					{error}
				</div>
			)}

			<Button
				type="submit"
				className="h-11 w-full"
				disabled={isSubmitting}
				aria-busy={isSubmitting}
			>
				{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Continue Setup"}
			</Button>
		</form>
	);
}
