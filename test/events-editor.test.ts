import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import test, { type TestContext } from "node:test";
import { EventType, PrismaClient, ScannerWorkflow } from "@prisma/client";
import { z } from "zod";

loadEnvFile(".github/workflows/build.env");
const routerModule = import("@/server/api/routers/events");

const eventInput = {
	name: "Opening ceremony",
	nameFr: "Cérémonie d'ouverture",
	room: "Auditorium",
	roomFr: "Amphithéâtre",
	start: new Date("2026-09-25T14:00:00Z"),
	end: new Date("2026-09-25T15:00:00Z"),
	description: "Welcome to the event",
	descriptionFr: "Bienvenue à l'événement",
	hidden: false,
	type: EventType.ALL,
	scannerEnabled: true,
	scannerWorkflow: ScannerWorkflow.ATTENDANCE,
	maxCheckIns: null,
	host: null,
	link: "https://example.com/event",
	linkText: "Event details",
	linkTextFr: "Détails de l'événement",
};

const existingEvent = {
	...eventInput,
	id: "event-1",
	image: "https://cdn1.hackthehill.com/existing-event.png",
};

const publicSelect = {
	id: true,
	name: true,
	nameFr: true,
	room: true,
	roomFr: true,
	start: true,
	end: true,
	description: true,
	descriptionFr: true,
	type: true,
	host: true,
	image: true,
	link: true,
	linkText: true,
	linkTextFr: true,
};

const setup = async (
	t: TestContext,
	access: "organizer" | "denied" | null,
	foundEvent: typeof existingEvent | null = existingEvent,
) => {
	const { eventsRouter } = await routerModule;
	const prisma = new PrismaClient({ datasourceUrl: "mysql://test:test@127.0.0.1:1/unreachable" });
	const userLookup = t.mock.fn(() =>
		Promise.resolve(
			access
				? {
						id: "editor-1",
						name: "Editor",
						email: access === "organizer" ? "editor@ctn-rtc.org" : "editor@example.com",
						isAdmin: false,
						disabledAt: null,
					}
				: null,
		),
	);
	const eventLookup = t.mock.fn(() => Promise.resolve(foundEvent));
	const eventFindFirst = t.mock.fn(() => Promise.resolve(foundEvent));
	const eventFindMany = t.mock.fn((request: unknown) => {
		void request;
		return Promise.resolve(foundEvent ? [foundEvent] : []);
	});
	const create = t.mock.fn(() => Promise.resolve(existingEvent));
	const update = t.mock.fn(() => Promise.resolve(existingEvent));
	const eventRow = foundEvent
		? {
				id: foundEvent.id,
				start: foundEvent.start,
				hidden: foundEvent.hidden,
				now: new Date("2026-09-21T00:00:00Z"),
			}
		: null;
	const queryRaw = t.mock.fn(() => Promise.resolve(eventRow ? [eventRow] : []));
	const deleteSubscriptions = t.mock.fn(() => Promise.resolve({ count: 0 }));
	const transaction = t.mock.fn((work: (client: PrismaClient) => Promise<unknown>) => work(prisma));
	Object.assign(prisma.user, { findUnique: userLookup });
	Object.assign(prisma.organizerAccess, { findUnique: () => Promise.resolve(null) });
	Object.assign(prisma.event, {
		findUnique: eventLookup,
		findFirst: eventFindFirst,
		findMany: eventFindMany,
		create,
		update,
	});
	Object.assign(prisma.pushSubscription, { deleteMany: deleteSubscriptions });
	Object.assign(prisma, { $queryRaw: queryRaw, $transaction: transaction });
	const caller = eventsRouter.createCaller({
		prisma,
		session: access
			? {
					user: { id: "editor-1", isOrganizer: access === "organizer", isAdmin: false },
					expires: "2099-01-01T00:00:00Z",
				}
			: null,
	});
	return {
		caller,
		userLookup,
		eventLookup,
		eventFindFirst,
		eventFindMany,
		create,
		update,
		queryRaw,
		transaction,
		deleteSubscriptions,
	};
};

