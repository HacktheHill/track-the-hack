import assert from "node:assert/strict";
import test from "node:test";
import { type PrismaClient, RoleName } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import {
	createCancellationApiHandler,
	createParticipantSignOutApiHandler,
	createRsvpApiHandler,
} from "@/server/http/participant-lifecycle-handlers";
import { canUseOrganizerAuth } from "@/server/lib/organizer-auth";
import { PrismaHackerLifecycleRepository } from "@/server/repositories/prisma-hacker-lifecycle";
import {
	clearParticipantSessionCookies,
	createParticipantSession,
	createParticipantHintCookie,
	createParticipantSessionCookie,
	createParticipantSessionVerifier,
	participantSessionVerifierFromRequest,
	readParticipantSession,
} from "@/server/lib/participant-session";
import {
	cancelRsvp,
	confirmRsvp,
	consumeClaimToken,
	createCancellationToken,
	createClaimToken,
	issueParticipantAccess,
	provisionHackers,
	provisioningRecordSchema,
	reconcileRsvps,
	type HackerLifecycleRepository,
	type NewParticipantSession,
	type ProvisioningRecord,
} from "@/server/services/hacker-lifecycle";

const participantId = "wvY1HKlwYnFBO8t-YnQbwg";
const cancellationSecret = "a".repeat(32);
const claimSecret = "b".repeat(32);

class MemoryRepository implements HackerLifecycleRepository {
	readonly hackers = new Map<string, ProvisioningRecord & { confirmed: boolean }>();
	readonly capabilities = new Map<string, string>();
	readonly claims = new Map<string, { hackerId: string; expiresAt: Date; consumedAt: Date | null }>();
	readonly sessions = new Map<string, { verifier: string; hackerId: string; expiresAt: Date }>();

	upsertProvisioned(record: ProvisioningRecord) {
		const existing = this.hackers.get(record.id);
		this.hackers.set(record.id, { ...existing, ...record, confirmed: existing?.confirmed ?? false });
		return Promise.resolve();
	}

	confirmAndRotate(id: string, now: Date, capabilityId: string) {
		const hacker = this.hackers.get(id);
		if (!hacker) return Promise.resolve("missing" as const);
		if (hacker.acceptanceExpiry <= now) return Promise.resolve("expired" as const);
		hacker.confirmed = true;
		this.capabilities.set(id, capabilityId);
		return Promise.resolve("confirmed" as const);
	}

	cancelByCapability(capabilityId: string) {
		const entry = [...this.capabilities].find(([, current]) => current === capabilityId);
		if (!entry) return Promise.resolve(null);
		const hacker = this.hackers.get(entry[0]);
		if (!hacker) return Promise.resolve(null);
		hacker.confirmed = false;
		return Promise.resolve(hacker.id);
	}

	reconcile(ids: string[]) {
		return Promise.resolve(
			ids.flatMap(id => {
				const hacker = this.hackers.get(id);
				return hacker
					? [{ id, confirmed: hacker.confirmed, cancellationCapabilityId: this.capabilities.get(id) ?? null }]
					: [];
			}),
		);
	}

	replaceParticipantAccess(record: ProvisioningRecord, claimId: string, expiresAt: Date) {
		const existing = this.hackers.get(record.id);
		this.hackers.set(record.id, { ...existing, ...record, confirmed: existing?.confirmed ?? false });
		for (const [existingId, claim] of this.claims) {
			if (claim.hackerId === record.id) this.claims.delete(existingId);
		}
		for (const [verifier, session] of this.sessions) {
			if (session.hackerId === record.id) this.sessions.delete(verifier);
		}
		this.claims.set(claimId, { hackerId: record.id, expiresAt, consumedAt: null });
		return Promise.resolve();
	}

	redeemClaimToken(claimId: string, now: Date, session: NewParticipantSession) {
		const claim = this.claims.get(claimId);
		if (!claim || claim.consumedAt || claim.expiresAt <= now) return Promise.resolve(null);
		claim.consumedAt = now;
		for (const [verifier, existing] of this.sessions) {
			if (existing.hackerId === claim.hackerId) this.sessions.delete(verifier);
		}
		this.sessions.set(session.verifier, { ...session, hackerId: claim.hackerId });
		return Promise.resolve(claim.hackerId);
	}

	findParticipantSession(verifier: string, now: Date) {
		const session = this.sessions.get(verifier);
		return Promise.resolve(session && session.expiresAt > now ? session : null);
	}

	revokeParticipantSession(verifier: string) {
		this.sessions.delete(verifier);
		return Promise.resolve();
	}
}

