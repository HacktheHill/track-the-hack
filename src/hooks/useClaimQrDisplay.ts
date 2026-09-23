import { useEffect, useState } from "react";

export const useClaimQrDisplay = () => {
	const [claimUrl, setClaimUrl] = useState("");
	const [expiresAt, setExpiresAt] = useState<number | null>(null);
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		const readCurrentClaim = () => {
			const token = window.location.hash.slice(1);
			const expiry = new URLSearchParams(window.location.search).get("expiresAt");
			const parsedExpiry = expiry ? Date.parse(expiry) : NaN;
			setClaimUrl(token ? `${window.location.origin}/claim#${token}` : "");
			setExpiresAt(Number.isFinite(parsedExpiry) ? parsedExpiry : null);
			setNow(Date.now());
		};

		readCurrentClaim();
		window.addEventListener("hashchange", readCurrentClaim);
		window.addEventListener("popstate", readCurrentClaim);
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => {
			window.removeEventListener("hashchange", readCurrentClaim);
			window.removeEventListener("popstate", readCurrentClaim);
			window.clearInterval(timer);
		};
	}, []);

	const secondsRemaining = expiresAt === null ? null : Math.max(0, Math.ceil((expiresAt - now) / 1000));
	return { claimUrl, secondsRemaining };
};
