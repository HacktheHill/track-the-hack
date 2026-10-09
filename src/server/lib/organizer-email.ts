import nodemailer from "nodemailer";
import { z } from "zod";
import type { SendVerificationRequestParams } from "next-auth/providers/email";
import { prisma } from "@/server/db";
import { normalizeOrganizerEmail } from "@/server/lib/organizer-auth";
import { isSignInEmailAllowed } from "@/server/lib/organizer-adapter";
import { createOrganizerEmailConfirmationUrl } from "@/server/lib/organizer-email-confirmation";

const escapeHtml = (value: string) =>
	value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const smtpServerSchema = z
	.object({
		host: z.string(),
		port: z.number().int().min(1).max(65535),
		auth: z.object({ user: z.string(), pass: z.string() }),
	})
	.passthrough();

export const failedOrganizerEmailRecipients = (result: {
	rejected?: readonly unknown[];
	pending?: readonly unknown[];
}) => [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);

export const sendOrganizerVerificationRequest = async ({
	identifier,
	url,
	provider,
}: SendVerificationRequestParams) => {
	const email = normalizeOrganizerEmail(identifier);
	// Silently do nothing for unknown addresses so the sign-in page cannot be
	// used to enumerate the organiser allowlist.
	if (!(await isSignInEmailAllowed(prisma, email))) return;

	const host = new URL(url).host;
	const confirmationUrl = createOrganizerEmailConfirmationUrl(url);
	// NextAuth v4's legacy Nodemailer subpath types resolve to any with Nodemailer 10.
	// Validate the configured SMTP options at that boundary; URLs remain supported.
	const server: unknown = provider.server;
	const transport = nodemailer.createTransport(typeof server === "string" ? server : smtpServerSchema.parse(server));
	const result = await transport.sendMail({
		to: email,
		from: provider.from,
		subject: `Sign in to ${host}`,
		text: `Open the link below, then choose Continue signing in to ${host}:\n${confirmationUrl}\n\nThis link expires shortly and can be used only once.`,
		html: `<p>Use the button below to sign in to <strong>${escapeHtml(host)}</strong>.</p>
			<p><a href="${escapeHtml(confirmationUrl)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#e67300;color:#fff;text-decoration:none;font-weight:bold">Review sign-in</a></p>
			<p>On the page that opens, choose <strong>Continue signing in</strong>. This extra step prevents automated email security checks from using your link.</p>
			<p>This link expires shortly and can be used only once. If you did not request it, you can ignore this email.</p>`,
	});
	const failed = failedOrganizerEmailRecipients(result);
	if (failed.length > 0) throw new Error("Organizer sign-in email could not be sent");
};
