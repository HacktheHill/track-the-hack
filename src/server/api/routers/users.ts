import { Prisma, RoleName } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hasRoles } from "@/utils/helpers";
import { log } from "@/server/lib/log";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

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
			const userIds = [...new Set(input.userIds)];
			const roles = [...new Set(input.roles)];

			await ctx.prisma.$transaction(
				async transaction => {
					const foundUsers = await transaction.user.findMany({
						where: { id: { in: userIds } },
						select: { id: true },
					});
					if (foundUsers.length !== userIds.length) {
						throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
					}

					for (const name of roles) {
						await transaction.role.upsert({
							where: { name },
							create: { name },
							update: {},
						});
					}

					if (!roles.includes(RoleName.ADMIN)) {
						const remainingAdmins = await transaction.user.count({
							where: { id: { notIn: userIds }, roles: { some: { name: RoleName.ADMIN } } },
						});
						if (remainingAdmins === 0) {
							throw new TRPCError({ code: "BAD_REQUEST", message: "At least one admin is required" });
						}
					}

					for (const id of userIds) {
						await transaction.user.update({
							where: { id },
							data: { roles: { set: roles.map(name => ({ name })) } },
						});
					}
				},
				{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
			);
			await log(ctx, {
				sourceId: admin.id,
				sourceType: "User",
				author: admin.name ?? admin.id,
				userId: admin.id,
				route: "/internal/roles",
				action: "UpdateRoles",
				details: `Updated organizer roles for user ids ${userIds.join(", ")}.`,
			});
		}),
});
