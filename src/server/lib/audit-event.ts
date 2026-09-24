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
	"participant.rsvp.updated",
	"participant.rsvp.cancelled",
	"hardware.loan.checked_out",
	"hardware.loan.returned",
	"latte.order.placed",
	"latte.order.cancelled",
	"latte.order.transitioned",
	"latte.lab.open_changed",
	"latte.ingredient.availability_changed",
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
	"participant.rsvp.updated": ["attending", "declined", "repeated_attending", "repeated_declined"],
	"participant.rsvp.cancelled": ["cancelled"],
	"hardware.loan.checked_out": ["recorded"],
	"hardware.loan.returned": ["partial", "closed", "closed_with_missing"],
	"latte.order.placed": ["queued"],
	"latte.order.cancelled": ["cancelled"],
	"latte.order.transitioned": ["preparing", "ready", "completed", "cancelled"],
	"latte.lab.open_changed": ["opened", "closed"],
	"latte.ingredient.availability_changed": ["available", "unavailable"],
	"legacy.migrated": ["migrated"],
};

const entitySchema = z
	.object({
<<<<<<< HEAD
		type: z.enum(["hacker", "user", "event", "presence", "role", "hardware_loan", "latte_order"]),
=======
		type: z.enum(["hacker", "user", "event", "presence", "role", "organizer_access"]),
>>>>>>> 3af78a9 (feat(auth): simplify organiser access and passes)
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
				type: z.enum(["organizer", "participant", "integration", "system"]),
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
		if (event.name.startsWith("scanner.") && (!event.subject || event.subject.type !== "hacker")) {
			context.addIssue({ code: "custom", path: ["subject"], message: "Scanner events require a hacker subject" });
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
