import assert from "node:assert/strict";
import test from "node:test";
import { createDraft, type GmailClient } from "@/server/lib/gmail";

void test("Gmail drafts preserve the rendered message, thread, and labels without live credentials", async () => {
	type DraftRequest = Parameters<GmailClient["users"]["drafts"]["create"]>[0];
	type LabelRequest = Parameters<GmailClient["users"]["threads"]["modify"]>[0];
	const draftRequests: DraftRequest[] = [];
	let labelRequest: LabelRequest | undefined;
	let threadListCount = 0;
	const requestedThreadIds: string[] = [];

	const gmail: GmailClient = {
		users: {
			labels: {
				list: () =>
					Promise.resolve({
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
				list: () => {
					threadListCount += 1;
					return Promise.resolve({
						data: {
							threads: threadListCount === 1 ? [{ id: null }, { id: "existing-thread" }] : [{ id: null }],
						},
					});
				},
				get: request => {
					requestedThreadIds.push(request.id);
					return Promise.resolve({
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
					});
				},
				modify: request => {
					labelRequest = request;
					return Promise.resolve({ data: {} });
				},
			},
			drafts: {
				create: request => {
					draftRequests.push(request);
					return Promise.resolve({
						data: { message: { threadId: request.requestBody.message.threadId ?? "new-thread" } },
					});
				},
			},
		},
	};

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

	const threadedDraft = draftRequests[0];
	assert.ok(threadedDraft);
	assert.equal(threadedDraft.requestBody.message.threadId, "existing-thread");
	const mime = Buffer.from(threadedDraft.requestBody.message.raw, "base64").toString("utf8");
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
	assert.deepEqual(requestedThreadIds, ["existing-thread"]);

	await createDraft(
		{
			subject: "Fresh subject",
			message: "<p>New conversation</p>",
			labels: [],
			sender: "sponsorship@ctn-rtc.org",
			recipient: "new-sponsor@example.test",
		},
		gmail,
	);

	const freshDraft = draftRequests[1];
	assert.ok(freshDraft);
	assert.equal(Object.hasOwn(freshDraft.requestBody.message, "threadId"), false);
	const freshMime = Buffer.from(freshDraft.requestBody.message.raw, "base64").toString("utf8");
	assert.doesNotMatch(freshMime, /^(References|In-Reply-To):/m);
});
