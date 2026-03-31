import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import Link from "next/link";

export const metadata = {
	title: "Create Your Account | DigSwap",
	description: "Sign up for DigSwap and start discovering vinyl records.",
};

export default function SignUpPage() {
	return (
		<AuthCard
			title="Create Your Account"
			footer={
				<p>
					Already have an account?{" "}
					<Link
						href="/signin"
						className="text-primary hover:underline"
					>
						Sign in
					</Link>
				</p>
			}
		>
			<SignUpForm />
		</AuthCard>
	);
}
