import type { GetServerSideProps } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useState } from "react";
import App from "../../components/App";
import { env } from "../../env/server.mjs";
import { readParticipantSession } from "../../server/lib/participant-session";

// The token rides in the fragment, so it never reaches the server on this GET
// and stays out of access logs.
export const getServerSideProps: GetServerSideProps = async ({ req, locale }) => {
	// Someone with a session reopened their link or pressed back. Send them to
	// the pass rather than a button that can only fail.
	if (readParticipantSession(req, env.PARTICIPANT_SESSION_SECRET)) {
		return { redirect: { destination: "/profile", permanent: false } };
	}

	return { props: await serverSideTranslations(locale ?? "en", ["claim", "navbar", "common"]) };
};

const Claim = () => {
	const { t } = useTranslation("claim");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	// Deliberately behind a button. Consuming on load would let a link preview
	// or a browser prefetch burn the token before the participant taps anything.
	const activate = async () => {
		setSubmitting(true);
		setError("");
		try {
			const response = await fetch("/api/claim", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: window.location.hash.slice(1) }),
			});
			const body = (await response.json()) as { ok: boolean; message?: string };
			if (!body.ok) {
				setError(body.message ?? t("unavailable"));
				return;
			}

			// replace, not push: the token must not survive in session history.
			window.location.replace("/profile");
		} catch {
			setError(t("unavailable"));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<App className="flex items-center justify-center bg-default-gradient p-6" title={t("title")} noIndex>
			<section className="w-full max-w-xl rounded-xl bg-light-quaternary-color p-8 text-center shadow-lg">
				<h1 className="font-coolvetica text-4xl text-dark-color">{t("title")}</h1>
				<p className="mt-4 font-rubik text-dark-color">{t("explanation")}</p>
				<button
					type="button"
					disabled={submitting}
					onClick={() => void activate()}
					className="mt-6 rounded-lg border border-dark-primary-color bg-light-primary-color px-6 py-3 font-coolvetica text-lg text-light-color disabled:cursor-not-allowed disabled:opacity-60"
				>
					{submitting ? t("activating") : t("activate")}
				</button>
				{error && (
					<p role="status" className="mt-6 rounded-lg bg-red-100 p-4 font-rubik text-red-900">
						{error}
					</p>
				)}
			</section>
		</App>
	);
};

export default Claim;
