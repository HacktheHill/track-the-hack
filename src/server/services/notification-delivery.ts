import { randomUUID } from "node:crypto";
import { NotificationChannel, NotificationDeliveryStatus } from "@prisma/client";
import { env } from "@/env/server.mjs";
import { prisma } from "@/server/db";
import { createAuditEvent, persistAuditEvent } from "@/server/lib/audit-event";
import { sendPushNotification } from "@/server/push";
import { deliverDiscordNotifications } from "@/server/services/discord-notifications";

const MAX_ATTEMPTS = 3;
let deliveryScheduler: NodeJS.Timeout | undefined;

const finish = async (
	id: string,
	token: string,
	status: NotificationDeliveryStatus,
	failureCode: string | null,
	attempts: number,
) => {
	const retry =
		status === NotificationDeliveryStatus.FAILED && failureCode === "temporary_failure" && attempts < MAX_ATTEMPTS;
	return prisma.notificationDelivery.updateMany({
		where: { id, status: NotificationDeliveryStatus.SENDING, leaseToken: token },
		data: {
			status,
			failureCode,
			sentAt: status === NotificationDeliveryStatus.SENT ? new Date() : undefined,
			nextAttemptAt: retry ? new Date(Date.now() + attempts * 60_000) : new Date("9999-12-31T00:00:00.000Z"),
			leaseToken: null,
			leaseUntil: null,
		},
	});
};

const completeParents = async (announcementId: string) => {
	const unfinished = await prisma.notificationDelivery.count({
		where: {
			announcementId,
			OR: [
				{ status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.SENDING] } },
				{
					status: NotificationDeliveryStatus.FAILED,
					failureCode: "temporary_failure",
					attempts: { lt: MAX_ATTEMPTS },
				},
			],
		},
	});
	if (unfinished) return;
	const campaignId = await prisma.$transaction(async transaction => {
		const completion = await transaction.notificationAnnouncement.updateMany({
			where: { id: announcementId, completedAt: null },
			data: { completedAt: new Date() },
		});
		if (completion.count !== 1) return null;
		const announcement = await transaction.notificationAnnouncement.findUniqueOrThrow({
			where: { id: announcementId },
			select: {
				contentHash: true,
				cohort: { select: { campaignId: true } },
				deliveries: { select: { status: true } },
			},
		});
		const deliveryCounts = announcement.deliveries.reduce(
			(counts, delivery) => ({ ...counts, [delivery.status]: counts[delivery.status] + 1 }),
			{ PENDING: 0, SENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 },
		);
		await persistAuditEvent(
			transaction,
			createAuditEvent({
				name: "notification.announcement.completed",
				outcome: "completed",
				actor: { type: "system", id: "notification-scheduler" },
				resource: { type: "notification_announcement", id: announcementId },
				data: {
					contentHash: announcement.contentHash,
					sentCount: deliveryCounts.SENT,
					failedCount: deliveryCounts.FAILED,
					skippedCount: deliveryCounts.SKIPPED,
				},
			}),
		);
		return announcement.cohort.campaignId;
	});
	if (!campaignId) return;
	const [cohorts, completed] = await Promise.all([
		prisma.notificationCohort.count({ where: { campaignId } }),
		prisma.notificationAnnouncement.count({ where: { cohort: { campaignId }, completedAt: { not: null } } }),
	]);
	if (cohorts > 0 && cohorts === completed) {
		await prisma.notificationCampaign.update({ where: { id: campaignId }, data: { status: "COMPLETED" } });
	}
};

