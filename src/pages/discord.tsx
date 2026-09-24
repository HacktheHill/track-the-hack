import type { GetStaticProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useState } from "react";
import App from "@/components/App";
import { useDiscordEligibility } from "@/utils/discord-eligibility";

// The page contains no session or proof data. A read-only eligibility request
// controls the button; the fragment stays in the browser until the explicit
// POST completes verification.
export const getStaticProps: GetStaticProps = async ({ locale }) => ({
	props: await serverSideTranslations(locale ?? "en", ["discord", "navbar", "common"]),
});

export default function Discord() {
	const { t } = useTranslation("discord");
	const [submitting, setSubmitting] = useState(false);
	const eligibility = useDiscordEligibility();
	const [result, setResult] = useState("");

	const verify = async () => {
		setSubmitting(true);
		setResult("");
		try {
			const response = await fetch("/api/discord/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: window.location.hash.slice(1) }),
			});
			const payload: unknown = await response.json().catch(() => null);
			if (response.ok) {
				setResult("verified");
				window.history.replaceState(null, "", window.location.pathname);
			} else {
				const detailedConflict =
					response.status === 409 &&
					payload !== null &&
					typeof payload === "object" &&
					"status" in payload &&
					(payload.status === "discord-account-conflict" || payload.status === "participant-conflict")
						? payload.status
						: null;
				setResult(
					response.status === 401
						? "session-required"
						: response.status === 403
							? "check-in-required"
							: response.status === 400
								? "invalid"
								: response.status === 409
									? (detailedConflict ?? "conflict")
									: "unavailable",
				);
			}
		} catch {
			setResult("unavailable");
		} finally {
			setSubmitting(false);
		}
	};
	return (
		<App className="flex items-center justify-center bg-default-gradient p-6" title={t("title")} noIndex>
			<section className="w-full max-w-xl rounded-xl bg-light-quaternary-color p-8 text-center shadow-lg">
				<h1 className="font-coolvetica text-4xl text-dark-color">{t("title")}</h1>
				{result !== "verified" && (
					<button
						type="button"
						disabled={submitting || eligibility !== "eligible"}
						onClick={() => void verify()}
						className="ui-button ui-button-primary ui-button-large mt-6"
					>
						{submitting ? t("verifying") : t("verify")}
					</button>
				)}
				{(result || eligibility !== "eligible") && (
					<p role="status" className="mt-6 font-rubik text-dark-color">
						{t(result || eligibility)}
					</p>
				)}
			</section>
		</App>
	);
}
