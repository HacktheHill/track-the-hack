import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useState } from "react";
import App from "../../components/App";

export const getServerSideProps: GetServerSideProps<{ participantId: string }> = async ({ params, locale }) => ({
	props: {
		participantId: typeof params?.id === "string" ? params.id : "",
		...(await serverSideTranslations(locale ?? "en", ["rsvp", "navbar", "common"])),
	},
});

const Rsvp = ({ participantId }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
	const { t } = useTranslation("rsvp");
	const [submitting, setSubmitting] = useState(false);
	const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

	const confirm = async () => {
		setSubmitting(true);
		setResult(null);
		try {
			const response = await fetch(`/api/rsvp/${encodeURIComponent(participantId)}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ confirm: true }),
			});
			const body = (await response.json()) as { ok: boolean; message: string };
			setResult(body);
		} catch {
			setResult({ ok: false, message: t("temporarily-unavailable") });
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<App className="flex items-center justify-center bg-default-gradient p-6" title={t("title")} noIndex>
			<section className="w-full max-w-xl rounded-xl bg-light-quaternary-color p-8 text-center shadow-lg">
				<h1 className="font-coolvetica text-4xl text-dark-color">{t("title")}</h1>
				<p className="mt-4 font-rubik text-dark-color">{t("explanation")}</p>
				{result ? (
					<p
						role="status"
						className={`mt-6 rounded-lg p-4 font-rubik ${
							result.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"
						}`}
					>
						{result.ok ? t("confirmed") : result.message}
					</p>
				) : (
					<button
						type="button"
						disabled={submitting || !participantId}
						onClick={() => void confirm()}
						className="mt-6 rounded-lg border border-dark-primary-color bg-light-primary-color px-6 py-3 font-coolvetica text-lg text-light-color disabled:cursor-not-allowed disabled:opacity-60"
					>
						{submitting ? t("confirming") : t("confirm")}
					</button>
				)}
			</section>
		</App>
	);
};

export default Rsvp;
