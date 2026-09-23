type TimedEvent = { start: Date; end: Date };
const marathonMs = 12 * 60 * 60_000;

export type ScheduleGroup<T> = {
	events: T[];
	overlapsPrevious: boolean;
};

// A brief handoff can share a full-width card. Longer overlaps need a distinct group.
export const groupScheduleEvents = <T extends TimedEvent>(events: T[]): ScheduleGroup<T>[] => {
	const groups: ScheduleGroup<T>[] = [];

	for (const event of events) {
		const previous = groups[groups.length - 1];
		const substantialOverlap = (other: T) => {
			const overlap = Math.min(event.end.getTime(), other.end.getTime()) - event.start.getTime();
			const shorterDuration = Math.min(
				event.end.getTime() - event.start.getTime(),
				other.end.getTime() - other.start.getTime(),
			);
			return overlap > 0 && overlap >= Math.min(20 * 60_000, shorterDuration / 3);
		};
		const isMarathon = (item: T) => item.end.getTime() - item.start.getTime() >= marathonMs;

		// Keep every card in a group concurrent with every other card. A later
		// event may overlap a long event but not an earlier short one.
		if (
			previous &&
			!isMarathon(event) &&
			previous.events.every(other => !isMarathon(other) && substantialOverlap(other))
		) {
			previous.events.push(event);
		} else {
			groups.push({
				events: [event],
				overlapsPrevious:
					previous != null &&
					!isMarathon(event) &&
					previous.events.some(other => !isMarathon(other) && other.end > event.start) &&
					!previous.events.some(other => !isMarathon(other) && substantialOverlap(other)),
			});
		}
	}

	return groups;
};
