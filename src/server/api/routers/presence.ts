import type { HackerInfo } from "@prisma/client";
import { Role } from "@prisma/client";
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "events";
import { z } from "zod";
import { hasRoles } from "../../../utils/helpers";

import { logAuditEntry } from "../../audit";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const ee = new EventEmitter();

export const presenceRouter = createTRPCRouter({
	onMutation: publicProcedure.subscription(() => {
		// return an `observable` with a callback which is triggered immediately
		return observable<HackerInfo>(emit => {
			const onMutation = (data: HackerInfo) => {
				// emit data to client
				emit.next(data);
			};
			// trigger `onMutation()` when `add` is triggered in our event emitter
			ee.on("add", onMutation);
			// unsubscribe function when client disconnects or stops subscribing
			return () => {
				ee.off("add", onMutation);
			};
		});
	}),
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
			});

			if (!user) {
				throw new Error("User not found");
			}

			if (!hasRoles(user, [Role.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

			const hacker = await ctx.prisma.hackerInfo.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			let presence = await ctx.prisma.presenceInfo.findUnique({
				where: {
					hackerInfoId: hacker.id,
				},
			});

			if (!presence) {
				presence = await ctx.prisma.presenceInfo.create({
					data: {
						hackerInfo: {
							connect: {
								id: hacker.id,
							},
						},
					},
				});
			}

			return presence;
		}),
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

			//return all presenceInfo if no pagination is needed
			if (!input) {
				return {
					results: await ctx.prisma.presenceInfo.findMany(),
					nextCursor: null,
				};
			}

			const { limit, cursor } = input;

			const results = await ctx.prisma.presenceInfo.findMany({
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
	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				presenceInfo: z.record(z.boolean()),
			}),
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

			if (!hasRoles(user, [Role.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

			const hacker = await ctx.prisma.hackerInfo.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			const presenceInfoBefore = await ctx.prisma.presenceInfo.findUnique({
				where: {
					hackerInfoId: hacker.id,
				},
			});
			ee.emit("add", hacker);

			await ctx.prisma.presenceInfo.upsert({
				where: {
					hackerInfoId: hacker.id,
				},
				update: input.presenceInfo,
				create: {
					...input.presenceInfo,
					hackerInfo: {
						connect: {
							id: hacker.id,
						},
					},
				},
			});

			for (const key in input.presenceInfo) {
				for (const key2 in presenceInfoBefore) {
					if (key === key2) {
						const valueBefore = presenceInfoBefore[key2 as keyof typeof presenceInfoBefore];
						const valueNow = input.presenceInfo[key];

						if (valueNow !== valueBefore) {
							if (valueNow) {
								await logAuditEntry(
									ctx,
									hacker.id,
									"/presence",
									"Presence",
									user.name ?? "Unknown",
									`${hacker.firstName} ${hacker.lastName} ${key} updated to true.`,
								);
							} else {
								await logAuditEntry(
									ctx,
									hacker.id,
									"/presence",
									"Presence",
									user.name ?? "Unknown",
									`${hacker.firstName} ${hacker.lastName} ${key} updated to false.`,
								);
							}
						}
					}
				}
			}
		}),
});
