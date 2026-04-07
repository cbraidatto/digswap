"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { challengeTotp } from "@/actions/mfa";
import { BackupCodeInput } from "@/components/auth/backup-code-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 2FA login challenge component.
 *
 * Per UI-SPEC 2FA Copywriting:
 * - Title: "Enter Verification Code"
 * - Body: "Open your authenticator app and enter the 6-digit code."
 * - Submit: "Verify Code"
 * - "Use a backup code instead" toggles to backup code input
 */
export function TotpChallenge() {
	const router = useRouter();
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showBackupCode, setShowBackupCode] = useState(false);

	async function handleSubmit() {
		setIsSubmitting(true);
		setError(null);

		const result = await challengeTotp(code);

		if (!result.success) {
			if (result.error.includes("Too many attempts")) {
				toast.error(result.error);
			} else {
				setError(result.error);
			}
			setIsSubmitting(false);
			return;
		}

		router.push(result.data.redirectTo);
	}

	if (showBackupCode) {
		return <BackupCodeInput onBack={() => setShowBackupCode(false)} />;
	}

	return (
		<div className="space-y-4">
			<p className="text-sm text-muted-foreground">
				Open your authenticator app and enter the 6-digit code.
			</p>

			{error && (
				<div
					className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
					role="alert"
				>
					{error}
				</div>
			)}

			<div className="space-y-2">
				<Label htmlFor="totp-challenge-code">Verification Code</Label>
				<Input
					id="totp-challenge-code"
					type="text"
					inputMode="numeric"
					autoComplete="one-time-code"
					placeholder="000000"
					maxLength={6}
					className="h-11 text-center font-mono text-lg tracking-widest"
					value={code}
					onChange={(e) => {
						const val = e.target.value.replace(/\D/g, "");
						setCode(val);
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" && code.length === 6 && !isSubmitting) {
							handleSubmit();
						}
					}}
					autoFocus
				/>
			</div>

			<Button
				className="h-11 w-full"
				disabled={code.length !== 6 || isSubmitting}
				aria-busy={isSubmitting}
				onClick={handleSubmit}
			>
				{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Verify Code"}
			</Button>

			<div className="text-center">
				<button
					type="button"
					className="text-sm text-primary hover:underline"
					onClick={() => setShowBackupCode(true)}
				>
					Use a backup code instead
				</button>
			</div>
		</div>
	);
}
