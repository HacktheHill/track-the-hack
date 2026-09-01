import { useEffect, useState } from "react";

// Client safe on purpose. The session module cannot be imported from a
// component because it pulls in node:crypto.
export const PARTICIPANT_HINT_COOKIE = "participant_pass";
export const PARTICIPANT_OFFLINE_PASS_STORAGE_KEY = "track-the-hack.participant-id";
type OfflinePassStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const isParticipantId = (value: string) =>
	value.length >= 22 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value) && !/^\d+$/.test(value);

const browserStorage = (): OfflinePassStorage | null => {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage;
	} catch {
		return null;
	}
};

/**
 * Save only the event QR payload. It identifies the Hacker record to an
 * organizer's scanner but is not accepted as participant authorization.
 */
export const storeOfflineParticipantPass = (
	participantId: string,
	storage: OfflinePassStorage | null = browserStorage(),
) => {
	if (!storage || !isParticipantId(participantId)) return false;
	try {
		storage.setItem(PARTICIPANT_OFFLINE_PASS_STORAGE_KEY, participantId);
		return true;
	} catch {
		return false;
	}
};

export const readOfflineParticipantPass = (storage: OfflinePassStorage | null = browserStorage()) => {
	if (!storage) return null;
	try {
		const participantId = storage.getItem(PARTICIPANT_OFFLINE_PASS_STORAGE_KEY);
		return participantId && isParticipantId(participantId) ? participantId : null;
	} catch {
		return null;
	}
};

export const clearOfflineParticipantPass = (storage: OfflinePassStorage | null = browserStorage()) => {
	try {
		storage?.removeItem(PARTICIPANT_OFFLINE_PASS_STORAGE_KEY);
	} catch {
		// A browser that blocks local storage has no saved pass to remove.
	}
};

/**
 * Whether this browser looks like it holds a participant pass.
 *
 * This is a hint for the navigation and nothing else. The cookie it reads is
 * empty of meaning and readable by any script; the real session lives in an
 * HttpOnly cookie that only the server can see. Setting this by hand just shows
 * someone a link that /profile will bounce them off.
 */
export const useHasParticipantPass = () => {
	const [hasPass, setHasPass] = useState(false);

	// Read after mount so the server render and the first client render agree.
	useEffect(() => {
		const hasSessionHint = document.cookie
			.split(";")
			.some(part => part.trim().startsWith(`${PARTICIPANT_HINT_COOKIE}=1`));
		setHasPass(hasSessionHint || readOfflineParticipantPass() !== null);
	}, []);

	return hasPass;
};

export const useOfflineParticipantPass = () => {
	const [participantId, setParticipantId] = useState<string | null>(null);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		setParticipantId(readOfflineParticipantPass());
		setLoaded(true);
	}, []);

	return { loaded, participantId };
};
