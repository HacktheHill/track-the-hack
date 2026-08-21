import type { IncomingMessage } from "http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PARTICIPANT_HINT_COOKIE } from "../../utils/participant-pass";

// NOTE: deliberately not NextAuth. NextAuth brings accounts, providers and an
// adapter, and a participant has no account at all. If Daniel or Kai would
// rather this went through NextAuth, the swap is contained to this file and
// whoever calls readParticipantSession.
const COOKIE_NAME = "participant_session";
const SESSION_TTL_SECONDS = 36 * 60 * 60;

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export const participantSessionExpiry = (now = new Date()) => new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

export const createParticipantSessionCookie = (hackerId: string, secret: string, expiresAt: Date) => {
	// The expiry is inside the signed payload, so it cannot be extended by hand.
	const payload = `${hackerId}.${expiresAt.getTime()}`;
	const value = `${payload}.${sign(payload, secret)}`;

	// Secure is dropped outside production, otherwise the cookie never arrives
	// over plain http://localhost and nothing can be tested locally.
	return [
		`${COOKIE_NAME}=${value}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${SESSION_TTL_SECONDS}`,
		process.env.NODE_ENV === "production" ? "Secure" : "",
	]
		.filter(Boolean)
		.join("; ");
};

// Readable by scripts on purpose. It only tells the navigation whether to show
// a link to the pass. It carries nothing and proves nothing: forging it gets you
// a link that /profile will bounce you off, because that page reads the signed
// cookie above instead.
export const createParticipantHintCookie = () =>
	[`${PARTICIPANT_HINT_COOKIE}=1`, "Path=/", "SameSite=Lax", `Max-Age=${SESSION_TTL_SECONDS}`].join("; ");

export const clearParticipantSessionCookies = () => [
	`${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
	`${PARTICIPANT_HINT_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`,
];

export const readParticipantSession = (req: Pick<IncomingMessage, "headers">, secret: string, now = new Date()) => {
	const raw = req.headers.cookie
		?.split(";")
		.map(part => part.trim())
		.find(part => part.startsWith(`${COOKIE_NAME}=`))
		?.slice(COOKIE_NAME.length + 1);

	if (!raw) return null;

	const [hackerId, expiryText, suppliedSignature, extra] = raw.split(".");
	if (!hackerId || !expiryText || !suppliedSignature || extra !== undefined) {
		return null;
	}

	const supplied = Buffer.from(suppliedSignature);
	const expected = Buffer.from(sign(`${hackerId}.${expiryText}`, secret));
	if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
		return null;
	}

	const expiresAt = Number(expiryText);
	if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
		return null;
	}

	return { hackerId };
};
