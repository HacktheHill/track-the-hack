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
	// Returns false when the participant does not exist.
	replaceClaimToken(hackerId: string, claimId: string, expiresAt: Date): Promise<boolean>;
	// Returns the participant id, or null for a spent, expired, or unknown claim.
	redeemClaimToken(claimId: string, now: Date): Promise<string | null>;
}

export class ParticipantLifecycleError extends Error {
	constructor(
		public readonly code:
			| "INVALID_OR_EXPIRED_INVITATION"
			| "INVALID_CANCELLATION_CAPABILITY"
			| "UNKNOWN_PARTICIPANT"
			| "INVALID_CLAIM_TOKEN",
	) {
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

const signOpaqueId = (opaqueId: string, secret: string) =>
	createHmac("sha256", secret).update(opaqueId).digest("base64url");

// Tokens are `<random id>.<signature>`. Only the id is stored, so a database
// dump on its own cannot be turned into working links.
const createSignedToken = (opaqueId: string, secret: string) => `${opaqueId}.${signOpaqueId(opaqueId, secret)}`;

const readSignedToken = (token: string, secret: string) => {
	const [opaqueId, suppliedSignature, extra] = token.split(".");
	// Reject the obviously malformed before spending time on the HMAC.
	if (!opaqueId || !suppliedSignature || extra !== undefined || !/^[A-Za-z0-9_-]{43}$/.test(opaqueId)) {
		return null;
	}

	const supplied = Buffer.from(suppliedSignature);
	const expected = Buffer.from(signOpaqueId(opaqueId, secret));
	// Constant time, otherwise the failure timing leaks the signature.
	if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
		return null;
	}

	return opaqueId;
};

// Cancellation and claim links use separate secrets so leaking one does not
// compromise the other.
export const createCancellationToken = (capabilityId: string, secret: string) =>
	createSignedToken(capabilityId, secret);

export const readCancellationToken = (token: string, secret: string) => readSignedToken(token, secret);

export const createClaimToken = (claimId: string, secret: string) => createSignedToken(claimId, secret);

export const readClaimToken = (token: string, secret: string) => readSignedToken(token, secret);

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

// The claim QR is shown on the organizer's screen where anyone nearby can
// photograph it. A narrow window plus single use keeps that photo worthless.
export const CLAIM_TOKEN_TTL_MS = 5 * 60 * 1000;

export const issueClaimToken = async (
	repository: HackerLifecycleRepository,
	idInput: unknown,
	baseUrl: string,
	secret: string,
	now = new Date(),
	createClaimId = () => randomBytes(32).toString("base64url"),
) => {
	const hackerId = participantIdSchema.parse(idInput);
	const claimId = createClaimId();
	const expiresAt = new Date(now.getTime() + CLAIM_TOKEN_TTL_MS);

	// relationMode is "prisma", so nothing at the database level stops a token
	// from pointing at a participant that was never provisioned.
	const issued = await repository.replaceClaimToken(hackerId, claimId, expiresAt);
	if (!issued) {
		throw new ParticipantLifecycleError("UNKNOWN_PARTICIPANT");
	}

	// Fragment, not query: it never reaches the server on the GET and stays out
	// of access logs, same as the cancellation link.
	return {
		claimUrl: `${baseUrl.replace(/\/$/, "")}/claim#${createClaimToken(claimId, secret)}`,
		expiresAt,
	};
};



export const consumeClaimToken = async (
	repository: HackerLifecycleRepository,
	tokenInput: unknown,
	secret: string,
	now = new Date(),
) => {
	const token = z.string().min(1).max(256).parse(tokenInput);
	const claimId = readClaimToken(token, secret);
	if (!claimId) {
		throw new ParticipantLifecycleError("INVALID_CLAIM_TOKEN");
	}

	// Spent, expired and unknown all fail the same way on purpose: telling them
	// apart would confirm to an attacker that a token was real.
	const hackerId = await repository.redeemClaimToken(claimId, now);
	if (!hackerId) {
		throw new ParticipantLifecycleError("INVALID_CLAIM_TOKEN");
	}

	return { hackerId };
};
