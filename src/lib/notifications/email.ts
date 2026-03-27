import { Resend } from "resend";

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
		if (!process.env.RESEND_API_KEY) return;
		const resend = new Resend(process.env.RESEND_API_KEY);
		const from =
			process.env.RESEND_FROM_EMAIL || "DigSwap <onboarding@resend.dev>";
		const appUrl =
			process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

		await resend.emails.send({
			from,
			to,
			subject: "Someone has a record from your wantlist",
			html: `<div style="font-family: monospace; background: #10141a; color: #dfe2eb; padding: 24px;">
  <h2 style="color: #6fdd78;">Wantlist Match Found</h2>
  <p><strong>${recordTitle}</strong> by ${recordArtist}</p>
  <p>User <strong>${ownerUsername}</strong> has this record in their collection.</p>
  <p><a href="${appUrl}/perfil/${ownerUsername}" style="color: #aac7ff;">View their profile</a></p>
</div>`,
		});
	} catch (error) {
		console.error("Failed to send wantlist match email:", error);
	}
}
