import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const prisma = new PrismaClient();

export const auditLogRouter = createTRPCRouter({
	auditLog: protectedProcedure
		.input(
			z.object({
				id: z.number(), // Assuming 'id' is auto-incremented, it should be a number
				timestamp: z.date(),
				userId: z.string(),
				route: z.string(),
				author: z.string(),
				action: z.string(),
				details: z.string().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const auditLog = await prisma.auditLog.create({
				data: {
					id: input.id,
					timestamp: input.timestamp,
					userId: input.userId,
					route: input.route,
					author: input.author,
					action: input.action,
					details: input.details,
				},
			});

			if (!auditLog) {
				throw new Error("Audit Log unsuccessful");
			}

			console.log(auditLog);

			return auditLog;
		}),

	getAllTheLogs: protectedProcedure.query(async ({ ctx }) => {
		const auditLogs = await prisma.auditLog.findMany({
			orderBy: [
				{
					timestamp: "desc",
				},
			],
		});

		if (!auditLogs) {
			throw new Error("No audit logs found");
		}

		return auditLogs;
	}),
});
