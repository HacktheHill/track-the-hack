import { RoleName, type Hacker } from "@prisma/client";
import crypto from "crypto";
import { z } from "zod";

import { env } from "../../../env/server.mjs";
import { hackerSchema } from "../../../utils/common";
import { hasRoles } from "../../../utils/helpers";
// import { sendApplyEmail } from "../../lib/email";
import { log } from "../../lib/log";
import { generatePresignedGetUrl, generatePresignedPutUrl, generateS3Filename } from "../../lib/s3";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const generateWalkInCode = (userId: string) => {
	return crypto.createHash("sha256").update(env.WALK_IN_SECRET_KEY).update(userId).digest("hex").slice(0, 6);
};

const HackerViewableFields = {
	firstName: true,
	lastName: true,
	pronouns: true,
	linkedin: true,
	github: true,
	personalWebsite: true,
	Team: {
		select: {
			name: true,
			hackers: {
				select: {
					firstName: true,
					lastName: true,
				},
			},
		},
	},
};

export const hackerRouter = createTRPCRouter({
	// Get a hacker by id or email
	get: protectedProcedure
		.input(
			z
				.object({
					id: z.string(),
				})
				.or(
					z.object({
						email: z.string(),
					}),
				)
				.or(
					z.object({
						firstName: z.string(),
						lastName: z.string(),
					}),
				),
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
					Hacker: {
						select: {
							id: true,
							email: true,
							firstName: true,
							lastName: true,
						},
					},
				},
			});

			if (!user) {
				throw new Error("User not found");
			}

			let hacker: Hacker | null = null;
			const isHacker = user.roles.some(role => role.name == RoleName.HACKER);
			const isSelfView = "id" in input && input.id === user.Hacker?.id;

			const fields = isHacker ? HackerViewableFields : null;
			const whereQuery = (() => {
				switch (true) {
					case "id" in input:
						return { id: input.id };
					case "email" in input:
						return { email: input.email };
					case "firstName" in input && "lastName" in input:
						return { firstName: input.firstName, lastName: input.lastName };
					default:
						return {};
				}
			})();

			if (isHacker && !isSelfView) {
				if ("id" in input) {
					hacker = await ctx.prisma.hacker.findUnique({
						where: whereQuery as never,
						select: input.id !== user.Hacker?.id ? fields : null,
					});
				} else if ("email" in input) {
					hacker = await ctx.prisma.hacker.findFirst({
						where: whereQuery as never,
						select: input.email !== user.Hacker?.email ? fields : null,
					});
				} else if ("firstName" in input && "lastName" in input) {
					hacker = await ctx.prisma.hacker.findFirst({
						where: whereQuery as never,
						select:
							input.firstName !== user.Hacker?.firstName || input.lastName !== user.Hacker?.lastName
								? fields
								: null,
					});
				}
			} else {
				hacker = await ctx.prisma.hacker.findFirst({
					where: whereQuery as never,
					include: {
						User: {
							include: {
								accounts: true,
							},
						},
						Team: {
							include: {
								hackers: true,
							},
						},
					},
				});
			}

			if (!hacker) {
				throw new Error("Hacker not found");
			}

			return hacker;
		}),

	// Get next hacker in db from an id
	getNext: protectedProcedure
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

			if (!hasRoles(user, [RoleName.MAYOR, RoleName.PREMIER, RoleName.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

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
	getPrev: protectedProcedure
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

			if (!hasRoles(user, [RoleName.MAYOR, RoleName.PREMIER, RoleName.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

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
					search: z.string().optional(),
					currentSchoolOrganizations: z.array(z.string()).optional(),
					educationLevels: z.array(z.string()).optional(),
					majors: z.array(z.string()).optional(),
					referralSources: z.array(z.string()).optional(),
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

			if (!hasRoles(user, [RoleName.MAYOR, RoleName.PREMIER, RoleName.ORGANIZER])) {
				throw new Error("You do not have permission to do this");
			}

			// Return all hackers if no pagination is needed
			if (!input) {
				return {
					results: await ctx.prisma.hacker.findMany(),
					nextCursor: null,
				};
			}

			const { limit, cursor, search, currentSchoolOrganizations, educationLevels, majors, referralSources } =
				input;

			const queryConditions: {
				currentSchoolOrganization?: { in: string[] };
				educationLevel?: { in: string[] };
				major?: { in: string[] };
				referralSource?: { in: string[] };
				OR?: {
					firstName?: { contains: string };
					lastName?: { contains: string };
					email?: { contains: string };
				}[];
			} = {};

			if (search) {
				queryConditions.OR = [
					{
						firstName: {
							contains: search,
						},
					},
					{
						lastName: {
							contains: search,
						},
					},
					{
						email: {
							contains: search,
						},
					},
				];
			}

			if (currentSchoolOrganizations && currentSchoolOrganizations.length > 0) {
				queryConditions.currentSchoolOrganization = { in: currentSchoolOrganizations };
			}

			if (educationLevels && educationLevels.length > 0) {
				queryConditions.educationLevel = { in: educationLevels };
			}

			if (majors && majors.length > 0) {
				queryConditions.major = { in: majors };
			}

			if (referralSources && referralSources.length > 0) {
				queryConditions.referralSource = { in: referralSources };
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

		if (!hasRoles(user, [RoleName.MAYOR, RoleName.PREMIER, RoleName.ORGANIZER])) {
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

			await ctx.prisma.hacker.update({
				where: {
					id: input.id,
				},
				data: {
					confirmed: input.confirm,
					...(input.confirm &&
						input.teamName && {
							Team: {
								connectOrCreate: {
									where: { name: input.teamName },
									create: { name: input.teamName },
								},
							},
						}),
					...(input.confirm === false && {
						Team: {
							disconnect: true,
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
			let presignedUrl: string;
			try {
				presignedUrl = await generatePresignedPutUrl(filename, "signatures");
			} catch (e) {
				presignedUrl = "";
			}

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

			return ctx.prisma.hacker.updateMany({
				where: {
					email: input.email,
				},
				data: {
					unsubscribed: input.unsubscribe,
				},
			});
		}),

	verifyWalkInCode: protectedProcedure
		.input(
			z.object({
				code: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
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

			return {
				valid: input.code === generateWalkInCode(userId),
			};
		}),

	getWalkInCode: protectedProcedure
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

			return {
				code: generateWalkInCode(input.id),
			};
		}),

	walkIn: protectedProcedure
		.input(
			hackerSchema.extend({
				code: z.string(),
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

			// Check if the walk-in code is correct
			const { code, ...data } = input;
			if (code !== generateWalkInCode(userId)) {
				throw new Error("Invalid walk-in code");
			}

			await ctx.prisma.hacker.deleteMany({
				where: {
					userId: userId,
				},
			});

			const hacker = await ctx.prisma.hacker.create({
				data: {
					...data,
					walkIn: true,
					User: {
						connect: {
							id: userId,
						},
					},
					acceptanceStatus: "ACCEPTED",
				},
			});

			const hackerRoleExists = user.roles.some(role => role.name === "HACKER");
			if (!hackerRoleExists) {
				await ctx.prisma.user.update({
					where: { id: userId },
					data: {
						roles: {
							connect: {
								name: RoleName.HACKER,
							},
						},
					},
				});
			}

			const filename = generateS3Filename(hacker.id, `${hacker.firstName}_${hacker.lastName}_Resume`, "pdf");
			const presignedUrl = await generatePresignedPutUrl(filename, "resumes");

			// Log the walk-in action
			await log(ctx, {
				sourceId: hacker.id,
				sourceType: "Hacker",
				route: "/apply",
				action: "Walk-In",
				author: user.name ?? "Unknown",
				details: `${input.firstName} ${input.lastName} applied as a walk-in.`,
			});

			return {
				...hacker,
				presignedUrl,
			};
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

		throw new Error("The application deadline has passed");

		/* await ctx.prisma.hacker.deleteMany({
			where: {
				userId: userId,
			},
		});

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

		return {
			...hacker,
			presignedUrl,
		}; */
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