const provisionInput = (overrides: Record<string, unknown> = {}) => ({
	id: participantId,
	tShirtSize: "M",
	mealCategory: "HALAL",
	acceptanceExpiry: "2026-09-01T03:59:59.000Z",
	...overrides,
});

void test("minimal provisioning rejects identity, Tally IDs, and weak participant IDs", () => {
	assert.equal(provisioningRecordSchema.safeParse(provisionInput()).success, true);
	assert.equal(provisioningRecordSchema.safeParse(provisionInput({ email: "person@example.com" })).success, false);
	assert.equal(provisioningRecordSchema.safeParse(provisionInput({ tallyApplicationId: "123" })).success, false);
	assert.equal(provisioningRecordSchema.safeParse(provisionInput({ id: "12345" })).success, false);
});

void test("provisioning is idempotent by exact id and preserves confirmation", async () => {
	const repository = new MemoryRepository();
	await provisionHackers(repository, { hackers: [provisionInput()] });
	const hacker = repository.hackers.get(participantId);
	assert.ok(hacker);
	hacker.confirmed = true;
	await provisionHackers(repository, { hackers: [provisionInput({ tShirtSize: "L" })] });
	assert.equal(repository.hackers.size, 1);
	assert.equal(repository.hackers.get(participantId)?.tShirtSize, "L");
	assert.equal(repository.hackers.get(participantId)?.confirmed, true);
});

void test("RSVP and cancellation GET requests cannot change state", async () => {
	let confirmations = 0;
	const rsvp = createRsvpApiHandler(() => {
		confirmations += 1;
		return Promise.resolve();
	});
	const rsvpResponse = responseMock();
	await rsvp({ method: "GET", query: { id: participantId } } as unknown as NextApiRequest, rsvpResponse.response);
	assert.equal(rsvpResponse.statusCode, 405);
	assert.equal(confirmations, 0);
	const postResponse = responseMock();
	await rsvp(
		{ method: "POST", query: { id: participantId }, body: { confirm: true } } as unknown as NextApiRequest,
		postResponse.response,
	);
	assert.equal(postResponse.statusCode, 200);
	assert.equal(confirmations, 1);

	let cancellations = 0;
	const cancel = createCancellationApiHandler(() => {
		cancellations += 1;
		return Promise.resolve();
	});
	const cancelResponse = responseMock();
	await cancel({ method: "GET", body: {} } as unknown as NextApiRequest, cancelResponse.response);
	assert.equal(cancelResponse.statusCode, 405);
	assert.equal(cancellations, 0);
});

void test("confirmation enforces expiry and rotates cancellation authorization", async () => {
	const repository = new MemoryRepository();
	await provisionHackers(repository, { hackers: [provisionInput()] });
	await assert.rejects(confirmRsvp(repository, participantId, new Date("2026-09-02T00:00:00Z")));

	await confirmRsvp(repository, participantId, new Date("2026-08-20T00:00:00Z"), () => "b".repeat(43));
	const oldToken = createCancellationToken("b".repeat(43), cancellationSecret);
	await confirmRsvp(repository, participantId, new Date("2026-08-20T00:00:00Z"), () => "c".repeat(43));
	await assert.rejects(cancelRsvp(repository, oldToken, cancellationSecret));
	const hacker = repository.hackers.get(participantId);
	assert.ok(hacker);
	hacker.acceptanceExpiry = new Date("2020-01-01T00:00:00Z");
	await cancelRsvp(repository, createCancellationToken("c".repeat(43), cancellationSecret), cancellationSecret);
	assert.equal(repository.hackers.get(participantId)?.confirmed, false);
});

void test("confirmation locks the participant before checking the current expiry", async () => {
	const now = new Date("2026-08-20T00:00:00Z");
	const queries: string[] = [];
	const transaction = {
		$queryRaw: (query: TemplateStringsArray) => {
			queries.push(query.join("?"));
			return Promise.resolve([{ acceptanceExpiry: now }]);
		},
		hacker: {
			update: () => {
				throw new Error("An expired participant must not be confirmed");
			},
		},
		cancellationCapability: {
			upsert: () => {
				throw new Error("An expired participant must not receive a cancellation capability");
			},
		},
	};
	const prisma = {
		$transaction: (run: (client: typeof transaction) => Promise<unknown>) => run(transaction),
	} as unknown as PrismaClient;
	const repository = new PrismaHackerLifecycleRepository(prisma);

	assert.equal(await repository.confirmAndRotate(participantId, now, "new-capability"), "expired");
	assert.equal(queries.length, 1);
	assert.match(queries[0] ?? "", /SELECT acceptanceExpiry FROM `Hacker` WHERE id = \? FOR UPDATE/);
});

