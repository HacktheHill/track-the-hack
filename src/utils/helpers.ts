import type { User } from "@prisma/client";
import type { Roles } from "./common";

/**
 * Checks if a given expiry date is expired
 * @param expiry Expiry date to check
 * @returns True if expiry date is expired
 * @example
 * isExpired("2022-01-01T00:00:00.000Z")
 * // => true if current date is after 2022-01-01T00:00:00.000Z
 * // => false otherwise
 */
export const isExpired = (expiry: string) => {
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
 * matchesRole(Role.SPONSOR, [Role.ORGANIZER, Role.SPONSOR])
 * // => true if role is Role.ORGANIZER or Role.SPONSOR
 * // => false otherwise
 */
export const matchesRole = (role: Roles, roles: Roles[]) => {
	if (!role) {
		return false;
	}

	// If the user has at least one of the given roles, return true
	return roles.some(role => role === role);
};

/**
 * Checks if user has one of the given roles
 * @param user User to check
 * @param roles Roles to check
 * @returns True if user has one of the given roles
 * @example
 * hasRoles(user, [Role.ORGANIZER, Role.SPONSOR])
 * // => true if user.role is Role.ORGANIZER or Role.SPONSOR
 * // => false otherwise
 */
export const hasRoles = (user: User, roles: string[]) => {
	if (!user) {
		return false;
	}

	roles.forEach(role => {
		if (user.hackerId && role === "HACKER") {
			return true;
		}
		if (user.organizerId && role === "ORGANIZER") {
			return true;
		}
		if (user.sponsorId && role === "SPONSOR") {
			return true;
		}
	});
	
	return false;
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
export const debounce = <F extends (...args: unknown[]) => unknown>(func: F, wait: number) => {
	let timeout: ReturnType<typeof setTimeout>;
	return (...args: Parameters<F>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
};
