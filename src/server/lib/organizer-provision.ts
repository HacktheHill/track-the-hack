import { z } from "zod";
import { normalizeOrganizerEmail } from "./organizer-auth";

const emailSchema = z.string().trim().email().max(191);

export function parseOrganizerProvisionInput(argv: string[], environment: Record<string, string | undefined>) {
	const [argumentEmail, argumentMode, ...extraArguments] = argv;
	if (argumentEmail !== undefined) {
		const parsedEmail = emailSchema.safeParse(argumentEmail);
		if (
			!parsedEmail.success ||
			extraArguments.length > 0 ||
			(argumentMode !== undefined && argumentMode !== "--admin")
		)
			throw new Error("Usage: npm run organizer:provision -- organizer@example.com [--admin]");
		return { email: normalizeOrganizerEmail(parsedEmail.data), admin: argumentMode === "--admin" };
	}

	const parsedEmail = emailSchema.safeParse(environment.ORGANIZER_PROVISION_EMAIL);
	const administrator = environment.ORGANIZER_PROVISION_ADMINISTRATOR;
	if (!parsedEmail.success || (administrator !== "true" && administrator !== "false")) {
		throw new Error("Production provisioning requires a valid email and administrator boolean");
	}
	return { email: normalizeOrganizerEmail(parsedEmail.data), admin: administrator === "true" };
}
