import type { GetStaticProps } from "next";
import BrowserHead from "next/head";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useEffect, useState } from "react";
import App from "@/components/App";

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["rsvp", "navbar", "common"]),
});

const CancelRsvp = () => {
	const { t } = useTranslation("rsvp");
	const [token, setToken] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

	useEffect(() => {
		const syncToken = () => {
			setToken(window.location.hash.slice(1));
			setResult(null);
		};
		syncToken();
		window.addEventListener("hashchange", syncToken);
		window.addEventListener("popstate", syncToken);
		return () => {
			window.removeEventListener("hashchange", syncToken);
			window.removeEventListener("popstate", syncToken);
		};
	}, []);

	const cancel = async () => {
		const currentToken = window.location.hash.slice(1);
		if (!currentToken) {
			setToken("");
			return;
		}
		setSubmitting(true);
		setResult(null);
		try {
			const response = await fetch("/api/rsvp/cancel", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: currentToken }),
			});
			if (window.location.hash.slice(1) !== currentToken) return;
			setResult({
				ok: response.ok,
				message: response.status === 400 ? t("invalid-cancellation-link") : t("temporarily-unavailable"),
			});
			if (response.ok) {
				window.history.replaceState(null, "", window.location.pathname);
				setToken("");
			}
		} catch {
			if (window.location.hash.slice(1) === currentToken)
				setResult({ ok: false, message: t("temporarily-unavailable") });
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<App className="flex items-center justify-center bg-default-gradient p-6" title={t("cancel-title")} noIndex>
			<BrowserHead>
				<meta name="referrer" content="no-referrer" />
			</BrowserHead>
			<section className="w-full max-w-xl rounded-xl bg-light-quaternary-color p-8 text-center shadow-lg">
				<h1 className="font-coolvetica text-4xl text-dark-color">{t("cancel-title")}</h1>
				<p className="mt-4 font-rubik text-dark-color">{t("cancel-explanation")}</p>
				{result && (
					<p
						role="status"
						className={`mt-6 rounded-lg p-4 font-rubik ${
							result.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"
						}`}
					>
						{result.ok ? t("cancelled") : result.message}
					</p>
				)}
				{!result?.ok && (
					<button
						type="button"
						disabled={submitting || !token}
						onClick={() => void cancel()}
						className="ui-button ui-button-primary ui-button-large mt-6"
					>
						{submitting ? t("cancelling") : t("cancel")}
					</button>
				)}
				{!token && !result && <p className="mt-4 text-red-900">{t("invalid-cancellation-link")}</p>}
			</section>
		</App>
	);
};

export default CancelRsvp;
