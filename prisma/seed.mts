import { AttendanceType, Language, PrismaClient, ShirtSize } from "@prisma/client";
import csv from "csvtojson";
import * as fs from "fs";
import { z } from "zod";
const prisma = new PrismaClient();

function parseBool(bool: string) {
	if (bool === "0") {
		return false;
	} else if (bool === "1") {
		return true;
	} else {
		return null;
	}
}

function NaNToNull(num: number) {
	return Number.isNaN(num) ? null : num;
}

async function main() {
	const csvParser = csv({
		headers: [
			"submissionID",
			"preferredLanguage",
			"email",
			"firstName",
			"lastName",
			"gender",
			"phoneNumber",
			"university",
			"studyLevel",
			"studyProgram",
			"graduationYear",
			"attendanceType",
			"attendanceLocation",
			"transportationRequired",
			"dietaryRestrictions",
			"accessibilityRequirements",
			"shirtSize",
			"emergencyContactName",
			"emergencyContactRelationship",
			"emergencyContactPhoneNumber",
			"numberOfPreviousHackathons",
			"linkGithub",
			"linkLinkedin",
			"linkPersonalSite",
			"linkResume",
			"lookingForwardTo",
			"formStartDate",
			"formEndDate",
		],
		trim: true,
	});

	void fs.createReadStream("prisma/data.csv").pipe(csvParser);

	void csvParser.subscribe(async (row: Row) => {
		try {
			const data = {
				...row,
				id: row.submissionID,
				submissionID: undefined,
				preferredLanguage: Language[row.preferredLanguage as keyof typeof Language],
				graduationYear: z
					.number()
					.int()
					.nullable()
					.parse(NaNToNull(parseInt(row.graduationYear ?? ""))),
				attendanceType: AttendanceType[row.attendanceType as keyof typeof AttendanceType],
				transportationRequired: z.boolean().parse(parseBool(row.transportationRequired ?? "")),
				shirtSize: ShirtSize[row.shirtSize as keyof typeof ShirtSize],
				numberOfPreviousHackathons: z
					.number()
					.int()
					.nullable()
					.parse(NaNToNull(parseInt(row.numberOfPreviousHackathons ?? ""))),
				formStartDate: z.date().parse(new Date(row.formStartDate ?? "")),
				formEndDate: z.date().parse(new Date(row.formEndDate ?? "")),
			};

			await prisma.hackerInfo.upsert({
				where: {
					id: row.submissionID,
				},
				create: data,
				update: data,
			});
		} catch (error) {
			console.error(error);
		}
	});

	await csvParser;
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

interface Row {
	submissionID: string;
	preferredLanguage: string;
	email: string;
	firstName: string;
	lastName: string;
	gender: string;
	phoneNumber: string;
	university: string;
	studyLevel: string;
	studyProgram: string;
	graduationYear: string;
	attendanceType: string;
	attendanceLocation: string;
	transportationRequired: string;
	dietaryRestrictions: string;
	accessibilityRequirements: string;
	shirtSize: string;
	emergencyContactName: string;
	emergencyContactRelationship: string;
	emergencyContactPhoneNumber: string;
	numberOfPreviousHackathons: string;
	linkGithub: string;
	linkLinkedin: string;
	linkPersonalSite: string;
	linkResume: string;
	lookingForwardTo: string;
	formStartDate: string;
	formEndDate: string;
}
