import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerificationButton } from "./resend-button";

export const metadata = {
	title: "Verify Your Email | DigSwap",
	description: "Check your inbox for the verification link to activate your DigSwap account.",
};

export default async function VerifyEmailPage({
	searchParams,
}: {
	searchParams: Promise<{ email?: string }>;
}) {
	const params = await searchParams;
	const email = params.email || "";

	return (
		<AuthCard
			title="Verify Your Email"
			footer={
				<p>
					<Link href="/signin" className="text-primary hover:underline">
						Back to Sign In
					</Link>
				</p>
			}
		>
			<div className="space-y-6">
				<p className="text-sm leading-relaxed text-muted-foreground">
					We sent a verification link to{" "}
					{email ? <span className="font-semibold text-foreground">{email}</span> : "your email"}.
					Check your inbox and click the link to activate your account.
				</p>

				<ResendVerificationButton email={email} />
			</div>
		</AuthCard>
	);
}
