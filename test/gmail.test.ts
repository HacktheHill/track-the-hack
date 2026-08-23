import assert from "node:assert/strict";
import test from "node:test";
import type { gmail_v1 } from "googleapis";
import { createDraft } from "@/server/lib/gmail";

void test("Gmail drafts preserve the rendered message, thread, and labels without live credentials", async () => {
	let draftRequest:
		| {
				requestBody?: { message?: { raw?: string; threadId?: string } };
		  }
		| undefined;
	let labelRequest: { id?: string; userId?: string; requestBody?: { addLabelIds?: string[] } } | undefined;

	const gmail = {
		users: {
			labels: {
				list: () => Promise.resolve({
					data: {
						labels: [
							{ id: "UNREAD", name: "UNREAD" },
							{ id: "season", name: "2023-24" },
							{ id: "organizer", name: "Organizer" },
						],
					},
				}),
			},
			threads: {
				list: () => Promise.resolve({ data: { threads: [{ id: "existing-thread" }] } }),
				get: () => Promise.resolve({
					data: {
						messages: [
							{
								threadId: "existing-thread",
								labelIds: ["season", "organizer"],
								payload: {
									headers: [
										{ name: "Message-ID", value: "<original@example.test>" },
										{ name: "Subject", value: "Existing subject" },
									],
								},
							},
						],
					},
				}),
				modify: (request: { id?: string; userId?: string; requestBody?: { addLabelIds?: string[] } }) => {
					labelRequest = request;
					return Promise.resolve({ data: {} });
				},
			},
			drafts: {
				create: (request: { requestBody?: { message?: { raw?: string; threadId?: string } } }) => {
					draftRequest = request;
					return Promise.resolve({ data: { message: { threadId: "existing-thread" } } });
				},
			},
		},
	} as unknown as gmail_v1.Gmail;

	await createDraft(
		{
			subject: "New subject",
			message: "<p>Hello sponsor</p>",
			labels: ["UNREAD", "2023-24", "Organizer"],
			sender: "sponsorship@ctn-rtc.org",
			recipient: "sponsor@example.test",
		},
		gmail,
	);

	assert.equal(draftRequest?.requestBody?.message?.threadId, "existing-thread");
	const raw = draftRequest?.requestBody?.message?.raw;
	assert.ok(raw);
	const mime = Buffer.from(raw, "base64").toString("utf8");
	assert.match(mime, /From: <sponsorship@ctn-rtc\.org>/);
	assert.match(mime, /To: <sponsor@example\.test>/);
	assert.match(mime, /Subject: =\?utf-8\?B\?RXhpc3Rpbmcgc3ViamVjdA==\?=/);
	assert.match(mime, /References: <original@example\.test>/);
	assert.match(mime, /<p>Hello sponsor<\/p>/);
	assert.deepEqual(labelRequest, {
		id: "existing-thread",
		userId: "me",
		requestBody: { addLabelIds: ["UNREAD", "season", "organizer"] },
	});
});
