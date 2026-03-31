"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Link from "next/link";

import { signInSchema, type SignInInput } from "@/lib/validations/auth";
import { signIn } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";

export function SignInForm() {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<SignInInput>({
		resolver: zodResolver(signInSchema),
		mode: "onBlur",
	});

	async function onSubmit(data: SignInInput) {
		setIsSubmitting(true);
		setFormError(null);
		try {
			const formData = new FormData();
			formData.append("email", data.email);
			formData.append("password", data.password);

			const result = await signIn(formData);

			if (!result.success) {
				if (
					result.error?.includes("Too many attempts") ||
					result.error?.includes("wait")
				) {
					toast.error(result.error);
				} else {
					setFormError(
						result.error ||
							"Invalid email or password. Please try again.",
					);
				}
				return;
			}

			if (result.mfaRequired) {
				router.push("/signin/2fa");
				return;
			}

			router.push(result.redirectTo || "/onboarding");
		} catch {
			toast.error("Something went wrong. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className="space-y-6">
			<form
				onSubmit={handleSubmit(onSubmit)}
				noValidate
				className="space-y-4"
			>
				{formError && (
					<div
						className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
						role="alert"
					>
						{formError}
					</div>
				)}

				<div className="space-y-2">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						type="email"
						placeholder="you@example.com"
						autoComplete="email"
						aria-describedby={errors.email ? "email-error" : undefined}
						aria-invalid={!!errors.email}
						className="h-11"
						{...register("email")}
					/>
					{errors.email && (
						<p
							id="email-error"
							className="text-sm text-destructive"
							role="alert"
						>
							{errors.email.message}
						</p>
					)}
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label htmlFor="password">Password</Label>
						<Link
							href="/forgot-password"
							className="text-sm text-primary hover:underline"
						>
							Forgot your password?
						</Link>
					</div>
					<Input
						id="password"
						type="password"
						placeholder="Enter your password"
						autoComplete="current-password"
						aria-describedby={
							errors.password ? "password-error" : undefined
						}
						aria-invalid={!!errors.password}
						className="h-11"
						{...register("password")}
					/>
					{errors.password && (
						<p
							id="password-error"
							className="text-sm text-destructive"
							role="alert"
						>
							{errors.password.message}
						</p>
					)}
				</div>

				<Button
					type="submit"
					className="h-11 w-full"
					disabled={isSubmitting}
					aria-busy={isSubmitting}
				>
					{isSubmitting ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						"Sign In"
					)}
				</Button>
			</form>

			<SocialLoginButtons />
		</div>
	);
}
