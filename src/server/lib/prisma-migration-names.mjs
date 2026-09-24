// These pairs were already applied with shared timestamps. Keep their names intact;
// every migration added after this guard was introduced must use a unique prefix.
const legacyDuplicatePrefixes = new Map([
	["20260922000000", new Set(["20260922000000_add_event_import_identity", "20260922000000_secure_sms_reminders"])],
	[
		"20260923000000",
		new Set(["20260923000000_remove_sms_reminders", "20260923000000_restore_event_tiktok_compatibility"]),
	],
	["20260923010000", new Set(["20260923010000_add_event_room_fr", "20260923010000_rsvp_management"])],
]);

/** @param {string[]} migrationNames */
export function findMigrationNameErrors(migrationNames) {
	/** @type {string[]} */
	const errors = [];
	/** @type {Map<string, string[]>} */
	const groups = new Map();

	for (const name of migrationNames) {
		if (name === "0_init") continue;
		const match = /^(\d{14})_[a-z0-9]+(?:_[a-z0-9]+)*$/.exec(name);
		if (!match) {
			errors.push(`Invalid Prisma migration directory name: ${name}`);
			continue;
		}
		const prefix = match[1];
		if (!prefix) continue;
		const names = groups.get(prefix) ?? [];
		names.push(name);
		groups.set(prefix, names);
	}

	for (const [prefix, names] of groups) {
		if (names.length < 2) continue;
		const grandfathered = legacyDuplicatePrefixes.get(prefix);
		const actual = new Set(names);
		if (
			!grandfathered ||
			actual.size !== names.length ||
			actual.size !== grandfathered.size ||
			[...actual].some(name => !grandfathered.has(name))
		) {
			errors.push(`Duplicate Prisma migration timestamp prefix ${prefix}: ${names.sort().join(", ")}`);
		}
	}

	return errors;
}
