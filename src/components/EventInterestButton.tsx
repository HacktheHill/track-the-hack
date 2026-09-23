import { useHasParticipantPass } from "@/utils/participant-pass";
import { useTranslation } from "next-i18next";
import { trpc } from "@/server/api/api";

export default function EventInterestButton({ eventId }: { eventId: string }) {
	const hasPass = useHasParticipantPass();
	const { t } = useTranslation("event");
	const utils = trpc.useUtils();
	const interest = trpc.events.getInterest.useQuery({ eventId }, { enabled: hasPass });
	const update = trpc.events.setInterest.useMutation({
		onSuccess: (interested, input) => {
			utils.events.getInterest.setData({ eventId: input.eventId }, interested);
			utils.events.savedIds.setData(undefined, previous => {
				const ids = previous ?? [];
				return interested ? [...new Set([...ids, input.eventId])] : ids.filter(id => id !== input.eventId);
			});
		},
	});

	if (!hasPass) return null;
	const label = t(
		interest.isError
			? "retry-interest"
			: update.isLoading
				? "saving-interest"
				: interest.data
					? "interested"
					: "mark-interested",
	);

	return (
		<div className="relative">
			<button
				type="button"
				aria-label={label}
				title={label}
				aria-pressed={interest.data ?? false}
				disabled={interest.isLoading || update.isLoading}
				aria-busy={interest.isLoading || update.isLoading}
				className="ui-button ui-button-icon"
				onClick={() => {
					if (interest.isError) {
						void interest.refetch();
					} else {
						update.mutate({ eventId, interested: !interest.data });
					}
				}}
			>
				<svg
					viewBox="0 0 24 24"
					width="24"
					height="24"
					fill={interest.data ? "currentColor" : "none"}
					stroke="currentColor"
					strokeWidth="2"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="m12 2 3.1 6.3 7 1-5 4.9 1.2 6.9-6.3-3.3-6.3 3.3 1.2-6.9-5-4.9 7-1L12 2Z" />
				</svg>
			</button>
			{(interest.isError || update.isError) && (
				<p
					className="ui-field-error-message absolute right-0 top-full z-10 mt-2 w-56 rounded-lg bg-light-secondary-color p-2 text-sm shadow-navbar"
					role="alert"
				>
					{t("interest-error")}
				</p>
			)}
		</div>
	);
}
