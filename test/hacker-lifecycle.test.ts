import assert from "node:assert/strict";
import test from "node:test";
import { RoleName } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { createCancellationApiHandler, createRsvpApiHandler } from "../src/server/http/participant-lifecycle-handlers";
import { canUseOrganizerAuth } from "../src/server/lib/organizer-auth";
import {
	cancelRsvp,
	confirmRsvp,
	createCancellationToken,
	provisionHackers,
	provisioningRecordSchema,
	reconcileRsvps,
	type HackerLifecycleRepository,
	type ProvisioningRecord,
} from "../src/server/services/hacker-lifecycle";

const participantId = "wvY1HKlwYnFBO8t-YnQbwg";
const cancellationSecret = "a".repeat(32);

class MemoryRepository implements HackerLifecycleRepository {
	readonly hackers = new Map<string, ProvisioningRecord & { confirmed: boolean }>();
	readonly capabilities = new Map<string, string>();

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
