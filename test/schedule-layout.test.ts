import assert from "node:assert/strict";
import { test } from "node:test";
import { groupScheduleEvents } from "@/utils/schedule-layout";

const event = (id: string, start: number, end: number) => ({
	id,
	start: new Date(start * 60_000),
	end: new Date(end * 60_000),
});

void test("simultaneous events stay together, while adjacent events remain separate", () => {
	const groups = groupScheduleEvents([
		event("check-in", 540, 660),
		event("merchandise", 540, 660),
		event("opening", 660, 720),
		event("lunch", 720, 750),
		event("workshop-1", 750, 840),
		event("workshop-2", 750, 840),
		event("workshop-3", 750, 840),
	]);
	assert.deepEqual(
		groups.map(group => group.events.map(item => item.id)),
		[["check-in", "merchandise"], ["opening"], ["lunch"], ["workshop-1", "workshop-2", "workshop-3"]],
	);
	assert.ok(groups.every(group => !group.overlapsPrevious));
});

void test("brief handoffs overlap cards, while a short event inside a long event gets its own place", () => {
	const groups = groupScheduleEvents([
		event("first", 540, 600),
		event("handoff", 595, 720),
		event("short", 630, 650),
		event("next", 720, 780),
	]);
	assert.deepEqual(
		groups.map(group => group.events.map(item => item.id)),
		[["first"], ["handoff", "short"], ["next"]],
	);
	assert.deepEqual(
		groups.map(group => group.overlapsPrevious),
		[false, true, false],
	);
});

void test("a long event does not absorb later simultaneous events", () => {
	const groups = groupScheduleEvents([
		event("long", 690, 900),
		event("short", 720, 735),
		event("workshop", 750, 840),
		event("fair", 750, 840),
		event("social", 750, 840),
	]);
	assert.deepEqual(
		groups.map(group => group.events.map(item => item.id)),
		[
			["long", "short"],
			["workshop", "fair", "social"],
		],
	);
	assert.equal(groups[1]?.overlapsPrevious, false);
});

void test("a weekend-long activity does not create an oversized group", () => {
	const groups = groupScheduleEvents([
		event("hacking", 540, 2700),
		event("react", 570, 630),
		event("coffee", 570, 750),
		event("game", 600, 660),
	]);
	assert.deepEqual(
		groups.map(group => group.events.map(item => item.id)),
		[["hacking"], ["react", "coffee", "game"]],
	);
	assert.ok(groups.every(group => !group.overlapsPrevious));
});

void test("consecutive judging sessions cannot look simultaneous", () => {
	const groups = groupScheduleEvents([
		event("judging-early", 780, 900),
		event("career-fair", 780, 960),
		event("judging-late", 930, 1020),
	]);
	assert.deepEqual(
		groups.map(group => group.events.map(item => item.id)),
		[["judging-early", "career-fair"], ["judging-late"]],
	);
});
