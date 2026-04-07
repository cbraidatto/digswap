"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { resetPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ResetPasswordInput, resetPasswordSchema } from "@/lib/validations/auth";

/**
 * Reset password form component.
 * Updates the user's password after they click the email reset link.
 *
 * Per UI-SPEC Copywriting:
 * - CTA: "Update Password"
 * - Success: "Password updated. You can now sign in with your new password."
 * - Expired link: "This reset link has expired. Request a new one."
 *
 * Same inline validation pattern as signup (password strength rules per D-18).
 */
export function ResetPasswordForm() {
	const [isPending, startTransition] = useTransition();
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [expiredLink, setExpiredLink] = useState(false);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<ResetPasswordInput>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: {
			password: "",
			confirmPassword: "",
		},
	});

	function onSubmit(data: ResetPasswordInput) {
		startTransition(async () => {
			const formData = new FormData();
			formData.append("password", data.password);
			formData.append("confirmPassword", data.confirmPassword);

			const result = await resetPassword(formData);

			if (result.success) {
				setSuccessMessage(result.message);
			} else if (result.message.includes("expired")) {
				setExpiredLink(true);
			} else {
				toast.error(result.message);
			}
		});
	}

	// Expired link state
	if (expiredLink) {
		return (
			<div className="space-y-6">
				<div className="text-center">
					<p className="text-sm text-destructive">
						This reset link has expired. Request a new one.
					</p>
				</div>
				<div className="text-center">
					<Link
						href="/forgot-password"
						className="text-sm text-primary underline-offset-4 hover:underline"
					>
						Request a new reset link
					</Link>
				</div>
			</div>
		);
	}

	// Success state
	if (successMessage) {
		return (
			<div className="space-y-6">
				<div className="flex flex-col items-center gap-3 text-center">
					<div className="flex size-12 items-center justify-center rounded-full bg-success/10">
						<CheckCircle className="size-6 text-success" />
					</div>
					<p className="text-sm text-muted-foreground">{successMessage}</p>
				</div>
				<div className="text-center">
					<Link href="/signin" className="text-sm text-primary underline-offset-4 hover:underline">
						Sign In
					</Link>
				</div>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="password">New Password</Label>
				<Input
					id="password"
					type="password"
					placeholder="Enter new password"
					autoComplete="new-password"
					aria-describedby={errors.password ? "password-error" : undefined}
					aria-invalid={!!errors.password}
					disabled={isPending}
					{...register("password")}
				/>
				{errors.password && (
					<p id="password-error" className="text-sm text-destructive">
						{errors.password.message}
					</p>
				)}
			</div>

			<div className="space-y-2">
				<Label htmlFor="confirmPassword">Confirm Password</Label>
				<Input
					id="confirmPassword"
					type="password"
					placeholder="Confirm new password"
					autoComplete="new-password"
					aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
					aria-invalid={!!errors.confirmPassword}
					disabled={isPending}
					{...register("confirmPassword")}
				/>
				{errors.confirmPassword && (
					<p id="confirm-password-error" className="text-sm text-destructive">
						{errors.confirmPassword.message}
					</p>
				)}
			</div>

			<p className="text-xs text-muted-foreground">
				Password must be at least 8 characters with one uppercase letter, one number, and one
				special character.
			</p>

			<Button type="submit" className="w-full" size="lg" disabled={isPending} aria-busy={isPending}>
				{isPending ? <Loader2 className="size-4 animate-spin" /> : "Update Password"}
			</Button>
		</form>
	);
}
