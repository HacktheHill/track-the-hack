import type { PrismaClient } from "@prisma/client";

async function logAuditEntry(
	ctx: {
		prisma: PrismaClient;
	},
	userId: string,
	route: string,
	action: string,
	author: string,
	details: string,
): Promise<void> {
	try {
		await ctx.prisma.auditLog.create({
			data: {
				timestamp: new Date(),
				userId: userId,
				route,
				action,
				author,
				details,
			},
		});
	} catch (error) {
		console.error("Error creating audit log entry:", error);
	}
}

export { logAuditEntry };
