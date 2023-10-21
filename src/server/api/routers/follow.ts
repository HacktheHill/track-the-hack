import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {logAuditEntry} from "../../audit";

export const followRouter = createTRPCRouter({
	create: publicProcedure
		.input(
			z.object({
				email: z.string().email(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if email is already in the database
			const exists = await ctx.prisma.follow.findUnique({
				where: {
					email: input.email,
				},
			});

			if (exists) {
				throw new Error("Already following");
			}

			await logAuditEntry(
				ctx,
				input.email,
				"/follow",
				"Created a new follow to email",
				input.email,
				"New follow created for email: " + input.email,
			);

			// Create a new follow
			const follow = await ctx.prisma.follow.create({
				data: {
					email: input.email,
				},
			});

			if (!follow) {
				throw new Error("Follow unsuccessful");
			}

			return follow;
		}),
});
