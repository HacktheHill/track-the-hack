import { RoleName, type Hacker } from "@prisma/client";
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "events";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

import { hackerSchema } from "../../../utils/common";
import { hasRoles } from "../../../utils/helpers";
import { sendApplyEmail } from "../../lib/email";
import { log } from "../../lib/log";
import { generatePresignedGetUrl, generatePresignedPutUrl, generateS3Filename } from "../../lib/s3";

const ee = new EventEmitter();

export const hackerRouter = createTRPCRouter({
	onMutation: publicProcedure.subscription(() => {
		// return an `observable` with a callback which is triggered immediately
		return observable<Hacker>(emit => {
			const onMutation = (data: Hacker) => {
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
			let hacker: Hacker | null = null;
			if ("id" in input) {
				hacker = await ctx.prisma.hacker.findUnique({
					where: {
						id: input.id,
					},
				});
			} else if ("email" in input) {
				hacker = await ctx.prisma.hacker.findFirst({
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
			let hacker: Hacker | null = null;
			if ("id" in input) {
				hacker = await ctx.prisma.hacker.findFirst({
					take: -1,
					skip: 1,
					cursor: {
						id: input.id,
					},
				});
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
					referralSources: z.array(z.string()).optional(),
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

			// Return all hackers if no pagination is needed
			if (!input) {
				return {
					results: await ctx.prisma.hacker.findMany(),
					nextCursor: null,
				};
			}

			const { limit, cursor, schools, currentLevelsOfStudy, programs, graduationYears } = input;

			const queryConditions: {
				university?: { in: string[] } | null;
				studyLevel?: { in: string[] } | null;
				studyProgram?: { in: string[] } | null;
				graduationYear?: { in: number[] } | null;
				referralSource?: { in: string[] };
			} = {};

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

			if (input.referralSources && input.referralSources.length > 0) {
				queryConditions.referralSource = { in: input.referralSources };
			}

			const results = await ctx.prisma.hacker.findMany({
				take: limit + 1, // get an extra item at the end which we'll use as next cursor
				cursor: cursor ? { id: cursor } : undefined,
				where: queryConditions,
				orderBy: {
					createdAt: "asc",
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

		const filterOptions = {
			currentSchoolOrganizations: [],
			educationLevels: [],
			majors: [],
			referralSources: [],
		} as {
			currentSchoolOrganizations: string[];
			educationLevels: string[];
			majors: string[];
			referralSources: string[];
		};

		const hackers = await ctx.prisma.hacker.findMany();

		hackers?.forEach(hacker => {
			if (hacker.currentSchoolOrganization) {
				if (!filterOptions.currentSchoolOrganizations.includes(hacker.currentSchoolOrganization)) {
					filterOptions.currentSchoolOrganizations.push(hacker.currentSchoolOrganization);
				}
			}

			if (hacker.educationLevel) {
				if (!filterOptions.educationLevels.includes(hacker.educationLevel)) {
					filterOptions.educationLevels.push(hacker.educationLevel);
				}
			}

			if (hacker.major) {
				if (!filterOptions.majors.includes(hacker.major)) {
					filterOptions.majors.push(hacker.major);
				}
			}

			if (hacker.referralSource) {
				if (!filterOptions.referralSources.includes(hacker.referralSource)) {
					filterOptions.referralSources.push(hacker.referralSource);
				}
			}
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
				teamName: z.string().optional(),
				confirm: z.boolean().default(true),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const hacker = await ctx.prisma.hacker.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			ee.emit("add", hacker);

			await ctx.prisma.hacker.update({
				where: {
					id: input.id,
				},
				data: {
					confirmed: input.confirm,
					...(input.confirm && input.teamName && {
						Team: {
							connect: {
								name: input.teamName,
							},
						},
					}),
				},
			});

			await ctx.prisma.team.deleteMany({
				where: {
					hackers: {
						none: {},
					},
				},
			});

			const filename = generateS3Filename(hacker.id, `${hacker.firstName}_${hacker.lastName}_Signature`, "png");
			const presignedUrl = await generatePresignedPutUrl(filename, "signatures");

			return {
				...hacker,
				presignedUrl,
			};
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
			const hacker = await ctx.prisma.hacker.findFirst({
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
	walkIn: protectedProcedure.input(hackerSchema).mutation(async ({ ctx, input }) => {
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

		const hacker = await ctx.prisma.hacker.create({
			data: {
				...input,
				walkIn: true,
				presences: {
					create: {
						key: "checkedIn",
						value: 1,
						label: "Checked In",
					},
				},
			},
		});

		await log(ctx, {
			sourceId: hacker.id,
			sourceType: "Hacker",
			route: "/walk-in",
			action: "WalkIn",
			details: `${input.firstName} ${input.lastName} walked in.`,
			author: user.name ?? "Unknown",
		});

		ee.emit("add", hacker);

		return hacker;
	}),

	apply: protectedProcedure.input(hackerSchema).mutation(async ({ ctx, input }) => {
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

		const hacker = await ctx.prisma.hacker.create({
			data: {
				...input,
				User: {
					connect: {
						id: userId,
					},
				},
			},
		});

		const filename = generateS3Filename(hacker.id, `${hacker.firstName}_${hacker.lastName}_Resume`, "pdf");
		const presignedUrl = await generatePresignedPutUrl(filename, "resumes");

		await sendApplyEmail({
			email: input.email,
			name: input.firstName,
			locale: input.preferredLanguage ?? "EN",
		});

		await log(ctx, {
			sourceId: hacker.id,
			sourceType: "Hacker",
			route: "/apply",
			action: "Apply",
			author: user.name ?? "Unknown",
			details: `${input.firstName} ${input.lastName} applied.`,
		});

		ee.emit("add", hacker);

		return {
			...hacker,
			presignedUrl,
		};
	}),

	delete: protectedProcedure
		.input(
			z.object({
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
					Hacker: true,
				},
			});

			if (!user) {
				throw new Error("User not found");
			}

			const hacker = user.Hacker;

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			if (!hasRoles(user, [RoleName.ORGANIZER]) && hacker.id !== input.id) {
				throw new Error("You do not have permission to do this");
			}

			await log(ctx, {
				sourceId: input.id,
				sourceType: "Hacker",
				route: "/delete-hacker",
				action: "DeleteHacker",
				details: `Deleted hacker ${input.id}`,
				author: user.name ?? "Unknown",
			});

			return ctx.prisma.hacker.delete({
				where: {
					id: input.id,
				},
			});
		}),

	// Update a hacker's info
	update: protectedProcedure
		.input(
			hackerSchema.partial().extend({
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
					Hacker: true,
				},
			});

			if (!user) {
				throw new Error("User not found");
			}

			const hacker = await ctx.prisma.hacker.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			if (
				// If the user is not an organizer, they can only edit their own hacker info
				!hasRoles(user, [RoleName.ORGANIZER]) &&
				hacker.userId !== userId &&
				// If the user has the acceptance role, they can only edit the acceptance status
				!(
					Object.values(input).length === 2 &&
					input.id &&
					input.acceptanceStatus &&
					hasRoles(user, [RoleName.ACCEPTANCE])
				)
			) {
				throw new Error("You do not have permission to edit this hacker");
			}

			const updates = new Map<keyof typeof input, string | boolean | number | Date | undefined>();

			for (const key in input) {
				for (const key2 in hacker) {
					if (
						key === key2 &&
						input[key as keyof typeof input] !== hacker[key2 as keyof typeof hacker] &&
						input[key as keyof typeof input] !== null &&
						hacker[key2 as keyof typeof hacker] !== null
					) {
						const field = key as keyof typeof input;
						const before = hacker[key2 as keyof typeof hacker];
						const after = input[key as keyof typeof input];

						await log(ctx, {
							sourceId: input.id,
							sourceType: "Hacker",
							route: "/update-hacker-info",
							details: `Updated field ${field} from ${String(before)} to ${String(after ?? "empty")}`,
							action: "UpdateHackerInfo",
							author: user.name ?? "Unknown",
						});

						updates.set(field, after);
					}
				}
			}

			const updatedHacker = await ctx.prisma.hacker.update({
				where: {
					id: input.id,
				},
				data: Object.fromEntries(updates),
			});

			let presignedUrl = null;
			if (updatedHacker.hasResume) {
				const filename = generateS3Filename(
					updatedHacker.id,
					`${updatedHacker.firstName}_${updatedHacker.lastName}_Resume`,
					"pdf",
				);
				presignedUrl = await generatePresignedPutUrl(filename, "resumes");
			}

			await log(ctx, {
				sourceId: input.id,
				sourceType: "Hacker",
				route: "/update-hacker-info",
				author: user.name ?? "Unknown",
				action: "UpdateHackerInfo",
				details: `Updated hacker info for ${input.id}`,
			});

			return {
				...updatedHacker,
				presignedUrl,
			};
		}),

	// Download a hacker's resume
	downloadResume: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const hacker = await ctx.prisma.hacker.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			const filename = generateS3Filename(hacker.id, `${hacker.firstName}_${hacker.lastName}_Resume`, "pdf");
			const presignedUrl = await generatePresignedGetUrl(filename, "resumes");

			return presignedUrl;
		}),
});
