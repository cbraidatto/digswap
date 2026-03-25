"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { resendVerification } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function ResendVerificationButton({ email }: { email: string }) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [hasSent, setHasSent] = useState(false);

	async function handleResend() {
		if (!email) {
			toast.error("No email address provided.");
			return;
		}

		setIsSubmitting(true);
		try {
			const result = await resendVerification(email);

			if (!result.success) {
				toast.error(
					result.error ||
						"Something went wrong. Please try again.",
				);
				return;
			}

			toast.success(
				"Verification email sent again. Check your spam folder if you don't see it.",
			);
			setHasSent(true);
		} catch {
			toast.error("Something went wrong. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Button
			type="button"
			variant="outline"
			className="h-11 w-full"
			onClick={handleResend}
			disabled={isSubmitting || hasSent}
			aria-busy={isSubmitting}
		>
			{isSubmitting ? (
				<Loader2 className="size-4 animate-spin" />
			) : hasSent ? (
				"Email Sent"
			) : (
				"Resend Verification Email"
			)}
		</Button>
	);
}
