import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
	// Sign up a new user
	signUp: publicProcedure
		.input(
			z.object({
				email: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingUser = await ctx.prisma.user.findFirst({
				where: {
					email: input.email,
				},
			});

			if (existingUser) {
				return existingUser;
			}

			const user = await ctx.prisma.user.create({
				data: {
					email: input.email,
				},
			});

			return user;
		}),
});
