import type { RoleName } from "@prisma/client";

export const ORGANIZER_EMAIL_DOMAIN = "ctn-rtc.org";
export const DEVELOPMENT_AUTH_PROVIDER_ID = "development";
export const DEVELOPMENT_ORGANIZER_EMAIL = "dev-organizer@ctn-rtc.org";

type DevelopmentAuthEnvironment = {
	DEV_AUTH_ENABLED?: string;
	NODE_ENV?: string;
	NEXTAUTH_URL?: string;
};

const hasLoopbackNextAuthUrl = (value: string | undefined) => {
	try {
		const { hostname, protocol } = new URL(value ?? "");
		return (
			(protocol === "http:" || protocol === "https:") &&
			(hostname === "localhost" || hostname === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(hostname))
		);
	} catch {
		return false;
	}
};

const hasLoopbackRequestHost = (value: string | undefined) => {
	if (value === undefined) return false;
	try {
		const { hostname } = new URL(`http://${value}`);
		return hostname === "localhost" || hostname === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(hostname);
	} catch {
		return false;
	}
};

const hasLoopbackPeerAddress = (value: string | undefined) =>
	value === "::1" || /^127(?:\.\d{1,3}){3}$/.test(value ?? "") || /^::ffff:127(?:\.\d{1,3}){3}$/i.test(value ?? "");

export const isDevelopmentOrganizerAuthEnabled = (
	environment: DevelopmentAuthEnvironment,
	requestHost?: string,
	requestPeerAddress?: string,
) =>
	environment.DEV_AUTH_ENABLED === "1" &&
	environment.NODE_ENV === "development" &&
	hasLoopbackNextAuthUrl(environment.NEXTAUTH_URL) &&
	hasLoopbackRequestHost(requestHost) &&
	hasLoopbackPeerAddress(requestPeerAddress);

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

type DevelopmentOrganizerSignInInput = {
	provider: string | null | undefined;
	userId: string | undefined;
	userEmail: string | null | undefined;
	sessionUserId: string | undefined;
};

export const normalizeOrganizerEmail = (email: string) => email.trim().toLowerCase();

export const canUseDevelopmentOrganizerAuth = (
	input: DevelopmentOrganizerSignInInput,
	environment: DevelopmentAuthEnvironment,
	requestHost?: string,
	requestPeerAddress?: string,
) =>
	isDevelopmentOrganizerAuthEnabled(environment, requestHost, requestPeerAddress) &&
	input.provider === DEVELOPMENT_AUTH_PROVIDER_ID &&
	!!input.userEmail &&
	normalizeOrganizerEmail(input.userEmail) === DEVELOPMENT_ORGANIZER_EMAIL &&
	(!input.sessionUserId || input.sessionUserId === input.userId);

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
