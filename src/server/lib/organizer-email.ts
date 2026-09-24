import nodemailer from "nodemailer";
import type { SendVerificationRequestParams } from "next-auth/providers/email";
import { prisma } from "@/server/db";
import { isOrganizerEmailAllowed, normalizeOrganizerEmail } from "@/server/lib/organizer-auth";

const escapeHtml = (value: string) =>
	value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export const sendOrganizerVerificationRequest = async ({
	identifier,
	url,
	provider,
}: SendVerificationRequestParams) => {
	const email = normalizeOrganizerEmail(identifier);
	// Silently do nothing for unknown addresses so the sign-in page cannot be
	// used to enumerate the organiser allowlist.
	if (!(await isOrganizerEmailAllowed(prisma, email))) return;

	const host = new URL(url).host;
	const transport = nodemailer.createTransport(provider.server);
	const result = await transport.sendMail({
		to: email,
		from: provider.from,
		subject: `Sign in to ${host}`,
		text: `Sign in to ${host}\n${url}\n\nThis link expires shortly and can be used only once.`,
		html: `<p>Use the button below to sign in to <strong>${escapeHtml(host)}</strong>.</p>
			<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#e67300;color:#fff;text-decoration:none;font-weight:bold">Sign in</a></p>
			<p>This link expires shortly and can be used only once. If you did not request it, you can ignore this email.</p>`,
	});
	const failed = [...result.rejected, ...result.pending].filter(Boolean);
	if (failed.length > 0) throw new Error("Organizer sign-in email could not be sent");
};
