import type { PrismaClient } from "@prisma/client";

type LogInput = {
	sourceId: string;
	sourceType: "Account" | "Hacker" | "Presence" | "Role" | "User";
	author: string;
	route: string;
	action: string;
	details: string;
};

async function log(
	ctx: {
		prisma: PrismaClient;
	},
	{ sourceId, sourceType, author, route, action, details }: LogInput,
) {
	try {
		await ctx.prisma.log.create({
			data: {
				timestamp: new Date(),
				sourceId,
				sourceType,
				author,
				route,
				action,
				details,
			},
		});
	} catch (error) {
		console.error("Error creating audit log entry:", error);
	}
}

export { log };