export const processNotificationDeliveries = async () => {
	const candidates = await prisma.notificationDelivery.findMany({
		where: {
			nextAttemptAt: { lte: new Date() },
			OR: [
				{
					status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.FAILED] },
					attempts: { lt: MAX_ATTEMPTS },
				},
				{ status: NotificationDeliveryStatus.SENDING, leaseUntil: { lte: new Date() } },
			],
		},
		orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
		take: 20,
		select: { id: true },
	});
	let processed = 0;
	for (const candidate of candidates) {
		const token = randomUUID();
		const claimed = await prisma.$executeRaw`
			UPDATE NotificationDelivery
			SET status = 'SENDING', leaseToken = ${token},
				leaseUntil = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 2 MINUTE), attempts = attempts + 1
			WHERE id = ${candidate.id} AND nextAttemptAt <= UTC_TIMESTAMP(3)
			AND ((status IN ('PENDING', 'FAILED') AND attempts < ${MAX_ATTEMPTS})
				OR (status = 'SENDING' AND leaseUntil <= UTC_TIMESTAMP(3)))
		`;
		if (claimed !== 1) continue;
		const delivery = await prisma.notificationDelivery.findUniqueOrThrow({
			where: { id: candidate.id },
			include: {
				announcement: { select: { id: true, body: true } },
				hacker: { include: { notificationPreference: true, participantPushSubscription: true } },
			},
		});
		try {
			const renewed = await prisma.$executeRaw`
				UPDATE NotificationDelivery
				SET leaseUntil = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 2 MINUTE)
				WHERE id = ${delivery.id} AND status = 'SENDING' AND leaseToken = ${token}
				AND leaseUntil > UTC_TIMESTAMP(3)
			`;
			if (renewed !== 1) continue;
			const preference = delivery.hacker.notificationPreference;
			if (delivery.channel === NotificationChannel.WEB_PUSH) {
				if (!preference?.pushEnabled) {
					await finish(
						delivery.id,
						token,
						NotificationDeliveryStatus.SKIPPED,
						"channel_disabled",
						delivery.attempts,
					);
				} else if (!delivery.hacker.participantPushSubscription) {
					await finish(
						delivery.id,
						token,
						NotificationDeliveryStatus.SKIPPED,
						"push_unavailable",
						delivery.attempts,
					);
				} else {
					const subscription = delivery.hacker.participantPushSubscription;
					const status = await sendPushNotification(
						{
							endpoint: subscription.endpoint,
							keys: { p256dh: subscription.p256dh, auth: subscription.auth },
						},
						JSON.stringify({
							title: "Hack the Hill update / Mise à jour Hack the Hill",
							body: delivery.announcement.body,
							tag: `announcement-${delivery.announcement.id}`,
							icon: "/icons/android-chrome-192x192.png",
							data: { url: "/profile" },
						}),
						AbortSignal.timeout(20_000),
					);
					if (status >= 200 && status < 300)
						await finish(delivery.id, token, NotificationDeliveryStatus.SENT, null, delivery.attempts);
					else if (status === 404 || status === 410) {
						await prisma.participantPushSubscription.deleteMany({
							where: { hackerId: delivery.hackerId, endpoint: subscription.endpoint },
						});
						await prisma.notificationPreference.updateMany({
							where: { hackerId: delivery.hackerId },
							data: { pushEnabled: false },
						});
						await finish(
							delivery.id,
							token,
							NotificationDeliveryStatus.SKIPPED,
							"push_expired",
							delivery.attempts,
						);
					} else
						await finish(
							delivery.id,
							token,
							NotificationDeliveryStatus.FAILED,
							"temporary_failure",
							delivery.attempts,
						);
				}
			} else if (!(preference?.discordEnabled ?? true)) {
				await finish(
					delivery.id,
					token,
					NotificationDeliveryStatus.SKIPPED,
					"channel_disabled",
					delivery.attempts,
				);
			} else {
				const response = await deliverDiscordNotifications(
					[{ id: delivery.id, hackerId: delivery.hackerId, content: delivery.announcement.body }],
					{ botUrl: env.DISCORD_BOT_URL, secret: env.INTERNAL_API_SECRET },
				);
				const outcome = response?.[0]?.outcome ?? "temporary_failure";
				if (outcome === "sent")
					await finish(delivery.id, token, NotificationDeliveryStatus.SENT, null, delivery.attempts);
				else if (outcome === "temporary_failure")
					await finish(delivery.id, token, NotificationDeliveryStatus.FAILED, outcome, delivery.attempts);
				else if (outcome === "uncertain")
					await finish(delivery.id, token, NotificationDeliveryStatus.FAILED, outcome, MAX_ATTEMPTS);
				else await finish(delivery.id, token, NotificationDeliveryStatus.SKIPPED, outcome, delivery.attempts);
			}
		} catch {
			await finish(delivery.id, token, NotificationDeliveryStatus.FAILED, "temporary_failure", delivery.attempts);
		}
		await completeParents(delivery.announcementId);
		processed += 1;
	}
	return processed;
};

export const startNotificationDeliveryScheduler = () => {
	if (deliveryScheduler) return deliveryScheduler;
	let running = false;
	const tick = async () => {
		if (running) return;
		running = true;
		try {
			await processNotificationDeliveries();
		} catch {
			console.error("Participant notification delivery failed; pending deliveries will be retried.");
		} finally {
			running = false;
		}
	};
	deliveryScheduler = setInterval(() => void tick(), 15_000);
	deliveryScheduler.unref();
	void tick();
	return deliveryScheduler;
};
