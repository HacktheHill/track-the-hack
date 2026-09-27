import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

const auditNames = [
	"scanner.scan",
	"scanner.adjust",
	"organizer.roles.updated",
	"organizer.access.added",
	"organizer.access.removed",
	"participant.claim.issued",
	"participant.claim.redeemed",
	"participant.check_in.inferred",
	"participant.rsvp.updated",
	"participant.rsvp.cancelled",
	"hardware.loan.checked_out",
	"hardware.loan.returned",
	"hardware.item.availability_changed",
	"latte.order.placed",
	"latte.order.cancelled",
	"latte.order.transitioned",
	"latte.lab.open_changed",
	"latte.ingredient.availability_changed",
	"participant.notifications.updated",
	"notification.campaign.created",
	"notification.campaign.regenerated",
	"notification.announcement.queued",
	"notification.announcement.completed",
	"notification.delivery.retried",
	"judging.round.imported",
	"judging.assignments.regenerated",
	"judging.round.published",
	"judging.round.locked",
	"judging.round.reopened",
	"judging.workload.approved",
	"judging.projects.main_track_corrected",
	"judging.categories.reconciled",
	"judging.category.dedicated",
	"judging.assignment.changed",
	"judging.project.disqualified",
	"judging.projects.coverage_closed",
	"judging.mlh.retired",
	"judging.eligibility.resolved",
	"judging.sync.applied",
	"legacy.migrated",
] as const;

const allowedOutcomes: Record<(typeof auditNames)[number], readonly string[]> = {
	"scanner.scan": ["recorded", "incremented", "duplicate", "limit"],
	"scanner.adjust": ["applied", "stale", "out_of_bounds"],
	"organizer.roles.updated": ["applied"],
	"organizer.access.added": ["added", "unchanged"],
	"organizer.access.removed": ["removed", "unchanged"],
	"participant.claim.issued": ["issued"],
	"participant.claim.redeemed": ["redeemed"],
	"participant.check_in.inferred": ["recorded"],
	"participant.rsvp.updated": ["attending", "declined", "repeated_attending", "repeated_declined"],
	"participant.rsvp.cancelled": ["cancelled"],
	"hardware.loan.checked_out": ["recorded"],
	"hardware.loan.returned": ["partial", "closed", "closed_with_missing"],
	"hardware.item.availability_changed": ["available", "out_of_stock"],
	"latte.order.placed": ["queued"],
	"latte.order.cancelled": ["cancelled"],
	"latte.order.transitioned": ["preparing", "ready", "completed", "cancelled"],
	"latte.lab.open_changed": ["opened", "closed"],
	"latte.ingredient.availability_changed": ["available", "unavailable"],
	"participant.notifications.updated": ["applied"],
	"notification.campaign.created": ["created"],
	"notification.campaign.regenerated": ["regenerated"],
	"notification.announcement.queued": ["queued"],
	"notification.announcement.completed": ["completed"],
	"notification.delivery.retried": ["queued"],
	"judging.round.imported": ["created"],
	"judging.assignments.regenerated": ["regenerated"],
	"judging.round.published": ["opened"],
	"judging.round.locked": ["locked", "force_locked"],
	"judging.round.reopened": ["reopened"],
	"judging.workload.approved": ["approved"],
	"judging.projects.main_track_corrected": ["cgi", "general", "civic"],
	"judging.categories.reconciled": ["applied"],
	"judging.category.dedicated": ["applied"],
	"judging.assignment.changed": [
		"moved",
		"project_visit_moved",
		"attribution_corrected",
		"recusal_auto_reassigned",
		"judge_restricted",
		"swapped",
		"added",
		"removed",
		"recusal_accepted",
	],
	"judging.project.disqualified": ["disqualified"],
	"judging.projects.coverage_closed": ["closed"],
	"judging.mlh.retired": ["retired"],
	"judging.eligibility.resolved": ["eligible", "ineligible"],
	"judging.sync.applied": ["applied", "discarded", "blocked"],
	"legacy.migrated": ["migrated"],
};

