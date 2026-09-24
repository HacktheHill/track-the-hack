import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { auditEventV1Schema, createAuditEvent, emitAuditEvent, persistAuditEvent } from "@/server/lib/audit-event";

const auditOutputSchema = z.record(z.unknown());

const scanEvent = () =>
	createAuditEvent({
		name: "scanner.scan",
		outcome: "recorded",
		actor: { type: "organizer", id: "organizer-1" },
		subject: { type: "hacker", id: "wvY1HKlwYnFBO8t-YnQbwg" },
		resource: { type: "event", id: "event-1" },
		data: { workflow: "ATTENDANCE", beforeCount: 0, afterCount: 1 },
		occurredAt: new Date("2026-09-24T12:00:00.000Z"),
	});

void test("canonical audit events are strict, UTC, and action-aware", () => {
	const event = scanEvent();
	assert.equal(event.schemaVersion, 1);
	assert.equal(event.occurredAt, "2026-09-24T12:00:00.000Z");
	assert.equal(auditEventV1Schema.safeParse({ ...event, unexpected: true }).success, false);
	assert.equal(auditEventV1Schema.safeParse({ ...event, outcome: "applied" }).success, false);
	assert.equal(auditEventV1Schema.safeParse({ ...event, occurredAt: "2026-09-24T08:00:00-04:00" }).success, false);
	assert.equal(auditEventV1Schema.safeParse({ ...event, subject: undefined }).success, false);
	assert.equal(auditEventV1Schema.safeParse({ ...event, data: { email: "person@example.com" } }).success, false);
	assert.equal(
		auditEventV1Schema.safeParse({ ...event, data: { value: "https://example.com/#secret" } }).success,
		false,
	);
});

void test("hardware availability audit records only opaque operational state", () => {
	const event = createAuditEvent({
		name: "hardware.item.availability_changed",
		outcome: "out_of_stock",
		actor: { type: "organizer", id: "organizer-1" },
		resource: { type: "hardware_item", id: "item-1" },
		data: { previousAvailable: true, available: false },
	});
	assert.equal(event.resource?.id, "item-1");
	assert.equal(auditEventV1Schema.safeParse({ ...event, data: { name: "Resistors" } }).success, false);
});

void test("audit persistence flattens searchable fields", async t => {
	const create = t.mock.fn((input: { data: Record<string, unknown> }) => {
		assert.ok(input.data);
		return Promise.resolve({});
	});
	const event = scanEvent();
	// Partial database mock exposes only the audit operation exercised here.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	await persistAuditEvent({ auditEvent: { create } } as never, event);
	const data = create.mock.calls[0]?.arguments[0];
	assert.ok(data);
	assert.equal(data.data.actorId, "organizer-1");
	assert.equal(data.data.subjectId, "wvY1HKlwYnFBO8t-YnQbwg");
	assert.equal(data.data.resourceId, "event-1");
	assert.deepEqual(data.data.data, event.data);
});

void test("Azure mirror output is one-line structured JSON without identity fields", t => {
	let output = "";
	t.mock.method(console, "info", (value: unknown) => {
		output = String(value);
	});
	emitAuditEvent(scanEvent());
	assert.equal(output.includes("\n"), false);
	const parsed = auditOutputSchema.parse(JSON.parse(output));
	assert.equal(parsed.kind, "track.audit");
	assert.equal(parsed.service, "track-the-hack");
	assert.equal("email" in parsed, false);
	assert.equal("token" in parsed, false);
});
