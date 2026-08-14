import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { MealCategory, TShirtSize } from "@prisma/client";
import { z } from "zod";

export const participantIdSchema = z
	.string()
	.min(22)
	.max(128)
	.regex(/^[A-Za-z0-9_-]+$/, "Participant IDs must use URL-safe opaque characters")
	.refine(id => !/^\d+$/.test(id), "Participant IDs must not be sequential numeric values");

const acceptanceExpirySchema = z
	.string()
	.datetime({ offset: true })
	.transform(value => new Date(value));

export const provisioningRecordSchema = z
	.object({
		id: participantIdSchema,
		tShirtSize: z.nativeEnum(TShirtSize),
		mealCategory: z.nativeEnum(MealCategory),
		acceptanceExpiry: acceptanceExpirySchema,
		walkIn: z.boolean().optional(),
	})
	.strict();

export const provisioningBatchSchema = z
	.object({
		hackers: z.array(provisioningRecordSchema).min(1).max(500),
	})
	.strict();

export const reconciliationRequestSchema = z
	.object({
		ids: z.array(participantIdSchema).min(1).max(500),
	})
	.strict();

export type ProvisioningRecord = z.infer<typeof provisioningRecordSchema>;

export type ConfirmationResult = "confirmed" | "missing" | "expired";

export type ReconciliationRecord = {
	id: string;
	confirmed: boolean;
	cancellationCapabilityId: string | null;
};

export interface HackerLifecycleRepository {
	upsertProvisioned(record: ProvisioningRecord): Promise<void>;
	confirmAndRotate(id: string, now: Date, cancellationCapabilityId: string): Promise<ConfirmationResult>;
	cancelByCapability(capabilityId: string): Promise<string | null>;
	reconcile(ids: string[]): Promise<ReconciliationRecord[]>;
}

export class ParticipantLifecycleError extends Error {
	constructor(public readonly code: "INVALID_OR_EXPIRED_INVITATION" | "INVALID_CANCELLATION_CAPABILITY") {
		super(code);
		this.name = "ParticipantLifecycleError";
	}
}

export const provisionHackers = async (repository: HackerLifecycleRepository, input: unknown) => {
	const { hackers } = provisioningBatchSchema.parse(input);

	for (const hacker of hackers) {
		await repository.upsertProvisioned(hacker);
	}

	return { processed: hackers.length };
};

export const confirmRsvp = async (
	repository: HackerLifecycleRepository,
	idInput: unknown,
	now = new Date(),
	createCapabilityId = () => randomBytes(32).toString("base64url"),
) => {
	const id = participantIdSchema.parse(idInput);
	const result = await repository.confirmAndRotate(id, now, createCapabilityId());

	if (result !== "confirmed") {
		throw new ParticipantLifecycleError("INVALID_OR_EXPIRED_INVITATION");
	}

	return { confirmed: true as const };
};

const capabilitySignature = (capabilityId: string, secret: string) =>
	createHmac("sha256", secret).update(capabilityId).digest("base64url");

export const createCancellationToken = (capabilityId: string, secret: string) =>
	`${capabilityId}.${capabilitySignature(capabilityId, secret)}`;

export const readCancellationToken = (token: string, secret: string) => {
	const [capabilityId, suppliedSignature, extra] = token.split(".");
	if (!capabilityId || !suppliedSignature || extra !== undefined || !/^[A-Za-z0-9_-]{43}$/.test(capabilityId)) {
		return null;
	}

	const expectedSignature = capabilitySignature(capabilityId, secret);
	const supplied = Buffer.from(suppliedSignature);
	const expected = Buffer.from(expectedSignature);
	if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
		return null;
	}

	return capabilityId;
};

export const cancelRsvp = async (repository: HackerLifecycleRepository, tokenInput: unknown, secret: string) => {
	const token = z.string().min(1).max(256).parse(tokenInput);
	const capabilityId = readCancellationToken(token, secret);
	if (!capabilityId) {
		throw new ParticipantLifecycleError("INVALID_CANCELLATION_CAPABILITY");
	}

	const participantId = await repository.cancelByCapability(capabilityId);
	if (!participantId) {
		throw new ParticipantLifecycleError("INVALID_CANCELLATION_CAPABILITY");
	}

	return { confirmed: false as const, participantId };
};

export const reconcileRsvps = async (
	repository: HackerLifecycleRepository,
	input: unknown,
	baseUrl: string,
	cancellationSecret: string,
) => {
	const { ids } = reconciliationRequestSchema.parse(input);
	const uniqueIds = [...new Set(ids)];
	const found = await repository.reconcile(uniqueIds);
	const foundById = new Map(found.map(record => [record.id, record]));

	return {
		records: uniqueIds.flatMap(id => {
			const record = foundById.get(id);
			if (!record) return [];

			return [
				{
					id: record.id,
					confirmed: record.confirmed,
					...(record.confirmed && record.cancellationCapabilityId
						? {
								cancellationLink: `${baseUrl.replace(/\/$/, "")}/cancel#${createCancellationToken(
									record.cancellationCapabilityId,
									cancellationSecret,
								)}`,
							}
						: {}),
				},
			];
		}),
		missingIds: uniqueIds.filter(id => !foundById.has(id)),
	};
};
