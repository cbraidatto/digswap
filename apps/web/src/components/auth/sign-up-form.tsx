"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { signUp } from "@/actions/auth";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SignUpInput, signUpSchema } from "@/lib/validations/auth";

export function SignUpForm() {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<SignUpInput>({
		resolver: zodResolver(signUpSchema),
		mode: "onBlur",
	});

	async function onSubmit(data: SignUpInput) {
		setIsSubmitting(true);
		try {
			const formData = new FormData();
			formData.append("email", data.email);
			formData.append("password", data.password);
			formData.append("confirmPassword", data.confirmPassword);

			const result = await signUp(formData);

			if (!result.success) {
				if (result.error?.includes("Too many attempts") || result.error?.includes("wait")) {
					toast.error(result.error);
				} else {
					toast.error(result.error || "Something went wrong. Please try again.");
				}
				return;
			}

			router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
		} catch {
			toast.error("Something went wrong. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className="space-y-6">
			<form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
						<p id="email-error" className="text-sm text-destructive" role="alert">
							{errors.email.message}
						</p>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor="password">Password</Label>
					<Input
						id="password"
						type="password"
						placeholder="Create a password"
						autoComplete="new-password"
						aria-describedby={errors.password ? "password-error" : undefined}
						aria-invalid={!!errors.password}
						className="h-11"
						{...register("password")}
					/>
					{errors.password && (
						<p id="password-error" className="text-sm text-destructive" role="alert">
							{errors.password.message}
						</p>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor="confirmPassword">Confirm Password</Label>
					<Input
						id="confirmPassword"
						type="password"
						placeholder="Confirm your password"
						autoComplete="new-password"
						aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
						aria-invalid={!!errors.confirmPassword}
						className="h-11"
						{...register("confirmPassword")}
					/>
					{errors.confirmPassword && (
						<p id="confirmPassword-error" className="text-sm text-destructive" role="alert">
							{errors.confirmPassword.message}
						</p>
					)}
				</div>

				<Button
					type="submit"
					className="h-11 w-full"
					disabled={isSubmitting}
					aria-busy={isSubmitting}
				>
					{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Create Account"}
				</Button>
			</form>

			<SocialLoginButtons />
		</div>
	);
}
