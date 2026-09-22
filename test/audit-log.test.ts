import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { log } from "@/server/lib/log";

void test("audit logs persist the stable organizer user ID", async t => {
	const create = t.mock.fn((input: { data: { userId?: string; author: string } }) => {
		assert.ok(input.data);
		return Promise.resolve({});
	});
	// Partial database mock exposes only the operation exercised by the audit helper.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const prisma = { log: { create } } as unknown as PrismaClient;

	await log(
		{ prisma },
		{
			sourceId: "presence-1",
			sourceType: "Presence",
			author: "Organizer name",
			userId: "organizer-1",
			route: "presence.scan",
			action: "scan",
			details: "Scanned a participant",
		},
	);

	const data = create.mock.calls[0]?.arguments[0]?.data;
	assert.equal(data?.userId, "organizer-1");
	assert.equal(data?.author, "Organizer name");
});
