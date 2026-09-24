import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { PrismaRsvpManagementRepository } from "@/server/repositories/prisma-rsvp-management";

void test("RSVP decisions write participant-scoped audit evidence without the capability", async t => {
	const participantId = "participant_0123456789_abcdef";
	const capabilityId = "private-capability-value";
	const now = new Date("2026-09-23T21:00:00.000Z");
	const findUnique = t.mock.fn((input: { where: { id?: string; hackerId?: string } }) =>
		Promise.resolve(input.where.id ? { hackerId: participantId } : { id: capabilityId }),
	);
	const update = t.mock.fn(() => Promise.resolve({}));
	const create = t.mock.fn((input: { data: Record<string, unknown> }) => {
		assert.ok(input.data);
		return Promise.resolve({});
	});
	const transaction = {
		cancellationCapability: { findUnique },
		$queryRaw: () =>
			Promise.resolve([
				{
					id: participantId,
					confirmed: true,
					rsvpRespondedAt: new Date("2026-09-22T12:00:00.000Z"),
					acceptanceExpiry: new Date("2026-09-27T14:00:00.000Z"),
				},
			]),
		hacker: { update },
		auditEvent: { create: () => Promise.resolve({}) },
	};
	// Partial database mock exposes only the transaction operations exercised here.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const prisma = {
		$transaction: (operation: (client: typeof transaction) => Promise<unknown>) => operation(transaction),
		log: { create },
	} as unknown as PrismaClient;

	const result = await new PrismaRsvpManagementRepository(prisma).decide(capabilityId, false, now);
	assert.deepEqual(result, { status: "DECLINED", canAttend: true });
	assert.equal(update.mock.callCount(), 1);
	assert.equal(create.mock.callCount(), 1);
	const audit = create.mock.calls[0]?.arguments[0];
	assert.equal(audit?.data.timestamp instanceof Date, true);
	assert.equal(audit?.data.sourceId, participantId);
	assert.equal(audit?.data.sourceType, "Hacker");
	assert.equal(audit?.data.author, "rsvp-management-capability");
	assert.equal(audit?.data.route, "/api/rsvp/manage");
	assert.equal(audit?.data.action, "ManageRsvpDecline");
	assert.equal(audit?.data.details, "Participant selected not attending.");
	assert.doesNotMatch(JSON.stringify(audit), new RegExp(capabilityId));
});

void test("RSVP decision remains committed when its best-effort legacy write fails", async t => {
	const participantId = "participant_0123456789_abcdef";
	const capabilityId = "private-capability-value";
	const now = new Date("2026-09-23T21:00:00.000Z");
	const findUnique = t.mock.fn((input: { where: { id?: string; hackerId?: string } }) =>
		Promise.resolve(input.where.id ? { hackerId: participantId } : { id: capabilityId }),
	);
	const update = t.mock.fn(() => Promise.resolve({}));
	const create = t.mock.fn(() => Promise.reject(new Error("log database unavailable")));
	const transaction = {
		cancellationCapability: { findUnique },
		$queryRaw: () =>
			Promise.resolve([
				{
					id: participantId,
					confirmed: false,
					rsvpRespondedAt: null,
					acceptanceExpiry: new Date("2026-09-27T14:00:00.000Z"),
				},
			]),
		hacker: { update },
		auditEvent: { create: () => Promise.resolve({}) },
	};
	// Partial database mock exposes only the transaction operations exercised here.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const prisma = {
		$transaction: (operation: (client: typeof transaction) => Promise<unknown>) => operation(transaction),
		log: { create },
	} as unknown as PrismaClient;
	t.mock.method(console, "error", () => undefined);

	const result = await new PrismaRsvpManagementRepository(prisma).decide(capabilityId, true, now);
	assert.deepEqual(result, { status: "CONFIRMED", canAttend: true });
	assert.equal(update.mock.callCount(), 1);
	assert.equal(create.mock.callCount(), 1);
});
