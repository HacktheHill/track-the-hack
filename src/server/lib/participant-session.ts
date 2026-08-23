import type { IncomingMessage } from "http";
import { createHmac, randomBytes } from "node:crypto";
import { PARTICIPANT_HINT_COOKIE } from "@/utils/participant-pass";
import type { ParticipantSessionRecord } from "@/server/services/hacker-lifecycle";

const COOKIE_NAME = "participant_session";
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SESSION_TTL_SECONDS = 36 * 60 * 60;

type ParticipantSessionLookup = (verifier: string, now: Date) => Promise<ParticipantSessionRecord | null>;

const cookieSecurityAttribute = () => (process.env.NODE_ENV === "production" ? "Secure" : "");

const cookieMaxAge = (expiresAt: Date, now: Date) =>
	Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

const readCookieValue = (req: Pick<IncomingMessage, "headers">, name: string) =>
	req.headers.cookie
		?.split(";")
		.map(part => part.trim())
		.find(part => part.startsWith(`${name}=`))
		?.slice(name.length + 1) ?? null;

export const participantSessionExpiry = (now = new Date()) => new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

// Domain separation makes the stored verifier specific to participant
// sessions even if the same deployment secret is accidentally reused.
export const createParticipantSessionVerifier = (token: string, secret: string) =>
	createHmac("sha256", secret).update(`participant-session:${token}`).digest("base64url");

export const createParticipantSession = (
	secret: string,
	now = new Date(),
	createToken = () => randomBytes(32).toString("base64url"),
) => {
	const token = createToken();
	if (!SESSION_TOKEN_PATTERN.test(token)) {
		throw new Error("Participant session token generator returned an invalid token");
	}

	return {
		token,
		verifier: createParticipantSessionVerifier(token, secret),
		expiresAt: participantSessionExpiry(now),
	};
};

export const createParticipantSessionCookie = (token: string, expiresAt: Date, now = new Date()) => {
	if (!SESSION_TOKEN_PATTERN.test(token)) {
		throw new Error("Cannot create a cookie from an invalid participant session token");
	}

	return [
		`${COOKIE_NAME}=${token}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${cookieMaxAge(expiresAt, now)}`,
		`Expires=${expiresAt.toUTCString()}`,
		cookieSecurityAttribute(),
	]
		.filter(Boolean)
		.join("; ");
};

// Readable by scripts on purpose. It only tells the navigation whether to show
// a link to the pass. It carries nothing and proves nothing.
export const createParticipantHintCookie = (expiresAt = participantSessionExpiry(), now = new Date()) =>
	[
		`${PARTICIPANT_HINT_COOKIE}=1`,
		"Path=/",
		"SameSite=Lax",
		`Max-Age=${cookieMaxAge(expiresAt, now)}`,
		`Expires=${expiresAt.toUTCString()}`,
		cookieSecurityAttribute(),
	]
		.filter(Boolean)
		.join("; ");

export const clearParticipantSessionCookies = () => {
	const secure = cookieSecurityAttribute();
	return [
		[
			`${COOKIE_NAME}=`,
			"Path=/",
			"HttpOnly",
			"SameSite=Lax",
			"Max-Age=0",
			"Expires=Thu, 01 Jan 1970 00:00:00 GMT",
			secure,
		]
			.filter(Boolean)
			.join("; "),
		[
			`${PARTICIPANT_HINT_COOKIE}=`,
			"Path=/",
			"SameSite=Lax",
			"Max-Age=0",
			"Expires=Thu, 01 Jan 1970 00:00:00 GMT",
			secure,
		]
			.filter(Boolean)
			.join("; "),
	];
};

export const participantSessionVerifierFromRequest = (req: Pick<IncomingMessage, "headers">, secret: string) => {
	const token = readCookieValue(req, COOKIE_NAME);
	return token && SESSION_TOKEN_PATTERN.test(token) ? createParticipantSessionVerifier(token, secret) : null;
};

// Authentication always resolves the keyed verifier against server-side
// state. Replacement issuance and sign-out delete that state, so old cookies
// stop authorizing immediately rather than waiting for their browser expiry.
export const readParticipantSession = async (
	req: Pick<IncomingMessage, "headers">,
	secret: string,
	lookup: ParticipantSessionLookup,
	now = new Date(),
) => {
	const verifier = participantSessionVerifierFromRequest(req, secret);
	if (!verifier) return null;

	const session = await lookup(verifier, now);
	if (!session || session.verifier !== verifier || session.expiresAt.getTime() <= now.getTime()) {
		return null;
	}

	return { hackerId: session.hackerId };
};