void test("cancellation rejects a capability replaced before its participant lock", async () => {
	const locks: string[] = [];
	const transaction = {
		cancellationCapability: {
			findUnique: () => Promise.resolve({ hackerId: participantId }),
		},
		$queryRaw: (query: TemplateStringsArray) => {
			const table = query.join("").includes("`Hacker`") ? "hacker" : "capability";
			locks.push(table);
			return Promise.resolve(table === "hacker" ? [{ id: participantId }] : [{ id: "new-capability" }]);
		},
		hacker: {
			update: () => {
				throw new Error("A replaced capability must not cancel the participant");
			},
		},
	};
	const prisma = {
		$transaction: (run: (client: typeof transaction) => Promise<unknown>) => run(transaction),
	} as unknown as PrismaClient;
	const repository = new PrismaHackerLifecycleRepository(prisma);

	assert.equal(await repository.cancelByCapability("old-capability"), null);
	assert.deepEqual(locks, ["hacker", "capability"]);
});

void test("reconciliation is exact and rerunnable", async () => {
	const repository = new MemoryRepository();
	await provisionHackers(repository, { hackers: [provisionInput()] });
	await confirmRsvp(repository, participantId, new Date("2026-08-20T00:00:00Z"), () => "d".repeat(43));
	const missingId = "z".repeat(22);
	const first = await reconcileRsvps(
		repository,
		{ ids: [participantId, missingId] },
		"https://track.example",
		cancellationSecret,
	);
	const second = await reconcileRsvps(
		repository,
		{ ids: [participantId] },
		"https://track.example/",
		cancellationSecret,
	);
	assert.deepEqual(first.missingIds, [missingId]);
	assert.equal(
		first.records[0]?.cancellationLink,
		`https://track.example/cancel#${createCancellationToken("d".repeat(43), cancellationSecret)}`,
	);
	assert.deepEqual(second.records, first.records.slice(0, 1));
});

void test("access issuance accepts one strict operational record and returns a fragment link", async () => {
	const repository = new MemoryRepository();
	const claimId = "e".repeat(43);

	const issued = await issueParticipantAccess(
		repository,
		provisionInput({ walkIn: true }),
		"https://track.example/",
		claimSecret,
		new Date("2026-08-20T00:00:00Z"),
		() => claimId,
	);

	assert.equal(issued.claimUrl, `https://track.example/claim#${createClaimToken(claimId, claimSecret)}`);
	assert.equal(issued.expiresAt.toISOString(), "2026-08-20T00:05:00.000Z");
	assert.equal(repository.hackers.get(participantId)?.walkIn, true);

	// The signature must never reach storage, otherwise a dump is a set of links.
	const stored = repository.claims.get(claimId);
	assert.ok(stored);
	assert.equal(stored.hackerId, participantId);
	assert.equal(stored.consumedAt, null);

	await assert.rejects(
		issueParticipantAccess(
			repository,
			provisionInput({ email: "person@example.com" }),
			"https://track.example",
			claimSecret,
		),
	);
	await assert.rejects(
		issueParticipantAccess(repository, { hackers: [provisionInput()] }, "https://track.example", claimSecret),
	);
});

void test("a claim atomically creates one session and rejects tampering, expiry, and reuse", async () => {
	const repository = new MemoryRepository();
	const issuedAt = new Date("2026-08-20T00:00:00Z");
	const claimId = "f".repeat(43);
	const session = { verifier: "s".repeat(43), expiresAt: new Date("2026-08-21T12:00:00Z") };

	const issued = await issueParticipantAccess(
		repository,
		provisionInput(),
		"https://track.example",
		claimSecret,
		issuedAt,
		() => claimId,
	);
	const token = issued.claimUrl.split("#")[1] ?? "";

	await assert.rejects(consumeClaimToken(repository, token, claimSecret, session, new Date("2026-08-20T00:06:00Z")));
	await assert.rejects(consumeClaimToken(repository, `${claimId}.${"A".repeat(43)}`, claimSecret, session, issuedAt));
	await assert.rejects(consumeClaimToken(repository, token, "z".repeat(32), session, issuedAt));

	assert.equal((await consumeClaimToken(repository, token, claimSecret, session, issuedAt)).hackerId, participantId);
	assert.deepEqual(repository.sessions.get(session.verifier), { ...session, hackerId: participantId });
	await assert.rejects(consumeClaimToken(repository, token, claimSecret, session, issuedAt));
});

