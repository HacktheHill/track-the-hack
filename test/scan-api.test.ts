import assert from "node:assert/strict";
import test from "node:test";
import { RoleName, type PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";

// These callers use a mock database. No external services are contacted.
Object.assign(process.env, {
	NODE_ENV: "test",
	DATABASE_URL: "mysql://test:test@127.0.0.1:1/test",
	NEXTAUTH_URL: "http://localhost:3000",
	EMAIL_SERVER_PORT: "1025",
	EMAIL_FROM: "test@example.com",
	S3_URL: "http://localhost:1",
	DISCORD_BOT_URL: "http://localhost:1",
	INTERNAL_API_SECRET: "test-only-secret-at-least-32-characters",
});
for (const key of [
	"DISCORD_CLIENT_ID",
	"DISCORD_CLIENT_SECRET",
	"GITHUB_CLIENT_ID",
	"GITHUB_CLIENT_SECRET",
	"GOOGLE_CLIENT_ID",
	"GOOGLE_CLIENT_SECRET",
	"EMAIL_SERVER_HOST",
	"EMAIL_SERVER_USER",
	"EMAIL_SERVER_PASSWORD",
	"SPONSORSHIP_GOOGLE_CLIENT_ID",
	"SPONSORSHIP_GOOGLE_CLIENT_SECRET",
	"SPONSORSHIP_GOOGLE_REFRESH_TOKEN",
	"S3_AUTH_KEY",
	"QR_SECRET_KEY",
	"WALK_IN_SECRET_KEY",
])
	process.env[key] = "test-only";

const routers = Promise.all([import("../src/server/api/routers/events"), import("../src/server/api/routers/presence")]);
const session: Session = { user: { id: "user-1", roles: [RoleName.HACKER] }, expires: "2099-01-01" };
const context = (prisma: object, currentSession: Session | null = session) => ({
	prisma: prisma as PrismaClient,
	session: currentSession,
});

void test("interest writes use the signed-in participant and persist/remove one event selection", async () => {
	const [{ eventsRouter }] = await routers;
	let saved = false;
	const selection = { hackerId: "hacker-1", eventId: "event-1" };
	const caller = eventsRouter.createCaller(
		context({
			hacker: {
				findUnique: (input: unknown) => {
					assert.deepEqual(input, { where: { userId: "user-1" }, select: { id: true } });
					return { id: "hacker-1" };
				},
			},
			event: { findUnique: () => ({ id: "event-1", hidden: false }) },
			eventInterest: {
				upsert: (input: unknown) => {
					assert.deepEqual(input, { where: { hackerId_eventId: selection }, create: selection, update: {} });
					saved = true;
				},
				findUnique: () => (saved ? { id: "interest-1" } : null),
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

void test("anonymous users, accounts without participants and hidden events cannot save interests", async () => {
	const [{ eventsRouter }] = await routers;
	await assert.rejects(
		eventsRouter.createCaller(context({}, null)).setInterest({ eventId: "event-1", interested: true }),
		{ code: "UNAUTHORIZED" },
	);
	await assert.rejects(
		eventsRouter
			.createCaller(context({ hacker: { findUnique: () => null } }))
			.setInterest({ eventId: "event-1", interested: true }),
		{ code: "FORBIDDEN" },
	);
	await assert.rejects(
		eventsRouter
			.createCaller(
				context({
					hacker: { findUnique: () => ({ id: "hacker-1" }) },
					event: { findUnique: () => ({ id: "event-1", hidden: true }) },
				}),
			)
			.setInterest({ eventId: "event-1", interested: true }),
		{ code: "NOT_FOUND" },
	);
});

void test("scan details require an organizer role, including for accounts that also have the hacker role", async () => {
	const [, { presenceRouter }] = await routers;
	await assert.rejects(presenceRouter.createCaller(context({}, null)).getScanInfo({ id: "hacker-2" }), {
		code: "UNAUTHORIZED",
	});
	await assert.rejects(
		presenceRouter
			.createCaller(
				context({
					user: { findUnique: () => ({ roles: [{ name: RoleName.HACKER }] }) },
				}),
			)
			.getScanInfo({ id: "hacker-2" }),
		/permission/,
	);
	const details = {
		id: "hacker-2",
		firstName: "Alex",
		tShirtSize: "M",
		dietaryRestrictions: "Peanuts",
		presences: [],
		eventInterests: [],
	};
	const result = await presenceRouter
		.createCaller(
			context({
				user: { findUnique: () => ({ roles: [{ name: RoleName.HACKER }, { name: RoleName.ORGANIZER }] }) },
				hacker: {
					findUnique: (input: { where: { id: string }; select: Record<string, unknown> }) => {
						assert.equal(input.where.id, "hacker-2");
						assert.equal(input.select.tShirtSize, true);
						assert.equal(input.select.dietaryRestrictions, true);
						assert.equal(input.select.presences, true);
						assert.ok(input.select.eventInterests);
						assert.equal(input.select.email, undefined);
						return details;
					},
				},
			}),
		)
		.getScanInfo({ id: "hacker-2" });
	assert.deepEqual(result, details);
});
