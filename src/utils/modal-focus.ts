export const modalFocusTarget = <T>(elements: readonly T[], active: T | null, shiftKey: boolean): T | null => {
	const first = elements[0];
	const last = elements.at(-1);
	if (!first || !last) return null;
	if (active === null || !elements.includes(active)) return shiftKey ? last : first;
	if (shiftKey && active === first) return last;
	if (!shiftKey && active === last) return first;
	return null;
};
