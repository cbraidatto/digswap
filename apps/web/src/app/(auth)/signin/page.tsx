import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata = {
	title: "Welcome Back | DigSwap",
	description: "Sign in to your DigSwap account.",
};

export default async function SignInPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const params = await searchParams;
	const oauthError = params.error;

	return (
		<AuthCard
			title="Welcome Back"
			subtitle={oauthError ? `Could not connect to ${oauthError}. Please try again.` : undefined}
			footer={
				<p>
					New to DigSwap?{" "}
					<Link href="/signup" className="text-primary hover:underline">
						Create an account
					</Link>
				</p>
			}
		>
			<SignInForm />
		</AuthCard>
	);
}
