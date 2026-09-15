import assert from "node:assert/strict";
import test from "node:test";
import {
	provisioningBatchSchema,
	provisioningRecordSchema,
	reconciliationRequestSchema,
} from "@/server/services/hacker-lifecycle";
import {
	applicationRow,
	createSheetHarness,
	type SheetRequest,
	type SheetRows,
} from "@root/test/helpers/google-sheets-harness";

const applications = ["first", "second"].map(id =>
	applicationRow({
		"Submission ID": id,
		"What unisex T-shirt size would you prefer?": "M",
	}),
);
const batch = (request: SheetRequest) => provisioningBatchSchema.parse(JSON.parse(request.options.payload)).hackers;
const success = (request: SheetRequest) => ({
	status: 200,
	body: JSON.stringify({ processed: batch(request).length }),
});
const ids = (rows: SheetRows) => rows.slice(1).map(row => row[2]);

for (const fault of ["lost response", "partial server write", "short response", "malformed response"] as const) {
	void test(`acceptance retries reuse committed IDs after a ${fault}`, () => {
		const serverIds = new Set<string>();
		let fail = true;
		const sheet = createSheetHarness({
			applications,
			fetch: request => {
				const records = batch(request);
				assert.deepEqual(
					ids(sheet.savedRows()),
					records.map(record => record.id),
					"IDs must be flushed before the request",
				);
				if (fail) {
					fail = false;
					assert.ok(
						sheet
							.savedRows()
							.slice(1)
							.every(row => !row[7] && !row[10]),
						"Do not claim sync success before a response",
					);
					(fault === "partial server write" ? records.slice(0, 1) : records).forEach(record =>
						serverIds.add(record.id),
					);
					if (fault === "short response") return { status: 200, body: '{"processed":1}' };
					if (fault === "malformed response") return { status: 200, body: "invalid JSON" };
					throw new Error(fault);
				}
				records.forEach(record => serverIds.add(record.id));
				return success(request);
			},
		});
		assert.throws(() => sheet.run());
		assert.equal(sheet.isLocked(), false);
		assert.equal(sheet.alerts.length, 0);
		const originalIds = ids(sheet.savedRows());
		sheet.run();
		assert.deepEqual(ids(sheet.savedRows()), originalIds);
		assert.equal(sheet.uuidCalls(), 4, "A retry must not generate replacement IDs");
		assert.equal(serverIds.size, 2);
		assert.ok(
			sheet
				.savedRows()
				.slice(1)
				.every(row => row[7] === "PENDING" && row[10] instanceof Date),
		);
	});
}

void test("a partially saved Sheet batch sends nothing and reuses its saved IDs on retry", () => {
	let fail = true;
	const sheet = createSheetHarness({
		applications,
		fetch: success,
		beforeWrite: row => {
			if (fail && row === 3) {
				fail = false;
				throw new Error("Sheet write failed");
			}
		},
	});
	assert.throws(() => sheet.run(), /Sheet write failed/);
	assert.equal(sheet.requests.length, 0);
	assert.equal(sheet.isLocked(), false);
	const firstId = sheet.savedRows()[1]?.[2];
	assert.ok(firstId);
	sheet.run();
	assert.equal(sheet.savedRows()[1]?.[2], firstId);
	assert.equal(sheet.savedRows().length, 3);
});

void test("a failed flush prevents the API call and still releases the lock", () => {
	const sheet = createSheetHarness({
		applications,
		fetch: success,
		beforeFlush: () => {
			throw new Error("Flush failed");
		},
	});
	assert.throws(() => sheet.run(), /Flush failed/);
	assert.equal(sheet.requests.length, 0);
	assert.equal(sheet.isLocked(), false);
});

void test("a Sheet write failure after server success is safe to retry", () => {
	let participantWrites = 0;
	const serverIds = new Set<string>();
	const sheet = createSheetHarness({
		applications,
		fetch: request => {
			batch(request).forEach(record => serverIds.add(record.id));
			return success(request);
		},
		beforeWrite: row => {
			if (row === 2 && ++participantWrites === 2) throw new Error("Sync marker write failed");
		},
	});
	assert.throws(() => sheet.run(), /Sync marker write failed/);
	const originalIds = ids(sheet.savedRows());
	sheet.run();
	assert.deepEqual(ids(sheet.savedRows()), originalIds);
	assert.equal(serverIds.size, 2);
});

void test("an overlapping acceptance waits for the lock before reading participant mappings", () => {
	let runPredecessor = true;
	const sheet = createSheetHarness({
		applications,
		fetch: success,
		beforeLock: () => {
			if (runPredecessor) {
				runPredecessor = false;
				sheet.run();
			}
		},
	});
	sheet.run();
	assert.equal(sheet.requests.length, 2);
	assert.equal(sheet.uuidCalls(), 4);
	assert.deepEqual(
		sheet.requests.map(request => batch(request).map(record => record.id)),
		[ids(sheet.savedRows()), ids(sheet.savedRows())],
	);
});

