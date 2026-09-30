import type { DevpostMetricsSnapshot } from "@/server/services/external-metrics";

export type CsvRow = Record<string, string>;

const normalizeEmail = (value: unknown) =>
	String(value ?? "")
		.trim()
		.toLowerCase();
const nonEmpty = (value: unknown) => String(value ?? "").trim();
const isAccepted = (row: CsvRow) => /^accepted$/i.test(nonEmpty(row["Admission status"]));
const isConfirmed = (row: CsvRow) => isAccepted(row) && nonEmpty(row["RSVP Status"]) === "CONFIRMED";
const attendanceValue = (row: CsvRow) => nonEmpty(row.Attended);
const isAttended = (row: CsvRow) => /^(yes|true|1)$/i.test(attendanceValue(row));
const applicationEmail = (row: CsvRow) => normalizeEmail(row["Email address"] || row["Adresse courriel"]);

export type DevpostImportOptions = {
	activeRegistrants: number;
	submitters: number;
	teamUpRequests: number;
};

export const buildDevpostMetricsSnapshot = (
	projectRows: CsvRow[],
	registrantRows: CsvRow[],
	applicationRows: CsvRow[],
	options: DevpostImportOptions,
): DevpostMetricsSnapshot => {
	const applications = applicationRows.filter(row => nonEmpty(row["Submission ID"]));
	const applicationsWithEmail = applications.filter(row => applicationEmail(row));
	const latestApplicationByEmail = new Map<string, CsvRow>();
	for (const row of applicationsWithEmail) latestApplicationByEmail.set(applicationEmail(row), row);

	const submittedProjects = projectRows.filter(row => nonEmpty(row["Project Status"]).startsWith("Submitted ("));
	const submittedParticipantEmails = new Set<string>();
	for (const project of submittedProjects) {
		for (const [header, value] of Object.entries(project)) {
			const email = normalizeEmail(value);
			const isKnownEmailColumn = /^(Submitter|Team Member \d+) Email$/.test(header);
			const isUnlabelledEmailColumn = /^field\d+$/.test(header) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
			if ((isKnownEmailColumn || isUnlabelledEmailColumn) && email) submittedParticipantEmails.add(email);
		}
	}
	const submittedRegistrant = (row: CsvRow) => submittedParticipantEmails.has(normalizeEmail(row.Email));
	const matched = registrantRows.flatMap(registrant => {
		const application = latestApplicationByEmail.get(normalizeEmail(registrant.Email));
		return application ? [{ registrant, application }] : [];
	});
	const matchedSubmitters = matched.filter(({ registrant }) => submittedRegistrant(registrant));
	const hasAttendance = matched.some(({ application }) => attendanceValue(application));
	const matchedAttended = hasAttendance
		? matched.filter(({ application }) => isAccepted(application) && isAttended(application)).length
		: undefined;
	const matchedAttendedSubmitters = hasAttendance
		? matchedSubmitters.filter(({ application }) => isAccepted(application) && isAttended(application)).length
		: undefined;
	const publicProjects = projectRows.filter(
		row => nonEmpty(row["Project Status"]) === "Submitted (Gallery/Visible)",
	).length;
	const hiddenProjects = projectRows.filter(row => nonEmpty(row["Project Status"]) === "Submitted (Hidden)").length;
	const draftProjects = projectRows.filter(row => nonEmpty(row["Project Status"]) === "Draft").length;

	return {
		kind: "devpost",
		registrants: registrantRows.length,
		activeRegistrants: options.activeRegistrants,
		submitters: options.submitters,
		submittedProjects: publicProjects + hiddenProjects,
		publicProjects,
		hiddenProjects,
		draftProjects,
		teamUpRequests: options.teamUpRequests,
		linkage: {
			applicationRows: applications.length,
			uniqueApplicationEmails: latestApplicationByEmail.size,
			duplicateApplicationRows: applicationsWithEmail.length - latestApplicationByEmail.size,
			matchedRegistrants: matched.length,
			matchedAccepted: matched.filter(({ application }) => isAccepted(application)).length,
			matchedConfirmed: matched.filter(({ application }) => isConfirmed(application)).length,
			...(matchedAttended === undefined ? {} : { matchedAttended }),
			matchedSubmitters: matchedSubmitters.length,
			matchedAcceptedSubmitters: matchedSubmitters.filter(({ application }) => isAccepted(application)).length,
			matchedConfirmedSubmitters: matchedSubmitters.filter(({ application }) => isConfirmed(application)).length,
			...(matchedAttendedSubmitters === undefined ? {} : { matchedAttendedSubmitters }),
			unmatchedRegistrants: registrantRows.length - matched.length,
		},
	};
};
