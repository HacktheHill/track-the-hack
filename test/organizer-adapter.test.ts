import assert from "node:assert/strict";
import test from "node:test";
import type { Adapter, VerificationToken } from "next-auth/adapters";
import type { PrismaClient } from "@prisma/client";
import { restrictOrganizerVerificationTokens } from "@/server/lib/organizer-adapter";

/* eslint-disable @typescript-eslint/consistent-type-assertions -- focused adapter and Prisma mocks expose only exercised methods */

const token = (identifier: string): VerificationToken => ({
	identifier,
	token: "hashed-token",
	expires: new Date("2026-09-24T12:15:00.000Z"),
});

void test("unknown magic-link addresses create no verification token", async t => {
	const createVerificationToken = t.mock.fn((value: VerificationToken) => Promise.resolve(value));
	const adapter = restrictOrganizerVerificationTokens(
		{ createVerificationToken } as Adapter,
		{ organizerAccess: { findUnique: () => Promise.resolve(null) } } as unknown as PrismaClient,
	);

	assert.equal(await adapter.createVerificationToken?.(token("unknown@example.com")), null);
	assert.equal(createVerificationToken.mock.callCount(), 0);
});

void test("allowed external and CTN addresses retain single-use verification tokens", async t => {
	const createVerificationToken = t.mock.fn((value: VerificationToken) => Promise.resolve(value));
	const prisma = {
		organizerAccess: {
			findUnique: ({ where }: { where: { email: string } }) =>
				Promise.resolve(where.email === "allowed@example.com" ? { id: "access-1" } : null),
		},
	} as unknown as PrismaClient;
	const adapter = restrictOrganizerVerificationTokens({ createVerificationToken } as Adapter, prisma);

	assert.deepEqual(
		await adapter.createVerificationToken?.(token("allowed@example.com")),
		token("allowed@example.com"),
	);
	assert.deepEqual(
		await adapter.createVerificationToken?.(token("organizer@ctn-rtc.org")),
		token("organizer@ctn-rtc.org"),
	);
	assert.equal(createVerificationToken.mock.callCount(), 2);
});
