import { MealCategory, ScannerWorkflow } from "@prisma/client";
import type { Prisma, PrismaClient, TShirtSize } from "@prisma/client";

type ScannerPrisma = Pick<PrismaClient, "event" | "hacker" | "presence">;

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

const findParticipant = async (
	prisma: ScannerPrisma,
	workflow: ScannerWorkflow,
	hackerId: string,
): Promise<ScannerParticipant | null> => {
	switch (workflow) {
		case ScannerWorkflow.CHECK_IN: {
			const participant = await prisma.hacker.findUnique({
				where: { id: hackerId },
				select: { id: true, confirmed: true, tShirtSize: true },
			});
			return participant ? { workflow: ScannerWorkflow.CHECK_IN, participant } : null;
		}
		case ScannerWorkflow.MERCHANDISE: {
			const participant = await prisma.hacker.findUnique({
				where: { id: hackerId },
				select: { id: true, tShirtSize: true },
			});
			return participant ? { workflow: ScannerWorkflow.MERCHANDISE, participant } : null;
		}
		case ScannerWorkflow.FOOD: {
			const participant = await prisma.hacker.findUnique({
				where: { id: hackerId },
				select: { id: true, mealCategory: true },
			});
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
			const participant = await prisma.hacker.findUnique({ where: { id: hackerId }, select: { id: true } });
			return participant ? { workflow: ScannerWorkflow.ATTENDANCE, participant } : null;
		}
	}
};

export const scanParticipantForEvent = async (
	prisma: ScannerPrisma,
	eventId: string,
	hackerId: string,
): Promise<ScannerResult> => {
	const event = await prisma.event.findUnique({ where: { id: eventId }, select: eventSelect });
	if (!event) throw new ScannerWorkflowError("EVENT_NOT_FOUND");
	const participant = await findParticipant(prisma, event.scannerWorkflow, hackerId);
	if (!participant) throw new ScannerWorkflowError("PARTICIPANT_NOT_FOUND");

	const maxCheckIns = normalizeMaximum(event.maxCheckIns);
	const initialValue = maxCheckIns === null || maxCheckIns > 0 ? 1 : 0;
	const presence = await prisma.presence.upsert({
		where: { hackerId_eventId: { hackerId, eventId } },
		create: { hackerId, eventId, label: event.name, value: initialValue },
		// A repeated scan must show the existing counter, not silently add to it.
		update: {},
		select: { id: true, value: true },
	});

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
	prisma: ScannerPrisma,
	eventId: string,
	hackerId: string,
	amount: -1 | 1,
): Promise<PresenceState> => {
	const event = await prisma.event.findUnique({
		where: { id: eventId },
		select: { maxCheckIns: true },
	});
	if (!event) throw new ScannerWorkflowError("EVENT_NOT_FOUND");

	const maxCheckIns = normalizeMaximum(event.maxCheckIns);
	const valueBoundary =
		amount < 0 ? { value: { gt: 0 } } : maxCheckIns === null ? {} : { value: { lt: maxCheckIns } };
	await prisma.presence.updateMany({
		where: {
			hackerId,
			eventId,
			...valueBoundary,
		},
		data: { value: { increment: amount } },
	});

	const presence = await prisma.presence.findUnique({
		where: { hackerId_eventId: { hackerId, eventId } },
		select: { id: true, value: true },
	});
	if (!presence) throw new ScannerWorkflowError("PRESENCE_NOT_FOUND");

	// A zero-row conditional update is an expected no-op at zero or at the cap.
	// The current database value is authoritative for all scanner devices.
	return {
		...presence,
		atLimit: maxCheckIns !== null && presence.value >= maxCheckIns,
	};
};
