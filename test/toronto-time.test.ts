import assert from "node:assert/strict";
import test from "node:test";
import { formatTorontoDateTimeLocal, parseTorontoDateTimeLocal } from "@/utils/toronto-time";

void test("Toronto local times use the date's daylight-saving offset", () => {
	assert.equal(parseTorontoDateTimeLocal("2026-09-25T10:00").toISOString(), "2026-09-25T14:00:00.000Z");
	assert.equal(parseTorontoDateTimeLocal("2027-01-15T10:00").toISOString(), "2027-01-15T15:00:00.000Z");
});

void test("Toronto dates format independently of the browser or server timezone", () => {
	assert.equal(formatTorontoDateTimeLocal(new Date("2026-09-25T14:00:00.000Z")), "2026-09-25T10:00");
	assert.equal(formatTorontoDateTimeLocal(new Date("2027-01-15T15:00:00.000Z")), "2027-01-15T10:00");
});

void test("Toronto local times reject invalid dates and skipped or ambiguous DST times", () => {
	assert.throws(() => parseTorontoDateTimeLocal("2026-02-30T10:00"));
	assert.throws(() => parseTorontoDateTimeLocal("2027-03-14T02:30"));
	assert.throws(() => parseTorontoDateTimeLocal("2026-11-01T01:30"));
});
