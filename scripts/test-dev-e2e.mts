import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { constants as fsConstants } from "node:fs";
import { access, mkdtemp, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient, type ScannerWorkflow } from "@prisma/client";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { chromium, type Browser, type BrowserContext } from "playwright-core";
import superjson from "superjson";
import { z } from "zod";
import type { AppRouter } from "@/server/api/root";
import { provisioningBatchSchema } from "@/server/services/hacker-lifecycle";
import { applicationRow, createSheetHarness } from "@root/test/helpers/google-sheets-harness";
import { deliverLocalParticipantEmail } from "./dev-email.mjs";
import {
	acceptedSheetRowsToOperationalRecords,
	loadTallySheetFixture,
	syncTallyFixtureToSheet,
} from "./dev-tally-sheet.mjs";

type OperationalRecord = ReturnType<typeof acceptedSheetRowsToOperationalRecords>[number];
type JsonRequestBody =
	OperationalRecord | { hackers: OperationalRecord[] } | { ids: string[] } | { confirm: boolean } | { token: string };
type JsonRequestOptions = { headers?: HeadersInit; jar?: CookieJar };

const processedResponseSchema = z.object({ processed: z.number().int().nonnegative() }).strict();
const reconciliationResponseSchema = z
	.object({
		records: z.array(
			z
				.object({
					id: z.string().min(1),
					confirmed: z.boolean(),
					cancellationLink: z.string().url().optional(),
				})
				.strict(),
		),
		missingIds: z.array(z.string()),
	})
	.strict();
const claimResponseSchema = z.object({ claimUrl: z.string().url() }).strict();
const authProviderSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		type: z.enum(["credentials", "oauth"]),
		signinUrl: z.string().url(),
		callbackUrl: z.string().url(),
	})
	.strict();
const authProvidersSchema = z
	.object({ google: authProviderSchema, development: authProviderSchema.optional() })
	.strict();
const sessionSchema = z.object({ user: z.object({ roles: z.array(z.string()) }) });
const unauthorizedErrorSchema = z.object({ data: z.object({ code: z.literal("UNAUTHORIZED") }) });

const wait = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

const getOpenPort = () =>
	new Promise<number>((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close();
				reject(new Error("Could not reserve a local port"));
				return;
			}
			server.close(error => (error ? reject(error) : resolve(address.port)));
		});
	});

class CookieJar {
	cookies = new Map<string, string>();

	read(headers: Headers) {
		for (const cookie of headers.getSetCookie()) {
			const [pair, ...attributes] = cookie.split(";");
			if (!pair) continue;
			const separator = pair.indexOf("=");
			if (separator < 1) continue;
			const name = pair.slice(0, separator);
			const value = pair.slice(separator + 1);
			const expired = attributes.some(attribute => attribute.trim().toLowerCase() === "max-age=0");
			if (expired || value === "") this.cookies.delete(name);
			else this.cookies.set(name, value);
		}
	}

	header() {
		return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
	}
}

const serverOutput: string[] = [];
const rememberOutput = (chunk: Buffer | string) => {
	serverOutput.push(String(chunk));
	if (serverOutput.length > 200) serverOutput.shift();
};

const configuredUrl = new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000");
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const configuredServerIsReady =
	!process.env.NEXT_DIST_DIR &&
	loopbackHosts.has(configuredUrl.hostname) &&
	(await fetch(new URL("/api/readyz", configuredUrl))
		.then(response => response.ok)
		.catch(() => false));

