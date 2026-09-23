import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import test from "node:test";
import { PrismaClient, type Prisma } from "@prisma/client";
import { formatScheduleDate, scheduleDayKey, scheduleDayKeys } from "@/utils/schedule-time";

loadEnvFile(".github/workflows/build.env");
const routerModule = import("@/server/api/routers/events");

void test("saved events are read in one participant-scoped query and require a session", async t => {
	const { eventsRouter } = await routerModule;
	const prisma = new PrismaClient({ datasourceUrl: "mysql://test:test@127.0.0.1:1/unreachable" });
	t.after(() => void prisma.$disconnect());
	const findMany = t.mock.fn<(args: Prisma.EventInterestFindManyArgs) => Promise<{ eventId: string }[]>>(() =>
		Promise.resolve([{ eventId: "event-1" }, { eventId: "event-2" }]),
	);
	Object.assign(prisma.eventInterest, { findMany });
	const caller = eventsRouter.createCaller({ prisma, session: null, participantSession: { hackerId: "hacker-1" } });
	assert.deepEqual(await caller.savedIds(), ["event-1", "event-2"]);
	assert.deepEqual(findMany.mock.calls[0]?.arguments, [
		{ where: { hackerId: "hacker-1", Event: { hidden: false } }, select: { eventId: true } },
	]);
	const guest = eventsRouter.createCaller({ prisma, session: null, participantSession: null });
	await assert.rejects(guest.savedIds(), { code: "UNAUTHORIZED" });
	assert.equal(findMany.mock.callCount(), 1);
});

void test("Ottawa day boundaries include overnight and weekend-long events without an extra midnight day", () => {
	const start = new Date("2026-09-26T01:30:00Z"); // Friday, 9:30 p.m. Ottawa time
	const end = new Date("2026-09-27T05:00:00Z"); // Sunday, 1:00 a.m.
	assert.equal(scheduleDayKey(start), "2026-09-25");
	assert.deepEqual(scheduleDayKeys(start, end), ["2026-09-25", "2026-09-26", "2026-09-27"]);
	assert.deepEqual(scheduleDayKeys(start, new Date("2026-09-26T04:00:00Z")), ["2026-09-25"]);
	assert.equal(formatScheduleDate(start, "fr-CA", { day: "numeric", month: "short" }), "25 sept.");
});
