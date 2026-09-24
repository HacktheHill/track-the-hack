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
const routers = Promise.all([import("@/server/api/routers/events"), import("@/server/api/routers/presence")]);
const hackerId = "wvY1HKlwYnFBO8t-YnQbwg";
const organizer: Session = { user: { id: "organizer-1", roles: [RoleName.ORGANIZER] }, expires: "2099-01-01" };
const context = (
	prisma: object,
	participantSession: { hackerId: string } | null = { hackerId },
	session: Session | null = null,
) => {
	if (!("$transaction" in prisma)) {
		Object.assign(prisma, {
			$transaction: (operation: (transaction: object) => unknown) => operation(prisma),
		});
	}
	return {
		// Partial database mocks expose only the operations exercised by each caller.
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		prisma: prisma as PrismaClient,
		session,
		participantSession,
		participantOriginAllowed: true,
	};
};

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
				findFirst: (input: unknown) => {
					assert.deepEqual(input, {
						where: { ...selection, Event: { hidden: false } },
						select: { id: true },
					});
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

void test("hidden event interests are not returned to participants", async t => {
	const [{ eventsRouter }] = await routers;
	const findFirst = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve(null);
	});
	const caller = eventsRouter.createCaller(context({ eventInterest: { findFirst } }));
	assert.equal(await caller.getInterest({ eventId: "event-1" }), false);
	assert.deepEqual(findFirst.mock.calls[0]?.arguments[0], {
		where: { hackerId, eventId: "event-1", Event: { hidden: false } },
		select: { id: true },
	});
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

void test("scanner API reports fresh, incremented, applied, stale, and bounded no-op audit actions", async () => {
	const [, { presenceRouter }] = await routers;
	let presence: { id: string; value: number } | null = null;
	const actions: string[] = [];
	const event = {
		id: "event-1",
		name: "Check-in",
		nameFr: "Enregistrement",
		scannerEnabled: true,
		scannerWorkflow: ScannerWorkflow.CHECK_IN,
		maxCheckIns: 3,
	};
	const prisma = {
		user: {
			findUnique: () => ({ id: "organizer-1", name: "Organizer", roles: [{ name: RoleName.ORGANIZER }] }),
		},
		event: { findUnique: () => event },
		hacker: {
			findUnique: () => ({ id: hackerId, confirmed: true, tShirtSize: "NONE" }),
		},
		$executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => {
			const statement = query.join("");
			if (statement.includes("INSERT INTO")) {
				presence ??= { id: String(values[0]), value: 1 };
				return 1;
			}
			if (!statement.includes("AND `value` =") && statement.includes("+ 1")) {
				const maximum = values[2];
				if (!presence || typeof maximum !== "number" || presence.value >= maximum) return 0;
				presence.value += 1;
				return 1;
			}
			const expected = values[2];
			if (!presence || presence.value !== expected) return 0;
			if (statement.includes("- 1") && presence.value === 0) return 0;
			const maximum = values[3];
			if (typeof maximum === "number" && presence.value >= maximum) return 0;
			presence.value += statement.includes("- 1") ? -1 : 1;
			return 1;
		},
		presence: {
			findUnique: () => presence,
		},
		log: {
			create: ({ data }: { data: { action: string } }) => {
				actions.push(data.action);
				return {};
			},
		},
	};
	const caller = presenceRouter.createCaller(context(prisma, null, organizer));

	const fresh = await caller.scan({ eventId: event.id, hackerId });
	const incremented = await caller.scan({ eventId: event.id, hackerId });
	const applied = await caller.adjust({ eventId: event.id, hackerId, amount: 1, expectedValue: 2 });
	const stale = await caller.adjust({ eventId: event.id, hackerId, amount: -1, expectedValue: 2 });
	const bounded = await caller.adjust({ eventId: event.id, hackerId, amount: 1, expectedValue: 3 });

	assert.equal(fresh.recordedNow, true);
	assert.equal(incremented.outcome, "incremented");
	assert.deepEqual(applied, { value: 3, atLimit: true, applied: true, stale: false });
	assert.deepEqual(stale, { value: 3, atLimit: true, applied: false, stale: true });
	assert.deepEqual(bounded, { value: 3, atLimit: true, applied: false, stale: false });
	assert.deepEqual(actions, ["scan", "scan_incremented", "adjust", "adjust_stale", "adjust_noop"]);
});
