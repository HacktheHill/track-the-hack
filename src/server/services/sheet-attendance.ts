import { ScannerWorkflow, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { participantIdSchema } from "@/server/services/hacker-lifecycle";

export const sheetAttendanceInputSchema = z
	.object({ ids: z.array(participantIdSchema).min(1).max(1000) })
	.strict()
	.refine(value => new Set(value.ids).size === value.ids.length, { message: "Participant IDs must be unique." });

export type SheetAttendanceRepository = {
	findAttendance(ids: string[]): Promise<Array<{ id: string; attended: boolean }>>;
};

export const reconcileSheetAttendance = async (repository: SheetAttendanceRepository, input: unknown) => {
	const { ids } = sheetAttendanceInputSchema.parse(input);
	const records = await repository.findAttendance(ids);
	const found = new Set(records.map(record => record.id));
	return { records, missingIds: ids.filter(id => !found.has(id)) };
};

export const createPrismaSheetAttendanceRepository = (
	prisma: Pick<PrismaClient, "hacker">,
): SheetAttendanceRepository => ({
	findAttendance: async ids =>
		(
			await prisma.hacker.findMany({
				where: { id: { in: ids } },
				select: {
					id: true,
					presences: {
						where: { value: { gt: 0 }, event: { scannerWorkflow: ScannerWorkflow.CHECK_IN } },
						select: { id: true },
						take: 1,
					},
				},
			})
		).map(record => ({ id: record.id, attended: record.presences.length > 0 })),
});
