type EventRoom = {
	room: string;
	roomFr?: string | null;
};

export const getEventRoom = (event: EventRoom, locale?: string) =>
	locale === "fr" ? event.roomFr?.trim() || event.room : event.room;
