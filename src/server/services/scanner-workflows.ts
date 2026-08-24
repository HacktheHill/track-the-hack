import { randomUUID } from "node:crypto";
import { MealCategory, Prisma, ScannerWorkflow } from "@prisma/client";
import type { PrismaClient, TShirtSize } from "@prisma/client";

type ScannerPrisma = Pick<PrismaClient, "$executeRaw" | "event" | "hacker" | "presence">;

type ScannerEventRecord = {
	id: string;
	name: string;
	nameFr: string;
	scannerWorkflow: ScannerWorkflow;
	maxCheckIns: number | null;
};

type ScannerEvent = {
	eventId: string;
	name: string;
	nameFr: string;
	workflow: ScannerWorkflow;
};

type PresenceState = {
	id: string;
	value: number;
	atLimit: boolean;
};

type CheckInParticipant = {
	id: string;
	confirmed: boolean;
	tShirtSize: TShirtSize;
};

type MerchandiseParticipant = {
	id: string;
	tShirtSize: TShirtSize;
};

type FoodParticipant = {
	id: string;
	mealCategory: MealCategory;
	requiresFoodLead: boolean;
};

type AttendanceParticipant = {
	id: string;
};

type ScannerParticipant =
	| { workflow: typeof ScannerWorkflow.CHECK_IN; participant: CheckInParticipant }
	| { workflow: typeof ScannerWorkflow.MERCHANDISE; participant: MerchandiseParticipant }
	| { workflow: typeof ScannerWorkflow.FOOD; participant: FoodParticipant }
	| { workflow: typeof ScannerWorkflow.ATTENDANCE; participant: AttendanceParticipant };

export type ScannerResult = ScannerParticipant & ScannerEvent & PresenceState;

export type ScannerRepository = {
	findEvent(id: string): Promise<ScannerEventRecord | null>;
	findEventMaximum(id: string): Promise<{ maxCheckIns: number | null } | null>;
	findCheckInParticipant(id: string): Promise<CheckInParticipant | null>;
	findMerchandiseParticipant(id: string): Promise<MerchandiseParticipant | null>;
	findFoodParticipant(id: string): Promise<Omit<FoodParticipant, "requiresFoodLead"> | null>;
	findAttendanceParticipant(id: string): Promise<AttendanceParticipant | null>;
	ensurePresence(input: {
		id: string;
		eventId: string;
		hackerId: string;
		label: string;
		initialValue: number;
	}): Promise<void>;
	adjustPresence(input: { eventId: string; hackerId: string; amount: -1 | 1; maximum: number | null }): Promise<void>;
	findPresence(eventId: string, hackerId: string): Promise<{ id: string; value: number } | null>;
};

export type ScannerFailure = "EVENT_NOT_FOUND" | "PARTICIPANT_NOT_FOUND" | "PRESENCE_NOT_FOUND";

export class ScannerWorkflowError extends Error {
	constructor(readonly reason: ScannerFailure) {
		super(reason);
		this.name = "ScannerWorkflowError";
	}
}

const eventSelect = {
	id: true,
	name: true,
	nameFr: true,
	scannerWorkflow: true,
	maxCheckIns: true,
} satisfies Prisma.EventSelect;

const normalizeMaximum = (maximum: number | null) => (maximum === null ? null : Math.max(0, maximum));

