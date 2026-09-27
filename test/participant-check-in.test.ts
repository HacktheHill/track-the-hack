import assert from "node:assert/strict";
import test from "node:test";

import { CanonicalCheckInEventError, ensureParticipantCheckedIn } from "@/server/services/participant-check-in";

const hackerId = "wvY1HKlwYnFBO8t-YnQbwg";

const checkInDatabase = (eventCount = 1, affected = 1) => {
	const audits: Array<{ data: Record<string, unknown> }> = [];
	const events = Array.from({ length: eventCount }, (_, index) => ({
		id: `check-in-${index}`,
		name: index === 0 ? "Check-Ins" : `Check-Ins ${index + 1}`,
	}));
	const prisma = {
		event: { findMany: () => Promise.resolve(events) },
		$executeRaw: () => Promise.resolve(affected),
		presence: {
			findUniqueOrThrow: () => Promise.resolve({ id: "presence-1", value: 1 }),
		},
		auditEvent: {
			create: (input: { data: Record<string, unknown> }) => {
				audits.push(input);
				return Promise.resolve(input.data);
			},
		},
	};
	return { audits, prisma };
};

void test("attendance evidence creates one canonical check-in and audit event", async () => {
	const { audits, prisma } = checkInDatabase();
	// Partial database mock exposes only the operations exercised by the service.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const result = await ensureParticipantCheckedIn(prisma as never, hackerId, {
		actor: { type: "organizer", id: "organizer-1" },
		correlationId: "4a8c0cf1-a871-474a-a818-d479922e06e6",
		evidenceSource: "participant_presence",
		sourceEventId: "dinner-1",
	});

	assert.deepEqual(result, {
		eventId: "check-in-0",
		presenceId: "presence-1",
		value: 1,
		recordedNow: true,
	});
	assert.equal(audits.length, 1);
	assert.equal(audits[0]?.data.name, "participant.check_in.inferred");
	assert.equal(audits[0]?.data.subjectId, hackerId);
	assert.deepEqual(audits[0]?.data.data, {
		evidenceSource: "participant_presence",
		presenceId: "presence-1",
		sourceEventId: "dinner-1",
	});
});

void test("an existing positive check-in remains idempotent", async () => {
	const { audits, prisma } = checkInDatabase(1, 0);
	// Partial database mock exposes only the operations exercised by the service.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const result = await ensureParticipantCheckedIn(prisma as never, hackerId, {
		actor: { type: "integration", id: "sheets" },
		evidenceSource: "participant_pass_issued",
	});

	assert.equal(result.recordedNow, false);
	assert.equal(audits.length, 0);
});

void test("automatic check-in fails closed when the canonical event is missing or ambiguous", async () => {
	for (const eventCount of [0, 2]) {
		const { prisma } = checkInDatabase(eventCount);
		await assert.rejects(
			// Partial database mock exposes only the operations exercised by the service.
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
			ensureParticipantCheckedIn(prisma as never, hackerId, {
				actor: { type: "system", id: "test" },
				evidenceSource: "participant_pass_issued",
			}),
			(error: unknown) => error instanceof CanonicalCheckInEventError && error.eventCount === eventCount,
		);
	}
});
