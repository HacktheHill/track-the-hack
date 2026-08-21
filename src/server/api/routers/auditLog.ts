import { RoleName } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hasRoles } from "../../../utils/helpers";
import { createTRPCRouter, protectedProcedure } from "../trpc";

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
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const user = await ctx.prisma.user.findUnique({
				where: { id: userId },
				select: { roles: { select: { name: true } } },
			});

			if (!user) {
				throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
			}

			if (!hasRoles(user, [RoleName.ADMIN])) {
				throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to do this" });
			}

			const log = await ctx.prisma.log.create({
				data: input,
			});

			if (!log) {
				throw new Error("Audit Log unsuccessful");
			}

			return log;
		}),

	all: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const user = await ctx.prisma.user.findUnique({
			where: { id: userId },
			select: { roles: { select: { name: true } } },
		});

		if (!user) {
			throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
		}

		if (!hasRoles(user, [RoleName.ADMIN])) {
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
			throw new Error("No audit logs found");
		}

		return logs;
	}),
});
