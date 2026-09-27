import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, createTRPCRouter, judgeProcedure } from "@/server/api/trpc";
import { createAuditEvent, persistAuditEvent } from "@/server/lib/audit-event";
import { generateJudgingAssignments } from "@/server/services/judging-assignments";
import {
	parseJudgeCsv,
	parseProjectCsv,
	type ImportedJudge,
	type ImportedJudgingProject,
} from "@/server/services/judging-import";
import { clampJudgingEditTime, judgingFieldWriteWins } from "@/server/services/judging-sync";
import {
	canonicalProjectCategoryCodes,
	isJudgingCategoryCode,
	isMiniAssessmentEligibleForRanking,
	isMiniCategoryCode,
	mainScoreTotal,
	pointsForLevel,
	rubricSnapshot,
	type MainRubricKey,
} from "@/shared/judging";

const csvInput = z.string().max(2_000_000);
const roundIdInput = z.object({ roundId: z.string().min(1).max(191) });
const expectedAssignmentVersionInput = { expectedAssignmentVersion: z.number().int().nonnegative() };
const versionedRoundIdInput = roundIdInput.extend(expectedAssignmentVersionInput);

const assignmentValueSchema = z
	.object({
		technicalLevel: z.number().int().min(0).max(5).nullable().optional(),
		ideaLevel: z.number().int().min(0).max(5).nullable().optional(),
		designLevel: z.number().int().min(0).max(5).nullable().optional(),
		learningLevel: z.number().int().min(0).max(5).nullable().optional(),
		presentationLevel: z.number().int().min(0).max(5).nullable().optional(),
		miniEligibility: z.enum(["ELIGIBLE", "UNSURE", "INELIGIBLE"]).nullable().optional(),
		miniScore: z.number().int().min(1).max(5).nullable().optional(),
		note: z.string().max(4000).nullable().optional(),
		rulesConcern: z.boolean().optional(),
		recusalReason: z.string().max(1000).nullable().optional(),
	})
	.strict();

const rankingRelevantFields = new Set([
	"technicalLevel",
	"ideaLevel",
	"designLevel",
	"learningLevel",
	"presentationLevel",
	"miniEligibility",
	"miniScore",
	"recusalReason",
]);
const mainScoreFields = new Set(["technicalLevel", "ideaLevel", "designLevel", "learningLevel", "presentationLevel"]);
const miniScoreFields = new Set(["miniEligibility", "miniScore"]);

const syncInput = z
	.object({
		roundId: z.string().min(1).max(191),
		assignmentVersion: z.number().int().nonnegative(),
		assignments: z
			.array(
				z.object({
					operationId: z.string().uuid(),
					assignmentId: z.string().min(1).max(191),
					editedAt: z.string().datetime(),
					fieldEditedAt: z.record(z.string().datetime()).default({}),
					fieldOperationIds: z.record(z.string().uuid()).default({}),
					values: assignmentValueSchema,
				}),
			)
			.max(100),
		rankings: z
			.array(
				z.object({
					operationId: z.string().uuid(),
					categoryCode: z.string().refine(isJudgingCategoryCode),
					projectIds: z.array(z.string().min(1).max(191)).max(100),
					editedAt: z.string().datetime(),
				}),
			)
			.max(20),
	})
	.superRefine((input, context) => {
		const operationIds = [...input.assignments, ...input.rankings].map(item => item.operationId);
		if (new Set(operationIds).size !== operationIds.length)
			context.addIssue({
				code: "custom",
				path: ["assignments"],
				message: "Every synchronization operation ID must be unique within a batch.",
			});
	});

const jsonStringArray = (value: Prisma.JsonValue): string[] =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const timestampMap = (value: Prisma.JsonValue): Record<string, string> => {
	if (!value || Array.isArray(value) || typeof value !== "object") return {};
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
	);
};

const isAssignmentComplete = (
	assignment: {
		isMain: boolean;
		technicalLevel: number | null;
		ideaLevel: number | null;
		designLevel: number | null;
		learningLevel: number | null;
		presentationLevel: number | null;
		miniEligibility: "ELIGIBLE" | "UNSURE" | "INELIGIBLE" | null;
		miniScore: number | null;
		note: string | null;
		recusedAt: Date | null;
		recusalAcceptedAt: Date | null;
	},
	eligibilityResolution?: "ELIGIBLE" | "UNSURE" | "INELIGIBLE" | null,
) => {
	if (assignment.recusedAt) return Boolean(assignment.recusalAcceptedAt);
	if (assignment.isMain)
		return [
			assignment.technicalLevel,
			assignment.ideaLevel,
			assignment.designLevel,
			assignment.learningLevel,
			assignment.presentationLevel,
		].every(value => value !== null);
	if (eligibilityResolution === "ELIGIBLE") return assignment.miniScore !== null;
	if (eligibilityResolution === "INELIGIBLE") {
		if (!assignment.miniEligibility) return false;
		return assignment.miniEligibility === "ELIGIBLE" || Boolean(assignment.note?.trim());
	}
	if (!assignment.miniEligibility) return false;
	if (assignment.miniEligibility === "ELIGIBLE") return assignment.miniScore !== null;
	return Boolean(assignment.note?.trim());
};

const completedLevel = (value: number | null) => {
	if (value === null) throw new Error("A completed main assessment is missing a rubric level");
	return value;
};

const assignmentSelect = {
	id: true,
	categoryCode: true,
	isMain: true,
	expertiseMatch: true,
	calibrationAnchor: true,
	technicalLevel: true,
	ideaLevel: true,
	designLevel: true,
	learningLevel: true,
	presentationLevel: true,
	miniEligibility: true,
	miniScore: true,
	note: true,
	rulesConcern: true,
	recusedAt: true,
	recusalReason: true,
	recusalAcceptedAt: true,
	fieldTimestamps: true,
	fieldOperationIds: true,
	completedAt: true,
	updatedAt: true,
	project: {
		select: {
			id: true,
			externalId: true,
			name: true,
			tableNumber: true,
			room: true,
			devpostUrl: true,
			mainTrack: true,
			categories: {
				select: { code: true, eligibilityResolution: true },
			},
		},
	},
} satisfies Prisma.JudgingAssignmentSelect;

type AssignmentIdentity = {
	categoryCode: string;
	isMain: boolean;
};

const resetAssignmentForJudge = (
	judge: { id: string; expertise: Prisma.JsonValue },
	assignment: AssignmentIdentity,
	assignmentReason: string,
): Prisma.JudgingAssignmentUncheckedUpdateInput => ({
	judgeId: judge.id,
	assignmentReason,
	expertiseMatch: !assignment.isMain && jsonStringArray(judge.expertise).includes(assignment.categoryCode),
	fieldTimestamps: {},
	fieldOperationIds: {},
	technicalLevel: null,
	ideaLevel: null,
	designLevel: null,
	learningLevel: null,
	presentationLevel: null,
	miniEligibility: null,
	miniScore: null,
	note: null,
	rulesConcern: false,
	recusedAt: null,
	recusalReason: null,
	recusalAcceptedAt: null,
	completedAt: null,
});

const requireMutableAssignments = (round: { state: string }) => {
	if (round.state === "LOCKED")
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Reopen judging before changing assignments.",
		});
};

const requireRoundState = (round: { state: string }, expected: "DRAFT" | "OPEN" | "LOCKED") => {
	if (round.state !== expected)
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: `This operation requires a ${expected.toLowerCase()} judging round.`,
		});
};

const invalidateRankings = async (
	transaction: Prisma.TransactionClient,
	pairs: Array<{ judgeId: string; categoryCode: string }>,
) => {
	for (const { judgeId, categoryCode } of new Map(
		pairs.map(pair => [`${pair.judgeId}:${pair.categoryCode}`, pair]),
	).values()) {
		await transaction.judgingRanking.updateMany({
			where: { judgeId, categoryCode },
			data: { confirmedAt: null },
		});
	}
};

const claimAssignmentVersion = async (
	transaction: Prisma.TransactionClient,
	roundId: string,
	expectedAssignmentVersion: number,
) => {
	const result = await transaction.judgingRound.updateMany({
		where: { id: roundId, assignmentVersion: expectedAssignmentVersion, state: { not: "LOCKED" } },
		data: { assignmentVersion: { increment: 1 } },
	});
	if (result.count !== 1)
		throw new TRPCError({
			code: "CONFLICT",
			message: "Assignments changed in another administrator session. Refresh and try again.",
		});
};

