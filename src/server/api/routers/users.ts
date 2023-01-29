import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { roles } from "../../../utils/common";

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

    // Set the given user's role
    setRole: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                role: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const role = roles.safeParse(input.role);
            if (!role.success) {
                return null;
            }
            const updatedUser = await ctx.prisma.user.update({
                where: {
                    id: input.id,
                },
                data: {
                    role: role.data,
                },
            });
            return updatedUser;
        }),
});
