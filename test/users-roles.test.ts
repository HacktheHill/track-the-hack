import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import test from "node:test";
import { Prisma, RoleName, type PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";

loadEnvFile(".github/workflows/build.env");
const routerModule = import("@/server/api/routers/users");

const session = (id: string): Session => ({
	user: { id, roles: [RoleName.ADMIN] },
	expires: "2099-01-01T00:00:00Z",
});

void test("role updates upsert requested roles and use serializable isolation", async t => {
	const upsert = t.mock.fn(() => Promise.resolve({}));
	const update = t.mock.fn(() => Promise.resolve({}));
	const createLog = t.mock.fn((input: { data: { userId?: string } }) => {
		assert.ok(input.data);
		return Promise.resolve({});
	});
	const transaction = t.mock.fn(async (operation: (client: object) => Promise<void>, options: object) => {
		assert.deepEqual(options, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
		await operation({
			role: { upsert },
			user: {
				findMany: () => Promise.resolve([{ id: "target-1" }]),
				count: () => Promise.resolve(1),
				update,
			},
			auditEvent: { create: () => Promise.resolve({}) },
		});
	});
	// Partial database mock exposes only the operations exercised by this caller.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const prisma = {
		user: {
			findUnique: () => Promise.resolve({ id: "admin-1", name: "Admin", roles: [{ name: RoleName.ADMIN }] }),
		},
		$transaction: transaction,
		log: { create: createLog },
	} as unknown as PrismaClient;
	const { userRouter } = await routerModule;

	await userRouter.createCaller({ prisma, session: session("admin-1") }).updateRoles({
		userIds: ["target-1"],
		roles: [RoleName.ORGANIZER, RoleName.ORGANIZER],
	});

	assert.deepEqual(upsert.mock.calls[0]?.arguments, [
		{ where: { name: RoleName.ORGANIZER }, create: { name: RoleName.ORGANIZER }, update: {} },
	]);
	assert.deepEqual(update.mock.calls[0]?.arguments, [
		{ where: { id: "target-1" }, data: { roles: { set: [{ name: RoleName.ORGANIZER }] } } },
	]);
	assert.equal(createLog.mock.calls[0]?.arguments[0]?.data.userId, "admin-1");
});

void test("concurrent updates cannot remove both remaining admins", async () => {
	const admins = new Set(["admin-1", "admin-2"]);
	let queue = Promise.resolve();
	const transaction = async (operation: (client: object) => Promise<void>, options: { isolationLevel?: string }) => {
		assert.equal(options.isolationLevel, Prisma.TransactionIsolationLevel.Serializable);
		const previous = queue;
		let release!: () => void;
		queue = new Promise<void>(resolve => {
			release = resolve;
		});
		await previous;
		try {
			await operation({
				role: { upsert: () => Promise.resolve({}) },
				user: {
					findMany: ({ where }: { where: { id: { in: string[] } } }) =>
						Promise.resolve(where.id.in.map(id => ({ id }))),
					count: ({ where }: { where: { id: { notIn: string[] } } }) =>
						Promise.resolve([...admins].filter(id => !where.id.notIn.includes(id)).length),
					update: ({ where }: { where: { id: string } }) => {
						admins.delete(where.id);
						return Promise.resolve({});
					},
				},
				auditEvent: { create: () => Promise.resolve({}) },
			});
		} finally {
			release();
		}
	};
	// Partial database mock exposes only the operations exercised by this caller.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const prisma = {
		user: {
			findUnique: ({ where }: { where: { id: string } }) =>
				Promise.resolve({ id: where.id, name: where.id, roles: [{ name: RoleName.ADMIN }] }),
		},
		$transaction: transaction,
		log: { create: () => Promise.resolve({}) },
	} as unknown as PrismaClient;
	const { userRouter } = await routerModule;
	const updates = ["admin-1", "admin-2"].map(id =>
		userRouter.createCaller({ prisma, session: session(id) }).updateRoles({ userIds: [id], roles: [] }),
	);

	const results = await Promise.allSettled(updates);
	assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
	assert.equal(results.filter(result => result.status === "rejected").length, 1);
	assert.equal(admins.size, 1);
	const rejection = results.find(result => result.status === "rejected");
	assert.match(String(rejection?.reason), /At least one admin is required/);
});