const entitySchema = z
	.object({
		type: z.enum([
			"hacker",
			"user",
			"event",
			"presence",
			"role",
			"organizer_access",
			"hardware_loan",
			"hardware_item",
			"latte_order",
			"notification_campaign",
			"notification_announcement",
			"judging_round",
			"judging_judge",
			"judging_assignment",
			"judging_project",
		]),
		id: z.string().min(1).max(191),
	})
	.strict();

const dataValueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const sensitiveDataKeys = new Set([
	"email",
	"token",
	"cookie",
	"capability",
	"claimurl",
	"url",
	"tallyid",
	"application",
	"request",
	"requestbody",
	"body",
	"details",
	"name",
]);
const sensitiveDataValue = /(?:https?:\/\/|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/;

export const auditEventV1Schema = z
	.object({
		schemaVersion: z.literal(1),
		id: z.string().uuid(),
		occurredAt: z
			.string()
			.datetime()
			.refine(value => value.endsWith("Z"), "occurredAt must be UTC"),
		name: z.enum(auditNames),
		outcome: z.string().min(1).max(64),
		actor: z
			.object({
				type: z.enum(["organizer", "judge", "participant", "integration", "system"]),
				id: z.string().min(1).max(191),
			})
			.strict(),
		subject: entitySchema.optional(),
		resource: entitySchema.optional(),
		correlationId: z.string().uuid(),
		data: z.record(dataValueSchema),
	})
	.strict()
	.superRefine((event, context) => {
		if (!allowedOutcomes[event.name].includes(event.outcome)) {
			context.addIssue({ code: "custom", path: ["outcome"], message: `Invalid outcome for ${event.name}` });
		}
		if (event.name.startsWith("scanner.") && (!event.subject || !["hacker", "user"].includes(event.subject.type))) {
			context.addIssue({
				code: "custom",
				path: ["subject"],
				message: "Scanner events require a participant or organiser subject",
			});
		}
		if (event.name.startsWith("scanner.") && (!event.resource || event.resource.type !== "event")) {
			context.addIssue({
				code: "custom",
				path: ["resource"],
				message: "Scanner events require an event resource",
			});
		}
		for (const [key, value] of Object.entries(event.data)) {
			if (sensitiveDataKeys.has(key.replace(/[^a-z]/gi, "").toLowerCase())) {
				context.addIssue({ code: "custom", path: ["data", key], message: "Sensitive audit data key" });
			}
			if (typeof value === "string" && sensitiveDataValue.test(value)) {
				context.addIssue({ code: "custom", path: ["data", key], message: "Sensitive audit data value" });
			}
		}
	});

export type AuditEventV1 = z.infer<typeof auditEventV1Schema>;
export type AuditEventDraft = Omit<AuditEventV1, "schemaVersion" | "id" | "occurredAt" | "correlationId"> & {
	id?: string;
	occurredAt?: Date;
	correlationId?: string;
};

type AuditClient = Pick<PrismaClient, "auditEvent">;

export const createAuditEvent = (draft: AuditEventDraft): AuditEventV1 =>
	auditEventV1Schema.parse({
		...draft,
		schemaVersion: 1,
		id: draft.id ?? randomUUID(),
		occurredAt: (draft.occurredAt ?? new Date()).toISOString(),
		correlationId: draft.correlationId ?? randomUUID(),
	});

export const persistAuditEvent = async (client: AuditClient, event: AuditEventV1) => {
	await client.auditEvent.create({
		data: {
			id: event.id,
			schemaVersion: event.schemaVersion,
			occurredAt: new Date(event.occurredAt),
			name: event.name,
			outcome: event.outcome,
			correlationId: event.correlationId,
			actorType: event.actor.type,
			actorId: event.actor.id,
			subjectType: event.subject?.type,
			subjectId: event.subject?.id,
			resourceType: event.resource?.type,
			resourceId: event.resource?.id,
			data: event.data,
		},
	});
};

export const emitAuditEvent = (event: AuditEventV1) => {
	try {
		console.info(
			JSON.stringify({
				kind: "track.audit",
				service: "track-the-hack",
				environment: process.env.NODE_ENV ?? "unknown",
				...event,
			}),
		);
	} catch {
		console.error("Audit event export failed");
	}
};