void test("two devices racing the same claim produce exactly one participant session", async () => {
	const repository = new MemoryRepository();
	const now = new Date("2026-08-20T00:00:00Z");
	const issued = await issueParticipantAccess(
		repository,
		provisionInput(),
		"https://track.example",
		claimSecret,
		now,
		() => "r".repeat(43),
	);
	const token = issued.claimUrl.split("#")[1] ?? "";
	const attempts = await Promise.allSettled([
		consumeClaimToken(
			repository,
			token,
			claimSecret,
			{ verifier: "1".repeat(43), expiresAt: new Date("2026-08-21T12:00:00Z") },
			now,
		),
		consumeClaimToken(
			repository,
			token,
			claimSecret,
			{ verifier: "2".repeat(43), expiresAt: new Date("2026-08-21T12:00:00Z") },
			now,
		),
	]);

	assert.equal(attempts.filter(attempt => attempt.status === "fulfilled").length, 1);
	assert.equal(attempts.filter(attempt => attempt.status === "rejected").length, 1);
	assert.equal(repository.sessions.size, 1);
});

void test("replacement access preserves RSVP state and revokes the prior claim and live session", async () => {
	const repository = new MemoryRepository();
	const now = new Date("2026-08-20T00:00:00Z");
	const firstSession = { verifier: "u".repeat(43), expiresAt: new Date("2026-08-21T12:00:00Z") };

	const first = await issueParticipantAccess(
		repository,
		provisionInput(),
		"https://track.example",
		claimSecret,
		now,
		() => "g".repeat(43),
	);
	const firstToken = first.claimUrl.split("#")[1] ?? "";
	await consumeClaimToken(repository, firstToken, claimSecret, firstSession, now);
	const hacker = repository.hackers.get(participantId);
	assert.ok(hacker);
	hacker.confirmed = true;

	await issueParticipantAccess(
		repository,
		provisionInput({ tShirtSize: "L" }),
		"https://track.example",
		claimSecret,
		now,
		() => "h".repeat(43),
	);

	await assert.rejects(consumeClaimToken(repository, firstToken, claimSecret, firstSession, now));
	assert.equal(repository.claims.size, 1);
	assert.equal(repository.sessions.size, 0);
	assert.equal(await repository.findParticipantSession(firstSession.verifier, now), null);
	assert.equal(repository.hackers.get(participantId)?.confirmed, true);
	assert.equal(repository.hackers.get(participantId)?.tShirtSize, "L");
});

void test("the participant cookie is opaque and requires an active server-side verifier", async () => {
	const sessionSecret = "s".repeat(32);
	const now = new Date("2026-08-20T00:00:00Z");
	const session = createParticipantSession(sessionSecret, now, () => "v".repeat(43));
	const cookie = createParticipantSessionCookie(session.token, session.expiresAt, now);

	assert.match(cookie, /HttpOnly/);
	assert.match(cookie, /SameSite=Lax/);
	assert.match(cookie, /Max-Age=129600/);
	assert.doesNotMatch(cookie, new RegExp(participantId));
	assert.notEqual(session.token, session.verifier);

	const value = cookie.split(";")[0]?.split("=")[1] ?? "";
	const request = { headers: { cookie: `participant_session=${value}` } };
	const stored = { verifier: session.verifier, hackerId: participantId, expiresAt: session.expiresAt };
	const lookup = (verifier: string) => Promise.resolve(verifier === stored.verifier ? stored : null);

	assert.deepEqual(await readParticipantSession(request, sessionSecret, lookup, now), { hackerId: participantId });
	assert.equal(await readParticipantSession(request, "t".repeat(32), lookup, now), null);
	assert.equal(
		await readParticipantSession(request, sessionSecret, lookup, new Date(session.expiresAt.getTime() + 1000)),
		null,
	);
	assert.equal(await readParticipantSession({ headers: {} }, sessionSecret, lookup, now), null);
});

