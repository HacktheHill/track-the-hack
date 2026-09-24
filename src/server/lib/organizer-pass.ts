const ORGANIZER_PASS_PREFIX = "organizer:";

export const createOrganizerPass = (organizerId: string) => `${ORGANIZER_PASS_PREFIX}${organizerId}`;

export const parseOrganizerPass = (value: string) => {
	if (!value.startsWith(ORGANIZER_PASS_PREFIX)) return null;
	const organizerId = value.slice(ORGANIZER_PASS_PREFIX.length);
	return organizerId.length > 0 && organizerId.length <= 191 ? organizerId : null;
};
