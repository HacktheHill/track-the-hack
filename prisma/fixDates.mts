import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	await prisma.hackerInfo.updateMany({
		where: {
			acceptanceExpiry: {
				equals: new Date("2023-02-19T05:00:00.000Z"), // Feb 19, 2023
			},
		},
		data: {
			acceptanceExpiry: new Date("2023-02-20T05:00:00.000Z"), // Feb 20, 2023
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			acceptanceExpiry: {
				equals: new Date("2023-03-02T05:00:00.000Z"), // Mar 2, 2023
			},
		},
		data: {
			acceptanceExpiry: new Date("2023-03-03T05:00:00.000Z"), // Mar 3, 2023
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
