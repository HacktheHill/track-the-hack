import type { Hacker } from "@prisma/client";
import { RoleName } from "@prisma/client";
import { z } from "zod";

import { hasRoles } from "../../../utils/helpers";
import { log } from "../../lib/log";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const presenceRouter = createTRPCRouter({
	getFromHackerId: protectedProcedure
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
				select: {
					name: true,
					roles: {
						select: {
							name: true,
						},
					},
				},
			});

			if (!user) {
				throw new Error("User not found");
			}

			if (!hasRoles(user, [RoleName.ORGANIZER])) {
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

			const presence = await ctx.prisma.presence.findMany({
				where: {
					hackerId: hacker.id,
				},
			});

			return presence;
		}),

	upsert: protectedProcedure
		.input(
			z.object({
				id: z.string().optional().default(""),
				hackerId: z.string(),
				value: z.number(),
				label: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const user = await ctx.prisma.user.findUnique({
				where: {
					id: userId,
				},
				select: {
					name: true,
					roles: {
						select: {
							name: true,
						},
					},
				},
			});

			if (!user) {
				throw new Error("User not found");
			}

			if (!hasRoles(user, [RoleName.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

			const hacker = await ctx.prisma.hacker.findUnique({
				where: {
					id: input.hackerId,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			await ctx.prisma.presence.upsert({
				where: {
					id: input.id,
				},
				create: {
					value: input.value,
					label: input.label,
					hackerId: input.hackerId,
				},
				update: {
					value: input.value,
					label: input.label,
				},
			});

			await log(ctx, {
				action: "update",
				sourceId: hacker.id,
				sourceType: "Presence",
				author: user.name ?? "Unknown",
				route: "presence",
				details: `Updated presence for hacker ${hacker.id} with id ${input.id}  (${input.label}) to ${input.value}`,
			});
		}),

	increment: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const user = await ctx.prisma.user.findUnique({
				where: {
					id: userId,
				},
				select: {
					name: true,
					roles: {
						select: {
							name: true,
						},
					},
				},
			});

			if (!user) {
				throw new Error("User not found");
			}

			if (!hasRoles(user, [RoleName.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

			await ctx.prisma.presence.update({
				where: {
					id: input.id,
				},
				data: {
					value: {
						increment: 1,
					},
				},
			});
		}),
});
