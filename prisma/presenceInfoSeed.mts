import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
	for (const hackerInfo of await prisma.hackerInfo.findMany()) {
		await prisma.hackerInfo.update({
			where: {
				id: hackerInfo.id,
			},
			data: {
				presenceInfo: {
					create: {},
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
