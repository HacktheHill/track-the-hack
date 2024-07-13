import { AttendanceType, RoleName, ShirtSize, type HackerInfo } from "@prisma/client";
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "events";
import { z } from "zod";
import { applySchema, walkInSchema } from "../../../utils/common";
import { hasRoles } from "../../../utils/helpers";
import { logAuditEntry } from "../../audit";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const DEFAULT_ACCEPTANCE_EXPIRY = new Date(2023, 2, 6, 5, 0, 0, 0); // 2023-03-06 00:00:00 EST

const ee = new EventEmitter();

export const hackerRouter = createTRPCRouter({
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
			let hacker: HackerInfo | null = null;
			if ("id" in input) {
				hacker = await ctx.prisma.hackerInfo.findUnique({
					where: {
						id: input.id,
					},
				});
			} else if ("email" in input) {
				hacker = await ctx.prisma.hackerInfo.findFirst({
					where: {
						email: input.email,
					},
				});
			}

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			return hacker;
		}),

	// Get next hacker in db from an id
	getNext: publicProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			let hacker: HackerInfo | null = null;
			if ("id" in input) {
				hacker = await ctx.prisma.hackerInfo.findFirst({
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
			z.object({
				id: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			let hacker: HackerInfo | null = null;
			if ("id" in input) {
				hacker = await ctx.prisma.hackerInfo.findFirst({
					take: -1,
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

	// Get all hackers
	all: protectedProcedure
		.input(
			z
				.object({
					limit: z.number().min(1).max(100),
					cursor: z.string().nullish(),
					schools: z.array(z.string()).optional(),
					currentLevelsOfStudy: z.array(z.string()).optional(),
					programs: z.array(z.string()).optional(),
					graduationYears: z.array(z.number()).optional(),
					attendanceTypes: z.array(z.nativeEnum(AttendanceType)).optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const user = await ctx.prisma.user.findUnique({
				where: {
					id: userId,
				},
				select: {
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

			if (!hasRoles(user, [RoleName.SPONSOR, RoleName.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

			//return all hackerInfo if no pagination is needed
			if (!input) {
				return {
					results: await ctx.prisma.hackerInfo.findMany(),
					nextCursor: null,
				};
			}

			const { limit, cursor, schools, currentLevelsOfStudy, programs, graduationYears, attendanceTypes } = input;

			interface QueryConditions {
				university?: { in: string[] } | null;
				studyLevel?: { in: string[] } | null;
				studyProgram?: { in: string[] } | null;
				graduationYear?: { in: number[] } | null;
				attendanceType?: { in: AttendanceType[] };
			}

			const queryConditions: QueryConditions = {};

			if (schools && schools.length > 0) {
				queryConditions.university = { in: schools };
			}

			if (currentLevelsOfStudy && currentLevelsOfStudy.length > 0) {
				queryConditions.studyLevel = { in: currentLevelsOfStudy };
			}

			if (programs && programs.length > 0) {
				queryConditions.studyProgram = { in: programs };
			}

			if (graduationYears && graduationYears.length > 0) {
				queryConditions.graduationYear = { in: graduationYears };
			}

			if (attendanceTypes && attendanceTypes.length > 0) {
				queryConditions.attendanceType = { in: attendanceTypes };
			}

			const results = await ctx.prisma.hackerInfo.findMany({
				take: limit + 1, // get an extra item at the end which we'll use as next cursor
				cursor: cursor ? { id: cursor } : undefined,
				where: queryConditions,
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

	// get of all the options you can filter the hackers by
	filterOptions: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const user = await ctx.prisma.user.findUnique({
			where: {
				id: userId,
			},
			select: {
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

		if (!hasRoles(user, [RoleName.SPONSOR, RoleName.ORGANIZER])) {
			throw new Error("You do not have permission to do this");
		}

		const filterOptions: {
			schools: string[];
			currentLevelsOfStudy: string[];
			programs: string[];
			graduationYears: string[];
			attendanceTypes: string[];
		} = {
			schools: [],
			currentLevelsOfStudy: [],
			programs: [],
			graduationYears: [],
			attendanceTypes: [],
		};

		const hackers = await ctx.prisma.hackerInfo.findMany();

		hackers?.forEach(hacker => {
			if (hacker.university && !filterOptions.schools.includes(hacker.university.toLowerCase()))
				filterOptions.schools.push(hacker.university.toLowerCase());

			if (hacker.studyLevel && !filterOptions.currentLevelsOfStudy.includes(hacker.studyLevel.toLowerCase()))
				filterOptions.currentLevelsOfStudy.push(hacker.studyLevel.toLowerCase());

			if (hacker.studyProgram && !filterOptions.programs.includes(hacker.studyProgram.toLowerCase()))
				filterOptions.programs.push(hacker.studyProgram.toLowerCase());

			if (hacker.graduationYear && !filterOptions.graduationYears.includes(hacker.graduationYear.toString()))
				filterOptions.graduationYears.push(hacker.graduationYear.toString());

			if (hacker.attendanceType && !filterOptions.attendanceTypes.includes(hacker.attendanceType))
				filterOptions.attendanceTypes.push(hacker.attendanceType);
		});

		return {
			filterOptions,
		};
	}),

	// Confirm a hacker's attendance
	confirm: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				shirtSize: z.enum([ShirtSize.S, ShirtSize.M, ShirtSize.L, ShirtSize.XL, ShirtSize.XXL]),
				attendanceType: z.enum([AttendanceType.IN_PERSON, AttendanceType.ONLINE]),
				userId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const hacker = await ctx.prisma.hackerInfo.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			if (hacker.confirmed) {
				throw new Error("Hacker already confirmed");
			}

			if (hacker.userId && hacker.userId !== input.userId) {
				throw new Error("Hacker already assigned to another account");
			}

			if (hacker.onlyOnline && input.attendanceType !== AttendanceType.ONLINE) {
				throw new Error("Hacker can only attend online");
			}

			ee.emit("add", hacker);

			return ctx.prisma.hackerInfo.update({
				where: {
					id: input.id,
				},
				data: {
					shirtSize: input.attendanceType === AttendanceType.ONLINE ? null : input.shirtSize,
					attendanceType: input.attendanceType,
					userId: input.userId,
					confirmed: true,
				},
			});
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
			const hacker = await ctx.prisma.hackerInfo.findFirst({
				where: {
					email: input.email,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			// If the hacker has an unsubscribe token and is not using it or is using it incorrectly
			if (
				hacker.unsubscribeToken !== null &&
				(input.unsubscribeToken === null || hacker.unsubscribeToken !== input.unsubscribeToken)
			) {
				throw new Error("invalid-unsubscribe-token");
			}

			ee.emit("add", hacker);

			return ctx.prisma.hackerInfo.updateMany({
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
				user.name ?? "Unknown",
				`${input.firstName} ${input.lastName} walked in.`,
			);

			ee.emit("add", hacker);

			return hacker;
		}),

	apply: protectedProcedure
		.input(
			applySchema.extend({
				acceptanceExpiry: z.date().default(DEFAULT_ACCEPTANCE_EXPIRY),
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

			const hacker = await ctx.prisma.hackerInfo.create({
				data: input,
			});
			await logAuditEntry(
				ctx,
				hacker.id,
				"/apply",
				"Apply",
				user.name ?? "Unknown",
				`${input.firstName} ${input.lastName} applied.`,
			);

			ee.emit("add", hacker);

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

			if (input.id !== userId && !hasRoles(user, [RoleName.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

			await logAuditEntry(
				ctx,
				userId,
				"/update-hacker-info",
				"UpdateHackerInfo",
				user.name ?? "Unknown",
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
							userName: user.name ?? "Unknown",
							details: `Updated field ${field} from ${String(before)} to ${String(after ?? "empty")}`,
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
