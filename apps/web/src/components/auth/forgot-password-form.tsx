"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { forgotPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ForgotPasswordInput, forgotPasswordSchema } from "@/lib/validations/auth";

/**
 * Forgot password form component.
 * Sends a password reset email via Supabase.
 *
 * Per UI-SPEC Copywriting:
 * - CTA: "Send Reset Link"
 * - Success: "Check your inbox. We sent a reset link to {email}."
 * - Rate limited: "Too many attempts. Please wait a moment before trying again."
 */
export function ForgotPasswordForm() {
	const [isPending, startTransition] = useTransition();
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<ForgotPasswordInput>({
		resolver: zodResolver(forgotPasswordSchema),
		defaultValues: {
			email: "",
		},
	});

	function onSubmit(data: ForgotPasswordInput) {
		startTransition(async () => {
			const formData = new FormData();
			formData.append("email", data.email);

			const result = await forgotPassword(formData);

			if (result.success) {
				setSuccessMessage(result.message);
			} else {
				toast.error(result.message);
			}
		});
	}

	// Success state
	if (successMessage) {
		return (
			<div className="space-y-6">
				<div className="flex flex-col items-center gap-3 text-center">
					<div className="flex size-12 items-center justify-center rounded-full bg-success/10">
						<Mail className="size-6 text-success" />
					</div>
					<p className="text-sm text-muted-foreground">{successMessage}</p>
				</div>
				<div className="text-center">
					<Link href="/signin" className="text-sm text-primary underline-offset-4 hover:underline">
						Back to Sign In
					</Link>
				</div>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="email">Email</Label>
				<Input
					id="email"
					type="email"
					placeholder="you@example.com"
					autoComplete="email"
					aria-describedby={errors.email ? "email-error" : undefined}
					aria-invalid={!!errors.email}
					disabled={isPending}
					{...register("email")}
				/>
				{errors.email && (
					<p id="email-error" className="text-sm text-destructive">
						{errors.email.message}
					</p>
				)}
			</div>

			<Button type="submit" className="w-full" size="lg" disabled={isPending} aria-busy={isPending}>
				{isPending ? <Loader2 className="size-4 animate-spin" /> : "Send Reset Link"}
			</Button>

			<div className="text-center">
				<Link href="/signin" className="text-sm text-primary underline-offset-4 hover:underline">
					Back to Sign In
				</Link>
			</div>
		</form>
	);
}
