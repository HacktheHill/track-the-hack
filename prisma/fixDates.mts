import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	await prisma.hackerInfo.updateMany({
		where: {
			acceptanceExpiry: {
				equals: new Date("2023-03-01T05:00:00.000Z"), // Mar 1, 2023
			},
		},
		data: {
			acceptanceExpiry: new Date("2023-03-02T05:00:00.000Z"), // Mar 2, 2023
		},
	});
}

main()
	.catch(error => {
		throw error;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
