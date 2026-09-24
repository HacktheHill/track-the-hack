import { createHash, randomUUID } from "node:crypto";
import {
	MealCategory,
	NotificationCampaignStatus,
	NotificationChannel,
	type PrismaClient,
	ScannerWorkflow,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "@/env/server.mjs";
import { createAuditEvent, persistAuditEvent } from "@/server/lib/audit-event";
import { getPushConfiguration, isValidPushSubscription } from "@/server/push";
import { createTRPCRouter, organizerProcedure, participantProcedure, publicProcedure } from "@/server/api/trpc";
import { getDiscordLinkStatuses } from "@/server/services/discord-notifications";
import { generateNotificationCohorts } from "@/server/services/notification-cohorts";

const varchar = z.string().trim().min(1).max(191);
const messageBody = z.string().trim().min(1).max(500);
const localeSchema = z.enum(["en", "fr"]);
const subscriptionSchema = z
	.object({
		endpoint: z.string().min(1).max(512),
		keys: z.object({ p256dh: z.string(), auth: z.string() }).strict(),
	})
	.strict()
	.refine(isValidPushSubscription, "Invalid push subscription");

const checkedInHackers = (prisma: Pick<PrismaClient, "hacker">) =>
	prisma.hacker.findMany({
		where: { presences: { some: { value: { gt: 0 }, event: { scannerWorkflow: ScannerWorkflow.CHECK_IN } } } },
		select: { id: true, mealCategory: true },
		orderBy: { id: "asc" },
	});

const discordConfig = () => ({ botUrl: env.DISCORD_BOT_URL, secret: env.INTERNAL_API_SECRET });

const statusMap = async (hackerIds: string[]) => {
	const result = new Map<string, boolean>();
	for (let offset = 0; offset < hackerIds.length; offset += 500) {
		const statuses = await getDiscordLinkStatuses(hackerIds.slice(offset, offset + 500), discordConfig());
		if (statuses === null) return null;
		for (const [id, linked] of statuses) result.set(id, linked);
	}
	return result;
};

const buildCampaign = async (
	transaction: Prisma.TransactionClient,
	input: { name: string; maximumCohortSize: number; seed: string; createdById: string },
	existingId?: string,
) => {
	const hackers = await checkedInHackers(transaction);
	if (!hackers.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No hackers are checked in" });
	const cohorts = generateNotificationCohorts(hackers, input.maximumCohortSize, input.seed);
	const snapshotAt = new Date();
	const campaign = existingId
		? await transaction.notificationCampaign.update({
				where: { id: existingId },
				data: {
					name: input.name,
					maximumCohortSize: input.maximumCohortSize,
					seed: input.seed,
					snapshotAt,
					snapshotCount: hackers.length,
				},
			})
		: await transaction.notificationCampaign.create({
				data: { ...input, snapshotAt, snapshotCount: hackers.length },
			});
	for (let cohortIndex = 0; cohortIndex < cohorts.length; cohortIndex += 1) {
		const cohort = await transaction.notificationCohort.create({
			data: { campaignId: campaign.id, ordinal: cohortIndex + 1 },
		});
		const members = cohorts[cohortIndex];
		if (!members) continue;
		if (members.length) {
			await transaction.notificationCohortMember.createMany({
				data: members.map((member, position) => ({
					campaignId: campaign.id,
					cohortId: cohort.id,
					hackerId: member.id,
					position,
					dietaryPriority: member.mealCategory !== MealCategory.STANDARD,
				})),
			});
		}
	}
	return campaign;
};

export const notificationsRouter = createTRPCRouter({
	overview: organizerProcedure.query(async ({ ctx }) => {
		const [campaigns, current] = await Promise.all([
			ctx.prisma.notificationCampaign.findMany({
				where: { archivedAt: null },
				orderBy: { createdAt: "desc" },
				take: 20,
				include: {
					cohorts: {
						orderBy: { ordinal: "asc" },
						include: {
							members: { orderBy: { position: "asc" } },
							announcement: { include: { deliveries: true } },
						},
					},
				},
			}),
			checkedInHackers(ctx.prisma),
		]);
		const ids = [
			...new Set(
				campaigns.flatMap(campaign =>
					campaign.cohorts.flatMap(cohort => cohort.members.map(member => member.hackerId)),
				),
			),
		];
		const [preferences, subscriptions, links] = await Promise.all([
			ctx.prisma.notificationPreference.findMany({ where: { hackerId: { in: ids } } }),
			ctx.prisma.participantPushSubscription.findMany({
				where: { hackerId: { in: ids } },
				select: { hackerId: true },
			}),
			statusMap(ids),
		]);
		const preferenceMap = new Map(preferences.map(preference => [preference.hackerId, preference]));
		const pushIds = new Set(subscriptions.map(subscription => subscription.hackerId));
		return {
			currentCheckedIn: current.length,
			currentDietaryPriority: current.filter(hacker => hacker.mealCategory !== MealCategory.STANDARD).length,
			discordStatusAvailable: links !== null,
			campaigns: campaigns.map(campaign => {
				const memberIds = new Set(
					campaign.cohorts.flatMap(cohort => cohort.members.map(member => member.hackerId)),
				);
				return {
					id: campaign.id,
					name: campaign.name,
					maximumCohortSize: campaign.maximumCohortSize,
					status: campaign.status,
					snapshotAt: campaign.snapshotAt,
					snapshotCount: campaign.snapshotCount,
					lateCheckIns: current.filter(hacker => !memberIds.has(hacker.id)).length,
					cohorts: campaign.cohorts.map(cohort => {
						const cohortIds = cohort.members.map(member => member.hackerId);
						const pushEligible = cohortIds.filter(
							id => preferenceMap.get(id)?.pushEnabled && pushIds.has(id),
						).length;
						const discordEligible =
							links === null
								? null
								: cohortIds.filter(
										id => (preferenceMap.get(id)?.discordEnabled ?? true) && links.get(id),
									).length;
						const eligibleIds = new Set(
							cohortIds.filter(
								id =>
									(preferenceMap.get(id)?.pushEnabled && pushIds.has(id)) ||
									(links !== null &&
										(preferenceMap.get(id)?.discordEnabled ?? true) &&
										links.get(id)),
							),
						);
						const deliveryCounts = { PENDING: 0, SENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 };
						for (const delivery of cohort.announcement?.deliveries ?? [])
							deliveryCounts[delivery.status] += 1;
						const retryableDeliveries = (cohort.announcement?.deliveries ?? []).filter(
							delivery =>
								(delivery.status === "FAILED" && delivery.failureCode === "temporary_failure") ||
								(delivery.status === "SKIPPED" &&
									["not_linked", "dm_unavailable", "push_expired", "push_unavailable"].includes(
										delivery.failureCode ?? "",
									)),
						).length;
						const uncertainDeliveries = (cohort.announcement?.deliveries ?? []).filter(
							delivery => delivery.failureCode === "uncertain",
						).length;
						return {
							id: cohort.id,
							ordinal: cohort.ordinal,
							size: cohort.members.length,
							dietaryPriority: cohort.members.filter(member => member.dietaryPriority).length,
							pushEligible,
							discordEligible,
							dualEligible:
								links === null
									? null
									: cohortIds.filter(
											id =>
												preferenceMap.get(id)?.pushEnabled &&
												pushIds.has(id) &&
												(preferenceMap.get(id)?.discordEnabled ?? true) &&
												links.get(id),
										).length,
							unreachable: links === null ? null : cohortIds.length - eligibleIds.size,
							announcementId: cohort.announcement?.id ?? null,
							body: cohort.announcement?.body ?? null,
							deliveryCounts,
							retryableDeliveries,
							uncertainDeliveries,
						};
					}),
				};
			}),
		};
	}),
	createCampaign: organizerProcedure
		.input(z.object({ name: varchar, maximumCohortSize: z.number().int().min(1).max(500) }).strict())
		.mutation(async ({ ctx, input }) =>
			ctx.prisma.$transaction(async transaction => {
				const campaign = await buildCampaign(transaction, {
					...input,
					seed: randomUUID(),
					createdById: ctx.organizer.id,
				});
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "notification.campaign.created",
						outcome: "created",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "notification_campaign", id: campaign.id },
						data: { snapshotCount: campaign.snapshotCount, maximumCohortSize: campaign.maximumCohortSize },
					}),
				);
				return { id: campaign.id };
			}),
		),
	regenerateCampaign: organizerProcedure
		.input(z.object({ id: varchar, name: varchar, maximumCohortSize: z.number().int().min(1).max(500) }).strict())
		.mutation(async ({ ctx, input }) =>
			ctx.prisma.$transaction(async transaction => {
				const existing = await transaction.notificationCampaign.findUnique({ where: { id: input.id } });
				if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
				if (existing.status !== NotificationCampaignStatus.DRAFT)
					throw new TRPCError({ code: "CONFLICT", message: "Campaign membership is locked" });
				const cohortIds = (
					await transaction.notificationCohort.findMany({
						where: { campaignId: input.id },
						select: { id: true },
					})
				).map(item => item.id);
				await transaction.notificationCohortMember.deleteMany({ where: { campaignId: input.id } });
				await transaction.notificationCohort.deleteMany({ where: { id: { in: cohortIds } } });
				const campaign = await buildCampaign(
					transaction,
					{
						name: input.name,
						maximumCohortSize: input.maximumCohortSize,
						seed: randomUUID(),
						createdById: existing.createdById,
					},
					input.id,
				);
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "notification.campaign.regenerated",
						outcome: "regenerated",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "notification_campaign", id: campaign.id },
						data: { snapshotCount: campaign.snapshotCount, maximumCohortSize: campaign.maximumCohortSize },
					}),
				);
				return { id: campaign.id };
			}),
		),
	queueAnnouncement: organizerProcedure
		.input(z.object({ cohortId: varchar, body: messageBody }).strict())
		.mutation(async ({ ctx, input }) =>
			ctx.prisma.$transaction(async transaction => {
				const cohort = await transaction.notificationCohort.findUnique({
					where: { id: input.cohortId },
					include: { campaign: true, members: { select: { hackerId: true } }, announcement: true },
				});
				if (!cohort) throw new TRPCError({ code: "NOT_FOUND" });
				if (cohort.announcement)
					throw new TRPCError({ code: "CONFLICT", message: "This cohort has already been queued" });
				const announcement = await transaction.notificationAnnouncement.create({
					data: {
						cohortId: cohort.id,
						body: input.body,
						contentHash: createHash("sha256").update(input.body).digest("hex"),
						createdById: ctx.organizer.id,
					},
				});
				await transaction.notificationDelivery.createMany({
					data: cohort.members.flatMap(member =>
						[NotificationChannel.WEB_PUSH, NotificationChannel.DISCORD].map(channel => ({
							id: randomUUID(),
							announcementId: announcement.id,
							hackerId: member.hackerId,
							channel,
						})),
					),
				});
				await transaction.notificationCampaign.update({
					where: { id: cohort.campaignId },
					data: { status: NotificationCampaignStatus.LOCKED },
				});
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "notification.announcement.queued",
						outcome: "queued",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "notification_announcement", id: announcement.id },
						data: {
							participantCount: cohort.members.length,
							channelCount: 2,
							contentHash: announcement.contentHash,
						},
					}),
				);
				return { id: announcement.id };
			}),
		),
	retryAnnouncement: organizerProcedure
		.input(z.object({ announcementId: varchar }).strict())
		.mutation(async ({ ctx, input }) => {
			return ctx.prisma.$transaction(async transaction => {
				const retryable = await transaction.notificationDelivery.updateMany({
					where: {
						announcementId: input.announcementId,
						OR: [
							{ status: "FAILED", failureCode: "temporary_failure" },
							{
								status: "SKIPPED",
								failureCode: {
									in: ["not_linked", "dm_unavailable", "push_expired", "push_unavailable"],
								},
							},
						],
					},
					data: {
						status: "PENDING",
						failureCode: null,
						attempts: 0,
						nextAttemptAt: new Date(),
						leaseToken: null,
						leaseUntil: null,
					},
				});
				if (!retryable.count) throw new TRPCError({ code: "CONFLICT", message: "No retryable deliveries" });
				const announcement = await transaction.notificationAnnouncement.update({
					where: { id: input.announcementId },
					data: { completedAt: null },
					select: { cohort: { select: { campaignId: true } } },
				});
				await transaction.notificationCampaign.update({
					where: { id: announcement.cohort.campaignId },
					data: { status: "LOCKED" },
				});
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "notification.delivery.retried",
						outcome: "queued",
						actor: { type: "organizer", id: ctx.organizer.id },
						resource: { type: "notification_announcement", id: input.announcementId },
						data: { deliveryCount: retryable.count },
					}),
				);
				return { count: retryable.count };
			});
		}),
	archiveCampaign: organizerProcedure.input(z.object({ id: varchar }).strict()).mutation(async ({ ctx, input }) => {
		const archived = await ctx.prisma.notificationCampaign.updateMany({
			where: { id: input.id, status: NotificationCampaignStatus.COMPLETED },
			data: { archivedAt: new Date() },
		});
		if (archived.count !== 1)
			throw new TRPCError({ code: "CONFLICT", message: "Only completed campaigns can be archived" });
		return { ok: true };
	}),
	preferences: participantProcedure.query(async ({ ctx }) => {
		const hackerId = ctx.participantSession.hackerId;
		const [preference, subscription, links] = await Promise.all([
			ctx.prisma.notificationPreference.findUnique({ where: { hackerId } }),
			ctx.prisma.participantPushSubscription.findUnique({ where: { hackerId }, select: { endpoint: true } }),
			getDiscordLinkStatuses([hackerId], discordConfig()),
		]);
		return {
			discordEnabled: preference?.discordEnabled ?? true,
			pushEnabled: preference?.pushEnabled ?? false,
			pushSubscribed: subscription !== null,
			pushAvailable: getPushConfiguration() !== null,
			discordLinked: links?.get(hackerId) ?? null,
		};
	}),
	setDiscordEnabled: participantProcedure
		.input(z.object({ enabled: z.boolean() }).strict())
		.mutation(async ({ ctx, input }) => {
			const hackerId = ctx.participantSession.hackerId;
			if (input.enabled) {
				const links = await getDiscordLinkStatuses([hackerId], discordConfig());
				if (!links?.get(hackerId))
					throw new TRPCError({ code: "BAD_REQUEST", message: "Discord account is not linked" });
			}
			await ctx.prisma.$transaction(async transaction => {
				await transaction.notificationPreference.upsert({
					where: { hackerId },
					create: { hackerId, discordEnabled: input.enabled },
					update: { discordEnabled: input.enabled },
				});
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "participant.notifications.updated",
						outcome: "applied",
						actor: { type: "participant", id: hackerId },
						subject: { type: "hacker", id: hackerId },
						data: { channel: "discord", enabled: input.enabled },
					}),
				);
			});
			return { enabled: input.enabled };
		}),
	setPushEnabled: participantProcedure
		.input(
			z.discriminatedUnion("enabled", [
				z.object({ enabled: z.literal(false) }).strict(),
				z.object({ enabled: z.literal(true), subscription: subscriptionSchema, locale: localeSchema }).strict(),
			]),
		)
		.mutation(async ({ ctx, input }) => {
			if (input.enabled && !getPushConfiguration())
				throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Push notifications are unavailable" });
			const hackerId = ctx.participantSession.hackerId;
			await ctx.prisma.$transaction(async transaction => {
				const existing = await transaction.participantPushSubscription.findUnique({ where: { hackerId } });
				if (input.enabled) {
					await transaction.participantPushSubscription.deleteMany({
						where: { endpoint: input.subscription.endpoint, hackerId: { not: hackerId } },
					});
					await transaction.participantPushSubscription.upsert({
						where: { hackerId },
						create: {
							hackerId,
							endpoint: input.subscription.endpoint,
							...input.subscription.keys,
							locale: input.locale,
						},
						update: {
							endpoint: input.subscription.endpoint,
							...input.subscription.keys,
							locale: input.locale,
						},
					});
				} else {
					if (existing)
						await transaction.pushSubscription.deleteMany({ where: { endpoint: existing.endpoint } });
					await transaction.participantPushSubscription.deleteMany({ where: { hackerId } });
				}
				await transaction.notificationPreference.upsert({
					where: { hackerId },
					create: { hackerId, pushEnabled: input.enabled },
					update: { pushEnabled: input.enabled },
				});
				await persistAuditEvent(
					transaction,
					createAuditEvent({
						name: "participant.notifications.updated",
						outcome: "applied",
						actor: { type: "participant", id: hackerId },
						subject: { type: "hacker", id: hackerId },
						data: { channel: "web_push", enabled: input.enabled },
					}),
				);
			});
			return { enabled: input.enabled };
		}),
	eventReminderStatus: publicProcedure
		.input(z.object({ eventId: varchar }).strict())
		.query(async ({ ctx, input }) => {
			if (!ctx.participantSession) return { participant: false, requested: false, discordAvailable: false };
			const hackerId = ctx.participantSession.hackerId;
			const [reminder, preference, links] = await Promise.all([
				ctx.prisma.participantEventReminder.findUnique({
					where: { hackerId_eventId: { hackerId, eventId: input.eventId } },
				}),
				ctx.prisma.notificationPreference.findUnique({ where: { hackerId } }),
				getDiscordLinkStatuses([hackerId], discordConfig()),
			]);
			return {
				participant: true,
				requested: reminder !== null,
				discordAvailable: (preference?.discordEnabled ?? true) && Boolean(links?.get(hackerId)),
			};
		}),
	setEventReminder: participantProcedure
		.input(
			z
				.object({
					eventId: varchar,
					enabled: z.boolean(),
					subscription: subscriptionSchema.optional(),
					locale: localeSchema,
				})
				.strict(),
		)
		.mutation(async ({ ctx, input }) => {
			const hackerId = ctx.participantSession.hackerId;
			if (input.enabled) {
				const [preference, existingSubscription, links] = await Promise.all([
					ctx.prisma.notificationPreference.findUnique({ where: { hackerId } }),
					ctx.prisma.participantPushSubscription.findUnique({
						where: { hackerId },
						select: { hackerId: true },
					}),
					getDiscordLinkStatuses([hackerId], discordConfig()),
				]);
				const pushAvailable =
					getPushConfiguration() !== null &&
					Boolean(input.subscription || (preference?.pushEnabled && existingSubscription));
				const discordAvailable = (preference?.discordEnabled ?? true) && Boolean(links?.get(hackerId));
				if (!pushAvailable && !discordAvailable)
					throw new TRPCError({
						code: "PRECONDITION_FAILED",
						message: "No notification channel is available",
					});
			}
			await ctx.prisma.$transaction(async transaction => {
				const event = await transaction.event.findUnique({
					where: { id: input.eventId },
					select: { id: true, hidden: true, start: true, notifiedAt: true },
				});
				if (!event || event.hidden || event.start <= new Date() || event.notifiedAt)
					throw new TRPCError({ code: "BAD_REQUEST", message: "Event is no longer accepting reminders" });
				if (input.enabled) {
					await transaction.participantEventReminder.upsert({
						where: { hackerId_eventId: { hackerId, eventId: event.id } },
						create: { hackerId, eventId: event.id },
						update: {},
					});
					if (input.subscription && getPushConfiguration()) {
						await transaction.participantPushSubscription.deleteMany({
							where: { endpoint: input.subscription.endpoint, hackerId: { not: hackerId } },
						});
						await transaction.participantPushSubscription.upsert({
							where: { hackerId },
							create: {
								hackerId,
								endpoint: input.subscription.endpoint,
								...input.subscription.keys,
								locale: input.locale,
							},
							update: {
								endpoint: input.subscription.endpoint,
								...input.subscription.keys,
								locale: input.locale,
							},
						});
						await transaction.notificationPreference.upsert({
							where: { hackerId },
							create: { hackerId, pushEnabled: true },
							update: { pushEnabled: true },
						});
						await transaction.pushSubscription.deleteMany({
							where: { eventId: event.id, endpoint: input.subscription.endpoint },
						});
					}
				} else {
					await transaction.participantEventReminder.deleteMany({ where: { hackerId, eventId: event.id } });
				}
			});
			return { enabled: input.enabled };
		}),
});
