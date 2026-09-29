import assert from "node:assert/strict";
import test from "node:test";
import { reconcileSheetAttendance } from "@/server/services/sheet-attendance";

const id = (character: string) => character.repeat(22);

void test("Sheet attendance reconciliation returns only opaque IDs and attendance booleans", async () => {
	const result = await reconcileSheetAttendance(
		{
			findAttendance: ids => {
				assert.deepEqual(ids, [id("a"), id("b")]);
				return Promise.resolve([{ id: id("a"), attended: true }]);
			},
		},
		{ ids: [id("a"), id("b")] },
	);
	assert.deepEqual(result, {
		records: [{ id: id("a"), attended: true }],
		missingIds: [id("b")],
	});
	assert.doesNotMatch(JSON.stringify(result), /name|email|phone/i);
});

void test("Sheet attendance reconciliation rejects duplicate IDs", async () => {
	await assert.rejects(
		reconcileSheetAttendance({ findAttendance: () => Promise.resolve([]) }, { ids: [id("a"), id("a")] }),
		/Participant IDs must be unique/,
	);
});
