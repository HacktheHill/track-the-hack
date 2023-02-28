import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// This script hasn't been run yet
// Instead we are creating new presenceInfos dynamically in the presence tRPC procedure
async function main() {
	for (const hackerInfo of await prisma.hackerInfo.findMany()) {
		await prisma.presenceInfo.create({
			data: {
				hackerInfo: {
					connect: {
						id: hackerInfo.id,
					},
				},
			},
		});
	}
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async e => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
