import { z } from "zod";
import { Role } from "../../../utils/common";
import { hasRoles } from "../../../utils/helpers";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
	// Get the given user's role
	getRole: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const user = await ctx.prisma.user.findUnique({
				where: {
					id: input.id,
				},
				include: {
					hacker: true,
					organizer: true,
					sponsor: true,
				},
			});
			if (!user) {
				return null;
			}
			
			if(user.hacker) {
				return "HACKER";
			}
			if(user.organizer) {
				return "ORGANIZER";
			}
			if(user.sponsor) {
				return "SPONSOR";
			}

			return null;
		}),

	// Get the given user's hacker id
	getHackerId: protectedProcedure
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

			const hacker = await ctx.prisma.hacker.findFirst({
				where: {
					id: input.id,
				},
			});

			if (!hacker) {
				return null;
			}

			if (!hasRoles(user, [Role.SPONSOR, Role.ORGANIZER]) && hacker.id !== user.id) {
				throw new Error("You do not have permission to do this");
			}

			return hacker.id;
		}),
});
