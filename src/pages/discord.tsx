import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useState } from "react";
import App from "@/components/App";

// The page contains no session or proof data. The fragment stays in the browser;
// only the explicit POST checks the active session and completes verification.
export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["discord", "navbar", "common"]),
});

export default function Discord() {
	const { t } = useTranslation("discord");
	const [submitting, setSubmitting] = useState(false);
	const [status, setStatus] = useState("");
	const verify = async () => {
		setSubmitting(true);
		setStatus("");
		try {
			const response = await fetch("/api/discord/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: window.location.hash.slice(1) }),
			});
			if (response.ok) {
				setStatus("verified");
				window.history.replaceState(null, "", window.location.pathname);
			} else {
				setStatus(
					response.status === 401
						? "session-required"
						: response.status === 400
							? "invalid"
							: response.status === 409
								? "conflict"
								: "unavailable",
				);
			}
		} catch {
			setStatus("unavailable");
		} finally {
			setSubmitting(false);
		}
	};
	return (
		<App className="flex items-center justify-center bg-default-gradient p-6" title={t("title")} noIndex>
			<section className="w-full max-w-xl rounded-xl bg-light-quaternary-color p-8 text-center shadow-lg">
				<h1 className="font-coolvetica text-4xl text-dark-color">{t("title")}</h1>
				<p className="mt-4 font-rubik text-dark-color">{t("explanation")}</p>
				{status !== "verified" && (
					<button
						type="button"
						disabled={submitting}
						onClick={() => void verify()}
						className="mt-6 rounded-lg border border-dark-primary-color bg-light-primary-color px-6 py-3 font-coolvetica text-lg text-light-color disabled:cursor-not-allowed disabled:opacity-60"
					>
						{submitting ? t("verifying") : t("verify")}
					</button>
				)}
				{status && (
					<p role="status" className="mt-6 font-rubik text-dark-color">
						{t(status)}
					</p>
				)}
			</section>
		</App>
	);
}
