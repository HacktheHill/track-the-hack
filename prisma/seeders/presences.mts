import { faker } from "@faker-js/faker";

type SeedHacker = { id: string };
type SeedEvent = { id: string; name: string; maxCheckIns: number | null };

/** Generate valid event-linked counters without duplicate participant/event pairs. */
export const generatePresences = (hackers: SeedHacker[], events: SeedEvent[], count = 10) => {
	if (hackers.length === 0 || events.length === 0) return [];
	const maximumPairs = hackers.length * events.length;

	return Array.from({ length: Math.min(count, maximumPairs) }, (_, index) => {
		const hacker = hackers[index % hackers.length];
		const event = events[Math.floor(index / hackers.length) % events.length];
		if (!hacker || !event) throw new Error("Unable to create a seeded Presence pair");
		const maximum = event.maxCheckIns === null ? 10 : Math.max(0, event.maxCheckIns);

		return {
			hackerId: hacker.id,
			eventId: event.id,
			label: event.name,
			value: maximum === 0 ? 0 : faker.number.int({ min: 1, max: maximum }),
		};
	});
};
