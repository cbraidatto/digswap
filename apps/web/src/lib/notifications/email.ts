import { Resend } from "resend";
import { env, publicEnv } from "@/lib/env";

function escapeHtml(unsafe: string): string {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Send a wantlist match notification email to a user.
 *
 * Non-fatal: catches all errors and logs to console.
 * Email failure should never break the add-record flow (per D-16).
 */
export async function sendWantlistMatchEmail(
	to: string,
	recordTitle: string,
	recordArtist: string,
	ownerUsername: string,
): Promise<void> {
	try {
		if (!env.RESEND_API_KEY) return;
		const resend = new Resend(env.RESEND_API_KEY);
		const from = env.RESEND_FROM_EMAIL || "DigSwap <onboarding@resend.dev>";
		const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;

		const safeTitle = escapeHtml(recordTitle);
		const safeArtist = escapeHtml(recordArtist);
		const safeUsername = escapeHtml(ownerUsername);

		await resend.emails.send({
			from,
			to,
			subject: "Someone has a record from your wantlist",
			html: `<div style="font-family: monospace; background: #10141a; color: #dfe2eb; padding: 24px;">
  <h2 style="color: #6fdd78;">Wantlist Match Found</h2>
  <p><strong>${safeTitle}</strong> by ${safeArtist}</p>
  <p>User <strong>${safeUsername}</strong> has this record in their collection.</p>
  <p><a href="${appUrl}/perfil/${safeUsername}" style="color: #aac7ff;">View their profile</a></p>
</div>`,
		});
	} catch (error) {
		console.error("Failed to send wantlist match email:", error);
	}
}
