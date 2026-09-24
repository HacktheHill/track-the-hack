import type { PrismaClient } from "@prisma/client";

export type LegacyLogInput = {
	sourceId: string;
	sourceType: "Account" | "Hacker" | "HardwareLoan" | "LatteOrder" | "Presence" | "Role" | "User";
	author: string;
	userId?: string;
	route: string;
	action: string;
	details: string;
};

async function log(
	ctx: {
		prisma: PrismaClient;
	},
	{ sourceId, sourceType, author, userId, route, action, details }: LegacyLogInput,
) {
	try {
		await ctx.prisma.log.create({
			data: {
				timestamp: new Date(),
				sourceId,
				sourceType,
				author,
				userId,
				route,
				action,
				details,
			},
		});
	} catch {
		console.error("Audit log entry failed");
	}
}

export { log };