export const createPrismaScannerRepository = (prisma: ScannerPrisma): ScannerRepository => {
	const findEvent = (id: string) => prisma.event.findUnique({ where: { id }, select: eventSelect });
	const findEventMaximum = (id: string) => prisma.event.findUnique({ where: { id }, select: { maxCheckIns: true } });
	const findCheckInParticipant = (id: string) =>
		prisma.hacker.findUnique({
			where: { id },
			select: { id: true, confirmed: true, tShirtSize: true },
		});
	const findMerchandiseParticipant = (id: string) =>
		prisma.hacker.findUnique({ where: { id }, select: { id: true, tShirtSize: true } });
	const findFoodParticipant = (id: string) =>
		prisma.hacker.findUnique({ where: { id }, select: { id: true, mealCategory: true } });
	const findAttendanceParticipant = (id: string) => prisma.hacker.findUnique({ where: { id }, select: { id: true } });
	const findPresence = (eventId: string, hackerId: string) =>
		prisma.presence.findUnique({
			where: { hackerId_eventId: { hackerId, eventId } },
			select: { id: true, value: true },
		});

	return {
		findEvent,
		findEventMaximum,
		findCheckInParticipant,
		findMerchandiseParticipant,
		findFoodParticipant,
		findAttendanceParticipant,
		ensurePresence: async ({ id, eventId, hackerId, label, initialValue }) => {
			for (let attempt = 0; ; attempt += 1) {
				try {
					await prisma.$executeRaw`
						INSERT INTO \`Presence\` (\`id\`, \`value\`, \`label\`, \`hackerId\`, \`eventId\`)
						VALUES (${id}, ${initialValue}, ${label}, ${hackerId}, ${eventId})
						ON DUPLICATE KEY UPDATE \`id\` = \`id\`
					`;
					return;
				} catch (error) {
					const deadlock =
						error instanceof Prisma.PrismaClientKnownRequestError &&
						error.code === "P2010" &&
						error.meta?.code === "1213";
					if (!deadlock || attempt === 2) throw error;
				}
			}
		},
		adjustPresence: async ({ eventId, hackerId, amount, maximum }) => {
			const valueBoundary =
				amount < 0 ? { value: { gt: 0 } } : maximum === null ? {} : { value: { lt: maximum } };
			await prisma.presence.updateMany({
				where: { hackerId, eventId, ...valueBoundary },
				data: { value: { increment: amount } },
			});
		},
		findPresence,
	};
};

const findParticipant = async (
	repository: ScannerRepository,
	workflow: ScannerWorkflow,
	hackerId: string,
): Promise<ScannerParticipant | null> => {
	switch (workflow) {
		case ScannerWorkflow.CHECK_IN: {
			const participant = await repository.findCheckInParticipant(hackerId);
			return participant ? { workflow: ScannerWorkflow.CHECK_IN, participant } : null;
		}
		case ScannerWorkflow.MERCHANDISE: {
			const participant = await repository.findMerchandiseParticipant(hackerId);
			return participant ? { workflow: ScannerWorkflow.MERCHANDISE, participant } : null;
		}
		case ScannerWorkflow.FOOD: {
			const participant = await repository.findFoodParticipant(hackerId);
			return participant
				? {
						workflow: ScannerWorkflow.FOOD,
						participant: {
							...participant,
							requiresFoodLead: participant.mealCategory === MealCategory.OTHER,
						},
					}
				: null;
		}
		case ScannerWorkflow.ATTENDANCE: {
			const participant = await repository.findAttendanceParticipant(hackerId);
			return participant ? { workflow: ScannerWorkflow.ATTENDANCE, participant } : null;
		}
	}
};

export const scanParticipantForEvent = async (
	repository: ScannerRepository,
	eventId: string,
	hackerId: string,
): Promise<ScannerResult> => {
	const event = await repository.findEvent(eventId);
	if (!event) throw new ScannerWorkflowError("EVENT_NOT_FOUND");
	const participant = await findParticipant(repository, event.scannerWorkflow, hackerId);
	if (!participant) throw new ScannerWorkflowError("PARTICIPANT_NOT_FOUND");

	const maxCheckIns = normalizeMaximum(event.maxCheckIns);
	const initialValue = maxCheckIns === null || maxCheckIns > 0 ? 1 : 0;
	await repository.ensurePresence({
		id: randomUUID(),
		eventId,
		hackerId,
		label: event.name,
		initialValue,
	});
	const presence = await repository.findPresence(eventId, hackerId);
	if (!presence) throw new ScannerWorkflowError("PRESENCE_NOT_FOUND");

	return {
		eventId: event.id,
		name: event.name,
		nameFr: event.nameFr,
		...presence,
		atLimit: maxCheckIns !== null && presence.value >= maxCheckIns,
		...participant,
	};
};

export const adjustPresenceForEvent = async (
	repository: ScannerRepository,
	eventId: string,
	hackerId: string,
	amount: -1 | 1,
): Promise<PresenceState> => {
	const event = await repository.findEventMaximum(eventId);
	if (!event) throw new ScannerWorkflowError("EVENT_NOT_FOUND");

	const maxCheckIns = normalizeMaximum(event.maxCheckIns);
	await repository.adjustPresence({ eventId, hackerId, amount, maximum: maxCheckIns });

	const presence = await repository.findPresence(eventId, hackerId);
	if (!presence) throw new ScannerWorkflowError("PRESENCE_NOT_FOUND");

	// A zero-row conditional update is an expected no-op at zero or at the cap.
	// The current database value is authoritative for all scanner devices.
	return {
		...presence,
		atLimit: maxCheckIns !== null && presence.value >= maxCheckIns,
	};
};