type JudgingManifestClient = Pick<Prisma.TransactionClient, "judgingJudge">;

const buildManifest = async (prisma: JudgingManifestClient, judgeId: string) => {
	const judge = await prisma.judgingJudge.findUnique({
		where: { id: judgeId },
		select: {
			id: true,
			name: true,
			email: true,
			round: {
				select: {
					id: true,
					name: true,
					state: true,
					assignmentVersion: true,
					rubricSnapshot: true,
					updatedAt: true,
				},
			},
			assignments: {
				select: assignmentSelect,
				orderBy: [{ project: { room: "asc" } }, { project: { tableNumber: "asc" } }, { categoryCode: "asc" }],
			},
			rankings: {
				select: {
					id: true,
					categoryCode: true,
					projectId: true,
					rank: true,
					editedAt: true,
					confirmedAt: true,
				},
				orderBy: [{ categoryCode: "asc" }, { rank: "asc" }],
			},
		},
	});
	if (!judge) throw new TRPCError({ code: "FORBIDDEN" });
	return { serverTime: new Date(), rubric: judge.round.rubricSnapshot, judge };
};

export const judgingRouter = createTRPCRouter({
	previewImport: adminProcedure
		.input(z.object({ projectCsv: csvInput, judgeCsv: csvInput }))
		.mutation(async ({ input }) => {
			const [projects, judges] = await Promise.all([
				parseProjectCsv(input.projectCsv),
				parseJudgeCsv(input.judgeCsv),
			]);
			const generation =
				projects.errors.length || judges.errors.length
					? null
					: generateJudgingAssignments(projects.rows, judges.rows);
			return { projects, judges, generation };
		}),

	applyImport: adminProcedure
		.input(
			z.object({
				name: z.string().trim().min(1).max(191),
				projectCsv: csvInput,
				judgeCsv: csvInput,
				replaceExistingDraft: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [projects, judges] = await Promise.all([
				parseProjectCsv(input.projectCsv),
				parseJudgeCsv(input.judgeCsv),
			]);
			const errors = [...projects.errors, ...judges.errors];
			if (errors.length) throw new TRPCError({ code: "BAD_REQUEST", message: errors.join("\n") });
			const generation = generateJudgingAssignments(projects.rows, judges.rows);
			if (generation.errors.length)
				throw new TRPCError({ code: "BAD_REQUEST", message: generation.errors.join("\n") });

			return ctx.prisma.$transaction(
				async transaction => {
					const openRound = await transaction.judgingRound.findFirst({
						where: { state: "OPEN" },
						select: { id: true },
					});
					if (openRound)
						throw new TRPCError({
							code: "PRECONDITION_FAILED",
							message: "Lock the open judging round before importing another.",
						});
					const existingDrafts = await transaction.judgingRound.findMany({
						where: { state: "DRAFT" },
						select: { id: true },
					});
					if (existingDrafts.length && !input.replaceExistingDraft)
						throw new TRPCError({
							code: "PRECONDITION_FAILED",
							message: "Confirm replacement of the existing draft before applying this import.",
						});
					if (existingDrafts.length)
						await transaction.judgingRound.deleteMany({
							where: { id: { in: existingDrafts.map(draft => draft.id) } },
						});
					const round = await transaction.judgingRound.create({
						data: {
							name: input.name,
							createdById: ctx.organizer.id,
							effectiveProjectLimit: generation.effectiveProjectLimit,
							rubricSnapshot: { en: rubricSnapshot("en"), fr: rubricSnapshot("fr") },
							generationWarnings: generation.warnings,
						},
					});
					const projectIds = new Map<string, string>();
					for (const project of projects.rows) {
						const created = await transaction.judgingProject.create({
							data: {
								roundId: round.id,
								externalId: project.externalId,
								name: project.name,
								tableNumber: project.tableNumber,
								room: project.room,
								devpostUrl: project.devpostUrl,
								mainTrack: project.mainTrack,
							},
						});
						projectIds.set(project.externalId, created.id);
						for (const code of project.categories) {
							await transaction.judgingProjectCategory.create({
								data: { roundId: round.id, projectId: created.id, code },
							});
						}
					}
					const judgeIds = new Map<string, string>();
					for (const judge of judges.rows) {
						const created = await transaction.judgingJudge.create({
							data: {
								roundId: round.id,
								name: judge.name,
								email: judge.email,
								expertise: judge.expertise,
								exclusions: judge.exclusions,
							},
						});
						judgeIds.set(judge.email, created.id);
					}
					for (const assignment of generation.assignments) {
						const judgeId = judgeIds.get(assignment.judgeEmail);
						const projectId = projectIds.get(assignment.projectExternalId);
						if (!judgeId || !projectId)
							throw new Error("Generated assignment references an unknown import row");
						await transaction.judgingAssignment.create({
							data: {
								roundId: round.id,
								judgeId,
								projectId,
								categoryCode: assignment.categoryCode,
								isMain: assignment.isMain,
								expertiseMatch: assignment.expertiseMatch,
								calibrationAnchor: assignment.calibrationAnchor,
								assignmentReason: assignment.reason,
								fieldTimestamps: {},
								fieldOperationIds: {},
							},
						});
					}
					await persistAuditEvent(
						transaction,
						createAuditEvent({
							name: "judging.round.imported",
							outcome: "created",
							actor: { type: "organizer", id: ctx.organizer.id },
							resource: { type: "judging_round", id: round.id },
							data: {
								projectCount: projects.rows.length,
								judgeCount: judges.rows.length,
								assignmentCount: generation.assignments.length,
								replacedDraftCount: existingDrafts.length,
							},
						}),
					);
					return {
						roundId: round.id,
						generation,
						projectWarnings: projects.warnings,
						judgeWarnings: judges.warnings,
					};
				},
				{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
			);
		}),

	adminOverview: adminProcedure.query(async ({ ctx }) => {
		const round = await ctx.prisma.judgingRound.findFirst({
			orderBy: { createdAt: "desc" },
			include: {
				projects: { include: { categories: true }, orderBy: [{ room: "asc" }, { tableNumber: "asc" }] },
				judges: { orderBy: { name: "asc" } },
				assignments: {
					include: { judge: true, project: true },
					orderBy: [{ judge: { name: "asc" } }, { project: { tableNumber: "asc" } }],
				},
			},
		});
		if (!round) return null;
		const judgeLoads = round.judges.map(judge => {
			const assignments = round.assignments.filter(assignment => assignment.judgeId === judge.id);
			const visits = [
				...new Map(assignments.map(assignment => [assignment.projectId, assignment.project])).values(),
			]
				.sort(
					(a, b) =>
						a.room.localeCompare(b.room) || a.tableNumber - b.tableNumber || a.name.localeCompare(b.name),
				)
				.map(project => ({
					projectId: project.id,
					tableNumber: project.tableNumber,
					room: project.room,
					name: project.name,
				}));
			return {
				id: judge.id,
				name: judge.name,
				email: judge.email,
				expertise: jsonStringArray(judge.expertise),
				exclusions: jsonStringArray(judge.exclusions),
				projects: visits.length,
				scopes: assignments.length,
				expertScopes: assignments.filter(assignment => assignment.expertiseMatch).length,
				fallbackScopes: assignments.filter(assignment => !assignment.isMain && !assignment.expertiseMatch)
					.length,
				rooms: [...new Set(visits.map(visit => visit.room))],
				route: visits,
				complete: assignments.filter(assignment =>
					isAssignmentComplete(
						assignment,
						round.projects
							.find(project => project.id === assignment.projectId)
							?.categories.find(category => category.code === assignment.categoryCode)
							?.eligibilityResolution,
					),
				).length,
				lastSyncAt: judge.lastSyncAt,
			};
		});
		const coverage = round.projects.flatMap(project => {
			const categoryCodes = [
				...(project.mainTrack === "CGI" ? [] : [project.mainTrack]),
				...project.categories.map(category => category.code),
			];
			return categoryCodes.map(categoryCode => {
				const assignments = round.assignments.filter(
					assignment => assignment.projectId === project.id && assignment.categoryCode === categoryCode,
				);
				return {
					projectId: project.id,
					projectName: project.name,
					tableNumber: project.tableNumber,
					room: project.room,
					categoryCode,
					count: assignments.length,
					judgeIds: assignments.map(assignment => assignment.judgeId),
				};
			});
		});
		const categoryCohorts = [...new Set(coverage.map(item => item.categoryCode))].sort().map(categoryCode => {
			const assignments = round.assignments.filter(assignment => assignment.categoryCode === categoryCode);
			const sharedProjects = new Set(
				coverage
					.filter(item => item.categoryCode === categoryCode && item.count > 1)
					.map(item => item.projectId),
			);
			return {
				categoryCode,
				judgeIds: [...new Set(assignments.map(assignment => assignment.judgeId))],
				projectCount: coverage.filter(item => item.categoryCode === categoryCode).length,
				assignmentCount: assignments.length,
				sharedProjectCount: sharedProjects.size,
				insufficientOverlap:
					new Set(assignments.map(assignment => assignment.judgeId)).size > 1 && sharedProjects.size === 0,
			};
		});
		return {
			...round,
			judgeLoads,
			coverage,
			categoryCohorts,
			generationWarningList: jsonStringArray(round.generationWarnings),
		};
	}),

	regenerateDraft: adminProcedure.input(versionedRoundIdInput).mutation(async ({ ctx, input }) => {
		const round = await ctx.prisma.judgingRound.findUnique({
			where: { id: input.roundId },
			include: { projects: { include: { categories: true } }, judges: true },
		});
		if (!round) throw new TRPCError({ code: "NOT_FOUND" });
		if (round.state !== "DRAFT")
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Only a draft round can be regenerated.",
			});
		const projects: ImportedJudgingProject[] = round.projects.map(project => ({
			externalId: project.externalId,
			name: project.name,
			tableNumber: project.tableNumber,
			room: project.room,
			devpostUrl: project.devpostUrl,
			mainTrack: project.mainTrack,
			categories: project.categories.map(category => category.code).filter(isMiniCategoryCode),
		}));
		const judges: ImportedJudge[] = round.judges.map(judge => ({
			name: judge.name,
			email: judge.email,
			expertise: jsonStringArray(judge.expertise).filter(isMiniCategoryCode),
			exclusions: jsonStringArray(judge.exclusions).filter(isJudgingCategoryCode),
		}));
		const generation = generateJudgingAssignments(projects, judges, round.preferredProjectLimit);
		if (generation.errors.length)
			throw new TRPCError({ code: "PRECONDITION_FAILED", message: generation.errors.join("\n") });
		const projectIds = new Map(round.projects.map(project => [project.externalId, project.id]));
		const judgeIds = new Map(round.judges.map(judge => [judge.email, judge.id]));
		return ctx.prisma.$transaction(
			async transaction => {
				await claimAssignmentVersion(transaction, round.id, input.expectedAssignmentVersion);
				await transaction.judgingRanking.deleteMany({ where: { roundId: round.id } });
				await transaction.judgingSyncReceipt.deleteMany({ where: { roundId: round.id } });
				await transaction.judgingAssignment.deleteMany({ where: { roundId: round.id } });
				for (const assignment of generation.assignments) {
					const projectId = projectIds.get(assignment.projectExternalId);
					const judgeId = judgeIds.get(assignment.judgeEmail);
					if (!projectId || !judgeId) throw new Error("Generated assignment references an unknown record");
					await transaction.judgingAssignment.create({
						data: {
							roundId: round.id,
							projectId,
							judgeId,
							categoryCode: assignment.categoryCode,
							isMain: assignment.isMain,
							expertiseMatch: assignment.expertiseMatch,
							calibrationAnchor: assignment.calibrationAnchor,
							assignmentReason: assignment.reason,
							fieldTimestamps: {},
							fieldOperationIds: {},
						},
					});
				}
				const updated = await transaction.judgingRound.update({
					where: { id: round.id },
					data: {
						effectiveProjectLimit: generation.effectiveProjectLimit,
						generationWarnings: generation.warnings,
						overloadApprovedAt: null,
					},
				});
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "judging.assignments.regenerated",
						outcome: "regenerated",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "judging_round", id: round.id },
						data: {
							assignmentCount: generation.assignments.length,
							effectiveProjectLimit: generation.effectiveProjectLimit,
						},
					}),
				);
				return { round: updated, generation };
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
		);
	}),

	approveOverload: adminProcedure.input(versionedRoundIdInput).mutation(async ({ ctx, input }) =>
		ctx.prisma.$transaction(async transaction => {
			const current = await transaction.judgingRound.findUnique({ where: { id: input.roundId } });
			if (!current) throw new TRPCError({ code: "NOT_FOUND" });
			requireRoundState(current, "DRAFT");
			if (current.effectiveProjectLimit <= current.preferredProjectLimit)
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "This proposal does not exceed the preferred workload limit.",
				});
			const approved = await transaction.judgingRound.updateMany({
				where: { id: input.roundId, assignmentVersion: input.expectedAssignmentVersion },
				data: { overloadApprovedAt: new Date() },
			});
			if (approved.count !== 1)
				throw new TRPCError({
					code: "CONFLICT",
					message: "Assignments changed in another administrator session. Refresh and try again.",
				});
			const round = await transaction.judgingRound.findUniqueOrThrow({ where: { id: input.roundId } });
			await persistAuditEvent(
				transaction,
				createAuditEvent({
					name: "judging.workload.approved",
					outcome: "approved",
					actor: { type: "organizer", id: ctx.organizer.id },
					resource: { type: "judging_round", id: round.id },
					data: { effectiveProjectLimit: round.effectiveProjectLimit },
				}),
			);
			return round;
		}),
	),

	publish: adminProcedure.input(versionedRoundIdInput).mutation(async ({ ctx, input }) => {
		const round = await ctx.prisma.judgingRound.findUnique({
			where: { id: input.roundId },
			include: { assignments: true, projects: { include: { categories: true } } },
		});
		if (!round) throw new TRPCError({ code: "NOT_FOUND" });
		requireRoundState(round, "DRAFT");
		const otherOpenRound = await ctx.prisma.judgingRound.findFirst({
			where: { state: "OPEN", id: { not: round.id } },
			select: { id: true },
		});
		if (otherOpenRound)
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Lock the currently open judging round before publishing another.",
			});
		if (round.effectiveProjectLimit > round.preferredProjectLimit && !round.overloadApprovedAt)
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Approve the workload above 15 before publishing.",
			});
		if (round.assignments.length === 0)
			throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Generate assignments before publishing." });
		const coverage = new Set(
			round.assignments.map(assignment => `${assignment.projectId}:${assignment.categoryCode}`),
		);
		const missing = round.projects
			.flatMap(project => [
				...(project.mainTrack === "CGI" ? [] : [`${project.id}:${project.mainTrack}`]),
				...project.categories.map(category => `${project.id}:${category.code}`),
			])
			.filter(key => !coverage.has(key));
		if (missing.length)
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: `${missing.length} required project/category assignments are uncovered.`,
			});
		return ctx.prisma.$transaction(async transaction => {
			await claimAssignmentVersion(transaction, round.id, input.expectedAssignmentVersion);
			const updated = await transaction.judgingRound.update({
				where: { id: round.id },
				data: {
					state: "OPEN",
					assignmentsPublishedAt: new Date(),
					openedAt: new Date(),
				},
			});
			await persistAuditEvent(
				transaction,
				createAuditEvent({
					name: "judging.round.published",
					outcome: "opened",
					actor: { type: "organizer", id: ctx.organizer.id },
					resource: { type: "judging_round", id: round.id },
					data: { assignmentCount: round.assignments.length },
				}),
			);
			return updated;
		});
	}),

	lock: adminProcedure
		.input(
			z.object({
				roundId: z.string().min(1).max(191),
				expectedAssignmentVersion: z.number().int().nonnegative(),
				force: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const round = await ctx.prisma.judgingRound.findUnique({
				where: { id: input.roundId },
				include: {
					assignments: true,
					rankings: true,
					judges: true,
					projects: { include: { categories: true } },
				},
			});
			if (!round) throw new TRPCError({ code: "NOT_FOUND" });
			requireRoundState(round, "OPEN");
			const resolutionFor = (assignment: (typeof round.assignments)[number]) =>
				round.projects
					.find(project => project.id === assignment.projectId)
					?.categories.find(category => category.code === assignment.categoryCode)?.eligibilityResolution;
			const incomplete = round.assignments.filter(
				assignment => !isAssignmentComplete(assignment, resolutionFor(assignment)),
			).length;
			if (incomplete && !input.force)
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: `${incomplete} synchronized assessments are incomplete.`,
				});
			const unresolvedEligibility = round.projects.flatMap(project =>
				project.categories.filter(category => {
					if (category.eligibilityResolution) return false;
					const opinions = new Set(
						round.assignments
							.filter(
								assignment =>
									assignment.projectId === project.id &&
									assignment.categoryCode === category.code &&
									!assignment.recusedAt,
							)
							.map(assignment => assignment.miniEligibility)
							.filter(Boolean),
					);
					return opinions.has("UNSURE") || opinions.size > 1;
				}),
			).length;
			if (unresolvedEligibility && !input.force)
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: `${unresolvedEligibility} eligibility decisions still require administrator resolution.`,
				});
			let incompleteRankings = 0;
			for (const judge of round.judges) {
				const assignments = round.assignments.filter(assignment => assignment.judgeId === judge.id);
				for (const categoryCode of new Set(assignments.map(assignment => assignment.categoryCode))) {
					const projectResolution = (projectId: string) =>
						round.projects
							.find(project => project.id === projectId)
							?.categories.find(category => category.code === categoryCode)?.eligibilityResolution;
					const eligibleProjects = assignments
						.filter(
							assignment =>
								assignment.categoryCode === categoryCode &&
								!assignment.recusedAt &&
								assignment.completedAt &&
								(assignment.isMain ||
									((assignment.miniEligibility === "ELIGIBLE" ||
										projectResolution(assignment.projectId) === "ELIGIBLE") &&
										assignment.miniScore !== null &&
										projectResolution(assignment.projectId) !== "INELIGIBLE")),
						)
						.map(assignment => assignment.projectId);
					if (eligibleProjects.length <= 1) continue;
					const ranking = round.rankings.filter(
						item => item.judgeId === judge.id && item.categoryCode === categoryCode && item.confirmedAt,
					);
					if (
						ranking.length !== eligibleProjects.length ||
						ranking.some(item => !eligibleProjects.includes(item.projectId))
					)
						incompleteRankings += 1;
				}
			}
			if (incompleteRankings && !input.force)
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: `${incompleteRankings} synchronized category rankings are incomplete or stale.`,
				});
			return ctx.prisma.$transaction(async transaction => {
				const locked = await transaction.judgingRound.updateMany({
					where: {
						id: round.id,
						state: "OPEN",
						assignmentVersion: input.expectedAssignmentVersion,
					},
					data: { state: "LOCKED", lockedAt: new Date() },
				});
				if (locked.count !== 1)
					throw new TRPCError({
						code: "CONFLICT",
						message:
							"Judging state or assignments changed in another administrator session. Refresh and try again.",
					});
				const updated = await transaction.judgingRound.findUniqueOrThrow({ where: { id: round.id } });
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "judging.round.locked",
						outcome: input.force ? "force_locked" : "locked",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "judging_round", id: round.id },
						data: { incompleteAssessments: incomplete, incompleteRankings, unresolvedEligibility },
					}),
				);
				return updated;
			});
		}),

	reopen: adminProcedure.input(roundIdInput).mutation(async ({ ctx, input }) =>
		ctx.prisma.$transaction(async transaction => {
			const current = await transaction.judgingRound.findUnique({ where: { id: input.roundId } });
			if (!current) throw new TRPCError({ code: "NOT_FOUND" });
			requireRoundState(current, "LOCKED");
			const round = await transaction.judgingRound.update({
				where: { id: input.roundId },
				data: { state: "OPEN", lockedAt: null },
			});
			await persistAuditEvent(
				transaction,
				createAuditEvent({
					name: "judging.round.reopened",
					outcome: "reopened",
					actor: { type: "organizer", id: ctx.organizer.id },
					resource: { type: "judging_round", id: round.id },
					data: {},
				}),
			);
			return round;
		}),
	),

	acceptRecusal: adminProcedure
		.input(z.object({ assignmentId: z.string().min(1).max(191) }))
		.mutation(async ({ ctx, input }) =>
			ctx.prisma.$transaction(async transaction => {
				const assignment = await transaction.judgingAssignment.findUnique({
					where: { id: input.assignmentId },
					include: { round: true },
				});
				if (!assignment?.recusedAt || !assignment.recusalReason?.trim())
					throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A reasoned recusal is required." });
				requireRoundState(assignment.round, "OPEN");
				const updated = await transaction.judgingAssignment.update({
					where: { id: assignment.id },
					data: { recusalAcceptedAt: new Date(), completedAt: new Date() },
				});
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "judging.assignment.changed",
						outcome: "recusal_accepted",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "judging_assignment", id: assignment.id },
						data: {},
					}),
				);
				return updated;
			}),
		),

	resolveEligibility: adminProcedure
		.input(
			z.object({
				projectId: z.string().min(1).max(191),
				categoryCode: z.string().refine(isJudgingCategoryCode),
				resolution: z.enum(["ELIGIBLE", "INELIGIBLE"]),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			ctx.prisma.$transaction(async transaction => {
				const category = await transaction.judgingProjectCategory.findUnique({
					where: { projectId_code: { projectId: input.projectId, code: input.categoryCode } },
					include: { project: { include: { round: true } } },
				});
				if (!category) throw new TRPCError({ code: "NOT_FOUND" });
				requireRoundState(category.project.round, "OPEN");
				const updated = await transaction.judgingProjectCategory.update({
					where: { id: category.id },
					data: {
						eligibilityResolution: input.resolution,
						eligibilityResolvedById: ctx.organizer.id,
						eligibilityResolvedAt: new Date(),
					},
				});
				const affectedAssignments = await transaction.judgingAssignment.findMany({
					where: { projectId: input.projectId, categoryCode: input.categoryCode },
				});
				await Promise.all(
					affectedAssignments.map(assignment =>
						transaction.judgingAssignment.update({
							where: { id: assignment.id },
							data: {
								completedAt: isAssignmentComplete(assignment, input.resolution) ? new Date() : null,
							},
						}),
					),
				);
				await invalidateRankings(
					transaction,
					affectedAssignments.map(assignment => ({
						judgeId: assignment.judgeId,
						categoryCode: input.categoryCode,
					})),
				);
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "judging.eligibility.resolved",
						outcome: input.resolution === "ELIGIBLE" ? "eligible" : "ineligible",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "judging_project", id: input.projectId },
						data: { categoryCode: input.categoryCode },
					}),
				);
				return updated;
			}),
		),

	moveAssignment: adminProcedure
		.input(
			z.object({
				assignmentId: z.string().min(1).max(191),
				targetJudgeId: z.string().min(1).max(191),
				expectedAssignmentVersion: z.number().int().nonnegative(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const assignment = await ctx.prisma.judgingAssignment.findUnique({
				where: { id: input.assignmentId },
				include: { project: true },
			});
			const judge = await ctx.prisma.judgingJudge.findUnique({ where: { id: input.targetJudgeId } });
			if (!assignment || !judge || assignment.roundId !== judge.roundId)
				throw new TRPCError({ code: "NOT_FOUND" });
			if (assignment.judgeId === judge.id) return assignment;
			if (jsonStringArray(judge.exclusions).includes(assignment.categoryCode))
				throw new TRPCError({ code: "BAD_REQUEST", message: "This judge is excluded from that category." });
			const duplicate = await ctx.prisma.judgingAssignment.findFirst({
				where: {
					judgeId: judge.id,
					projectId: assignment.projectId,
					categoryCode: assignment.categoryCode,
				},
				select: { id: true },
			});
			if (duplicate)
				throw new TRPCError({ code: "CONFLICT", message: "This judge already has that scoring scope." });
			const projectCount = await ctx.prisma.judgingAssignment
				.findMany({ where: { judgeId: judge.id }, select: { projectId: true } })
				.then(rows => new Set(rows.map(row => row.projectId)).size);
			const alreadyVisits = await ctx.prisma.judgingAssignment.count({
				where: { judgeId: judge.id, projectId: assignment.projectId },
			});
			const round = await ctx.prisma.judgingRound.findUniqueOrThrow({ where: { id: judge.roundId } });
			requireMutableAssignments(round);
			if (!alreadyVisits && projectCount >= round.effectiveProjectLimit)
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "This move would exceed the approved project limit.",
				});
			return ctx.prisma.$transaction(async transaction => {
				await claimAssignmentVersion(transaction, assignment.roundId, input.expectedAssignmentVersion);
				const moved = await transaction.judgingAssignment.update({
					where: { id: assignment.id },
					data: resetAssignmentForJudge(judge, assignment, "manual scope reassignment"),
				});
				await invalidateRankings(transaction, [
					{ judgeId: assignment.judgeId, categoryCode: assignment.categoryCode },
					{ judgeId: judge.id, categoryCode: assignment.categoryCode },
				]);
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "judging.assignment.changed",
						outcome: "moved",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "judging_assignment", id: assignment.id },
						data: { assignmentVersionChanged: true },
					}),
				);
				return moved;
			});
		}),

	moveProjectVisit: adminProcedure
		.input(
			z.object({
				roundId: z.string().min(1).max(191),
				projectId: z.string().min(1).max(191),
				sourceJudgeId: z.string().min(1).max(191),
				targetJudgeId: z.string().min(1).max(191),
				expectedAssignmentVersion: z.number().int().nonnegative(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (input.sourceJudgeId === input.targetJudgeId)
				throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a different target judge." });
			const [round, sourceAssignments, targetJudge, targetAssignments] = await Promise.all([
				ctx.prisma.judgingRound.findUnique({ where: { id: input.roundId } }),
				ctx.prisma.judgingAssignment.findMany({
					where: {
						roundId: input.roundId,
						projectId: input.projectId,
						judgeId: input.sourceJudgeId,
					},
				}),
				ctx.prisma.judgingJudge.findFirst({
					where: { id: input.targetJudgeId, roundId: input.roundId },
				}),
				ctx.prisma.judgingAssignment.findMany({
					where: { judgeId: input.targetJudgeId },
					select: { projectId: true, categoryCode: true },
				}),
			]);
			if (!round || !targetJudge || sourceAssignments.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
			requireMutableAssignments(round);
			const exclusions = jsonStringArray(targetJudge.exclusions);
			if (sourceAssignments.some(assignment => exclusions.includes(assignment.categoryCode)))
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "The target judge is excluded from at least one scope in this project visit.",
				});
			const targetCategories = new Set(
				targetAssignments
					.filter(assignment => assignment.projectId === input.projectId)
					.map(assignment => assignment.categoryCode),
			);
			if (sourceAssignments.some(assignment => targetCategories.has(assignment.categoryCode)))
				throw new TRPCError({
					code: "CONFLICT",
					message: "The target judge already has one of this visit's scoring scopes.",
				});
			const targetProjects = new Set(targetAssignments.map(assignment => assignment.projectId));
			if (!targetProjects.has(input.projectId) && targetProjects.size >= round.effectiveProjectLimit)
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "This move would exceed the approved project limit.",
				});
			return ctx.prisma.$transaction(async transaction => {
				await claimAssignmentVersion(transaction, round.id, input.expectedAssignmentVersion);
				for (const assignment of sourceAssignments) {
					await transaction.judgingAssignment.update({
						where: { id: assignment.id },
						data: resetAssignmentForJudge(targetJudge, assignment, "manual project visit reassignment"),
					});
				}
				await invalidateRankings(
					transaction,
					sourceAssignments.flatMap(assignment => [
						{ judgeId: input.sourceJudgeId, categoryCode: assignment.categoryCode },
						{ judgeId: input.targetJudgeId, categoryCode: assignment.categoryCode },
					]),
				);
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "judging.assignment.changed",
						outcome: "project_visit_moved",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "judging_project", id: input.projectId },
						data: {
							sourceJudgeId: input.sourceJudgeId,
							targetJudgeId: input.targetJudgeId,
							scopeCount: sourceAssignments.length,
						},
					}),
				);
				return { moved: sourceAssignments.length };
			});
		}),

	swapAssignments: adminProcedure
		.input(
			z.object({
				firstAssignmentId: z.string().min(1).max(191),
				secondAssignmentId: z.string().min(1).max(191),
				expectedAssignmentVersion: z.number().int().nonnegative(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (input.firstAssignmentId === input.secondAssignmentId)
				throw new TRPCError({ code: "BAD_REQUEST", message: "Choose two different assignments." });
			const [first, second] = await Promise.all([
				ctx.prisma.judgingAssignment.findUnique({ where: { id: input.firstAssignmentId } }),
				ctx.prisma.judgingAssignment.findUnique({ where: { id: input.secondAssignmentId } }),
			]);
			if (!first || !second || first.roundId !== second.roundId) throw new TRPCError({ code: "NOT_FOUND" });
			if (first.judgeId === second.judgeId)
				throw new TRPCError({ code: "BAD_REQUEST", message: "Assignments must belong to different judges." });
			if (first.projectId === second.projectId && first.categoryCode === second.categoryCode)
				throw new TRPCError({ code: "BAD_REQUEST", message: "Swapping identical scopes has no effect." });
			const [round, firstJudge, secondJudge, judgeAssignments, conflict] = await Promise.all([
				ctx.prisma.judgingRound.findUnique({ where: { id: first.roundId } }),
				ctx.prisma.judgingJudge.findUnique({ where: { id: first.judgeId } }),
				ctx.prisma.judgingJudge.findUnique({ where: { id: second.judgeId } }),
				ctx.prisma.judgingAssignment.findMany({
					where: { judgeId: { in: [first.judgeId, second.judgeId] } },
					select: { id: true, judgeId: true, projectId: true },
				}),
				ctx.prisma.judgingAssignment.findFirst({
					where: {
						id: { notIn: [first.id, second.id] },
						OR: [
							{
								judgeId: second.judgeId,
								projectId: first.projectId,
								categoryCode: first.categoryCode,
							},
							{
								judgeId: first.judgeId,
								projectId: second.projectId,
								categoryCode: second.categoryCode,
							},
						],
					},
					select: { id: true },
				}),
			]);
			if (!round || !firstJudge || !secondJudge) throw new TRPCError({ code: "NOT_FOUND" });
			requireMutableAssignments(round);
			if (conflict)
				throw new TRPCError({ code: "CONFLICT", message: "This swap would create a duplicate scoring scope." });
			if (
				jsonStringArray(secondJudge.exclusions).includes(first.categoryCode) ||
				jsonStringArray(firstJudge.exclusions).includes(second.categoryCode)
			)
				throw new TRPCError({ code: "BAD_REQUEST", message: "An exclusion prevents this swap." });
			const firstProjects = new Set(
				judgeAssignments
					.filter(assignment => assignment.judgeId === firstJudge.id && assignment.id !== first.id)
					.map(assignment => assignment.projectId),
			);
			firstProjects.add(second.projectId);
			const secondProjects = new Set(
				judgeAssignments
					.filter(assignment => assignment.judgeId === secondJudge.id && assignment.id !== second.id)
					.map(assignment => assignment.projectId),
			);
			secondProjects.add(first.projectId);
			if (firstProjects.size > round.effectiveProjectLimit || secondProjects.size > round.effectiveProjectLimit)
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "This swap would exceed the approved project limit.",
				});
			return ctx.prisma.$transaction(async transaction => {
				await claimAssignmentVersion(transaction, round.id, input.expectedAssignmentVersion);
				await transaction.judgingAssignment.update({
					where: { id: first.id },
					data: resetAssignmentForJudge(secondJudge, first, "manual assignment swap"),
				});
				await transaction.judgingAssignment.update({
					where: { id: second.id },
					data: resetAssignmentForJudge(firstJudge, second, "manual assignment swap"),
				});
				await invalidateRankings(transaction, [
					{ judgeId: firstJudge.id, categoryCode: first.categoryCode },
					{ judgeId: firstJudge.id, categoryCode: second.categoryCode },
					{ judgeId: secondJudge.id, categoryCode: first.categoryCode },
					{ judgeId: secondJudge.id, categoryCode: second.categoryCode },
				]);
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "judging.assignment.changed",
						outcome: "swapped",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "judging_round", id: round.id },
						data: { firstAssignmentId: first.id, secondAssignmentId: second.id },
					}),
				);
				return { swapped: [first.id, second.id] };
			});
		}),

	addOptionalAssignment: adminProcedure
		.input(
			z.object({
				roundId: z.string().min(1).max(191),
				projectId: z.string().min(1).max(191),
				categoryCode: z.string().refine(isJudgingCategoryCode),
				judgeId: z.string().min(1).max(191),
				calibrationAnchor: z.boolean().default(false),
				expectedAssignmentVersion: z.number().int().nonnegative(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [round, project, judge, existing] = await Promise.all([
				ctx.prisma.judgingRound.findUnique({ where: { id: input.roundId } }),
				ctx.prisma.judgingProject.findUnique({ where: { id: input.projectId }, include: { categories: true } }),
				ctx.prisma.judgingJudge.findUnique({ where: { id: input.judgeId } }),
				ctx.prisma.judgingAssignment.findMany({
					where: { projectId: input.projectId, categoryCode: input.categoryCode },
				}),
			]);
			if (!round || !project || !judge || project.roundId !== round.id || judge.roundId !== round.id)
				throw new TRPCError({ code: "NOT_FOUND" });
			requireMutableAssignments(round);
			const isMain = project.mainTrack !== "CGI" && input.categoryCode === project.mainTrack;
			if (!isMain && !project.categories.some(category => category.code === input.categoryCode))
				throw new TRPCError({ code: "BAD_REQUEST", message: "The project is not entered in this category." });
			if (existing.length >= 3)
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "A category cannot have more than three assessments.",
				});
			if (existing.some(assignment => assignment.judgeId === judge.id))
				throw new TRPCError({ code: "CONFLICT", message: "This judge already has that scoring scope." });
			if (jsonStringArray(judge.exclusions).includes(input.categoryCode))
				throw new TRPCError({ code: "BAD_REQUEST", message: "This judge is excluded from that category." });
			const visits = await ctx.prisma.judgingAssignment.findMany({
				where: { judgeId: judge.id },
				select: { projectId: true },
			});
			if (
				!visits.some(visit => visit.projectId === project.id) &&
				new Set(visits.map(visit => visit.projectId)).size >= round.effectiveProjectLimit
			)
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "This assignment would exceed the approved project limit.",
				});
			return ctx.prisma.$transaction(async transaction => {
				await claimAssignmentVersion(transaction, round.id, input.expectedAssignmentVersion);
				const created = await transaction.judgingAssignment.create({
					data: {
						roundId: round.id,
						projectId: project.id,
						judgeId: judge.id,
						categoryCode: input.categoryCode,
						isMain,
						expertiseMatch: !isMain && jsonStringArray(judge.expertise).includes(input.categoryCode),
						calibrationAnchor: input.calibrationAnchor,
						assignmentReason: input.calibrationAnchor
							? "manual calibration anchor"
							: "manual optional coverage",
						fieldTimestamps: {},
						fieldOperationIds: {},
					},
				});
				await invalidateRankings(transaction, [{ judgeId: judge.id, categoryCode: input.categoryCode }]);
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "judging.assignment.changed",
						outcome: "added",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "judging_assignment", id: created.id },
						data: { calibrationAnchor: input.calibrationAnchor },
					}),
				);
				return created;
			});
		}),

	removeOptionalAssignment: adminProcedure
		.input(
			z.object({
				assignmentId: z.string().min(1).max(191),
				expectedAssignmentVersion: z.number().int().nonnegative(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const assignment = await ctx.prisma.judgingAssignment.findUnique({ where: { id: input.assignmentId } });
			if (!assignment) throw new TRPCError({ code: "NOT_FOUND" });
			const round = await ctx.prisma.judgingRound.findUniqueOrThrow({ where: { id: assignment.roundId } });
			requireMutableAssignments(round);
			const coverage = await ctx.prisma.judgingAssignment.count({
				where: { projectId: assignment.projectId, categoryCode: assignment.categoryCode },
			});
			if (coverage <= 1)
				throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Baseline coverage cannot be removed." });
			return ctx.prisma.$transaction(async transaction => {
				await claimAssignmentVersion(transaction, assignment.roundId, input.expectedAssignmentVersion);
				await transaction.judgingAssignment.delete({ where: { id: assignment.id } });
				await invalidateRankings(transaction, [
					{ judgeId: assignment.judgeId, categoryCode: assignment.categoryCode },
				]);
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "judging.assignment.changed",
						outcome: "removed",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "judging_assignment", id: assignment.id },
						data: {},
					}),
				);
				return { removed: assignment.id };
			});
		}),

	manifest: judgeProcedure.query(async ({ ctx }) => buildManifest(ctx.prisma, ctx.judge.id)),

	sync: judgeProcedure.input(syncInput).mutation(async ({ ctx, input }) => {
		if (input.roundId !== ctx.judge.roundId) throw new TRPCError({ code: "FORBIDDEN" });
		const now = new Date();
		const summary = await ctx.prisma.$transaction(
			async transaction => {
				const round = await transaction.judgingRound.findUnique({ where: { id: input.roundId } });
				if (!round) throw new TRPCError({ code: "NOT_FOUND" });
				if (round.state === "LOCKED") {
					return {
						locked: true,
						discarded: [],
						applied: [],
						supersededFields: [],
					};
				}
				const discarded: string[] = [];
				const applied: string[] = [];
				const supersededFields: Array<{ assignmentId: string; field: string }> = [];
				let newlyProcessedCount = 0;

				for (const patch of input.assignments) {
					const clientTimestamps = { editedAt: patch.editedAt, fieldEditedAt: patch.fieldEditedAt };
					const existingReceipt = await transaction.judgingSyncReceipt.findUnique({
						where: { operationId: patch.operationId },
					});
					if (existingReceipt) {
						if (existingReceipt.judgeId !== ctx.judge.id || existingReceipt.roundId !== input.roundId)
							throw new TRPCError({
								code: "CONFLICT",
								message: "This synchronization operation ID was already used in another scope.",
							});
						(existingReceipt.discarded ? discarded : applied).push(patch.operationId);
						continue;
					}
					const assignment = await transaction.judgingAssignment.findFirst({
						where: { id: patch.assignmentId, judgeId: ctx.judge.id, roundId: input.roundId },
						include: {
							project: {
								select: {
									categories: {
										select: { code: true, eligibilityResolution: true },
									},
								},
							},
						},
					});
					if (!assignment) {
						discarded.push(patch.operationId);
						await transaction.judgingSyncReceipt.create({
							data: {
								operationId: patch.operationId,
								roundId: input.roundId,
								judgeId: ctx.judge.id,
								discarded: true,
								clientTimestamps,
							},
						});
						newlyProcessedCount += 1;
						continue;
					}
					const changedFields = Object.keys(patch.values);
					if (
						(assignment.isMain && changedFields.some(field => miniScoreFields.has(field))) ||
						(!assignment.isMain && changedFields.some(field => mainScoreFields.has(field)))
					)
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "The submitted fields do not belong to this scoring scope.",
						});
					const desiredMiniEligibility =
						patch.values.miniEligibility === undefined
							? assignment.miniEligibility
							: patch.values.miniEligibility;
					const eligibilityResolution = assignment.project.categories.find(
						category => category.code === assignment.categoryCode,
					)?.eligibilityResolution;
					if (
						patch.values.miniScore !== undefined &&
						patch.values.miniScore !== null &&
						desiredMiniEligibility !== "ELIGIBLE" &&
						eligibilityResolution !== "ELIGIBLE"
					)
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "A mini-category score requires an eligible disposition.",
						});
					const timestamps = timestampMap(assignment.fieldTimestamps);
					const operationIds = timestampMap(assignment.fieldOperationIds);
					const data: Record<string, unknown> = {};
					for (const [field, value] of Object.entries(patch.values)) {
						const incomingAt = clampJudgingEditTime(patch.fieldEditedAt[field] ?? patch.editedAt, now);
						const incomingOperationId = patch.fieldOperationIds[field] ?? patch.operationId;
						if (
							judgingFieldWriteWins(
								incomingAt,
								incomingOperationId,
								timestamps[field],
								operationIds[field],
							)
						) {
							data[field] = value;
							timestamps[field] = incomingAt.toISOString();
							operationIds[field] = incomingOperationId;
						} else supersededFields.push({ assignmentId: assignment.id, field });
					}
					if ("recusalReason" in data)
						data.recusedAt = data.recusalReason
							? clampJudgingEditTime(patch.fieldEditedAt.recusalReason ?? patch.editedAt, now)
							: null;
					if ("recusalReason" in data) data.recusalAcceptedAt = null;
					// The strict input schema restricts dynamic keys to JudgingAssignment fields.
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
					const projected = { ...assignment, ...data } as typeof assignment;
					data.completedAt = isAssignmentComplete(projected, eligibilityResolution) ? now : null;
					data.fieldTimestamps = timestamps;
					data.fieldOperationIds = operationIds;
					await transaction.judgingAssignment.update({
						where: { id: assignment.id },
						// The strict input schema restricts dynamic keys to JudgingAssignment fields.
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
						data: data as Prisma.JudgingAssignmentUncheckedUpdateInput,
					});
					if (Object.keys(data).some(field => rankingRelevantFields.has(field))) {
						await transaction.judgingRanking.updateMany({
							where: { judgeId: ctx.judge.id, categoryCode: assignment.categoryCode },
							data: { confirmedAt: null },
						});
					}
					await transaction.judgingSyncReceipt.create({
						data: {
							operationId: patch.operationId,
							roundId: input.roundId,
							judgeId: ctx.judge.id,
							clientTimestamps,
						},
					});
					applied.push(patch.operationId);
					newlyProcessedCount += 1;
				}

				for (const ranking of input.rankings) {
					const clientTimestamps = { editedAt: ranking.editedAt };
					const receipt = await transaction.judgingSyncReceipt.findUnique({
						where: { operationId: ranking.operationId },
					});
					if (receipt) {
						if (receipt.judgeId !== ctx.judge.id || receipt.roundId !== input.roundId)
							throw new TRPCError({
								code: "CONFLICT",
								message: "This synchronization operation ID was already used in another scope.",
							});
						(receipt.discarded ? discarded : applied).push(ranking.operationId);
						continue;
					}
					const editedAt = clampJudgingEditTime(ranking.editedAt, now);
					const current = await transaction.judgingRanking.findFirst({
						where: { judgeId: ctx.judge.id, categoryCode: ranking.categoryCode },
						orderBy: { editedAt: "desc" },
					});
					if (
						!current ||
						editedAt.getTime() > current.editedAt.getTime() ||
						(editedAt.getTime() === current.editedAt.getTime() &&
							ranking.operationId.localeCompare(current.operationId) > 0)
					) {
						const categoryAssignments = await transaction.judgingAssignment.findMany({
							where: { judgeId: ctx.judge.id, categoryCode: ranking.categoryCode, recusedAt: null },
							select: {
								projectId: true,
								isMain: true,
								miniEligibility: true,
								miniScore: true,
								completedAt: true,
								project: {
									select: {
										categories: {
											where: { code: ranking.categoryCode },
											select: { eligibilityResolution: true },
										},
									},
								},
							},
						});
						const validIds = new Set(
							categoryAssignments
								.filter(
									item =>
										item.completedAt &&
										item.project.categories[0]?.eligibilityResolution !== "INELIGIBLE" &&
										(item.isMain ||
											isMiniAssessmentEligibleForRanking({
												eligibility: item.miniEligibility,
												score: item.miniScore,
												resolution: item.project.categories[0]?.eligibilityResolution,
											})),
								)
								.map(item => item.projectId),
						);
						if (
							new Set(ranking.projectIds).size !== ranking.projectIds.length ||
							ranking.projectIds.length !== validIds.size ||
							ranking.projectIds.some(projectId => !validIds.has(projectId))
						) {
							discarded.push(ranking.operationId);
							await transaction.judgingSyncReceipt.create({
								data: {
									operationId: ranking.operationId,
									roundId: input.roundId,
									judgeId: ctx.judge.id,
									discarded: true,
									clientTimestamps,
								},
							});
							newlyProcessedCount += 1;
							continue;
						}
						await transaction.judgingRanking.deleteMany({
							where: { judgeId: ctx.judge.id, categoryCode: ranking.categoryCode },
						});
						for (const [rank, projectId] of ranking.projectIds.entries()) {
							await transaction.judgingRanking.create({
								data: {
									roundId: input.roundId,
									judgeId: ctx.judge.id,
									projectId,
									categoryCode: ranking.categoryCode,
									rank,
									editedAt,
									operationId: ranking.operationId,
									confirmedAt: now,
								},
							});
						}
					} else supersededFields.push({ assignmentId: `ranking:${ranking.categoryCode}`, field: "order" });
					await transaction.judgingSyncReceipt.create({
						data: {
							operationId: ranking.operationId,
							roundId: input.roundId,
							judgeId: ctx.judge.id,
							clientTimestamps,
						},
					});
					applied.push(ranking.operationId);
					newlyProcessedCount += 1;
				}
				await transaction.judgingJudge.update({ where: { id: ctx.judge.id }, data: { lastSyncAt: now } });
				if (newlyProcessedCount > 0)
					await persistAuditEvent(
						transaction,
						createAuditEvent({
							name: "judging.sync.applied",
							outcome: discarded.length ? "discarded" : "applied",
							actor: { type: "judge", id: ctx.judge.id },
							resource: { type: "judging_round", id: round.id },
							data: {
								appliedCount: applied.length,
								discardedCount: discarded.length,
								supersededFieldCount: supersededFields.length,
							},
						}),
					);
				return { locked: false, discarded, applied, supersededFields };
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
		);
		return { ...summary, manifest: await buildManifest(ctx.prisma, ctx.judge.id) };
	}),

	results: adminProcedure.input(roundIdInput).query(async ({ ctx, input }) => {
		const [assignments, projects, rankings] = await Promise.all([
			ctx.prisma.judgingAssignment.findMany({
				where: { roundId: input.roundId, recusedAt: null },
				include: { project: true, judge: true },
			}),
			ctx.prisma.judgingProject.findMany({ where: { roundId: input.roundId }, include: { categories: true } }),
			ctx.prisma.judgingRanking.findMany({ where: { roundId: input.roundId, confirmedAt: { not: null } } }),
		]);
		const resolutionFor = (assignment: (typeof assignments)[number]) =>
			projects
				.find(project => project.id === assignment.projectId)
				?.categories.find(category => category.code === assignment.categoryCode)?.eligibilityResolution;
		const assessments = assignments.map(assignment => ({
			projectId: assignment.projectId,
			projectName: assignment.project.name,
			tableNumber: assignment.project.tableNumber,
			categoryCode: assignment.categoryCode,
			judgeName: assignment.judge.name,
			mainTotal: assignment.isMain
				? mainScoreTotal(
						Object.fromEntries(
							[
								["technicalLevel", assignment.technicalLevel],
								["ideaLevel", assignment.ideaLevel],
								["designLevel", assignment.designLevel],
								["learningLevel", assignment.learningLevel],
								["presentationLevel", assignment.presentationLevel],
							].filter((entry): entry is [MainRubricKey, number] => typeof entry[1] === "number"),
						),
					)
				: null,
			miniEligibility: assignment.miniEligibility,
			miniScore: assignment.miniScore,
			complete: isAssignmentComplete(assignment, resolutionFor(assignment)),
		}));
		const numericForAssignment = (assignment: (typeof assignments)[number]) => {
			if (!isAssignmentComplete(assignment, resolutionFor(assignment))) return null;
			if (assignment.isMain)
				return mainScoreTotal({
					technicalLevel: assignment.technicalLevel ?? undefined,
					ideaLevel: assignment.ideaLevel ?? undefined,
					designLevel: assignment.designLevel ?? undefined,
					learningLevel: assignment.learningLevel ?? undefined,
					presentationLevel: assignment.presentationLevel ?? undefined,
				});
			return assignment.miniEligibility === "ELIGIBLE" || resolutionFor(assignment) === "ELIGIBLE"
				? assignment.miniScore
				: null;
		};
		const percentileByProject = new Map<string, number[]>();
		for (const grouped of Map.groupBy(rankings, ranking => `${ranking.judgeId}:${ranking.categoryCode}`).values()) {
			if (grouped.length <= 1) continue;
			const ordered = grouped.sort((a, b) => a.rank - b.rank);
			for (const [index, ranking] of ordered.entries()) {
				const key = `${ranking.projectId}:${ranking.categoryCode}`;
				const values = percentileByProject.get(key) ?? [];
				values.push(index / (ordered.length - 1));
				percentileByProject.set(key, values);
			}
		}
		const aggregates = projects.flatMap(project => {
			const categoryCodes = [
				...(project.mainTrack === "CGI" ? [] : [project.mainTrack]),
				...project.categories.map(category => category.code),
			];
			return categoryCodes.map(categoryCode => {
				const category = project.categories.find(item => item.code === categoryCode);
				const relevant = assignments.filter(
					assignment =>
						assignment.projectId === project.id &&
						assignment.categoryCode === categoryCode &&
						isAssignmentComplete(assignment, category?.eligibilityResolution),
				);
				const isMain = categoryCode === "GENERAL" || categoryCode === "CIVIC";
				const opinions = new Set(relevant.map(item => item.miniEligibility).filter(Boolean));
				const needsReview =
					!isMain && !category?.eligibilityResolution && (opinions.has("UNSURE") || opinions.size > 1);
				const included = isMain
					? relevant
					: relevant.filter(
							assignment =>
								category?.eligibilityResolution !== "INELIGIBLE" &&
								(assignment.miniEligibility === "ELIGIBLE" ||
									category?.eligibilityResolution === "ELIGIBLE") &&
								assignment.miniScore !== null &&
								(category?.eligibilityResolution === "ELIGIBLE" || !needsReview),
						);
				const numericValues = included
					.map(assignment =>
						isMain
							? mainScoreTotal({
									technicalLevel: assignment.technicalLevel ?? undefined,
									ideaLevel: assignment.ideaLevel ?? undefined,
									designLevel: assignment.designLevel ?? undefined,
									learningLevel: assignment.learningLevel ?? undefined,
									presentationLevel: assignment.presentationLevel ?? undefined,
								})
							: assignment.miniScore,
					)
					.filter((value): value is number => value !== null);
				const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
				const percentiles = percentileByProject.get(`${project.id}:${categoryCode}`) ?? [];
				const criterionMeans =
					isMain && included.length
						? {
								technical: average(
									included.map(item => pointsForLevel(completedLevel(item.technicalLevel), 15)),
								),
								idea: average(included.map(item => pointsForLevel(completedLevel(item.ideaLevel), 10))),
								design: average(
									included.map(item => pointsForLevel(completedLevel(item.designLevel), 10)),
								),
								learning: average(
									included.map(item => pointsForLevel(completedLevel(item.learningLevel), 5)),
								),
								presentation: average(
									included.map(item => pointsForLevel(completedLevel(item.presentationLevel), 5)),
								),
							}
						: null;
				return {
					projectId: project.id,
					projectName: project.name,
					tableNumber: project.tableNumber,
					mainTrack: project.mainTrack,
					categoryCode,
					numericAggregate: numericValues.length ? Number(average(numericValues).toFixed(2)) : null,
					ordinalPercentile: percentiles.length ? Number(average(percentiles).toFixed(4)) : null,
					includedAssessments: included.length,
					needsReview,
					criterionMeans,
				};
			});
		});
		const categoryCounts = Map.groupBy(aggregates, item => item.categoryCode);
		const unequalCategories = new Set(
			[...categoryCounts.entries()]
				.filter(
					([, items]) =>
						new Set(
							items.filter(item => item.numericAggregate !== null).map(item => item.includedAssessments),
						).size > 1,
				)
				.map(([categoryCode]) => categoryCode),
		);
		const rankedAggregates = [...categoryCounts.values()].flatMap(items => {
			const scored = items
				.filter(item => item.numericAggregate !== null)
				.sort((a, b) => {
					const numericDifference = (b.numericAggregate ?? 0) - (a.numericAggregate ?? 0);
					if (numericDifference !== 0) return numericDifference;
					if (a.ordinalPercentile !== null && b.ordinalPercentile !== null) {
						const ordinalDifference = b.ordinalPercentile - a.ordinalPercentile;
						if (ordinalDifference !== 0) return ordinalDifference;
					}
					return a.tableNumber - b.tableNumber || a.projectId.localeCompare(b.projectId);
				});
			return items.map(item => {
				const position = scored.findIndex(candidate => candidate.projectId === item.projectId);
				const tied = scored.some(
					candidate =>
						candidate.projectId !== item.projectId &&
						candidate.numericAggregate === item.numericAggregate &&
						(candidate.ordinalPercentile === null ||
							item.ordinalPercentile === null ||
							candidate.ordinalPercentile === item.ordinalPercentile),
				);
				return {
					...item,
					officialPosition: position < 0 || tied ? null : position + 1,
					unresolvedTie: tied,
					unequalAssessmentCount: unequalCategories.has(item.categoryCode),
				};
			});
		});
		const benchmarks = [...Map.groupBy(assignments, assignment => assignment.judgeId).values()].map(
			judgeAssignments => {
				const judge = judgeAssignments[0]?.judge;
				if (!judge) throw new Error("Judging benchmark group has no judge");
				const scores = judgeAssignments
					.map(numericForAssignment)
					.filter((value): value is number => value !== null);
				const sharedDifferences = judgeAssignments.flatMap(assignment => {
					const score = numericForAssignment(assignment);
					if (score === null) return [];
					const peers = assignments
						.filter(
							candidate =>
								candidate.judgeId !== assignment.judgeId &&
								candidate.projectId === assignment.projectId &&
								candidate.categoryCode === assignment.categoryCode,
						)
						.map(numericForAssignment)
						.filter((value): value is number => value !== null);
					return peers.length ? [score - peers.reduce((sum, value) => sum + value, 0) / peers.length] : [];
				});
				const main = judgeAssignments.filter(
					assignment => assignment.isMain && isAssignmentComplete(assignment),
				);
				const mean = (values: number[]) =>
					values.length
						? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
						: null;
				const rankingAgreements: number[] = [];
				const ownRankings = rankings.filter(ranking => ranking.judgeId === judge.id);
				for (const otherJudgeId of new Set(
					rankings.map(ranking => ranking.judgeId).filter(id => id !== judge.id),
				)) {
					for (const categoryCode of new Set(ownRankings.map(ranking => ranking.categoryCode))) {
						const own = ownRankings
							.filter(ranking => ranking.categoryCode === categoryCode)
							.sort((a, b) => a.rank - b.rank);
						const other = rankings
							.filter(
								ranking => ranking.judgeId === otherJudgeId && ranking.categoryCode === categoryCode,
							)
							.sort((a, b) => a.rank - b.rank);
						const common = own.filter(item =>
							other.some(candidate => candidate.projectId === item.projectId),
						);
						if (common.length < 3) continue;
						const differences = common.map(item => {
							const ownIndex = own.findIndex(candidate => candidate.projectId === item.projectId);
							const otherIndex = other.findIndex(candidate => candidate.projectId === item.projectId);
							return Math.abs(
								ownIndex / Math.max(own.length - 1, 1) - otherIndex / Math.max(other.length - 1, 1),
							);
						});
						rankingAgreements.push(
							1 - differences.reduce((sum, value) => sum + value, 0) / differences.length,
						);
					}
				}
				return {
					judgeId: judge.id,
					judgeName: judge.name,
					projectCount: new Set(judgeAssignments.map(assignment => assignment.projectId)).size,
					scopeCount: judgeAssignments.length,
					completeCount: judgeAssignments.filter(assignment =>
						isAssignmentComplete(assignment, resolutionFor(assignment)),
					).length,
					averageScore: mean(scores),
					scoreSpread: scores.length ? Number((Math.max(...scores) - Math.min(...scores)).toFixed(2)) : null,
					meanDifferenceFromCoJudges: mean(sharedDifferences),
					mainCriterionTendencies: {
						technical: mean(main.map(item => pointsForLevel(completedLevel(item.technicalLevel), 15))),
						idea: mean(main.map(item => pointsForLevel(completedLevel(item.ideaLevel), 10))),
						design: mean(main.map(item => pointsForLevel(completedLevel(item.designLevel), 10))),
						learning: mean(main.map(item => pointsForLevel(completedLevel(item.learningLevel), 5))),
						presentation: mean(main.map(item => pointsForLevel(completedLevel(item.presentationLevel), 5))),
					},
					rankAgreement: mean(rankingAgreements),
					expertiseMatches: judgeAssignments.filter(assignment => assignment.expertiseMatch).length,
					fallbacks: judgeAssignments.filter(assignment => !assignment.isMain && !assignment.expertiseMatch)
						.length,
					sharedAssessments: sharedDifferences.length,
					insufficientOverlap: sharedDifferences.length === 0 && rankingAgreements.length === 0,
				};
			},
		);
		return {
			assessments,
			benchmarks,
			projectRoster: projects.map(project => ({
				projectName: project.name,
				tableNumber: project.tableNumber,
				room: project.room,
				devpostUrl: project.devpostUrl,
				devpostProjectId: project.externalId,
				mainTrack: project.mainTrack,
				categoryOptIns: canonicalProjectCategoryCodes(
					project.mainTrack,
					project.categories.map(category => category.code).filter(isMiniCategoryCode),
				).join(";"),
			})),
			aggregates: rankedAggregates,
		};
	}),
});
