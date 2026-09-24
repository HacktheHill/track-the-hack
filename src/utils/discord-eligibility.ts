import { useEffect, useState } from "react";
import { readOfflineParticipantPass } from "@/utils/participant-pass";

export type DiscordEligibility =
	| "checking"
	| "eligible"
	| "session-required"
	| "saved-pass-session-required"
	| "check-in-required"
	| "unavailable";

export const readDiscordEligibility = async (
	send: typeof fetch = fetch,
	hasSavedPass = () => readOfflineParticipantPass() !== null,
): Promise<DiscordEligibility> => {
	try {
		const response = await send("/api/discord/verify", { headers: { Accept: "application/json" } });
		if (response.ok) return "eligible";
		if (response.status === 401) return hasSavedPass() ? "saved-pass-session-required" : "session-required";
		if (response.status === 403) return "check-in-required";
		return "unavailable";
	} catch {
		return "unavailable";
	}
};

export const useDiscordEligibility = (
	checkEligibility: () => Promise<DiscordEligibility> = readDiscordEligibility,
	retryMilliseconds = 3_000,
) => {
	const [eligibility, setEligibility] = useState<DiscordEligibility>("checking");

	useEffect(() => {
		let active = true;
		let checking = false;
		let retry: ReturnType<typeof setTimeout> | undefined;

		const check = async () => {
			if (checking) return;
			checking = true;
			const next = await checkEligibility().catch(() => "unavailable" as const);
			checking = false;
			if (!active) return;
			setEligibility(next);
			if (next !== "eligible") retry = setTimeout(() => void check(), retryMilliseconds);
		};
		const checkNow = () => {
			if (retry) clearTimeout(retry);
			void check();
		};
		const checkWhenVisible = () => {
			if (document.visibilityState === "visible") checkNow();
		};

		void check();
		window.addEventListener("focus", checkNow);
		document.addEventListener("visibilitychange", checkWhenVisible);
		return () => {
			active = false;
			if (retry) clearTimeout(retry);
			window.removeEventListener("focus", checkNow);
			document.removeEventListener("visibilitychange", checkWhenVisible);
		};
	}, [checkEligibility, retryMilliseconds]);

	return eligibility;
};
