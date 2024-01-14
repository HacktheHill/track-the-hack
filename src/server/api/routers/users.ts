import { Role } from "@prisma/client";
import { z } from "zod";
import { roles } from "../../../utils/common";
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
			});
			if (!user) {
				return null;
			}
			const role = roles.safeParse(user.role);
			if (role.success) {
				return role.data;
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

			const hacker = await ctx.prisma.hackerInfo.findFirst({
				where: {
					userId: input.id,
				},
			});

			if (!hacker) {
				return null;
			}

			if (!hasRoles(user, [Role.SPONSOR, Role.ORGANIZER]) && hacker.userId !== user.id) {
				throw new Error("You do not have permission to do this");
			}

			return hacker.id;
		}),

	signUp: protectedProcedure.input(z.object({ eventId: z.string() })).mutation(async ({ ctx, input }) => {
		const user = await ctx.prisma.user.update({
			where: {
				id: ctx.session.user.id,
			},
			data: {
				event: {
					connect: {
						id: input.eventId,
					},
				},
			},
		});

		return user;
	}),

	isSignedUp: protectedProcedure.input(z.object({ eventId: z.string() })).query(async ({ ctx, input }) => {
		const user = await ctx.prisma.user.findUnique({
			where: {
				id: ctx.session.user.id,
			},
			include: {
				event: true,
			},
		});

		if (!user) {
			throw new Error("User is not logged in. Cannot query if signed up.");
		}
		user.event.map(event => {
			if (event.id === input.eventId) {
				return true;
			}
		});
		return false;
	}),

	getSignedUpEvents: protectedProcedure.query(async ({ ctx, input }) => {
		const user = await ctx.prisma.user.findUnique({
			where: {
				id: ctx.session.user.id,
			},
			include: {
				event: true,
			},
		});

		if (!user) {
			throw new Error("User is not logged in. Cannot query if signed up.");
		}

		return user.event;
	}),
});
