import type { PrismaClient } from "@prisma/client";

type LogInput = {
	sourceId: string;
	sourceType: "Account" | "Hacker" | "Presence" | "Role" | "User";
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
	{ sourceId, sourceType, author, userId, route, action, details }: LogInput,
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
