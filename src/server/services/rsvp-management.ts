import { z } from "zod";
import {
	ParticipantLifecycleError,
	readCancellationToken,
	type RsvpStatus,
} from "@/server/services/hacker-lifecycle";
import { rsvpStatus } from "@/server/services/hacker-lifecycle";

export type ManagedRsvp = {
	status: RsvpStatus;
	canAttend: boolean;
};

export interface RsvpManagementRepository {
	read(capabilityId: string, now: Date): Promise<ManagedRsvp | null>;
	decide(capabilityId: string, attending: boolean, now: Date): Promise<ManagedRsvp | "expired" | null>;
}

const capabilityIdFromToken = (tokenInput: unknown, secret: string) => {
	const token = z.string().min(1).max(256).parse(tokenInput);
	const capabilityId = readCancellationToken(token, secret);
	if (!capabilityId) throw new ParticipantLifecycleError("INVALID_CANCELLATION_CAPABILITY");
	return capabilityId;
};

export const readManagedRsvp = async (
	repository: RsvpManagementRepository,
	tokenInput: unknown,
	secret: string,
	now = new Date(),
) => {
	const result = await repository.read(capabilityIdFromToken(tokenInput, secret), now);
	if (!result) throw new ParticipantLifecycleError("INVALID_CANCELLATION_CAPABILITY");
	return result;
};

export const decideManagedRsvp = async (
	repository: RsvpManagementRepository,
	tokenInput: unknown,
	secret: string,
	attending: boolean,
	now = new Date(),
) => {
	const result = await repository.decide(capabilityIdFromToken(tokenInput, secret), attending, now);
	if (!result) throw new ParticipantLifecycleError("INVALID_CANCELLATION_CAPABILITY");
	if (result === "expired") throw new ParticipantLifecycleError("INVALID_OR_EXPIRED_INVITATION");
	return result;
};

export const managedRsvpState = (
	confirmed: boolean,
	respondedAt: Date | null,
	acceptanceExpiry: Date,
	now: Date,
): ManagedRsvp => ({
	status: rsvpStatus(confirmed, respondedAt),
	canAttend: acceptanceExpiry.getTime() > now.getTime(),
});
