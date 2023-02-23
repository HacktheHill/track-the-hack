import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";

export const notificationsRouter = createTRPCRouter({
	get: publicProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const notification = await ctx.prisma.notification.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!notification) {
				throw new Error("No notification found");
			}

			return notification;
		}),
	getLatest: publicProcedure.query(async ({ ctx }) => {
		const notification = await ctx.prisma.notification.findFirst({
			orderBy: { time: 'desc' }
		})

		if (!notification) {
			throw new Error("No notification found");
		}

		return notification;
	}),
	all: publicProcedure.query(async ({ ctx }) => {
		const notifications = await ctx.prisma.notification.findMany();

		if (!notifications) {
			throw new Error("No notification found");
		}

		return notifications;
	}),
});
