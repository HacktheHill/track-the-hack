import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { Session } from "next-auth";

/* eslint-disable @typescript-eslint/consistent-type-assertions -- focused authorization tests expose no database */

loadEnvFile(".github/workflows/build.env");
const routerModule = import("@/server/api/routers/notifications");

const organizerSession: Session = {
	user: { id: "organizer-1", isOrganizer: true, isAdmin: false },
	expires: "2099-01-01T00:00:00Z",
};

const organizerPrisma = {
	user: {
		findUnique: () =>
			Promise.resolve({
				id: "organizer-1",
				name: "Organizer",
				email: "organizer@ctn-rtc.org",
				isAdmin: false,
				disabledAt: null,
			}),
	},
	organizerAccess: { findUnique: () => Promise.resolve(null) },
} as unknown as PrismaClient;

void test("participants and anonymous callers cannot use notification campaign procedures", async () => {
	const { notificationsRouter } = await routerModule;
	for (const context of [
		{ prisma: organizerPrisma, session: null, participantSession: null, participantOriginAllowed: true },
		{
			prisma: organizerPrisma,
			session: null,
			participantSession: { hackerId: "participant_0123456789_abcdef" },
			participantOriginAllowed: true,
		},
	]) {
		await assert.rejects(
			notificationsRouter.createCaller(context).createCampaign({ name: "Lunch", maximumCohortSize: 50 }),
			{ code: "UNAUTHORIZED" },
		);
	}
});

void test("cross-origin participant notification mutations are rejected before database access", async () => {
	const { notificationsRouter } = await routerModule;
	const caller = notificationsRouter.createCaller({
		prisma: {} as PrismaClient,
		session: null,
		participantSession: { hackerId: "participant_0123456789_abcdef" },
		participantOriginAllowed: false,
	});
	await assert.rejects(caller.setDiscordEnabled({ enabled: false }), { code: "FORBIDDEN" });
});

void test("announcement bodies and cohort sizes retain conservative validation limits", async () => {
	const { notificationsRouter } = await routerModule;
	const caller = notificationsRouter.createCaller({
		prisma: organizerPrisma,
		session: organizerSession,
		participantSession: null,
		participantOriginAllowed: true,
	});
	await assert.rejects(caller.createCampaign({ name: "Lunch", maximumCohortSize: 0 }), { code: "BAD_REQUEST" });
	await assert.rejects(caller.createCampaign({ name: "Lunch", maximumCohortSize: 501 }), { code: "BAD_REQUEST" });
	await assert.rejects(caller.queueAnnouncement({ cohortId: "cohort-1", body: " " }), { code: "BAD_REQUEST" });
	await assert.rejects(caller.queueAnnouncement({ cohortId: "cohort-1", body: "x".repeat(501) }), {
		code: "BAD_REQUEST",
	});
});

void test("a null cohort maximum is persisted and creates one all-participants cohort", async () => {
	const { notificationsRouter } = await routerModule;
	const storedMaximums: Array<number | null> = [];
	const cohortMemberCounts: number[] = [];
	let cohortNumber = 0;
	const transaction = {
		hacker: {
			findMany: () =>
				Promise.resolve([
					{ id: "standard", mealCategory: "STANDARD" },
					{ id: "vegan", mealCategory: "VEGAN" },
					{ id: "halal", mealCategory: "HALAL" },
				]),
		},
		notificationCampaign: {
			create: ({ data }: { data: { maximumCohortSize: number | null; snapshotCount: number } }) => {
				storedMaximums.push(data.maximumCohortSize);
				return Promise.resolve({ id: "campaign-1", ...data });
			},
		},
		notificationCohort: {
			create: () => Promise.resolve({ id: `cohort-${++cohortNumber}` }),
		},
		notificationCohortMember: {
			createMany: ({ data }: { data: unknown[] }) => {
				cohortMemberCounts.push(data.length);
				return Promise.resolve({ count: data.length });
			},
		},
		auditEvent: { create: () => Promise.resolve({}) },
	};
	const prisma = {
		...organizerPrisma,
		$transaction: (operation: (client: typeof transaction) => Promise<unknown>) => operation(transaction),
	} as unknown as PrismaClient;

	await notificationsRouter
		.createCaller({
			prisma,
			session: organizerSession,
			participantSession: null,
			participantOriginAllowed: true,
		})
		.createCampaign({ name: "Seconds", maximumCohortSize: null });

	assert.deepEqual(storedMaximums, [null]);
	assert.equal(cohortNumber, 1);
	assert.deepEqual(cohortMemberCounts, [3]);
});

void test("only completed notification campaigns can be archived", async () => {
	const { notificationsRouter } = await routerModule;
	const prisma = {
		...organizerPrisma,
		notificationCampaign: { updateMany: () => Promise.resolve({ count: 0 }) },
	} as unknown as PrismaClient;
	await assert.rejects(
		notificationsRouter
			.createCaller({
				prisma,
				session: organizerSession,
				participantSession: null,
				participantOriginAllowed: true,
			})
			.archiveCampaign({ id: "campaign-1" }),
		{ code: "CONFLICT" },
	);
});