void test("participant sign-out revokes server state and clears both browser cookies", async () => {
	const sessionSecret = "s".repeat(32);
	const now = new Date("2026-08-20T00:00:00Z");
	const session = createParticipantSession(sessionSecret, now, () => "w".repeat(43));
	const hint = createParticipantHintCookie(session.expiresAt, now);

	assert.match(hint, /^participant_pass=1;/);
	assert.doesNotMatch(hint, /HttpOnly/);
	assert.doesNotMatch(hint, new RegExp(participantId));
	assert.equal(
		await readParticipantSession({ headers: { cookie: hint } }, sessionSecret, () => Promise.resolve(null), now),
		null,
	);

	let revokedVerifier = "";
	const signOut = createParticipantSignOutApiHandler(verifier => {
		revokedVerifier = verifier;
		return Promise.resolve();
	}, sessionSecret);
	const result = responseMock();
	await signOut(
		{
			method: "POST",
			headers: { cookie: `participant_session=${session.token}; ${hint}` },
		} as unknown as NextApiRequest,
		result.response,
	);

	assert.equal(result.statusCode, 204);
	assert.equal(result.ended, true);
	assert.equal(revokedVerifier, session.verifier);
	assert.equal(participantSessionVerifierFromRequest({ headers: {} }, sessionSecret), null);
	assert.equal(createParticipantSessionVerifier(session.token, sessionSecret), revokedVerifier);
	const cleared = result.headers["Set-Cookie"];
	assert.ok(Array.isArray(cleared));
	assert.equal(cleared.length, 2);
	assert.ok((cleared as readonly string[]).every(cookie => cookie.includes("Max-Age=0")));
	assert.deepEqual(clearParticipantSessionCookies(), cleared);
});

void test("organizer auth removes participant providers and enforces verification and provisioning", async () => {
	const findUser = (email: string) =>
		Promise.resolve(
			email === "organizer@ctn-rtc.org"
				? { id: "user", roles: [{ name: RoleName.ORGANIZER }] }
				: email === "replacement@ctn-rtc.org"
					? { id: "replacement", roles: [{ name: RoleName.ORGANIZER }] }
					: null,
		);
	assert.equal(
		await canUseOrganizerAuth(
			{
				provider: "google",
				profileEmail: "organizer@ctn-rtc.org",
				userEmail: "organizer@ctn-rtc.org",
				emailVerified: true,
			},
			findUser,
		),
		true,
	);
	assert.equal(
		await canUseOrganizerAuth(
			{
				provider: "credentials",
				profileEmail: "organizer@ctn-rtc.org",
				userEmail: "organizer@ctn-rtc.org",
				emailVerified: true,
			},
			findUser,
		),
		false,
	);
	assert.equal(
		await canUseOrganizerAuth(
			{
				provider: "google",
				profileEmail: "person@example.com",
				userEmail: "person@example.com",
				emailVerified: true,
			},
			findUser,
		),
		false,
	);
	assert.equal(
		await canUseOrganizerAuth(
			{
				provider: "google",
				profileEmail: "organizer@ctn-rtc.org",
				userEmail: "organizer@ctn-rtc.org",
				emailVerified: false,
			},
			findUser,
		),
		false,
	);
	assert.equal(
		await canUseOrganizerAuth(
			{
				provider: "google",
				profileEmail: "missing@ctn-rtc.org",
				userEmail: "missing@ctn-rtc.org",
				emailVerified: true,
			},
			findUser,
		),
		false,
	);
	assert.equal(
		await canUseOrganizerAuth(
			{
				provider: "google",
				profileEmail: "replacement@ctn-rtc.org",
				userEmail: "organizer@ctn-rtc.org",
				emailVerified: true,
			},
			findUser,
		),
		false,
	);
	assert.equal(
		await canUseOrganizerAuth(
			{
				provider: "google",
				profileEmail: "replacement@ctn-rtc.org",
				userEmail: "replacement@ctn-rtc.org",
				emailVerified: true,
			},
			findUser,
			"user",
		),
		false,
	);
	assert.equal(
		await canUseOrganizerAuth(
			{
				provider: "google",
				profileEmail: "replacement@ctn-rtc.org",
				userEmail: "replacement@ctn-rtc.org",
				emailVerified: true,
			},
			findUser,
		),
		true,
	);
});

const responseMock = () => {
	const result: {
		statusCode: number;
		body?: unknown;
		headers: Record<string, number | string | readonly string[]>;
		ended: boolean;
		response: NextApiResponse;
	} = {
		statusCode: 0,
		headers: {},
		ended: false,
		response: {} as NextApiResponse,
	};
	result.response = {
		setHeader: (name: string, value: number | string | readonly string[]) => {
			result.headers[name] = value;
			return result.response;
		},
		status: (code: number) => {
			result.statusCode = code;
			return result.response;
		},
		json: (body: unknown) => {
			result.body = body;
			return result.response;
		},
		end: () => {
			result.ended = true;
			return result.response;
		},
	} as unknown as NextApiResponse;
	return result;
};
