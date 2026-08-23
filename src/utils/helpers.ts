import type { RoleName } from "@prisma/client";

/**
 * Checks if user has one of the given roles
 * @param user User to check
 * @param roles Roles to check
 * @returns True if user has one of the given roles
 * @example
 * hasRoles(user, [RoleName.ORGANIZER, RoleName.ADMIN])
 * // => true if user.role is RoleName.ORGANIZER or RoleName.ADMIN
 * // => false otherwise
 */
export const hasRoles = (
	user: {
		roles: {
			name: RoleName;
		}[];
	},
	roles: RoleName[],
) => user.roles.some(role => roles.includes(role.name));
