import { Role, type User } from "@prisma/client";
import { Roles } from "./common";

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
 * Checks if user has one of the given roles
 * @param user User to check
 * @param roles Roles to check
 * @returns True if user has one of the given roles
 * @example
 * hasRole(user, [Role.ORGANIZER, Role.SPONSOR])
 * // => true if user.role is Role.ORGANIZER or Role.SPONSOR
 * // => false otherwise
 * @example
 */
export const hasRoles = (user: User, roles: Roles[]) => {
	if (!user) {
		return false;
	}

	// If the user has at least one of the given roles, return true
	return roles.some(role => user.role === role);
};
