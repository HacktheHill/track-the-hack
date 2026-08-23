import type { RoleName } from "@prisma/client";

export const ORGANIZER_EMAIL_DOMAIN = "ctn-rtc.org";

type OrganizerUser = {
	id: string;
	roles: { name: RoleName }[];
};

type OrganizerSignInInput = {
	provider: string | null | undefined;
	profileEmail: string | null | undefined;
	userEmail: string | null | undefined;
	emailVerified: boolean;
};

export const normalizeOrganizerEmail = (email: string) => email.trim().toLowerCase();

export const hasOrganizerEmailDomain = (email: string) => {
	const normalized = normalizeOrganizerEmail(email);
	const [localPart, domain, extra] = normalized.split("@");
	return !!localPart && domain === ORGANIZER_EMAIL_DOMAIN && extra === undefined;
};

export const canUseOrganizerAuth = async (
	input: OrganizerSignInInput,
	findUserByEmail: (email: string) => Promise<OrganizerUser | null>,
	sessionUserId?: string,
) => {
	if (input.provider !== "google" || !input.profileEmail || !input.userEmail || !input.emailVerified) {
		return false;
	}

	if (
		!hasOrganizerEmailDomain(input.profileEmail) ||
		normalizeOrganizerEmail(input.profileEmail) !== normalizeOrganizerEmail(input.userEmail)
	) {
		return false;
	}

	const user = await findUserByEmail(normalizeOrganizerEmail(input.profileEmail));
	return !!user && user.roles.length > 0 && (!sessionUserId || user.id === sessionUserId);
};
