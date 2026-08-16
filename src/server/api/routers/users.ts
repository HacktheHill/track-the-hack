import { RoleName } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hasRoles } from "../../../utils/helpers";
import { log } from "../../lib/log";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const getAdmin = async (ctx: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]) => {
	const user = await ctx.prisma.user.findUnique({
		where: { id: ctx.session.user.id },
		select: { id: true, name: true, roles: { select: { name: true } } },
	});
	if (!user || !hasRoles(user, [RoleName.ADMIN])) throw new TRPCError({ code: "FORBIDDEN" });
	return user;
};

export const userRouter = createTRPCRouter({
	search: protectedProcedure.input(z.object({ query: z.string().max(200) })).query(async ({ ctx, input }) => {
		await getAdmin(ctx);
		return ctx.prisma.user.findMany({
			where: { OR: [{ email: { contains: input.query } }, { name: { contains: input.query } }] },
			select: { id: true, name: true, email: true, image: true, roles: { select: { name: true } } },
		});
	}),

	updateRoles: protectedProcedure
		.input(z.object({ roles: z.array(z.nativeEnum(RoleName)), userIds: z.array(z.string()).min(1) }))
		.mutation(async ({ ctx, input }) => {
			const admin = await getAdmin(ctx);
			await ctx.prisma.$transaction(
				input.userIds.map(id =>
					ctx.prisma.user.update({
						where: { id },
						data: { roles: { set: input.roles.map(name => ({ name })) } },
					}),
				),
			);
			await log(ctx, {
				sourceId: admin.id,
				sourceType: "User",
				author: admin.name ?? admin.id,
				route: "/internal/roles",
				action: "UpdateRoles",
				details: `Updated organizer roles for user ids ${input.userIds.join(", ")}.`,
			});
		}),
});
