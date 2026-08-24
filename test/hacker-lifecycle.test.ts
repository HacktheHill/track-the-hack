import assert from "node:assert/strict";
import test from "node:test";
import { RoleName } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { createCancellationApiHandler, createRsvpApiHandler } from "../src/server/http/participant-lifecycle-handlers";
import { canUseOrganizerAuth } from "../src/server/lib/organizer-auth";
import {
	clearParticipantSessionCookies,
	createParticipantHintCookie,
	createParticipantSessionCookie,
	participantSessionExpiry,
	readParticipantSession,
} from "../src/server/lib/participant-session";
import {
	cancelRsvp,
	confirmRsvp,
	consumeClaimToken,
	createCancellationToken,
	createClaimToken,
	issueClaimToken,
	provisionHackers,
	provisioningRecordSchema,
	reconcileRsvps,
	type HackerLifecycleRepository,
	type ProvisioningRecord,
} from "../src/server/services/hacker-lifecycle";

const participantId = "wvY1HKlwYnFBO8t-YnQbwg";
const cancellationSecret = "a".repeat(32);
const claimSecret = "b".repeat(32);

class MemoryRepository implements HackerLifecycleRepository {
	readonly hackers = new Map<string, ProvisioningRecord & { confirmed: boolean }>();
	readonly capabilities = new Map<string, string>();
	readonly claims = new Map<string, { hackerId: string; expiresAt: Date; consumedAt: Date | null }>();

	upsertProvisioned(record: ProvisioningRecord) {
		const existing = this.hackers.get(record.id);
		this.hackers.set(record.id, { ...existing, ...record, confirmed: existing?.confirmed ?? false });
		return Promise.resolve();
	}

