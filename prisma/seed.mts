import { AttendanceType, Language, PrismaClient, ShirtSize } from "@prisma/client";
import csv from "csvtojson";
import * as fs from "fs";
import { z } from "zod";
const prisma = new PrismaClient();

/* 2023-03-01 */
const ACCEPTANCE_EXPIRY = new Date(2023, 2, 1, 0, 0, 0, 0);

// List of submission IDs that are allowed to be inserted (we can't insert everything because stuff has been removed and modified since and we don't want to mess up the database)
const WHITE_LIST = [] as string[];

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
	// Read from a CSV file containing registrations
	const registrations = csv({
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
		delimiter: "|",
	});
	void fs.createReadStream("prisma/registrations.csv").pipe(registrations);

	// Insert any missing rows from the registrations
	void registrations.subscribe(async (row: RegistrationsRow) => {
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
				location: row.attendanceLocation,
				attendanceLocation: undefined,
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
				presenceInfo: {
					create: {},
				},
			};

			// Check if the row already exists
			if (
				await prisma.hackerInfo.findUnique({
					where: { id: data.id },
				})
			) {
				return;
			}

			// Check if the row is not in the white list
			if (!WHITE_LIST.includes(data.id)) {
				return;
			}

			console.info(`Inserting row ${data.id}...`);

			await prisma.hackerInfo.create({
				data,
			});
		} catch (error) {
			console.error(row, error);
		}
	});
	await registrations;

	// Read from a CSV file containing the acceptances email list
	const emails = csv({
		headers: ["id", "name", "email", "language"],
		trim: true,
	});
	void fs.createReadStream("prisma/emails.csv").pipe(emails);

	// Update any existing rows with the acceptances email list
	void emails.subscribe(async (row: EmailsRow) => {
		try {
			const data = {
				id: row.id,
				acceptanceExpiry: ACCEPTANCE_EXPIRY,
			};

			// Check if the row doesn't exist
			if (
				!(await prisma.hackerInfo.findUnique({
					where: { id: data.id },
				}))
			) {
				console.error(`Row ${data.id} does not exist`);
				return;
			}

			await prisma.hackerInfo.update({
				where: { id: data.id },
				data,
			});
		} catch (error) {
			console.error(row, error);
		}
	});
	await emails;

	/* // Read from a CSV file containing the online-only list
	const online = csv({
		headers: ["id", "name", "email", "language"],
		trim: true,
	});
	void fs.createReadStream("prisma/online.csv").pipe(online);

	// Update any existing rows with the online-only list
	void online.subscribe(async (row: EmailsRow) => {
		try {
			const data = {
				id: row.id,
				attendanceType: AttendanceType.ONLINE,
				onlyOnline: true,
			};

			// Check if the row doesn't exist
			if (
				!(await prisma.hackerInfo.findUnique({
					where: { id: data.id },
				}))
			) {
				console.error(`Row ${data.id} does not exist`);
				return;
			}

			await prisma.hackerInfo.update({
				where: { id: data.id },
				data,
			});
		} catch (error) {
			console.error(row, error);
		}
	});
	await online; */
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

interface RegistrationsRow {
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
	location: string;
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

type EmailsRow = {
	id: string;
	name: string;
	email: string;
	language: "en" | "fr";
};
