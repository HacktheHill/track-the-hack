import assert from "node:assert/strict";
import test from "node:test";
import {
	clearOfflineParticipantPass,
	PARTICIPANT_OFFLINE_PASS_STORAGE_KEY,
	readOfflineParticipantPass,
	storeOfflineParticipantPass,
} from "@/utils/participant-pass";

const memoryStorage = () => {
	const entries = new Map<string, string>();
	return {
		entries,
		storage: {
			getItem: (key: string) => entries.get(key) ?? null,
			setItem: (key: string, value: string) => entries.set(key, value),
			removeItem: (key: string) => entries.delete(key),
		},
	};
};

void test("the offline pass stores only a valid participant QR identifier", () => {
	const { entries, storage } = memoryStorage();
	const participantId = "wvY1HKlwYnFBO8t-YnQbwg";

	assert.equal(storeOfflineParticipantPass(participantId, storage), true);
	assert.equal(entries.size, 1);
	assert.equal(entries.get(PARTICIPANT_OFFLINE_PASS_STORAGE_KEY), participantId);
	assert.equal(readOfflineParticipantPass(storage), participantId);

	assert.equal(storeOfflineParticipantPass("1234567890123456789012", storage), false);
	assert.equal(storeOfflineParticipantPass("person@example.com", storage), false);
	assert.equal(entries.size, 1);
});

void test("clearing the offline pass removes its only client-readable value", () => {
	const { entries, storage } = memoryStorage();
	storeOfflineParticipantPass("wvY1HKlwYnFBO8t-YnQbwg", storage);
	clearOfflineParticipantPass(storage);

	assert.equal(readOfflineParticipantPass(storage), null);
	assert.equal(entries.size, 0);
});
