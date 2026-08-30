import { RoleName } from "@prisma/client";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { hasRoles } from "../../../utils/helpers";

export const logRouter = createTRPCRouter({
	new: protectedProcedure
		.input(
			z.object({
				id: z.number().optional(), // Assuming 'id' is auto-incremented, it should be a number. Optional as Prisma handles it.
				timestamp: z.date(),
				action: z.string(),
				details: z.string(),
				route: z.string(),
				locale: z.string(),
				sourceId: z.string(),
				sourceType: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const user = await ctx.prisma.user.findUnique({
				where: { id: userId },
				select: {
					roles: {
						select: { name: true },
					},
				},
			});

			if (!user || !hasRoles(user, [RoleName.ADMIN, RoleName.ORGANIZER])) {
				throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to do this" });
			}

			const log = await ctx.prisma.log.create({
				data: input,
			});

			if (!log) {
				throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Audit Log unsuccessful" });
			}

			return log;
		}),

	all: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const user = await ctx.prisma.user.findUnique({
			where: { id: userId },
			select: {
				roles: {
					select: { name: true },
				},
			},
		});

		if (!user || !hasRoles(user, [RoleName.ADMIN, RoleName.ORGANIZER])) {
			throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to do this" });
		}

		const logs = await ctx.prisma.log.findMany({
			orderBy: [
				{
					timestamp: "desc",
				},
			],
		});

		if (!logs) {
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No audit logs found" });
		}

		return logs;
	}),
});
