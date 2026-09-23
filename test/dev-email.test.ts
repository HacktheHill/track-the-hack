import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { deliverLocalParticipantEmail } from "@root/scripts/dev-email.mjs";

void test("development RSVP emails cross loopback SMTP and land as parsed MIME", async () => {
	const mailboxDirectory = await mkdtemp(join(tmpdir(), "track-the-hack-mail-"));
	const messages = [{
		type: "invitation" as const,
		link: "http://127.0.0.1:3000/rsvp/manage#0123456789abcdefghijklmnopqrstuvwxyz.ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abc",
		subject: "RSVP for Hack the Hill III",
	}];

	try {
		for (const expected of messages) {
			const delivered = await deliverLocalParticipantEmail({ ...expected, mailboxDirectory });
			assert.equal(delivered.from, "no-reply@track.local");
			assert.deepEqual(delivered.to, ["participant@example.test"]);
			assert.equal(delivered.subject, expected.subject);
			assert.equal(delivered.type, expected.type);
			assert.deepEqual(delivered.links, [expected.link]);
			assert.match(await readFile(delivered.file, "utf8"), /Content-Type: multipart\/alternative/);
		}
	} finally {
		await rm(mailboxDirectory, { recursive: true, force: true });
	}
});
