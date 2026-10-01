export type OperationalEvent = {
	eventId: string;
	label: string;
	labelFr?: string;
	start?: string;
	group?: string;
	uniqueParticipants: number;
	recordedUnits: number;
};

// The retained snapshot predates schedule metadata. The fallback categorizes
// known labels but never invents a date or merges distinct event records.
export function operationalEvents(events: OperationalEvent[], locale: string) {
	const copies = new Map<string, number>();
	const sizes = new Map<string, number>();
	for (const event of events) sizes.set(event.label, (sizes.get(event.label) ?? 0) + 1);
	return events.map(event => {
		const index = (copies.get(event.label) ?? 0) + 1;
		copies.set(event.label, index);
		const count = sizes.get(event.label) ?? 1;
		const duplicate = count > 1;
		const name = locale.startsWith("fr") && event.labelFr ? event.labelFr : event.label;
		const date = event.start
			? new Intl.DateTimeFormat(locale, {
					timeZone: "America/Toronto",
					weekday: "short",
					hour: "numeric",
					minute: "2-digit",
				}).format(new Date(event.start))
			: null;
		const fallback = locale.startsWith("fr") ? `fiche ${index}/${count}` : `record ${index}/${count}`;
		const group = /check.?ins?/i.test(event.label)
			? "checkin"
			: event.group === "FOOD" || /^(Lunch|Dinner|Breakfast|Snacks|Latte Lab)$/i.test(event.label)
				? "food"
				: event.group === "WORKSHOP" || /workshop|intro to|pitching advice/i.test(event.label)
					? "workshops"
					: "activities";
		return {
			...event,
			displayLabel: `${name}${date ? ` · ${date}` : duplicate ? ` · ${fallback}` : ""}`,
			displayGroup: group,
			missingSessionDate: duplicate && !date,
		};
	});
}

export function shirtSizeOrder(size: string) {
	const order = ["XS", "S", "M", "L", "XL", "XXL", "NONE"];
	const index = order.indexOf(size);
	return index < 0 ? order.length : index;
}
