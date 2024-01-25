import { AttendanceType, ShirtSize, type Hacker } from "@prisma/client";
import { z } from "zod";
import { walkInSchema, Role, Tag } from "../../../utils/common";
import { hasRoles } from "../../../utils/helpers";
import { logAuditEntry } from "../../audit";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";


const DEFAULT_ACCEPTANCE_EXPIRY = new Date(2023, 2, 6, 5, 0, 0, 0); // 2023-03-06 00:00:00 EST

export const hackerRouter = createTRPCRouter({
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
			let hacker: Hacker | null = null;
			if ("id" in input) {
				hacker = await ctx.prisma.hacker.findUnique({
					where: {
						id: input.id,
					},
					
				});
			} else if ("email" in input) {
				
				const personalInfo = await ctx.prisma.personalInfo.findFirst({
					where: {
						email: input.email,
					},
					include: {
						hacker: true,
					},
				});

				if (personalInfo) {
					hacker = personalInfo.hacker;
				}
			}

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			return hacker;
		}),

	// Get next hacker in db from an id
	getNext: publicProcedure
	.input(
		z
			.object({
				id: z.string(),
			}),
	)
	.query(async ({ ctx, input }) => {
		let hacker: Hacker | null = null;
		if ("id" in input) {
			hacker = await ctx.prisma.hacker.findFirst({
				take: 1,
				skip: 1,
				cursor: {
					id: input.id,
				},
			});
		}

		if (!hacker) {
			throw new Error("Hacker not found");
		}

		return hacker;
	}),

	// Get prev hacker in db from an id
	getPrev: publicProcedure
	.input(
		z
			.object({
				id: z.string(),
			}),
	)
	.query(async ({ ctx, input }) => {
		let hacker: Hacker | null = null;
		if ("id" in input) {
			hacker = await ctx.prisma.hacker.findFirst({
				take: -1,
				skip: 1,
				cursor: {
					id: input.id,
				},
				include: {
					personalInfo: true,

				},
			});
		}

		if (!hacker) {
			throw new Error("Hacker not found");
		}

		return hacker;
	}),

	// Get all hackers
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

			//return all hackers if no pagination is needed
			if (!input) {
				return {
					results: await ctx.prisma.hacker.findMany(),
					nextCursor: null,
				};
			}

			const { limit, cursor } = input;

			const results = await ctx.prisma.hacker.findMany({
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

	confirm: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				userId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const hacker = await ctx.prisma.hacker.findUnique({
				where: {
					id: input.id,
				},
				include: {
					personalInfo: true,
					miscellaneousInfo: true,
					preferences: true,
					user: true,
				}
			});
			
			const userId = hacker?.user?.id;
			const preferences = hacker?.preferences;
			const miscellaneousInfo = hacker?.miscellaneousInfo;

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			if (hacker.user) {
				throw new Error("Hacker already confirmed");
			}
			
			if (userId && userId !== input.userId) {
				throw new Error("Hacker already assigned to another account");
			}
			

			if (preferences?.attendanceType !== AttendanceType.ONLINE) {
				throw new Error("Hacker can only attend online");
			}

			//TO-DO: Implement acceptance expiries into more than one event.
			if ((miscellaneousInfo?.acceptanceExpiry ?? 0) < new Date()) {
				throw new Error("Hacker acceptance expired");
			}


			const confirmedTag = await ctx.prisma.tag.findFirst({
				where: {
					value: Tag.CONFIRMED
				},
			});

			const updatedHacker = ctx.prisma.hacker.update({
				where: {
					id: input.id,
				},
				data: confirmedTag ? {
					user: {
						connect: {
							id: input.userId,
						},
					},
					tags: {
						connect: {
							id: confirmedTag?.id,
						},
					},
				} : {
					user: {
						connect: {
							id: input.userId,
						},
					},
				},
				
			});

			return updatedHacker;
		}),

	// Unsubscribe a hacker from emails
	unsubscribe: publicProcedure
		.input(
			z.object({
				email: z.string(),
				unsubscribeToken: z.string().nullable(),
				unsubscribe: z.boolean().default(true),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const person = await ctx.prisma.personalInfo.findFirst({
				where: {
					email: input.email,
				},
				include: {
					hacker: {
						include: {
							preferences: {
								include : {
									emailUnsubscribe: true,
								}
							},
						},
					}
				}
			});

			if (!person) {
				throw new Error("PersonalInfo with given email not found");
			}


			if (!person.hacker) {
				throw new Error("PersonalInfo found, Hacker not found");
			}
			const token = person.hacker.preferences?.emailUnsubscribe?.unsubscribeToken;

			// If the hacker has an unsubscribe token and is not using it or is using it incorrectly
			if (
				token !== null &&
				(input.unsubscribeToken === null || token !== input.unsubscribeToken)
			) {
				throw new Error("Tokens provided are incorrect");
			}

			return ctx.prisma.hacker.updateMany({
				where: {
					email: input.email,
				},
				data: {
					unsubscribed: input.unsubscribe,
				},
			});
		}),

	// Create a walk-in hacker
	walkIn: protectedProcedure
		.input(
			walkInSchema.extend({
				acceptanceExpiry: z.date().default(DEFAULT_ACCEPTANCE_EXPIRY),
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

			const hacker = await ctx.prisma.hackerInfo.create({
				data: {
					...input,
					walkIn: true,
					presenceInfo: {
						create: {
							checkedIn: true,
						},
					},
				},
			});
			await logAuditEntry(
				ctx,
				hacker.id,
				"/walk-in",
				"WalkIn",
				user.username ?? "Unknown",
				`${input.firstName} ${input.lastName} walked in.`,
			);

			return hacker;
		}),

	// Update a hacker's info
	update: protectedProcedure

		.input(
			walkInSchema.extend({
				id: z.string(),
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

			if (input.id !== userId && !hasRoles(user, [Role.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

			await logAuditEntry(
				ctx,
				userId,
				"/update-hacker-info",
				"UpdateHackerInfo",
				user.username ?? "Unknown",
				"Updated hacker information",
			);
			const hackerDetails = await ctx.prisma.hackerInfo.findUnique({
				where: {
					id: input.id,
				},
			});
			const auditEntries: Array<{
				action: string;
				entityType: string;
				userName: string;
				details: string;
			}> = [];

			for (const key in input) {
				for (const key2 in hackerDetails) {
					if (
						key === key2 &&
						input[key as keyof typeof input] !== hackerDetails[key2 as keyof typeof hackerDetails] &&
						input[key as keyof typeof input] !== null &&
						hackerDetails[key2 as keyof typeof hackerDetails] !== null
					) {
						const field = key as keyof typeof input;
						const before = hackerDetails[key2 as keyof typeof hackerDetails];
						const after = input[key as keyof typeof input];

						const auditEntry = {
							action: "/update-hacker-info",
							entityType: "UpdateHackerInfo",
							userName: user.username ?? "Unknown",
							details: `Updated field ${field} from ${String(before)} to ${String(
								after ?? "empty",
							)}`,
						};

						auditEntries.push(auditEntry);
					}
				}
			}

			for (const entry of auditEntries) {
				await logAuditEntry(ctx, input.id, entry.action, entry.entityType, entry.userName, entry.details);
			}

			const hacker = await ctx.prisma.hackerInfo.update({
				where: {
					id: input.id,
				},
				data: input,
			});

			return hacker;
		}),
});
