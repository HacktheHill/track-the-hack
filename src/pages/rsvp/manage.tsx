import type { GetStaticProps } from "next";
import BrowserHead from "next/head";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useEffect, useState } from "react";
import App from "@/components/App";

type Status = "PENDING" | "CONFIRMED" | "DECLINED";
type RsvpState = { status: Status; canAttend: boolean };

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["rsvp", "navbar", "common"]),
});

const isRsvpState = (value: unknown): value is RsvpState =>
	!!value && typeof value === "object" && "status" in value &&
	(value.status === "PENDING" || value.status === "CONFIRMED" || value.status === "DECLINED") &&
	"canAttend" in value && typeof value.canAttend === "boolean";

const ManageRsvp = () => {
	const { t } = useTranslation("rsvp");
	const [token, setToken] = useState("");
	const [state, setState] = useState<RsvpState | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [retryableLoad, setRetryableLoad] = useState(false);

	const request = async (action: "status" | "attend" | "decline", currentToken: string) => {
		setBusy(true);
		setError("");
		setRetryableLoad(false);
		try {
			const response = await fetch("/api/rsvp/manage", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: currentToken, action }),
			});
			if (!response.ok) {
				setError(response.status === 400 ? t("invalid-management-link") : response.status === 409 ? t("attendance-deadline-passed") : t("temporarily-unavailable"));
				setRetryableLoad(action === "status" && response.status !== 400);
				if (response.status === 409) setState(previous => previous ? { ...previous, canAttend: false } : null);
				return;
			}
			const next: unknown = await response.json();
			if (!isRsvpState(next)) { setError(t("temporarily-unavailable")); setRetryableLoad(action === "status"); return; }
			setState(next);
		} catch {
			setError(t("temporarily-unavailable"));
			setRetryableLoad(action === "status");
		} finally {
			setBusy(false);
		}
	};

	useEffect(() => {
		const currentToken = window.location.hash.slice(1);
		setToken(currentToken);
		if (!currentToken) { setError(t("invalid-management-link")); return; }
		void request("status", currentToken);
		// Keep the fragment so the original email can reopen this same page.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<App className="flex items-center justify-center bg-default-gradient p-6" title={t("manage-title")} noIndex>
			<BrowserHead><meta name="referrer" content="no-referrer" /></BrowserHead>
			<section className="w-full max-w-xl rounded-xl bg-light-quaternary-color p-8 text-center shadow-lg">
				<h1 className="font-coolvetica text-4xl text-dark-color">{t("manage-title")}</h1>
				{state && <p className="mt-5 font-rubik text-dark-color" role="status">{t(`manage-status-${state.status.toLowerCase()}`)}</p>}
				{!state && !error && <p className="mt-5 font-rubik text-dark-color">{t("loading-status")}</p>}
				{state && <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
					{state.canAttend && state.status !== "CONFIRMED" && <button type="button" disabled={busy} onClick={() => void request("attend", token)} className="rounded-lg bg-light-primary-color px-6 py-3 font-coolvetica text-lg text-light-color disabled:opacity-60">{t("manage-attend")}</button>}
					{state.status !== "DECLINED" && <button type="button" disabled={busy} onClick={() => void request("decline", token)} className="rounded-lg border border-dark-primary-color px-6 py-3 font-coolvetica text-lg text-dark-color disabled:opacity-60">{t("manage-decline")}</button>}
				</div>}
				{state && !state.canAttend && state.status !== "CONFIRMED" && <p className="mt-4 font-rubik text-dark-color">{t("attendance-deadline-passed")}</p>}
				{error && <p className="mt-5 font-rubik text-red-900" role="alert">{error}</p>}
				{!state && retryableLoad && token && <button type="button" disabled={busy} onClick={() => void request("status", token)} className="mt-4 rounded-lg border border-dark-primary-color px-6 py-3 font-coolvetica text-lg text-dark-color disabled:opacity-60">{t("retry")}</button>}
			</section>
		</App>
	);
};

export default ManageRsvp;
