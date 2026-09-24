import { useState } from "react";
import { useTranslation } from "next-i18next";
import { trpc } from "@/server/api/api";

type Props = { eventId: string; eventName: string; interested: boolean };

export default function ScheduleSaveButton({ eventId, eventName, interested }: Props) {
	const { t } = useTranslation("schedule");
	const { t: eventText } = useTranslation("event");
	const utils = trpc.useUtils();
	const [optimisticInterested, setOptimisticInterested] = useState<boolean | null>(null);
	const update = trpc.events.setInterest.useMutation({
		onMutate: async input => {
			setOptimisticInterested(input.interested);
			await utils.events.savedIds.cancel();
			const previousInterested = (utils.events.savedIds.getData() ?? []).includes(input.eventId);
			utils.events.savedIds.setData(undefined, previous => {
				const ids = previous ?? [];
				return input.interested
					? [...new Set([...ids, input.eventId])]
					: ids.filter(id => id !== input.eventId);
			});
			return { previousInterested };
		},
		onSuccess: (saved, input) => {
			utils.events.savedIds.setData(undefined, previous => {
				const ids = previous ?? [];
				return saved ? [...new Set([...ids, input.eventId])] : ids.filter(id => id !== input.eventId);
			});
			utils.events.getInterest.setData({ eventId: input.eventId }, saved);
		},
		onError: (_error, input, context) => {
			if (!context) return;
			setOptimisticInterested(context.previousInterested);
			utils.events.savedIds.setData(undefined, previous => {
				const ids = (previous ?? []).filter(id => id !== input.eventId);
				return context.previousInterested ? [...ids, input.eventId] : ids;
			});
		},
		onSettled: (_data, error) => {
			if (!error) setOptimisticInterested(null);
		},
	});

	const displayedInterested = optimisticInterested ?? interested;
	const label = t(displayedInterested ? "remove-from-schedule" : "save-to-schedule", { name: eventName });

	return (
		<div className="absolute right-2 top-2">
			<button
				type="button"
				className="ui-button ui-button-icon flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-current bg-white/90 text-xl text-dark-color"
				aria-label={label}
				title={label}
				aria-pressed={displayedInterested}
				aria-busy={update.isLoading}
				disabled={update.isLoading}
				onClick={() => update.mutate({ eventId, interested: !displayedInterested })}
			>
				{displayedInterested ? "★" : "☆"}
			</button>
			{update.isError && (
				<p
					role="alert"
					className="absolute right-0 top-14 z-10 w-56 rounded-lg bg-light-secondary-color p-2 text-sm text-dark-color shadow-navbar"
				>
					{eventText("interest-error-event", { name: eventName })}
				</p>
			)}
		</div>
	);
}