void test("contending acceptance and other Sheet writers cannot enter an in-flight operation", () => {
	let contend = true;
	const sheet = createSheetHarness({
		applications,
		fetch: request => {
			if (contend) {
				contend = false;
				for (const action of [
					"acceptSelectedApplications",
					"refreshRsvpStatus",
					"setupTrackOperations",
					"issueAccessForSelectedParticipant",
				] as const) {
					assert.throws(() => sheet.run(action), /Another Track operation is running/);
				}
			}
			return success(request);
		},
	});
	sheet.run();
	sheet.run();
	assert.equal(sheet.requests.length, 2);
	assert.equal(sheet.uuidCalls(), 4);
	assert.equal(sheet.savedRows().length, 3);
});

void test("retrying an existing walk-in preserves confirmation and access data", () => {
	const first = createSheetHarness({ applications, fetch: success });
	first.run("acceptSelectedWalkInApplications");
	const saved = first.savedRows();
	const participant = saved[1];
	assert.ok(participant);
	participant[7] = "CONFIRMED";
	participant[8] = "https://track.example/cancel#existing";
	participant[9] = new Date("2030-09-15T00:00:00Z");
	let fail = true;
	const sheet = createSheetHarness({
		applications,
		initialRows: saved,
		fetch: request => {
			if (fail) {
				fail = false;
				throw new Error("Lost response");
			}
			assert.ok(batch(request).every(record => record.walkIn));
			return success(request);
		},
	});
	assert.throws(() => sheet.run("acceptSelectedWalkInApplications"));
	assert.deepEqual(sheet.savedRows(), saved);
	sheet.run("acceptSelectedWalkInApplications");
	assert.deepEqual(sheet.savedRows()[1]?.slice(7, 10), participant.slice(7, 10));
	assert.deepEqual(ids(sheet.savedRows()), ids(saved));
	assert.equal(sheet.uuidCalls(), 0);
});

void test("a missing reservation can be reconciled, retried, and issued access with the same ID", () => {
	let fail = true;
	const accessExpiry = "2030-09-15T00:05:00.000Z";
	const sheet = createSheetHarness({
		applications,
		fetch: request => {
			if (request.url.endsWith("/rsvp-reconciliation")) {
				const { ids } = reconciliationRequestSchema.parse(JSON.parse(request.options.payload));
				return { status: 200, body: JSON.stringify({ records: [], missingIds: ids }) };
			}
			if (request.url.endsWith("/claim")) {
				const record = provisioningRecordSchema.parse(JSON.parse(request.options.payload));
				assert.equal(record.id, sheet.savedRows()[1]?.[2]);
				return {
					status: 200,
					body: JSON.stringify({ claimUrl: "https://track.example/claim#token", expiresAt: accessExpiry }),
				};
			}
			if (fail) {
				fail = false;
				return { status: 500, body: "Provisioning failed" };
			}
			return success(request);
		},
	});
	assert.throws(() => sheet.run(), /Track API 500/);
	const originalIds = ids(sheet.savedRows());
	sheet.run("refreshRsvpStatus");
	assert.ok(
		sheet
			.savedRows()
			.slice(1)
			.every(row => row[7] === "MISSING"),
	);
	sheet.run();
	assert.ok(
		sheet
			.savedRows()
			.slice(1)
			.every(row => row[7] === "PENDING"),
	);
	sheet.run("issueAccessForSelectedParticipant");
	assert.deepEqual(sheet.savedRows()[1]?.[9], new Date(accessExpiry));
	assert.deepEqual(ids(sheet.savedRows()), originalIds);
	assert.equal(sheet.uuidCalls(), 4);
	assert.equal(sheet.isLocked(), false);
});

void test("duplicate selected submissions and conflicting existing mappings fail before provisioning", () => {
	const duplicate = createSheetHarness({
		applications: [applications[0] ?? [], applications[0] ?? []],
		fetch: success,
	});
	assert.throws(() => duplicate.run(), /Duplicate Submission ID/);
	assert.equal(duplicate.requests.length, 0);
	const first = createSheetHarness({ applications, fetch: success });
	first.run();
	const saved = first.savedRows();
	const participant = saved[1];
	assert.ok(participant);
	saved.push([...participant.slice(0, 2), "different_participant_0123456789", ...participant.slice(3)]);
	const conflicting = createSheetHarness({ applications, initialRows: saved, fetch: success });
	assert.throws(() => conflicting.run(), /Conflicting participant IDs/);
	assert.equal(conflicting.requests.length, 0);
});
