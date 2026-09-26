import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import test from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";

/* eslint-disable @typescript-eslint/consistent-type-assertions -- focused Prisma mocks expose only exercised methods */

loadEnvFile(".github/workflows/build.env");
const routerModule = import("@/server/api/routers/users");

const session = (isAdmin: boolean): Session => ({
	user: { id: "organizer-1", isOrganizer: true, isAdmin },
	expires: "2099-01-01T00:00:00Z",
});

const organizerUser = (isAdmin: boolean) => ({
	id: "organizer-1",
	name: "Organizer",
	email: "test.organizer@ctn-rtc.org",
	isAdmin,
	disabledAt: null,
});

void test("admins can add an external email to the organizer allowlist", async t => {
	const createdAt = new Date("2026-09-24T00:00:00Z");
	const create = t.mock.fn((input: unknown) => {
		void input;
		return Promise.resolve({ id: "access-1", email: "person@example.com", createdAt, createdById: "organizer-1" });
	});
	const persistAudit = t.mock.fn(() => Promise.resolve({}));
	const transaction = t.mock.fn(async (operation: (client: object) => Promise<unknown>, options: object) => {
		assert.deepEqual(options, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
		return operation({
			organizerAccess: { findUnique: () => Promise.resolve(null), create },
			auditEvent: { create: persistAudit },
		});
	});
	const prisma = {
		user: { findUnique: () => Promise.resolve(organizerUser(true)) },
		$transaction: transaction,
	} as unknown as PrismaClient;
	const { userRouter } = await routerModule;

	const access = await userRouter
		.createCaller({ prisma, session: session(true) })
		.addOrganizerAccess({ email: " Person@Example.com " });

	assert.equal(access.email, "person@example.com");
	assert.deepEqual(create.mock.calls[0]?.arguments[0], {
		data: { email: "person@example.com", createdById: "organizer-1" },
		select: { id: true, email: true, createdAt: true, createdById: true },
	});
	assert.equal(persistAudit.mock.callCount(), 1);
});

void test("CTN addresses cannot be added to the external allowlist", async () => {
	const prisma = {
		user: { findUnique: () => Promise.resolve(organizerUser(true)) },
	} as unknown as PrismaClient;
	const { userRouter } = await routerModule;
	await assert.rejects(
		userRouter.createCaller({ prisma, session: session(true) }).addOrganizerAccess({ email: "member@ctn-rtc.org" }),
		{ code: "BAD_REQUEST" },
	);
});

void test("organizers who are not admins cannot manage the allowlist", async () => {
	const prisma = {
		user: { findUnique: () => Promise.resolve(organizerUser(false)) },
	} as unknown as PrismaClient;
	const { userRouter } = await routerModule;
	const caller = userRouter.createCaller({ prisma, session: session(false) });
	await assert.rejects(caller.listOrganizerAccess(), { code: "FORBIDDEN" });
	await assert.rejects(caller.addOrganizerAccess({ email: "person@example.com" }), { code: "FORBIDDEN" });
	await assert.rejects(caller.removeOrganizerAccess({ id: "access-1" }), { code: "FORBIDDEN" });
});
