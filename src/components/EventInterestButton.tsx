import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { trpc } from "../server/api/api";

export default function EventInterestButton({ eventId }: { eventId: string }) {
	const { data: session } = useSession();
	const { t } = useTranslation("event");
	const utils = trpc.useUtils();
	const interest = trpc.events.getInterest.useQuery({ eventId }, { enabled: !!session?.user?.hackerId });
	const update = trpc.events.setInterest.useMutation({
		onSuccess: (interested, input) => {
			utils.events.getInterest.setData({ eventId: input.eventId }, interested);
		},
	});

	if (!session?.user?.hackerId) return null;

	return (
		<div className="flex w-full min-w-0 max-w-xl flex-col items-center gap-3 text-center">
			<button
				type="button"
				aria-pressed={interest.data ?? false}
				disabled={interest.isLoading || update.isLoading}
				aria-busy={interest.isLoading || update.isLoading}
				className="ui-button max-w-full whitespace-normal"
				onClick={() => {
					if (interest.isError) {
						void interest.refetch();
					} else {
						update.mutate({ eventId, interested: !interest.data });
					}
				}}
			>
				{t(
					interest.isError
						? "retry-interest"
						: update.isLoading
							? "saving-interest"
							: interest.data
								? "interested"
								: "mark-interested",
				)}
			</button>
			<p className="text-sm">{t("interest-organizer-visibility")}</p>
			{(interest.isError || update.isError) && (
				<p className="ui-field-error-message" role="alert">
					{t("interest-error")}
				</p>
			)}
		</div>
	);
}
