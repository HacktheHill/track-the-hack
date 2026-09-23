import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import csv from "csvtojson";
import { z } from "zod";

type ResponseRow = Record<string, string>;
export type RsvpRecipient = {
	email: string;
	name: string;
	rsvpUrl: string;
	deadlineEn: string;
	deadlineFr: string;
};

const deadlineSchema = z.string().datetime({ offset: true });
const emailSchema = z.string().trim().toLowerCase().email();
const tokenPattern = /^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/;
const requiredColumns = ["Admission status", "Participant ID", "RSVP Link", "RSVP Status", "RSVP Deadline"];
const optionalColumns = ["Email address", "Adresse courriel", "First name", "Prénom"];

export const responseRowsFromMatrix = (matrix: string[][]): ResponseRow[] => {
	const headers = matrix[0];
	if (!headers) throw new Error("The response export has no header row.");
	const columns = [...requiredColumns, ...optionalColumns];
	const indices = new Map(columns.map(header => {
		const matches = headers.flatMap((value, index) => value === header ? [index] : []);
		if (matches.length > 1 || (requiredColumns.includes(header) && matches.length !== 1)) {
			throw new Error(`The response export has a missing or duplicate ${header} header.`);
		}
		return [header, matches[0]];
	}));
	if (indices.get("Email address") === undefined && indices.get("Adresse courriel") === undefined) {
		throw new Error("The response export has no applicant email column.");
	}
	return matrix.slice(1).filter(cells => cells.some(Boolean)).map(cells => Object.fromEntries(
		[...indices].map(([header, index]) => [header, index === undefined ? "" : cells[index] ?? ""]),
	));
};

export const prepareRsvpRecipients = (rows: ResponseRow[], baseUrl: string, now = new Date()): RsvpRecipient[] => {
	const origin = new URL(baseUrl);
	if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) {
		throw new Error("Base URL must be an HTTPS origin.");
	}
	const accepted = rows.flatMap((row, index) => /^(accepted|accepté|acceptée)$/i.test(String(row["Admission status"] || "").trim()) ? [{ row, rowNumber: index + 2 }] : []);
	if (!accepted.length) throw new Error("No Accepted response rows were found.");
	const seenIds = new Set<string>();
	const seenEmails = new Set<string>();
	let deadlineIso = "";
	const recipients: RsvpRecipient[] = [];

	for (const { row, rowNumber } of accepted) {
		const id = String(row["Participant ID"] || "").trim();
		if (!/^[A-Za-z0-9_-]{22,128}$/.test(id) || seenIds.has(id)) throw new Error(`Accepted row ${rowNumber} has a missing, invalid, or duplicate Participant ID.`);
		seenIds.add(id);
		const status = String(row["RSVP Status"] || "").trim();
		if (status !== "PENDING" && status !== "CONFIRMED" && status !== "DECLINED") throw new Error(`Accepted row ${rowNumber} has no reconciled RSVP status.`);

		const rowDeadline = deadlineSchema.safeParse(String(row["RSVP Deadline"] || "").trim());
		if (!rowDeadline.success) throw new Error(`Accepted row ${rowNumber} needs an ISO-8601 RSVP Deadline.`);
		if (deadlineIso && rowDeadline.data !== deadlineIso) throw new Error("Accepted rows have different RSVP deadlines.");
		deadlineIso = rowDeadline.data;

		const link = String(row["RSVP Link"] || "").trim();
		let parsed: URL;
		try { parsed = new URL(link); } catch { throw new Error(`Accepted row ${rowNumber} has no valid RSVP management link.`); }
		if (parsed.origin !== origin.origin || parsed.pathname !== "/rsvp/manage" || parsed.search || !tokenPattern.test(parsed.hash.slice(1))) {
			throw new Error(`Accepted row ${rowNumber} has no valid RSVP management link.`);
		}
		if (status !== "PENDING") continue;

		const englishEmail = String(row["Email address"] || "").trim();
		const frenchEmail = String(row["Adresse courriel"] || "").trim();
		if (englishEmail && frenchEmail && englishEmail.toLowerCase() !== frenchEmail.toLowerCase()) {
			throw new Error(`Accepted row ${rowNumber} has conflicting email addresses.`);
		}
		const parsedEmail = emailSchema.safeParse(englishEmail || frenchEmail);
		if (!parsedEmail.success || seenEmails.has(parsedEmail.data)) throw new Error(`Accepted row ${rowNumber} has a missing, invalid, or duplicate email address.`);
		seenEmails.add(parsedEmail.data);
		const name = String(row["First name"] || row["Prénom"] || "").trim().replace(/[\r\n]+/g, " ");
		const deadline = new Date(deadlineIso);
		recipients.push({
			email: parsedEmail.data,
			name,
			rsvpUrl: parsed.href,
			deadlineEn: formatDeadline(deadline, "en-CA"),
			deadlineFr: formatDeadline(deadline, "fr-CA"),
		});
	}
	if (new Date(deadlineIso).getTime() <= now.getTime()) throw new Error("The RSVP deadline has passed.");
	if (!recipients.length) throw new Error("No pending accepted applicants remain for this campaign.");
	return recipients;
};

const formatDeadline = (deadline: Date, locale: string) => new Intl.DateTimeFormat(locale, {
	year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
	timeZone: "America/Toronto", timeZoneName: "short",
}).format(deadline);

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
export const recipientCsv = (recipients: RsvpRecipient[]) => [
	"email,name,rsvpUrl,deadlineEn,deadlineFr",
	...recipients.map(row => [row.email, row.name, row.rsvpUrl, row.deadlineEn, row.deadlineFr].map(csvCell).join(",")),
].join("\n") + "\n";

const arg = (name: string) => {
	const index = process.argv.indexOf(name);
	const value = process.argv[index + 1];
	if (index < 0 || !value) throw new Error(`Missing ${name}.`);
	return value;
};

const runCli = async () => {
	try {
		const input = arg("--input");
		const output = arg("--output");
		const baseUrl = arg("--base-url");
		if (resolve(input) === resolve(output)) throw new Error("Input and output must be different files.");
		const rawRows: unknown = await csv({ noheader: true, output: "csv" }).fromFile(input);
		const rows = responseRowsFromMatrix(z.array(z.array(z.string())).parse(rawRows));
		const recipients = prepareRsvpRecipients(rows, baseUrl);
		await writeFile(output, recipientCsv(recipients), { flag: "wx", mode: 0o600 });
		console.info(`Prepared ${recipients.length} pending invitation recipient(s). No email was sent.`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : "RSVP preparation failed.");
		process.exitCode = 1;
	}
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	void runCli();
}
