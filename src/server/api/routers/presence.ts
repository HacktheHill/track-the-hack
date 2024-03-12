import { Role } from "../../../utils/common";
import { z } from "zod";
import { hasRoles } from "../../../utils/helpers";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { logAuditEntry } from "../../audit";

export const presenceRouter = createTRPCRouter({
	getAllPresences: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const user = await ctx.prisma.user.findUnique({
				where: {
					id: userId,
				},
			});

			if (!user) {
				throw new Error("User not found");
			}

			if (!hasRoles(user, [Role.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

			const hacker = await ctx.prisma.hacker.findUnique({
				where: {
					id: input.id,
				},
				include: {
					presences: true,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			return hacker.presences;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				eventName: z.string(),
				presenceInfo: z.record(z.boolean()),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const user = await ctx.prisma.user.findUnique({
				where: {
					id: userId,
				},
			});

			if (!user) {
				throw new Error("User not found");
			}

			if (!hasRoles(user, [Role.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

			const hacker = await ctx.prisma.hacker.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			const presenceInfoBefore = await ctx.prisma.presence.findUnique({
				where: {
					hackerId: hacker.id,
					
				},
			});

			await ctx.prisma.presenceInfo.upsert({
				where: {
					hackerInfoId: hacker.id,
				},
				update: input.presenceInfo,
				create: {
					...input.presenceInfo,
					hacker: {
						connect: {
							id: hacker.id,
						},
					},
				},
			});

			for (const key in input.presenceInfo) {
				for (const key2 in presenceInfoBefore) {
					if (key === key2) {
						const valueBefore = presenceInfoBefore[key2 as keyof typeof presenceInfoBefore];
						const valueNow = input.presenceInfo[key];

						if (valueNow !== valueBefore) {
							if (valueNow) {
								await logAuditEntry(
									ctx,
									hacker.id,
									"/presence",
									"Presence",
									user.username ?? "Unknown",
									`${hacker.firstName} ${hacker.lastName} ${key} updated to true.`,
								);
							} else {
								await logAuditEntry(
									ctx,
									hacker.id,
									"/presence",
									"Presence",
									user.username ?? "Unknown",
									`${hacker.firstName} ${hacker.lastName} ${key} updated to false.`,
								);
							}
						}
					}
				}
			}
		}),
});