	confirmAndRotate(id: string, now: Date, capabilityId: string) {
		const hacker = this.hackers.get(id);
		if (!hacker) return Promise.resolve("missing" as const);
		if (hacker.acceptanceExpiry < now) return Promise.resolve("expired" as const);
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

	replaceClaimToken(hackerId: string, claimId: string, expiresAt: Date) {
		if (!this.hackers.has(hackerId)) return Promise.resolve(false);
		for (const [existingId, claim] of this.claims) {
			if (claim.hackerId === hackerId) this.claims.delete(existingId);
		}
		this.claims.set(claimId, { hackerId, expiresAt, consumedAt: null });
		return Promise.resolve(true);
	}

	redeemClaimToken(claimId: string, now: Date) {
		const claim = this.claims.get(claimId);
		if (!claim || claim.consumedAt || claim.expiresAt <= now) return Promise.resolve(null);
		claim.consumedAt = now;
		return Promise.resolve(claim.hackerId);
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
		"https://track.example",
		cancellationSecret,
	);
	assert.deepEqual(first.missingIds, [missingId]);
	assert.match(first.records[0]?.cancellationLink ?? "", /^https:\/\/track\.example\/cancel#/);
	assert.deepEqual(second.records, first.records.slice(0, 1));
});

void test("claim issuance stores the opaque id only and hands back a fragment link", async () => {
	const repository = new MemoryRepository();
	await provisionHackers(repository, { hackers: [provisionInput()] });
	const claimId = "e".repeat(43);

	const issued = await issueClaimToken(
		repository,
		participantId,
		"https://track.example/",
		claimSecret,
		new Date("2026-08-20T00:00:00Z"),
		() => claimId,
	);

	assert.equal(issued.claimUrl, `https://track.example/claim#${createClaimToken(claimId, claimSecret)}`);
	assert.equal(issued.expiresAt.toISOString(), "2026-08-20T00:05:00.000Z");

	// The signature must never reach storage, otherwise a dump is a set of links.
	const stored = repository.claims.get(claimId);
	assert.ok(stored);
	assert.equal(stored.hackerId, participantId);
	assert.equal(stored.consumedAt, null);
});

void test("a claim is single use and rejects tampering, expiry, and unknown participants", async () => {
	const repository = new MemoryRepository();
	await provisionHackers(repository, { hackers: [provisionInput()] });
	const issuedAt = new Date("2026-08-20T00:00:00Z");
	const claimId = "f".repeat(43);

	const issued = await issueClaimToken(
		repository,
		participantId,
		"https://track.example",
		claimSecret,
		issuedAt,
		() => claimId,
	);
	const token = issued.claimUrl.split("#")[1] ?? "";

	await assert.rejects(consumeClaimToken(repository, token, claimSecret, new Date("2026-08-20T00:06:00Z")));
	await assert.rejects(consumeClaimToken(repository, `${claimId}.${"A".repeat(43)}`, claimSecret, issuedAt));
	await assert.rejects(consumeClaimToken(repository, token, "z".repeat(32), issuedAt));

	assert.equal((await consumeClaimToken(repository, token, claimSecret, issuedAt)).hackerId, participantId);
	await assert.rejects(consumeClaimToken(repository, token, claimSecret, issuedAt));

	await assert.rejects(issueClaimToken(repository, "z".repeat(22), "https://track.example", claimSecret));
});

void test("issuing access again revokes the claim that was not used", async () => {
	const repository = new MemoryRepository();
	await provisionHackers(repository, { hackers: [provisionInput()] });
	const now = new Date("2026-08-20T00:00:00Z");

	const first = await issueClaimToken(repository, participantId, "https://track.example", claimSecret, now, () =>
		"g".repeat(43),
	);
	await issueClaimToken(repository, participantId, "https://track.example", claimSecret, now, () => "h".repeat(43));

	await assert.rejects(consumeClaimToken(repository, first.claimUrl.split("#")[1] ?? "", claimSecret, now));
	assert.equal(repository.claims.size, 1);
});

void test("the participant session is signed, hidden from scripts, and cannot be extended by hand", () => {
	const sessionSecret = "s".repeat(32);
	const now = new Date("2026-08-20T00:00:00Z");
	const expiresAt = participantSessionExpiry(now);
	const cookie = createParticipantSessionCookie(participantId, sessionSecret, expiresAt);

	assert.match(cookie, /HttpOnly/);
	assert.match(cookie, /SameSite=Lax/);

	const value = cookie.split(";")[0]?.split("=")[1] ?? "";
	const request = { headers: { cookie: `participant_session=${value}` } };
	assert.deepEqual(readParticipantSession(request, sessionSecret, now), { hackerId: participantId });

	// Wrong secret, tampered participant, and a hand extended expiry all fail.
	assert.equal(readParticipantSession(request, "t".repeat(32), now), null);
	const [, expiryText = "", signature = ""] = value.split(".");
	const swapped = { headers: { cookie: `participant_session=${"z".repeat(22)}.${expiryText}.${signature}` } };
	assert.equal(readParticipantSession(swapped, sessionSecret, now), null);
	const stretched = {
		headers: { cookie: `participant_session=${participantId}.${now.getTime() + 10 ** 12}.${signature}` },
	};
	assert.equal(readParticipantSession(stretched, sessionSecret, now), null);

	// A genuine cookie still stops working once its own expiry passes.
	assert.equal(readParticipantSession(request, sessionSecret, new Date(expiresAt.getTime() + 1000)), null);
	assert.equal(readParticipantSession({ headers: {} }, sessionSecret, now), null);
});

void test("the navigation hint carries nothing and is not accepted as a session", () => {
	const sessionSecret = "s".repeat(32);
	const now = new Date("2026-08-20T00:00:00Z");
	const hint = createParticipantHintCookie();

	// Readable by scripts, so it must never be HttpOnly, and it must not carry
	// the participant id.
	assert.match(hint, /^participant_pass=1;/);
	assert.doesNotMatch(hint, /HttpOnly/);
	assert.doesNotMatch(hint, new RegExp(participantId));

	// Holding the hint on its own must not get you a session.
	assert.equal(readParticipantSession({ headers: { cookie: hint } }, sessionSecret, now), null);

	// Signing out has to drop both cookies, not just the signed one.
	const cleared = clearParticipantSessionCookies();
	assert.equal(cleared.length, 2);
	assert.ok(cleared.every(cookie => cookie.includes("Max-Age=0")));
});

void test("organizer auth removes participant providers and enforces verification and provisioning", async () => {
	const findUser = (email: string) =>
		Promise.resolve(
			email === "organizer@ctn-rtc.org" ? { id: "user", roles: [{ name: RoleName.ORGANIZER }] } : null,
		);
	assert.equal(
		await canUseOrganizerAuth(
			{ provider: "google", email: "organizer@ctn-rtc.org", emailVerified: true },
			findUser,
		),
		true,
	);
	assert.equal(
		await canUseOrganizerAuth(
			{ provider: "credentials", email: "organizer@ctn-rtc.org", emailVerified: true },
			findUser,
		),
		false,
	);
	assert.equal(
		await canUseOrganizerAuth({ provider: "google", email: "person@example.com", emailVerified: true }, findUser),
		false,
	);
	assert.equal(
		await canUseOrganizerAuth(
			{ provider: "google", email: "organizer@ctn-rtc.org", emailVerified: false },
			findUser,
		),
		false,
	);
	assert.equal(
		await canUseOrganizerAuth({ provider: "google", email: "missing@ctn-rtc.org", emailVerified: true }, findUser),
		false,
	);
});

const responseMock = () => {
	const result: { statusCode: number; body?: unknown; response: NextApiResponse } = {
		statusCode: 0,
		response: {} as NextApiResponse,
	};
	result.response = {
		setHeader: () => result.response,
		status: (code: number) => {
			result.statusCode = code;
			return result.response;
		},
		json: (body: unknown) => {
			result.body = body;
			return result.response;
		},
	} as unknown as NextApiResponse;
	return result;
};
