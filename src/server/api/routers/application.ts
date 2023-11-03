import { AttendanceType, Role, ShirtSize, type HackerInfo, ApplicationInfo } from "@prisma/client";
import { z } from "zod";
import { hasRoles } from "../../../utils/helpers";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { applicationInfoSchema } from "../../../utils/common";

const DEFAULT_ACCEPTANCE_EXPIRY = new Date(2023, 2, 6, 5, 0, 0, 0); // 2023-03-06 00:00:00 EST

export const applicationRouter = createTRPCRouter({
	// Get a hacker by id or email
	get: publicProcedure
		.input(
			z
				.object({
					id: z.string(),
				})
				.or(
					z.object({
						email: z.string(),
					}),
				),
		)
		.query(async ({ ctx, input }) => {
			let hacker: ApplicationInfo | null = null;
			if ("id" in input) {
				hacker = await ctx.prisma.applicationInfo.findUnique({
					where: {
						id: input.id,
					},
				});
			} else if ("email" in input) {
				hacker = await ctx.prisma.applicationInfo.findFirst({
					where: {
						email: input.email,
					},
				});
			}

			if (!hacker) {
				throw new Error("Application not found");
			}

			return hacker;
		}),

	// Get all applications
	all: protectedProcedure
		.input(
			z
				.object({
					limit: z.number().min(1).max(100),
					cursor: z.string().nullish(),
				})
				.optional(),
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

			if (!hasRoles(user, [Role.SPONSOR, Role.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

			//return all applications if no pagination is needed
			if (!input) {
				return {
					results: await ctx.prisma.applicationInfo.findMany(),
					nextCursor: null,
				};
			}

			const { limit, cursor } = input;

			const results = await ctx.prisma.applicationInfo.findMany({
				take: limit + 1, // get an extra item at the end which we'll use as next cursor
				cursor: cursor ? { id: cursor } : undefined,
				orderBy: {
					id: "asc",
				},
			});

			let nextCursor: typeof cursor | undefined = undefined;

			if (results.length > limit) {
				const nextItem = results.pop();
				nextCursor = nextItem?.id;
			}

			return {
				results,
				nextCursor,
			};
		}),

	// Create a walk-in hacker
	submit: protectedProcedure
		.input(
			applicationInfoSchema
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

			const hacker = await ctx.prisma.applicationInfo.create({
				data: {
					...input,
					createdAt: new Date().getDate().toString(),
					updatedAt: new Date().getDate().toString(),
				},
			});

			return hacker;
		}),
});
