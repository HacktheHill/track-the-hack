import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type ScannerWorkflow } from "@prisma/client";
import { getOrganizerAccess } from "@/server/lib/organizer-auth";
import { ScannerWorkflowError, type ScanOutcome } from "@/server/services/scanner-workflows";

type OrganizerScannerPrisma = Pick<
	PrismaClient,
	"$executeRaw" | "event" | "organizerPresence" | "organizerAccess" | "user"
>;

const eventSelect = {
	id: true,
	name: true,
	nameFr: true,
	scannerEnabled: true,
	scannerWorkflow: true,
	maxCheckIns: true,
} satisfies Prisma.EventSelect;

const normalizeMaximum = (maximum: number | null) => (maximum === null ? null : Math.max(0, maximum));

export type OrganizerScannerResult = {
	subjectType: "organizer";
	organizer: { id: string; name: string | null };
	eventId: string;
	name: string;
	nameFr: string;
	workflow: ScannerWorkflow;
	id: string;
	value: number;
	atLimit: boolean;
	recordedNow: boolean;
	outcome: ScanOutcome;
};

export const scanOrganizerForEvent = async (
	prisma: OrganizerScannerPrisma,
	eventId: string,
	organizerId: string,
): Promise<OrganizerScannerResult> => {
	const [event, organizer] = await Promise.all([
		prisma.event.findUnique({ where: { id: eventId }, select: eventSelect }),
		getOrganizerAccess(prisma, organizerId),
	]);
	if (!event?.scannerEnabled) throw new ScannerWorkflowError("EVENT_NOT_FOUND");
	if (!organizer) throw new ScannerWorkflowError("PARTICIPANT_NOT_FOUND");

	const maximum = normalizeMaximum(event.maxCheckIns);
	const initialValue = maximum === null || maximum > 0 ? 1 : 0;
	const where = { organizerId_eventId: { organizerId, eventId } };
	const before = await prisma.organizerPresence.findUnique({ where, select: { id: true, value: true } });
	const candidateId = randomUUID();
	await prisma.$executeRaw`
		INSERT INTO \`OrganizerPresence\` (\`id\`, \`value\`, \`label\`, \`organizerId\`, \`eventId\`)
		VALUES (${candidateId}, ${initialValue}, ${event.name}, ${organizerId}, ${eventId})
		ON DUPLICATE KEY UPDATE \`id\` = \`id\`
	`;
	let presence = await prisma.organizerPresence.findUnique({ where, select: { id: true, value: true } });
	if (!presence) throw new ScannerWorkflowError("PRESENCE_NOT_FOUND");
	const recordedNow = presence.id === candidateId;
	let outcome: ScanOutcome;
	if (before && maximum !== null && maximum > 1) {
		const updated = await prisma.$executeRaw`
			UPDATE \`OrganizerPresence\`
			SET \`value\` = \`value\` + 1
			WHERE \`organizerId\` = ${organizerId}
				AND \`eventId\` = ${eventId}
				AND \`value\` < ${maximum}
		`;
		presence =
			(await prisma.organizerPresence.findUnique({ where, select: { id: true, value: true } })) ?? presence;
		outcome = updated === 1 ? "incremented" : presence.value >= maximum ? "limit" : "unchanged";
	} else if (recordedNow) {
		outcome = maximum === 0 ? "limit" : "new";
	} else {
		outcome = maximum !== null && presence.value >= maximum ? "limit" : "unchanged";
	}

	return {
		subjectType: "organizer",
		organizer: { id: organizer.id, name: organizer.name },
		eventId: event.id,
		name: event.name,
		nameFr: event.nameFr,
		workflow: event.scannerWorkflow,
		...presence,
		atLimit: maximum !== null && presence.value >= maximum,
		recordedNow,
		outcome,
	};
};

export const adjustOrganizerPresenceForEvent = async (
	prisma: OrganizerScannerPrisma,
	eventId: string,
	organizerId: string,
	amount: -1 | 1,
	expectedValue: number,
) => {
	const [event, organizer] = await Promise.all([
		prisma.event.findUnique({
			where: { id: eventId },
			select: { maxCheckIns: true, scannerEnabled: true, scannerWorkflow: true },
		}),
		getOrganizerAccess(prisma, organizerId),
	]);
	if (!event?.scannerEnabled) throw new ScannerWorkflowError("EVENT_NOT_FOUND");
	if (!organizer) throw new ScannerWorkflowError("PARTICIPANT_NOT_FOUND");
	const maximum = normalizeMaximum(event.maxCheckIns);
	const upperBound = amount > 0 && maximum !== null ? Prisma.sql`AND \`value\` < ${maximum}` : Prisma.empty;
	const lowerBound = amount < 0 ? Prisma.sql`AND \`value\` > 0` : Prisma.empty;
	const updated = await prisma.$executeRaw`
		UPDATE \`OrganizerPresence\`
		SET \`value\` = \`value\` + ${amount}
		WHERE \`organizerId\` = ${organizerId}
			AND \`eventId\` = ${eventId}
			AND \`value\` = ${expectedValue}
			${lowerBound}
			${upperBound}
	`;
	const presence = await prisma.organizerPresence.findUnique({
		where: { organizerId_eventId: { organizerId, eventId } },
		select: { id: true, value: true },
	});
	if (!presence) throw new ScannerWorkflowError("PRESENCE_NOT_FOUND");
	return {
		...presence,
		atLimit: maximum !== null && presence.value >= maximum,
		beforeValue: expectedValue,
		workflow: event.scannerWorkflow,
		applied: updated === 1,
		stale: updated !== 1 && presence.value !== expectedValue,
	};
};