void test("public event queries exclude hidden events and project only public fields", async t => {
	const { caller, eventFindFirst, eventFindMany } = await setup(t, null);
	await caller.all();
	await caller.get({ id: existingEvent.id });

	assert.deepEqual(eventFindMany.mock.calls[0]?.arguments, [{ where: { hidden: false }, select: publicSelect }]);
	assert.deepEqual(eventFindFirst.mock.calls[0]?.arguments, [
		{ where: { id: existingEvent.id, hidden: false }, select: publicSelect },
	]);
	assert.equal("hidden" in publicSelect, false);
	assert.equal("scannerWorkflow" in publicSelect, false);
	assert.equal("maxCheckIns" in publicSelect, false);
});

void test("organizer management includes hidden events and all editable scanner fields", async t => {
	const { caller, eventFindMany } = await setup(t, "organizer");
	await caller.manage();
	assert.deepEqual(eventFindMany.mock.calls[0]?.arguments, [
		{
			select: { ...publicSelect, hidden: true, scannerEnabled: true, scannerWorkflow: true, maxCheckIns: true },
			orderBy: { start: "asc" },
		},
	]);
});

void test("scanner list includes only explicitly enabled current events", async t => {
	const { caller, eventFindMany } = await setup(t, "organizer");
	const before = Date.now();
	await caller.scannable();
	const after = Date.now();
	const request = z
		.object({
			where: z.object({ scannerEnabled: z.boolean(), end: z.object({ gt: z.date() }) }),
			select: z.record(z.boolean()),
		})
		.parse(eventFindMany.mock.calls[0]?.arguments[0]);
	assert.equal(request?.where.scannerEnabled, true);
	assert.ok(request?.where.end.gt.getTime() >= before - 30 * 60 * 1000);
	assert.ok(request?.where.end.gt.getTime() <= after - 30 * 60 * 1000);
	assert.deepEqual(request?.select, {
		id: true,
		name: true,
		nameFr: true,
		start: true,
		scannerWorkflow: true,
	});
});

void test("organizers can create and update events while the API owns the photo", async t => {
	const { caller, userLookup, create, update } = await setup(t, "organizer");
	await caller.create(eventInput);
	assert.deepEqual(create.mock.calls[0]?.arguments, [{ data: { ...eventInput, image: null } }]);

	const editedInput = { ...eventInput, linkText: "Join us", linkTextFr: "Rejoignez-nous" };
	await caller.update({ id: existingEvent.id, ...editedInput });
	assert.deepEqual(update.mock.calls[0]?.arguments, [{ where: { id: existingEvent.id }, data: editedInput }]);
	assert.equal(userLookup.mock.callCount(), 2);
});

void test("removing the event link preserves the existing photo", async t => {
	const { caller, update } = await setup(t, "organizer");
	const input = { ...eventInput, link: null, linkText: null, linkTextFr: null };
	await caller.update({ id: existingEvent.id, ...input });
	assert.deepEqual(update.mock.calls[0]?.arguments, [{ where: { id: existingEvent.id }, data: input }]);
});

void test("moving an event to a new future start reopens completion while preserving an active lease", async t => {
	const { caller, update, transaction, queryRaw } = await setup(t, "organizer");
	const start = new Date("2026-09-26T14:00:00Z");
	await caller.update({ id: existingEvent.id, ...eventInput, start, end: new Date("2026-09-26T15:00:00Z") });
	assert.equal(transaction.mock.callCount(), 1);
	assert.equal(queryRaw.mock.callCount(), 1);
	assert.deepEqual(update.mock.calls[0]?.arguments, [
		{
			where: { id: existingEvent.id },
			data: {
				...eventInput,
				start,
				end: new Date("2026-09-26T15:00:00Z"),
				notifiedAt: null,
			},
		},
	]);
});

