"use client";

import { useState, useCallback } from "react";
import { Loader2, Check, Copy, Shield } from "lucide-react";
import { toast } from "sonner";

import { enrollTotp, verifyTotpEnrollment } from "@/actions/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";

type SetupStep = "loading" | "scan" | "verify" | "success";

interface EnrollmentData {
	factorId: string;
	qrCode: string;
	uri: string;
	backupCodes: string[];
}

/**
 * 2FA enrollment component with multi-step flow:
 * 1. Loading: Call enrollTotp() to generate factor
 * 2. Scan: Display QR code and backup codes
 * 3. Verify: Enter 6-digit TOTP code to confirm enrollment
 * 4. Success: Confirmation that 2FA is enabled
 *
 * Per UI-SPEC: QR code placeholder is gray 200x200px skeleton while loading.
 */
export function TotpSetup({ onComplete }: { onComplete?: () => void }) {
	const [step, setStep] = useState<SetupStep>("loading");
	const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [codesCopied, setCodesCopied] = useState(false);
	const [hasStarted, setHasStarted] = useState(false);

	const startEnrollment = useCallback(async () => {
		if (hasStarted) return;
		setHasStarted(true);
		setStep("loading");
		setError(null);

		const result = await enrollTotp();

		if (!result.success) {
			setError(result.error);
			setStep("loading");
			setHasStarted(false);
			return;
		}

		setEnrollment(result.data);
		setStep("scan");
	}, [hasStarted]);

	// Auto-start enrollment on first render
	if (!hasStarted) {
		startEnrollment();
	}

	async function handleVerify() {
		if (!enrollment) return;

		setIsSubmitting(true);
		setError(null);

		const result = await verifyTotpEnrollment(enrollment.factorId, code);

		if (!result.success) {
			setError(result.error);
			setIsSubmitting(false);
			return;
		}

		setStep("success");
		setIsSubmitting(false);
		toast.success("Two-factor authentication enabled.");
		onComplete?.();
	}

	async function copyBackupCodes() {
		if (!enrollment) return;

		const codesText = enrollment.backupCodes.join("\n");
		try {
			await navigator.clipboard.writeText(codesText);
			setCodesCopied(true);
			toast.success("Backup codes copied to clipboard.");
			setTimeout(() => setCodesCopied(false), 3000);
		} catch {
			toast.error("Failed to copy. Please select and copy manually.");
		}
	}

	// Loading state
	if (step === "loading" && !error) {
		return (
			<div className="space-y-6">
				<div className="flex flex-col items-center gap-4">
					<Skeleton className="h-[200px] w-[200px] rounded-lg" />
					<Skeleton className="h-4 w-48" />
				</div>
			</div>
		);
	}

	// Error during loading
	if (step === "loading" && error) {
		return (
			<div className="space-y-4">
				<Alert variant="destructive">
					<AlertTitle>Setup failed</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
				<Button
					variant="outline"
					className="w-full"
					onClick={() => {
						setHasStarted(false);
						setError(null);
					}}
				>
					Try Again
				</Button>
			</div>
		);
	}

	// Step: Scan QR code and save backup codes
	if (step === "scan" && enrollment) {
		return (
			<div className="space-y-6">
				{/* QR Code */}
				<div className="flex flex-col items-center gap-3">
					<div
						className="rounded-lg bg-white p-3"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: QR code SVG from Supabase MFA enrollment API
						dangerouslySetInnerHTML={{ __html: enrollment.qrCode }}
					/>
					<p className="text-center text-sm text-muted-foreground">
						Scan this QR code with your authenticator app, then enter the
						6-digit code to verify.
					</p>
				</div>

				{/* Backup Codes */}
				<div className="space-y-3">
					<Alert>
						<Shield className="size-4" />
						<AlertTitle>Save your backup codes</AlertTitle>
						<AlertDescription>
							Save these codes in a safe place. Each code can only be used
							once.
						</AlertDescription>
					</Alert>

					<div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/50 p-4">
						{enrollment.backupCodes.map((backupCode) => (
							<code
								key={backupCode}
								className="rounded bg-background px-2 py-1 text-center font-mono text-sm text-foreground"
							>
								{backupCode}
							</code>
						))}
					</div>

					<Button
						variant="outline"
						size="sm"
						className="w-full"
						onClick={copyBackupCodes}
					>
						{codesCopied ? (
							<>
								<Check className="size-4" data-icon="inline-start" />
								Copied
							</>
						) : (
							<>
								<Copy className="size-4" data-icon="inline-start" />
								Copy Backup Codes
							</>
						)}
					</Button>
				</div>

				<Button className="h-11 w-full" onClick={() => setStep("verify")}>
					Continue to Verification
				</Button>
			</div>
		);
	}

	// Step: Verify TOTP code
	if (step === "verify") {
		return (
			<div className="space-y-4">
				<p className="text-sm text-muted-foreground">
					Enter the 6-digit code from your authenticator app to complete
					setup.
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
					<Label htmlFor="totp-code">Verification Code</Label>
					<Input
						id="totp-code"
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
						autoFocus
					/>
				</div>

				<Button
					className="h-11 w-full"
					disabled={code.length !== 6 || isSubmitting}
					aria-busy={isSubmitting}
					onClick={handleVerify}
				>
					{isSubmitting ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						"Verify and Enable"
					)}
				</Button>

				<Button
					variant="ghost"
					className="w-full"
					onClick={() => setStep("scan")}
				>
					Back to QR Code
				</Button>
			</div>
		);
	}

	// Step: Success
	if (step === "success") {
		return (
			<div className="flex flex-col items-center gap-4 py-4">
				<div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
					<Check className="size-8 text-primary" />
				</div>
				<div className="text-center">
					<h3 className="font-heading text-lg font-semibold text-foreground">
						Two-Factor Authentication Enabled
					</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						Your account is now protected with an additional layer of
						security.
					</p>
				</div>
			</div>
		);
	}

	return null;
}
