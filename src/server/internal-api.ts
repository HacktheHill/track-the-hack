import { Prisma, type PrismaClient } from "@prisma/client";

export async function runInternalRequest<T>(
	prisma: PrismaClient,
	requestId: string,
	expiresAt: Date,
	action: (db: Prisma.TransactionClient) => Promise<T>,
) {
	await prisma.$transaction(
		async db => {
			await db.internalApiRequest.deleteMany({ where: { expiresAt: { lt: new Date() } } });
			await db.internalApiRequest.create({ data: { id: requestId, expiresAt } });
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);
	return prisma.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