void test("hiding an event closes reminders without discarding future browser requests", async t => {
	const { caller, update, deleteSubscriptions } = await setup(t, "organizer");
	await caller.update({ id: existingEvent.id, ...eventInput, hidden: true });
	assert.equal(deleteSubscriptions.mock.callCount(), 0);
	assert.deepEqual(update.mock.calls[0]?.arguments, [
		{
			where: { id: existingEvent.id },
			data: {
				...eventInput,
				hidden: true,
				notifiedAt: new Date("2026-09-21T00:00:00Z"),
			},
		},
	]);
});

void test("unhiding a future event reopens reminder registration", async t => {
	const hiddenEvent = { ...existingEvent, hidden: true };
	const { caller, update } = await setup(t, "organizer", hiddenEvent);
	await caller.update({ id: existingEvent.id, ...eventInput });
	assert.deepEqual(update.mock.calls[0]?.arguments, [
		{
			where: { id: existingEvent.id },
			data: {
				...eventInput,
				notifiedAt: null,
			},
		},
	]);
});

for (const [name, invalidInput] of [
	["unknown event type", { ...eventInput, type: "CONCERT" }],
	["unknown scanner workflow", { ...eventInput, scannerWorkflow: "CUSTOM" }],
	["fractional maximum", { ...eventInput, maxCheckIns: 1.5 }],
	["negative maximum", { ...eventInput, maxCheckIns: -1 }],
	["blank host", { ...eventInput, host: "  " }],
	["HTTP link", { ...eventInput, link: "http://example.com/event" }],
	["partial localized link", { ...eventInput, linkTextFr: null }],
	["blank trimmed name", { ...eventInput, name: "  " }],
	["oversized room", { ...eventInput, room: "x".repeat(192) }],
	["oversized French room", { ...eventInput, roomFr: "x".repeat(192) }],
	["empty description", { ...eventInput, description: "" }],
	["description exceeding the database byte limit", { ...eventInput, description: "é".repeat(32_768) }],
	["end before start", { ...eventInput, end: eventInput.start }],
	["client-controlled image", { ...eventInput, image: "https://example.com/replacement.png" }],
] as const) {
	void test(`create rejects ${name}`, async t => {
		const { caller, userLookup, create } = await setup(t, "organizer");
		// @ts-expect-error The malformed payloads intentionally violate the inferred API input.
		await assert.rejects(caller.create(invalidInput), { code: "BAD_REQUEST" });
		assert.equal(userLookup.mock.callCount(), 1);
		assert.equal(create.mock.callCount(), 0);
	});
}

void test("signed-in users without organizer access cannot create, update, or manage events", async t => {
	const { caller, eventLookup, eventFindMany, create, update } = await setup(t, "denied");
	await assert.rejects(caller.create(eventInput), { code: "FORBIDDEN" });
	await assert.rejects(caller.update({ id: existingEvent.id, ...eventInput }), { code: "FORBIDDEN" });
	await assert.rejects(caller.manage(), { code: "FORBIDDEN" });
	assert.equal(eventLookup.mock.callCount(), 0);
	assert.equal(eventFindMany.mock.callCount(), 0);
	assert.equal(create.mock.callCount(), 0);
	assert.equal(update.mock.callCount(), 0);
});

void test("missing public and editable events return NOT_FOUND", async t => {
	const { caller } = await setup(t, "organizer", null);
	await assert.rejects(caller.get({ id: "missing" }), { code: "NOT_FOUND" });
	await assert.rejects(caller.update({ id: "missing", ...eventInput }), { code: "NOT_FOUND" });
});

void test("anonymous callers cannot reach protected event operations", async t => {
	const { caller, userLookup, eventLookup, eventFindMany, create, update } = await setup(t, null);
	await assert.rejects(caller.create(eventInput), { code: "UNAUTHORIZED" });
	await assert.rejects(caller.update({ id: existingEvent.id, ...eventInput }), { code: "UNAUTHORIZED" });
	await assert.rejects(caller.manage(), { code: "UNAUTHORIZED" });
	assert.equal(userLookup.mock.callCount(), 0);
	assert.equal(eventLookup.mock.callCount(), 0);
	assert.equal(eventFindMany.mock.callCount(), 0);
	assert.equal(create.mock.callCount(), 0);
	assert.equal(update.mock.callCount(), 0);
});
