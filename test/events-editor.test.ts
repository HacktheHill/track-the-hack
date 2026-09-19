import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import test, { type TestContext } from "node:test";
import { PrismaClient, RoleName } from "@prisma/client";

// Router imports validate the server environment. Use the same non-secret
// placeholders as CI; every database operation below is mocked.
loadEnvFile(".github/workflows/build.env");
const routerModule = import("@/server/api/routers/events");

const eventInput = {
	name: "Opening ceremony",
	nameFr: "Cérémonie d'ouverture",
	room: "Auditorium",
	start: new Date("2026-09-25T14:00:00Z"),
	end: new Date("2026-09-25T15:00:00Z"),
	description: "Welcome to the event",
	descriptionFr: "Bienvenue à l'événement",
	hidden: false,
	image: "https://cdn1.hackthehill.com/existing-event.png",
	link: "https://example.com/event",
	linkText: "Event details",
	linkTextFr: "Détails de l'événement",
};

const existingEvent = {
	...eventInput,
	id: "event-1",
};

const setup = async (t: TestContext, roles: RoleName[] | null) => {
	const { eventsRouter } = await routerModule;
	const prisma = new PrismaClient({ datasourceUrl: "mysql://test:test@127.0.0.1:1/unreachable" });
	const userLookup = t.mock.fn(() =>
		Promise.resolve({ name: "Editor", roles: (roles ?? []).map(name => ({ name })) }),
	);
	const eventLookup = t.mock.fn(() => Promise.resolve(existingEvent));
	const create = t.mock.fn(() => Promise.resolve(existingEvent));
	const update = t.mock.fn(() => Promise.resolve(existingEvent));
	// Prisma delegates are proxies; install the mocks on this isolated client.
	Object.assign(prisma.user, { findUnique: userLookup });
	Object.assign(prisma.event, { findUnique: eventLookup, create, update });
	const caller = eventsRouter.createCaller({
		prisma,
		session: roles ? { user: { id: "editor-1", roles }, expires: "2099-01-01T00:00:00Z" } : null,
	});
	return { caller, userLookup, eventLookup, create, update };
};

for (const role of [RoleName.ADMIN, RoleName.ORGANIZER]) {
	void test(`${role} alone can create and update events with both link labels and the existing photo`, async t => {
		const { caller, userLookup, create, update } = await setup(t, [role]);

		await caller.create(eventInput);
		assert.deepEqual(create.mock.calls[0]?.arguments, [{ data: eventInput }]);

		const editedInput = { ...eventInput, linkText: "Join us", linkTextFr: "Rejoignez-nous" };
		await caller.update({ id: existingEvent.id, ...editedInput });
		assert.deepEqual(update.mock.calls[0]?.arguments, [{ where: { id: existingEvent.id }, data: editedInput }]);
		assert.equal(userLookup.mock.callCount(), 2);
	});
}

void test("removing the event link clears the URL and both localized labels without removing its photo", async t => {
	const { caller, update } = await setup(t, [RoleName.ADMIN]);
	const input = { ...eventInput, link: null, linkText: null, linkTextFr: null };
	await caller.update({ id: existingEvent.id, ...input });
	assert.deepEqual(update.mock.calls[0]?.arguments, [{ where: { id: existingEvent.id }, data: input }]);
});

void test("creating an event without an image or link persists null optional fields", async t => {
	const { caller, create } = await setup(t, [RoleName.ORGANIZER]);
	const input = { ...eventInput, image: null, link: null, linkText: null, linkTextFr: null };
	await caller.create(input);
	assert.deepEqual(create.mock.calls[0]?.arguments, [{ data: input }]);
});

for (const roles of [[], [RoleName.MAYOR], [RoleName.PREMIER]]) {
	void test(`users with ${roles.join(", ") || "no roles"} cannot create or update events`, async t => {
		const { caller, eventLookup, create, update } = await setup(t, roles);
		await assert.rejects(caller.create(eventInput), /permission to create events/);
		await assert.rejects(caller.update({ id: existingEvent.id, ...eventInput }), /permission to update events/);
		assert.equal(eventLookup.mock.callCount(), 0);
		assert.equal(create.mock.callCount(), 0);
		assert.equal(update.mock.callCount(), 0);
	});
}

void test("anonymous callers cannot reach event mutations or database lookups", async t => {
	const { caller, userLookup, eventLookup, create, update } = await setup(t, null);
	await assert.rejects(caller.create(eventInput), { code: "UNAUTHORIZED" });
	await assert.rejects(caller.update({ id: existingEvent.id, ...eventInput }), { code: "UNAUTHORIZED" });
	assert.equal(userLookup.mock.callCount(), 0);
	assert.equal(eventLookup.mock.callCount(), 0);
	assert.equal(create.mock.callCount(), 0);
	assert.equal(update.mock.callCount(), 0);
});
