import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

export const ORGANIZER_EMAIL_DOMAIN = "ctn-rtc.org";
export const DEVELOPMENT_AUTH_PROVIDER_ID = "development";
export const DEVELOPMENT_ORGANIZER_EMAIL = "dev.organizer@ctn-rtc.org";

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

type DevelopmentOrganizerSignInInput = {
	provider: string | null | undefined;
	userId: string;
	userEmail: string | null | undefined;
	sessionUserId: string | undefined;
};

const googleOrganizerProfileSchema = z.object({
	email: z.string().email(),
	email_verified: z.boolean(),
	hd: z.string(),
});

export const parseGoogleOrganizerProfile = (profile: unknown) => {
	const result = googleOrganizerProfileSchema.safeParse(profile);
	if (!result.success) return undefined;
	return {
		email: result.data.email,
		emailVerified: result.data.email_verified,
		hostedDomain: result.data.hd,
	};
};

export const normalizeOrganizerEmail = (email: string) => email.trim().toLowerCase();

export const hasOrganizerEmailDomain = (email: string) => {
	const normalized = normalizeOrganizerEmail(email);
	const [localPart, domain, extra] = normalized.split("@");
	return !!localPart && domain === ORGANIZER_EMAIL_DOMAIN && extra === undefined;
};

// CTN role and shared mailboxes use non-personal local parts. Automatic access
// is limited to the Workspace naming convention for an individual organiser.
export const isNamedCtnOrganizerEmail = (email: string) => {
	const normalized = normalizeOrganizerEmail(email);
	if (!hasOrganizerEmailDomain(normalized)) return false;
	const [localPart] = normalized.split("@");
	return /^[a-z]+(?:-[a-z]+)*\.[a-z]+(?:-[a-z]+)*$/.test(localPart ?? "");
};

export const canUseGoogleOrganizerAuth = (input: {
	provider: string | null | undefined;
	profileEmail: string | null | undefined;
	userEmail: string | null | undefined;
	emailVerified: boolean;
	hostedDomain: string | null | undefined;
}) =>
	input.provider === "google" &&
	!!input.profileEmail &&
	!!input.userEmail &&
	input.emailVerified &&
	input.hostedDomain === ORGANIZER_EMAIL_DOMAIN &&
	isNamedCtnOrganizerEmail(input.profileEmail) &&
	normalizeOrganizerEmail(input.profileEmail) === normalizeOrganizerEmail(input.userEmail);

export const canUseDevelopmentOrganizerAuth = (
	input: DevelopmentOrganizerSignInInput,
	environment: DevelopmentAuthEnvironment,
	requestHost?: string,
	requestPeerAddress?: string,
) =>
	isDevelopmentOrganizerAuthEnabled(environment, requestHost, requestPeerAddress) &&
	input.provider === DEVELOPMENT_AUTH_PROVIDER_ID &&
	input.userId.length > 0 &&
	!!input.userEmail &&
	normalizeOrganizerEmail(input.userEmail) === DEVELOPMENT_ORGANIZER_EMAIL &&
	(input.sessionUserId === undefined || input.sessionUserId === input.userId);

type OrganizerAllowlistPrisma = Pick<PrismaClient, "organizerAccess">;
type AccessPrisma = OrganizerAllowlistPrisma & Pick<PrismaClient, "user">;

export type OrganizerAccessContext = {
	id: string;
	name: string | null;
	email: string;
	isOrganizer: true;
	isAdmin: boolean;
};

export const isOrganizerEmailAllowed = async (prisma: OrganizerAllowlistPrisma, rawEmail: string) => {
	const email = normalizeOrganizerEmail(rawEmail);
	if (hasOrganizerEmailDomain(email)) return isNamedCtnOrganizerEmail(email);
	return (await prisma.organizerAccess.findUnique({ where: { email }, select: { id: true } })) !== null;
};

// Secure organiser checks re-read current database state. Session flags are
// useful for presentation only and are never the authority for mutations.
export const getOrganizerAccess = async (
	prisma: AccessPrisma,
	userId: string,
): Promise<OrganizerAccessContext | null> => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, name: true, email: true, isAdmin: true, disabledAt: true },
	});
	if (!user?.email || user.disabledAt) return null;
	if (!(await isOrganizerEmailAllowed(prisma, user.email))) return null;
	return {
		id: user.id,
		name: user.name,
		email: normalizeOrganizerEmail(user.email),
		isOrganizer: true,
		isAdmin: user.isAdmin,
	};
};