let baseUrl = configuredUrl.origin;
let next: ChildProcess | null = null;
let browser: Browser | null = null;
let participantContext: BrowserContext | null = null;
if (configuredServerIsReady) {
	console.info(`Reusing the healthy development server at ${baseUrl}.`);
} else {
	const port = await getOpenPort();
	baseUrl = `http://127.0.0.1:${port}`;
	const spawnedNext = spawn(
		process.execPath,
		["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)],
		{
			cwd: process.cwd(),
			env: {
				...process.env,
				DEV_AUTH_ENABLED: "1",
				NEXTAUTH_URL: baseUrl,
				NEXT_TELEMETRY_DISABLED: "1",
			},
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	next = spawnedNext;
	spawnedNext.stdout.on("data", rememberOutput);
	spawnedNext.stderr.on("data", rememberOutput);
}

const stopServer = async () => {
	if (!next || next.exitCode !== null) return;
	next.kill("SIGTERM");
	await Promise.race([
		once(next, "exit"),
		wait(5_000).then(() => {
			if (next.exitCode === null) next.kill("SIGKILL");
		}),
	]);
};

const request = async (path: string, init: RequestInit = {}, jar?: CookieJar) => {
	const headers = new Headers(init.headers);
	if (jar?.header()) headers.set("Cookie", jar.header());
	const response = await fetch(new URL(path, baseUrl), { redirect: "manual", ...init, headers });
	jar?.read(response.headers);
	return response;
};

const jsonRequest = async (path: string, body: JsonRequestBody, options: JsonRequestOptions = {}) =>
	request(
		path,
		{
			method: "POST",
			headers: { "Content-Type": "application/json", ...options.headers },
			body: JSON.stringify(body),
		},
		options.jar,
	);

const getAuthProvidersWithHost = (path: string, host: string) =>
	new Promise<{ status: number | undefined; body: z.infer<typeof authProvidersSchema> }>((resolve, reject) => {
		const url = new URL(path, baseUrl);
		const outgoing = httpRequest(
			{
				hostname: url.hostname,
				port: url.port,
				path: `${url.pathname}${url.search}`,
				headers: { Host: host },
			},
			response => {
				const chunks: Buffer[] = [];
				response.on("data", (chunk: Uint8Array) => chunks.push(Buffer.from(chunk)));
				response.once("error", reject);
				response.once("end", () => {
					try {
						resolve({
							status: response.statusCode,
							body: authProvidersSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8"))),
						});
					} catch (error) {
						reject(error);
					}
				});
			},
		);
		outgoing.once("error", reject);
		outgoing.end();
	});

const findChromium = async () => {
	const candidates = [
		process.env.CHROMIUM_PATH,
		"/usr/bin/chromium-browser",
		"/usr/bin/chromium",
		"/usr/bin/google-chrome",
		"/usr/bin/google-chrome-stable",
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	].filter((candidate): candidate is string => candidate !== undefined);

	for (const candidate of candidates) {
		try {
			await access(candidate, fsConstants.X_OK);
			return candidate;
		} catch {
			// Try the next common browser location.
		}
	}
	throw new Error("Chromium not found. Install Chromium or set CHROMIUM_PATH to its executable.");
};

const getBrowser = async () => {
	browser ??= await chromium.launch({
		executablePath: await findChromium(),
		headless: true,
		args: ["--no-sandbox", "--disable-dev-shm-usage"],
	});
	return browser;
};

const closeBrowser = async () => {
	if (browser) await browser.close();
};

const runOrganizerScannerBrowserE2E = async () => {
	const context = await (await getBrowser()).newContext();

	try {
		const page = await context.newPage();
		await page.goto(`${baseUrl}/auth/sign-in?callbackUrl=${encodeURIComponent(`${baseUrl}/qr`)}`, {
			waitUntil: "domcontentloaded",
		});
		await page.getByRole("button", { name: "Sign in as local organizer" }).click();
		await page.waitForURL(url => url.pathname === "/qr", { timeout: 20_000 });
		assert.equal(new URL(page.url()).pathname, "/qr", "Browser test must reach the protected scanner page");
		await page.locator("main select").selectOption("dev-event-check-in");
		const scannerInput = page.locator("#scanner-input");
		await scannerInput.fill(participantId);
		await scannerInput.press("Enter");
		await page.getByText(participantId, { exact: true }).waitFor({ timeout: 20_000 });
		await page.getByText("Check In: 1", { exact: true }).waitFor({ timeout: 20_000 });
		assert.equal(await scannerInput.inputValue(), "", "Scanner input must reset after a successful scan");

		const presence = await prisma.presence.findUnique({
			where: { hackerId_eventId: { hackerId: participantId, eventId: "dev-event-check-in" } },
		});
		assert.equal(presence?.value, 1, "Browser scanner submission must complete the scanner mutation");

		for (const choice of noTShirtChoices) {
			await page.setViewportSize(
				choice.locale === "fr" ? { width: 390, height: 844 } : { width: 1280, height: 800 },
			);
			await page.goto(`${baseUrl}${choice.locale === "fr" ? "/fr" : ""}/qr`, { waitUntil: "domcontentloaded" });
			await page
				.getByRole("combobox", {
					name: choice.locale === "fr" ? "Sélectionner une action du lecteur" : "Select a scanner action",
				})
				.selectOption("dev-event-merchandise");
			await scannerInput.fill(choice.id);
			await scannerInput.press("Enter");
			await page.getByText(choice.label, { exact: true }).waitFor({ timeout: 20_000 });
			const merchandise = await prisma.presence.findUnique({
				where: { hackerId_eventId: { hackerId: choice.id, eventId: "dev-event-merchandise" } },
			});
			assert.equal(merchandise?.value, 1, "T-shirt opt-outs must remain eligible for other merchandise");
		}

		const organizerCookies = new CookieJar();
		for (const cookie of await context.cookies(baseUrl)) organizerCookies.cookies.set(cookie.name, cookie.value);
		return organizerCookies;
	} finally {
		await context.close();
	}
};

const waitForReady = async () => {
	for (let attempt = 0; attempt < 120; attempt += 1) {
		if (next && next.exitCode !== null) throw new Error(`Next exited before becoming ready (${next.exitCode})`);
		try {
			const response = await fetch(`${baseUrl}/api/readyz`);
			if (response.ok) return;
		} catch {
			// The server is still compiling.
		}
		await wait(500);
	}
	throw new Error("Next did not become ready within 60 seconds");
};

const sheetsIntegrationApiKey = process.env.SHEETS_INTEGRATION_API_KEY;
if (!sheetsIntegrationApiKey) throw new Error("SHEETS_INTEGRATION_API_KEY is required for the development E2E test.");
const integrationHeaders = { Authorization: `Bearer ${sheetsIntegrationApiKey}` };
const acceptanceIds: string[] = [];
const verifyAcceptanceRetries = async () => {
	for (const fault of ["lost response", "partial commit"] as const) {
		let fail = true;
		const sheet = createSheetHarness({
			apiKey: sheetsIntegrationApiKey,
			applications: ["first", "second"].map(id =>
				applicationRow({
					"Submission ID": id,
					"What unisex T-shirt size would you prefer?": "M",
				}),
			),
			fetch: request => {
				const { hackers } = provisioningBatchSchema.parse(JSON.parse(request.options.payload));
				acceptanceIds.push(...hackers.map(hacker => hacker.id));
				const selected = fail && fault === "partial commit" ? hackers.slice(0, 1) : hackers;
				const body = {
					hackers: selected.map(hacker => ({
						...hacker,
						acceptanceExpiry: hacker.acceptanceExpiry.toISOString(),
					})),
				};
				// Apps Script fetch is synchronous. The disposable child calls the
				// actual local HTTP server, with credentials passed only through stdin.
				const response = z.object({ status: z.number(), body: z.string() }).parse(
					JSON.parse(
						execFileSync(
							process.execPath,
							[
								"--input-type=module",
								"-e",
								`
let input = "";
for await (const chunk of process.stdin) input += chunk;
const { url, headers, body } = JSON.parse(input);
const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
process.stdout.write(JSON.stringify({ status: response.status, body: await response.text() }));
`,
							],
							{
								input: JSON.stringify({
									url: `${baseUrl}/api/integrations/sheets/hackers`,
									headers: { ...request.options.headers, "Content-Type": "application/json" },
									body,
								}),
								encoding: "utf8",
								timeout: 30000,
							},
						),
					),
				);
				assert.equal(response.status, 200);
				if (fail) {
					fail = false;
					throw new Error(fault);
				}
				return response;
			},
		});
		assert.throws(() => sheet.run());
		sheet.run();
		const attempts = sheet.requests.map(request =>
			provisioningBatchSchema.parse(JSON.parse(request.options.payload)).hackers.map(hacker => hacker.id),
		);
		assert.deepEqual(attempts[0], attempts[1], "The real API retry must reuse every originally assigned ID");
		const ids = attempts[0];
		assert.ok(ids);
		assert.equal(await prisma.hacker.count({ where: { id: { in: ids } } }), 2);
		assert.equal(sheet.savedRows().length, 3);
	}
};
const participantId = randomBytes(16).toString("base64url");
const walkInId = randomBytes(16).toString("base64url");
const noTShirtChoices = [
	{
		id: randomBytes(16).toString("base64url"),
		locale: "en",
		header: "What unisex T-shirt size would you prefer?",
		answer: "I do not want a T-shirt",
		label: "No T-shirt requested",
	},
	{
		id: randomBytes(16).toString("base64url"),
		locale: "fr",
		header: "Quelle taille de t-shirt unisexe préférez-vous?",
		answer: "Je ne souhaite pas recevoir de t-shirt",
		label: "Aucun t-shirt demandé",
	},
] as const;
const prisma = new PrismaClient();
const mailboxDirectory = await mkdtemp(join(tmpdir(), "track-the-hack-mail-"));

const cleanUp = async () => {
	const ids = [participantId, walkInId, ...noTShirtChoices.map(choice => choice.id), ...acceptanceIds];
	const presences = await prisma.presence.findMany({ where: { hackerId: { in: ids } }, select: { id: true } });
	await prisma.$transaction([
		prisma.log.deleteMany({
			where: {
				OR: [
					{ sourceId: { in: [...ids, ...presences.map(presence => presence.id)] } },
					...ids.map(id => ({ details: { contains: id } })),
				],
			},
		}),
		prisma.presence.deleteMany({ where: { hackerId: { in: ids } } }),
		prisma.participantSession.deleteMany({ where: { hackerId: { in: ids } } }),
		prisma.claimToken.deleteMany({ where: { hackerId: { in: ids } } }),
		prisma.cancellationCapability.deleteMany({ where: { hackerId: { in: ids } } }),
		prisma.hacker.deleteMany({ where: { id: { in: ids } } }),
	]);
};

try {
	await waitForReady();
	await verifyAcceptanceRetries();

	const rejectedProvision = await jsonRequest("/api/integrations/sheets/hackers", { hackers: [] });
	assert.equal(rejectedProvision.status, 401, "Sheet endpoints must reject a missing bearer key");

	const tallyFixture = await loadTallySheetFixture(new URL("../test/fixtures/dev-tally-sheet.json", import.meta.url));
	const records = acceptedSheetRowsToOperationalRecords(syncTallyFixtureToSheet(tallyFixture), {
		participantIdFor: row => (row.walkIn ? walkInId : participantId),
	});
	assert.equal(records.length, 2, "The reviewed Sheet fixture must contain two accepted participants");
	const template = syncTallyFixtureToSheet(tallyFixture).find(row => row.decision === "ACCEPTED");
	assert.ok(template);
	const noTShirtRecords = noTShirtChoices.map(choice => {
		const [record] = acceptedSheetRowsToOperationalRecords(
			[{ ...template, sheetValues: { [choice.header]: choice.answer } }],
			{ participantIdFor: () => choice.id },
		);
		assert.ok(record);
		assert.equal(record.tShirtSize, "NONE");
		return record;
	});
	const provision = await jsonRequest(
		"/api/integrations/sheets/hackers",
		{ hackers: [...records, ...noTShirtRecords] },
		{ headers: integrationHeaders },
	);
	assert.equal(provision.status, 200);
	assert.deepEqual(processedResponseSchema.parse(await provision.json()), { processed: 4 });
	for (const choice of noTShirtChoices) {
		const saved = await prisma.hacker.findUnique({ where: { id: choice.id }, select: { tShirtSize: true } });
		assert.equal(saved?.tShirtSize, "NONE", "The database must preserve the explicit opt-out");
	}

	const invitationEmail = await deliverLocalParticipantEmail({
		type: "invitation",
		link: `${baseUrl}/rsvp/${participantId}`,
		mailboxDirectory,
	});
	assert.equal(invitationEmail.type, "invitation");
	assert.equal(invitationEmail.subject, "Track the Hack RSVP invitation");
	assert.equal(invitationEmail.from, "no-reply@track.local");
	assert.deepEqual(invitationEmail.to, ["participant@example.test"]);
	assert.deepEqual(invitationEmail.links, [`${baseUrl}/rsvp/${participantId}`]);
	const invitationLink = invitationEmail.links[0];
	assert.ok(invitationLink);
	participantContext = await (await getBrowser()).newContext();
	const participantPage = await participantContext.newPage();
	await participantPage.goto(invitationLink, { waitUntil: "domcontentloaded" });
	await participantPage.getByRole("button", { name: "Confirm attendance" }).click();
	await participantPage
		.getByRole("status")
		.getByText("Your attendance is confirmed.", { exact: false })
		.waitFor({ timeout: 20_000 });

	const reconciliation = await jsonRequest(
		"/api/integrations/sheets/rsvp-reconciliation",
		{ ids: [participantId, walkInId] },
		{ headers: integrationHeaders },
	);
	assert.equal(reconciliation.status, 200);
	const reconciled = reconciliationResponseSchema.parse(await reconciliation.json());
	const confirmedRecord = reconciled.records.find(record => record.id === participantId);
	assert.ok(confirmedRecord, "Reconciliation must include the invited participant");
	assert.equal(confirmedRecord.confirmed, true);
	assert.ok(confirmedRecord.cancellationLink, "Reconciliation must produce the confirmation-email link");

	const confirmationEmail = await deliverLocalParticipantEmail({
		type: "confirmation",
		link: confirmedRecord.cancellationLink,
		mailboxDirectory,
	});
	assert.equal(confirmationEmail.type, "confirmation");
	assert.equal(confirmationEmail.subject, "Track the Hack RSVP confirmed");
	assert.deepEqual(confirmationEmail.links, [confirmedRecord.cancellationLink]);
	const confirmationLink = confirmationEmail.links[0];
	assert.ok(confirmationLink);
	const cancellationUrl = new URL(confirmationLink);
	await participantPage.goto(cancellationUrl.toString(), { waitUntil: "domcontentloaded" });
	await participantPage.getByRole("button", { name: "Cancel attendance" }).click();
	await participantPage
		.getByRole("status")
		.getByText("Your attendance has been cancelled.", { exact: true })
		.waitFor({ timeout: 20_000 });
	assert.equal(new URL(participantPage.url()).hash, "", "Cancellation success must remove the capability fragment");
	const reconfirmation = await jsonRequest(`/api/rsvp/${participantId}`, { confirm: true });
	assert.equal(reconfirmation.status, 200);

	const [normalRecord, walkInRecord] = records;
	assert.ok(normalRecord && walkInRecord, "The reviewed Sheet fixture must provide normal and walk-in records");
	const issueClaim = (record: OperationalRecord) =>
		jsonRequest("/api/integrations/sheets/claim", record, { headers: integrationHeaders });
	const claimResponse = await issueClaim(normalRecord);
	assert.equal(claimResponse.status, 200);
	const claim = claimResponseSchema.parse(await claimResponse.json());
	const claimUrl = new URL(claim.claimUrl);
	assert.equal((await request(claimUrl.pathname)).status, 200);
	assert.equal((await request(claimUrl.pathname)).status, 200, "GET/reload must not consume a claim");
	const claimQrPage = await participantContext.newPage();
	await claimQrPage.goto(`${baseUrl}/claim/qr${claimUrl.hash}`, { waitUntil: "domcontentloaded" });
	await claimQrPage.getByRole("img", { name: "Participant access QR code" }).waitFor({ timeout: 20_000 });
	await claimQrPage.close();

	await participantPage.goto(claimUrl.toString(), { waitUntil: "domcontentloaded" });
	await participantPage.getByRole("button", { name: "Activate access" }).click();
	await participantPage.waitForURL(url => url.pathname === "/profile", { timeout: 20_000 });
	assert.match(await participantPage.content(), new RegExp(participantId));
	const participantQr = participantPage.getByRole("img", { name: "Your event QR code" });
	await participantQr.waitFor({ timeout: 20_000 });
	assert.match((await participantQr.getAttribute("src")) ?? "", /^data:image\/png;base64,/);

	const participantCookies = new CookieJar();
	for (const cookie of await participantContext.cookies(baseUrl)) {
		participantCookies.cookies.set(cookie.name, cookie.value);
	}
	const profile = await request("/profile", {}, participantCookies);
	assert.equal(profile.status, 200);
	assert.match(await profile.text(), new RegExp(participantId));
	await participantContext.close();
	participantContext = null;

	const replacementResponse = await issueClaim(normalRecord);
	const replacement = claimResponseSchema.parse(await replacementResponse.json());
	const revokedProfile = await request("/profile", {}, participantCookies);
	assert.ok([302, 307, 308].includes(revokedProfile.status), "Replacement access must revoke the old device");

	const replacementCookies = new CookieJar();
	const replacementToken = new URL(replacement.claimUrl).hash.slice(1);
	assert.equal(
		(await jsonRequest("/api/claim", { token: replacementToken }, { jar: replacementCookies })).status,
		200,
	);

	const walkInClaimResponse = await issueClaim(walkInRecord);
	assert.equal(walkInClaimResponse.status, 200);
	const walkInCookies = new CookieJar();
	const walkInToken = new URL(claimResponseSchema.parse(await walkInClaimResponse.json()).claimUrl).hash.slice(1);
	assert.equal((await jsonRequest("/api/claim", { token: walkInToken }, { jar: walkInCookies })).status, 200);
	assert.equal((await request("/profile", {}, walkInCookies)).status, 200);
	assert.equal(
		(
			await prisma.hacker.findUnique({
				where: { id: walkInId },
				select: { walkIn: true },
			})
		)?.walkIn,
		true,
		"The real Sheet mapper and access-issuance path must preserve walk-in status",
	);

	for (const choice of noTShirtChoices) {
		const record = noTShirtRecords.find(candidate => candidate.id === choice.id);
		assert.ok(record);
		const issued = await issueClaim(record);
		assert.equal(issued.status, 200);
		const token = new URL(claimResponseSchema.parse(await issued.json()).claimUrl).hash.slice(1);
		const cookies = new CookieJar();
		assert.equal((await jsonRequest("/api/claim", { token }, { jar: cookies })).status, 200);
		const context = await (await getBrowser()).newContext();
		try {
			await context.addCookies([...cookies.cookies].map(([name, value]) => ({ name, value, url: baseUrl })));
			const page = await context.newPage();
			await page.goto(`${baseUrl}${choice.locale === "fr" ? "/fr" : ""}/profile`, {
				waitUntil: "domcontentloaded",
			});
			await page.getByText(choice.label, { exact: true }).waitFor({ timeout: 20_000 });
		} finally {
			await context.close();
		}
	}

	const providersResponse = await request("/api/auth/providers");
	assert.equal(providersResponse.status, 200);
	const providers = authProvidersSchema.parse(await providersResponse.json());
	assert.equal(providers.development?.type, "credentials");
	assert.equal(providers.google.type, "oauth");
	const externalProvidersResponse = await getAuthProvidersWithHost("/api/auth/providers", "track.example");
	assert.equal(externalProvidersResponse.status, 200);
	const externalProviders = externalProvidersResponse.body;
	assert.equal(externalProviders.development, undefined, "The local organizer provider must be loopback-only");
	assert.equal(externalProviders.google.type, "oauth");
	assert.ok([302, 307, 308].includes((await request("/qr")).status), "Anonymous organizers must be redirected");
	const anonymousTrpc = createTRPCProxyClient<AppRouter>({
		transformer: superjson,
		links: [httpBatchLink({ url: `${baseUrl}/api/trpc` })],
	});
	await assert.rejects(
		anonymousTrpc.presence.scan.mutate({ eventId: "dev-event-check-in", hackerId: participantId }),
		error => unauthorizedErrorSchema.safeParse(error).success,
		"Anonymous scanner mutations must be rejected",
	);

	const organizerCookies = await runOrganizerScannerBrowserE2E();
	const session = await request("/api/auth/session", {}, organizerCookies);
	const sessionBody = sessionSchema.parse(await session.json());
	assert.ok(sessionBody.user.roles.includes("ORGANIZER"), "Development login must produce an organizer session");
	assert.equal((await request("/qr", {}, organizerCookies)).status, 200);
	assert.equal((await request("/metrics", {}, organizerCookies)).status, 200);

	const trpc = createTRPCProxyClient<AppRouter>({
		transformer: superjson,
		links: [
			httpBatchLink({
				url: `${baseUrl}/api/trpc`,
				headers: () => ({ Cookie: organizerCookies.header() }),
			}),
		],
	});
	const events = await trpc.events.scannable.query();
	const event = (workflow: ScannerWorkflow) => {
		const match = events.find(candidate => candidate.scannerWorkflow === workflow);
		assert.ok(match, `Seed data must contain a ${workflow} scanner event`);
		return match;
	};
	const checkIn = await trpc.presence.scan.mutate({ eventId: event("CHECK_IN").id, hackerId: participantId });
	assert.equal(checkIn.workflow, "CHECK_IN");
	assert.equal(checkIn.participant.confirmed, true);
	assert.equal(checkIn.atLimit, true);
	const merchandise = await trpc.presence.scan.mutate({
		eventId: event("MERCHANDISE").id,
		hackerId: participantId,
	});
	assert.equal(merchandise.workflow, "MERCHANDISE");
	assert.equal(merchandise.participant.tShirtSize, "M");
	const food = await trpc.presence.scan.mutate({ eventId: event("FOOD").id, hackerId: participantId });
	assert.equal(food.workflow, "FOOD");
	assert.equal(food.participant.requiresFoodLead, true);
	await trpc.presence.scan.mutate({ eventId: event("ATTENDANCE").id, hackerId: participantId });
	await trpc.presence.scan.mutate({ eventId: event("CHECK_IN").id, hackerId: walkInId });

	const metrics = await trpc.metrics.getMetrics.query();
	assert.ok(metrics.provisioned >= 2);
	assert.ok(metrics.walkIn >= 1);
	assert.ok(metrics.checkedIn >= 2);
	assert.ok((metrics.tShirtSizeData.find(entry => entry.tShirtSize === "NONE")?._count.tShirtSize ?? 0) >= 2);

	const replacementContext = await (await getBrowser()).newContext();
	try {
		await replacementContext.addCookies(
			[...replacementCookies.cookies].map(([name, value]) => ({ name, value, url: baseUrl })),
		);
		const replacementPage = await replacementContext.newPage();
		await replacementPage.goto(`${baseUrl}/profile`, { waitUntil: "domcontentloaded" });
		await replacementPage.getByText("Check In", { exact: true }).first().waitFor({ timeout: 20_000 });
		await replacementPage.getByRole("button", { name: "Sign out of participant pass" }).click();
		await replacementPage.waitForURL(url => url.pathname === "/", { timeout: 20_000 });
		await replacementPage.goto(`${baseUrl}/profile`, { waitUntil: "domcontentloaded" });
		assert.equal(new URL(replacementPage.url()).pathname, "/", "Signed-out participant must be denied the profile");
	} finally {
		await replacementContext.close();
	}

	console.info(
		"Dev E2E passed: Tally/Sheet fixtures, captured SMTP links, participant RSVP/cancel/access-QR/claim/profile/sign-out UI, sessions, OAuth boundary/local organizer auth, browser scanner UI, all scanner workflows, walk-ins, and metrics.",
	);
} catch (error) {
	console.error(serverOutput.join(""));
	throw error;
} finally {
	await participantContext?.close().catch(() => undefined);
	await closeBrowser().catch(() => undefined);
	await cleanUp().catch(error => console.error("E2E cleanup failed:", error));
	await rm(mailboxDirectory, { recursive: true, force: true });
	await prisma.$disconnect();
	await stopServer();
	if (process.env.NEXT_DIST_DIR === ".next-dev-e2e") {
		await rm(join(process.cwd(), ".next-dev-e2e"), { recursive: true, force: true });
	}
}
