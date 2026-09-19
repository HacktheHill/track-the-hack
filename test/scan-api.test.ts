import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { RoleName, ScannerWorkflow, type PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";

// Use the checked-in, non-secret CI fixture; callers below mock every database operation.
for (const line of readFileSync(new URL("../.github/workflows/build.env", import.meta.url), "utf8")
	.trim()
	.split("\n")) {
	const separator = line.indexOf("=");
	process.env[line.slice(0, separator)] = line.slice(separator + 1);
}
Object.assign(process.env, { NODE_ENV: "test" });
const routers = Promise.all([import("../src/server/api/routers/events"), import("../src/server/api/routers/presence")]);
const hackerId = "wvY1HKlwYnFBO8t-YnQbwg";
const organizer: Session = { user: { id: "organizer-1", roles: [RoleName.ORGANIZER] }, expires: "2099-01-01" };
const context = (
	prisma: object,
	participantSession: { hackerId: string } | null = { hackerId },
	session: Session | null = null,
) => ({
	prisma: prisma as PrismaClient,
	session,
	participantSession,
	participantOriginAllowed: true,
});

void test("interest writes use only the authenticated participant and persist/remove one selection", async () => {
	const [{ eventsRouter }] = await routers;
	let saved = false;
	const selection = { hackerId, eventId: "event-1" };
	const caller = eventsRouter.createCaller(
		context({
			event: { findUnique: () => ({ id: "event-1", hidden: false }) },
			eventInterest: {
				upsert: (input: unknown) => {
					assert.deepEqual(input, { where: { hackerId_eventId: selection }, create: selection, update: {} });
					saved = true;
				},
				findUnique: (input: unknown) => {
					assert.deepEqual(input, { where: { hackerId_eventId: selection } });
					return saved ? { id: "interest-1" } : null;
				},
				deleteMany: (input: unknown) => {
					assert.deepEqual(input, { where: selection });
					saved = false;
				},
			},
		}),
	);
	assert.equal(await caller.getInterest({ eventId: "event-1" }), false);
	await caller.setInterest({ eventId: "event-1", interested: true });
	await caller.setInterest({ eventId: "event-1", interested: true });
	assert.equal(await caller.getInterest({ eventId: "event-1" }), true);
	await caller.setInterest({ eventId: "event-1", interested: false });
	assert.equal(await caller.getInterest({ eventId: "event-1" }), false);
});

void test("anonymous and organizer sessions cannot substitute for a participant session", async () => {
	const [{ eventsRouter }] = await routers;
	for (const session of [null, organizer]) {
		const caller = eventsRouter.createCaller(context({}, null, session));
		await assert.rejects(caller.setInterest({ eventId: "event-1", interested: true }), { code: "UNAUTHORIZED" });
		await assert.rejects(caller.getInterest({ eventId: "event-1" }), { code: "UNAUTHORIZED" });
	}
});

void test("cross-origin writes and hidden/missing events cannot save interests", async () => {
	const [{ eventsRouter }] = await routers;
	await assert.rejects(
		eventsRouter
			.createCaller({ ...context({}), participantOriginAllowed: false })
			.setInterest({ eventId: "event-1", interested: true }),
		{ code: "FORBIDDEN" },
	);
	for (const event of [null, { id: "event-1", hidden: true }]) {
		await assert.rejects(
			eventsRouter
				.createCaller(context({ event: { findUnique: () => event } }))
				.setInterest({ eventId: "event-1", interested: true }),
			{ code: "NOT_FOUND" },
		);
	}
});

void test("attendance interest lookup requires an organizer and filters hidden events", async () => {
	const [, { presenceRouter }] = await routers;
	const input = { eventId: "event-1", hackerId };
	await assert.rejects(presenceRouter.createCaller(context({})).getEventInterests(input), { code: "UNAUTHORIZED" });
	await assert.rejects(
		presenceRouter
			.createCaller(context({ user: { findUnique: () => ({ roles: [] }) } }, null, organizer))
			.getEventInterests(input),
		{ code: "FORBIDDEN" },
	);
	const details = { id: "workshop", name: "Workshop", nameFr: "Atelier", start: new Date() };
	for (const role of [RoleName.ORGANIZER, RoleName.ADMIN]) {
		const result = await presenceRouter
			.createCaller(
				context(
					{
						user: { findUnique: () => ({ roles: [{ name: role }] }) },
						event: { findUnique: () => ({ scannerWorkflow: ScannerWorkflow.ATTENDANCE }) },
						eventInterest: {
							findMany: (query: unknown) => {
								assert.deepEqual(query, {
									where: { hackerId, Event: { hidden: false } },
									select: { Event: { select: { id: true, name: true, nameFr: true, start: true } } },
									orderBy: { Event: { start: "asc" } },
								});
								return [{ Event: details }];
							},
						},
					},
					null,
					organizer,
				),
			)
			.getEventInterests(input);
		assert.deepEqual(result, [details]);
	}
});

void test("food, merchandise and check-in workflows cannot look up interests", async () => {
	const [, { presenceRouter }] = await routers;
	for (const scannerWorkflow of [ScannerWorkflow.FOOD, ScannerWorkflow.MERCHANDISE, ScannerWorkflow.CHECK_IN]) {
		await assert.rejects(
			presenceRouter
				.createCaller(
					context(
						{
							user: { findUnique: () => ({ roles: [{ name: RoleName.ORGANIZER }] }) },
							event: { findUnique: () => ({ scannerWorkflow }) },
						},
						null,
						organizer,
					),
				)
				.getEventInterests({ eventId: "event-1", hackerId }),
			{ code: "FORBIDDEN" },
		);
	}
});
