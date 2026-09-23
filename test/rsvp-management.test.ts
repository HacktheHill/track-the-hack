import assert from "node:assert/strict";
import test from "node:test";
import {
	createCancellationToken,
	reconcileRsvps,
} from "@/server/services/hacker-lifecycle";
import {
	decideManagedRsvp,
	managedRsvpState,
	readManagedRsvp,
	type RsvpManagementRepository,
} from "@/server/services/rsvp-management";

const id = "participant_0123456789_abcdef";
const capabilityId = "c".repeat(43);
const secret = "test-secret-at-least-32-characters-long";
const token = createCancellationToken(capabilityId, secret);
const deadline = new Date("2030-09-30T03:59:59.000Z");
const before = new Date("2030-09-29T12:00:00.000Z");
const after = new Date("2030-10-01T12:00:00.000Z");

class MemoryManagement implements RsvpManagementRepository {
	confirmed = false;
	respondedAt: Date | null = null;
	writes = 0;
	read(requested: string, now: Date) {
		return Promise.resolve(requested === capabilityId
			? managedRsvpState(this.confirmed, this.respondedAt, deadline, now)
			: null);
	}
	decide(requested: string, attending: boolean, now: Date) {
		if (requested !== capabilityId) return Promise.resolve(null);
		if (attending && deadline <= now) return Promise.resolve("expired" as const);
		if (this.confirmed !== attending || this.respondedAt === null) {
			this.confirmed = attending;
			this.respondedAt = now;
			this.writes++;
		}
		return this.read(requested, now);
	}
}

void test("one management token can answer yes, cancel, and answer yes again without rotating", async () => {
	const repository = new MemoryManagement();
	assert.deepEqual(await readManagedRsvp(repository, token, secret, before), { status: "PENDING", canAttend: true });
	assert.equal(repository.writes, 0, "opening the page must be read-only");
	assert.equal((await decideManagedRsvp(repository, token, secret, true, before)).status, "CONFIRMED");
	assert.equal((await decideManagedRsvp(repository, token, secret, true, before)).status, "CONFIRMED");
	assert.equal(repository.writes, 1);
	assert.equal((await decideManagedRsvp(repository, token, secret, false, before)).status, "DECLINED");
	assert.equal((await decideManagedRsvp(repository, token, secret, true, before)).status, "CONFIRMED");
	assert.equal(repository.writes, 3);
	assert.equal((await readManagedRsvp(repository, token, secret, before)).status, "CONFIRMED");
});

void test("a participant can decline first and cancel after the deadline, but cannot newly attend after it", async () => {
	const repository = new MemoryManagement();
	assert.equal((await decideManagedRsvp(repository, token, secret, false, before)).status, "DECLINED");
	await assert.rejects(decideManagedRsvp(repository, token, secret, true, after), /INVALID_OR_EXPIRED_INVITATION/);
	assert.equal((await decideManagedRsvp(repository, token, secret, false, after)).status, "DECLINED");
	assert.equal(repository.writes, 1);
	await assert.rejects(decideManagedRsvp(repository, id, secret, false, before), /INVALID_CANCELLATION_CAPABILITY/);
});

void test("reconciliation returns a management link before the first answer and a distinct declined state", async () => {
	const repository = {
		reconcile: () => Promise.resolve([{ id, confirmed: false, rsvpRespondedAt: null, cancellationCapabilityId: capabilityId }]),
	};
	const initial = await reconcileRsvps(repository, { ids: [id] }, "https://track.example", secret);
	assert.equal(initial.records[0]?.status, "PENDING");
	assert.equal(initial.records[0]?.rsvpLink, `https://track.example/rsvp/manage#${token}`);
	assert.equal(initial.records[0]?.cancellationLink, undefined);
	const declined = await reconcileRsvps({
		reconcile: () => Promise.resolve([{ id, confirmed: false, rsvpRespondedAt: before, cancellationCapabilityId: capabilityId }]),
	}, { ids: [id] }, "https://track.example", secret);
	assert.equal(declined.records[0]?.status, "DECLINED");
	assert.equal(declined.records[0]?.rsvpLink, initial.records[0]?.rsvpLink);
});
