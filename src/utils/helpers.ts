import type { RoleName, User } from "@prisma/client";

/**
 * Checks if a given expiry date is expired
 * @param expiry Expiry date to check
 * @returns True if expiry date is expired
 * @example
 * isExpired("2022-01-01T00:00:00.000Z")
 * // => true if current date is after 2022-01-01T00:00:00.000Z
 * // => false otherwise
 */
export const isExpired = (expiry: Date | string | null | undefined) => {
	if (!expiry) {
		return false;
	}
	const now = new Date();
	const expiryDate = new Date(expiry);
	if (expiryDate.toString() === "Invalid Date") {
		return false;
	}
	return now > expiryDate;
};

/**
 * Checks if role matches one of the given roles
 * @param role Role to check
 * @param roles Roles to check against
 * @returns True if role matches one of the given roles
 * @example
 * matchesRole(RoleName.SPONSOR, [RoleName.ORGANIZER, RoleName.SPONSOR])
 * // => true if role is RoleName.ORGANIZER or RoleName.SPONSOR
 * // => false otherwise
 */
export const matchesRole = (role: RoleName | null, roles: RoleName[]) => {
	if (!role) {
		return false;
	}

	// If the user has at least one of the given roles, return true
	return roles.some(r => r === role);
};

/**
 * Checks if user has one of the given roles
 * @param user User to check
 * @param roles Roles to check
 * @returns True if user has one of the given roles
 * @example
 * hasRoles(user, [RoleName.ORGANIZER, RoleName.SPONSOR])
 * // => true if user.role is RoleName.ORGANIZER or RoleName.SPONSOR
 * // => false otherwise
 */
export const hasRoles = (
	user: {
		roles: {
			name: RoleName;
		}[];
	} & Partial<User>,
	roles: RoleName[],
) => {
	if (!user) {
		return false;
	}

	// If the user has at least one of the given roles, return true
	return user.roles.some(r => roles.includes(r.name));
};

/**
 * Debounce function
 * @param func Function to debounce
 * @param wait Time to wait before calling function
 * @returns Debounced function
 * @example
 * const debounced = debounce(() => console.log("Hello"), 1000);
 * debounced();
 * // => "Hello" will be logged after 1000ms
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const debounce = <F extends (...args: any[]) => void | Promise<void>>(func: F, wait: number) => {
	let timeout: ReturnType<typeof setTimeout>;
	return (...args: Parameters<F>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => void func(...args), wait);
	};
};
