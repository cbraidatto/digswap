"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useBackupCode as consumeBackupCode } from "@/actions/mfa";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Backup code entry component for 2FA login.
 *
 * - Single text input for 8-character alphanumeric backup code
 * - Submit: "Use Backup Code"
 * - Warns if this is the last backup code
 * - "Back to authenticator code" link toggles back to TOTP challenge
 */
export function BackupCodeInput({ onBack }: { onBack: () => void }) {
	const router = useRouter();
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [lastCodeWarning, setLastCodeWarning] = useState(false);

	async function handleSubmit() {
		setIsSubmitting(true);
		setError(null);
		setLastCodeWarning(false);

		const result = await consumeBackupCode(code);

		if (!result.success) {
			if (result.error.includes("Too many attempts")) {
				toast.error(result.error);
			} else {
				setError(result.error);
			}
			setIsSubmitting(false);
			return;
		}

		// Check if this was the last backup code
		if (result.data.remainingCodes === 0) {
			setLastCodeWarning(true);
			toast.warning("This was your last backup code. Please re-enable 2FA to generate new codes.");
			// Brief delay so user sees the warning before redirect
			setTimeout(() => {
				router.push(result.data.redirectTo);
			}, 2000);
			setIsSubmitting(false);
			return;
		}

		router.push(result.data.redirectTo);
	}

	return (
		<div className="space-y-4">
			<p className="text-sm text-muted-foreground">Enter one of your backup codes to sign in.</p>

			{error && (
				<div
					className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
					role="alert"
				>
					{error}
				</div>
			)}

			{lastCodeWarning && (
				<Alert variant="destructive">
					<AlertTriangle className="size-4" />
					<AlertTitle>Last backup code used</AlertTitle>
					<AlertDescription>
						This is your last backup code. Please re-enable 2FA to generate new codes.
					</AlertDescription>
				</Alert>
			)}

			<div className="space-y-2">
				<Label htmlFor="backup-code">Backup Code</Label>
				<Input
					id="backup-code"
					type="text"
					autoComplete="off"
					placeholder="XXXXXXXX"
					maxLength={8}
					className="h-11 text-center font-mono text-lg tracking-widest uppercase"
					value={code}
					onChange={(e) => {
						const val = e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
						setCode(val);
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" && code.length > 0 && !isSubmitting) {
							handleSubmit();
						}
					}}
					autoFocus
				/>
			</div>

			<Button
				className="h-11 w-full"
				disabled={code.length === 0 || isSubmitting}
				aria-busy={isSubmitting}
				onClick={handleSubmit}
			>
				{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Use Backup Code"}
			</Button>

			<div className="text-center">
				<button type="button" className="text-sm text-primary hover:underline" onClick={onBack}>
					Back to authenticator code
				</button>
			</div>
		</div>
	);
}
