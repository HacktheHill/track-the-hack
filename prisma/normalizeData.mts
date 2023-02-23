import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	await prisma.hackerInfo.updateMany({
		where: {
			university: {
				equals: "Université d'Ottawa", 
			},
		},
		data: {
			university: "University of Ottawa", 
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			university: {
				equals: "Université Concordia", 
			},
		},
		data: {
			university: "Concordia University", 
		},
	});


	await prisma.hackerInfo.updateMany({
		where: {
			studyLevel: {
				equals: "Secondary / High School", 
			},
		},
		data: {
			university: "High School", 
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			studyLevel: {
				equals: "I'm not currently a student", 
			},
		},
		data: {
			university: null, 
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			university: {
				contains: "Western"
			 },
		},
		data: {
			university: "Western University", 
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			university: {
				contains: "Queen"
			 },
		},
		data: {
			university: "Queen's University", 
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			OR: [
				{
					university: {
						contains: "McGill"
				 },
				},
				{
					university: {
						contains: "Mcgill"
				 },
				}
			]
			
		},
		data: {
			university: "McGill University", 
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			OR: [
				{
					university: {
						contains: "Gap"
				 },
				},
				{
					university: {
						contains: "Je ne suis pas Etudiante"
				 },
				}
			]
		},
		data: {
			university: null, 
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			university: {
				contains: "Conestoga"
			 },
		},
		data: {
			university: "Conestoga College", 
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			studyLevel: {
				equals: "Premier cycle", 
			},
		},
		data: {
			studyLevel: "Undergraduate", 
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			studyLevel: {
				equals: "Supérieures", 
			},
		},
		data: {
			studyLevel: "Graduate (Masters, PhD)", 
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			studyProgram: {
				equals: "Génie logiciel", 
			},
		},
		data: {
			studyProgram: "Software Engineering", 
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			studyProgram: {
				equals: "Génie informatique", 
			},
		},
		data: {
			studyProgram: "Computer Engineering", 
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			studyProgram: {
				equals: "Génie électrique", 
			},
		},
		data: {
			studyProgram: "Electrical Engineering", 
		},
	});

	await prisma.hackerInfo.updateMany({
		where: {
			studyProgram: {
				equals: "Droit", 
			},
		},
		data: {
			studyProgram: "Law", 
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
