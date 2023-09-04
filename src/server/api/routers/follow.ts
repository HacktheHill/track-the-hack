import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const followRouter = createTRPCRouter({
	create: publicProcedure
		.input(
			z.object({
				email: z.string().email(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
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
