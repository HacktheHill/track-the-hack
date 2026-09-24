import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { useState } from "react";
import { clearOfflineParticipantPass } from "@/utils/participant-pass";

const ParticipantSignOut = () => {
	const { t } = useTranslation("profile");
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState(false);

	const signOut = async () => {
		setSubmitting(true);
		setError(false);

		try {
			const response = await fetch("/api/participant/sign-out", {
				method: "POST",
				credentials: "same-origin",
				headers: { Accept: "application/json" },
			});
			if (!response.ok) throw new Error("Participant sign-out failed");

			clearOfflineParticipantPass();
			const destination = router.locale && router.locale !== router.defaultLocale ? `/${router.locale}` : "/";
			window.location.replace(destination);
		} catch {
			setError(true);
			setSubmitting(false);
		}
	};

	return (
		<div className="flex flex-col items-center gap-2">
			<button
				type="button"
				className="ui-button ui-button-tertiary"
				disabled={submitting}
				onClick={() => void signOut()}
			>
				{submitting ? t("signing-out") : t("participant-sign-out")}
			</button>
			{error && (
				<p className="font-rubik text-sm text-dark-primary-color" role="alert">
					{t("sign-out-error")}
				</p>
			)}
		</div>
	);
};

export default ParticipantSignOut;
