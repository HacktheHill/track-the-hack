import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const prisma = new PrismaClient();

export const logRouter = createTRPCRouter({
	new: protectedProcedure
		.input(
			z.object({
				id: z.number(), // Assuming 'id' is auto-incremented, it should be a number
				timestamp: z.date(),
				action: z.string(),
				details: z.string(),
				route: z.string(),
				locale: z.string(),
				sourceId: z.string(),
				sourceType: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			const log = await prisma.log.create({
				data: input,
			});

			if (!log) {
				throw new Error("Audit Log unsuccessful");
			}

			console.log(log);

			return log;
		}),

	all: protectedProcedure.query(async () => {
		const logs = await prisma.log.findMany({
			orderBy: [
				{
					timestamp: "desc",
				},
			],
		});

		if (!logs) {
			throw new Error("No audit logs found");
		}

		return logs
	}),
});
