import { useEffect, useState } from "react";

// Client safe on purpose. The session module cannot be imported from a
// component because it pulls in node:crypto.
export const PARTICIPANT_HINT_COOKIE = "participant_pass";

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
		setHasPass(document.cookie.split(";").some(part => part.trim().startsWith(`${PARTICIPANT_HINT_COOKIE}=1`)));
	}, []);

	return hasPass;
};
