import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { constants as fsConstants } from "node:fs";
import { access, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { EventType, PrismaClient, ScannerWorkflow } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { chromium, type Browser, type Locator, type Page } from "playwright-core";
import { z } from "zod";
import { publicPrecacheUrls } from "@root/pwa-runtime-caching";
import { rubricSnapshot } from "@/shared/judging";

const participantSchema = z
	.object({
		id: z.string().min(1),
		tShirtSize: z.enum(["XS", "S", "M", "L", "XL", "XXL", "NONE"]),
		mealCategory: z.enum(["STANDARD", "VEGETARIAN", "VEGAN", "HALAL", "OTHER"]),
		acceptanceExpiry: z.string().datetime(),
		walkIn: z.boolean(),
	})
	.strict();
const processedResponseSchema = z.object({ processed: z.number().int().nonnegative() }).strict();
const claimResponseSchema = z.object({ claimUrl: z.string().url(), expiresAt: z.string().datetime() }).strict();

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

const port = await getOpenPort();
const baseUrl = `http://127.0.0.1:${port}`;
const serverOutput: string[] = [];
const rememberOutput = (chunk: Buffer | string) => {
	serverOutput.push(String(chunk));
	if (serverOutput.length > 200) serverOutput.shift();
};
const next = spawn(
	process.execPath,
	["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
	{
		cwd: process.cwd(),
		env: {
			...process.env,
			DEV_AUTH_ENABLED: "0",
			NEXTAUTH_URL: baseUrl,
			NEXT_TELEMETRY_DISABLED: "1",
			NODE_ENV: "production",
		},
		stdio: ["ignore", "pipe", "pipe"],
	},
);
next.stdout.on("data", rememberOutput);
next.stderr.on("data", rememberOutput);

const stopServer = async () => {
	if (next.exitCode !== null) return;
	next.kill("SIGTERM");
	await Promise.race([
		once(next, "exit"),
		wait(5_000).then(() => {
			if (next.exitCode === null) next.kill("SIGKILL");
		}),
	]);
};

const waitForReady = async () => {
	for (let attempt = 0; attempt < 120; attempt += 1) {
		if (next.exitCode !== null) throw new Error(`Next exited before becoming ready (${next.exitCode})`);
		try {
			if ((await fetch(`${baseUrl}/api/readyz`)).ok) return;
		} catch {
			// The production server is still starting.
		}
		await wait(500);
	}
	throw new Error("Next did not become ready within 60 seconds");
};

const participantId = randomBytes(16).toString("base64url");
const eventId = `pwa-${randomBytes(8).toString("hex")}`;
const checkInEventId = `pwa-check-in-${randomBytes(8).toString("hex")}`;
const eventName = `PWA offline event ${eventId.slice(-6)}`;
const eventNameFr = `Événement hors ligne PWA ${eventId.slice(-6)}`;
const judgeSuffix = randomBytes(8).toString("hex");
const judgeEmail = `pwa-judge-${judgeSuffix}@example.com`;
const judgingRoundId = `pwa-round-${judgeSuffix}`;
const judgingProjectId = `pwa-project-${judgeSuffix}`;
const judgingProjectName = `PWA judging project ${judgeSuffix.slice(-6)}`;
const secondJudgingProjectId = `pwa-project-2-${judgeSuffix}`;
const secondJudgingProjectName = `PWA judging project two ${judgeSuffix.slice(-6)}`;
const participant = participantSchema.parse({
	id: participantId,
	tShirtSize: "M",
	mealCategory: "OTHER",
	acceptanceExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
	walkIn: false,
});
const sheetsIntegrationApiKey = process.env.SHEETS_INTEGRATION_API_KEY;
if (!sheetsIntegrationApiKey) throw new Error("SHEETS_INTEGRATION_API_KEY is required for the PWA E2E test.");
const integrationHeaders = {
	Authorization: `Bearer ${sheetsIntegrationApiKey}`,
	"Content-Type": "application/json",
};
const prisma = new PrismaClient();
let browser: Browser | undefined;
let createdCheckInEvent = false;

const closeBrowser = async () => {
	if (browser) await browser.close();
};

const cleanUp = async () => {
	const presences = await prisma.presence.findMany({ where: { hackerId: participantId }, select: { id: true } });
	await prisma.$transaction([
		prisma.judgingRound.deleteMany({ where: { id: judgingRoundId } }),
		prisma.user.deleteMany({ where: { email: judgeEmail } }),
		prisma.log.deleteMany({
			where: {
				OR: [
					{ sourceId: { in: [participantId, ...presences.map(presence => presence.id)] } },
					{ details: { contains: participantId } },
				],
			},
		}),
		prisma.presence.deleteMany({ where: { hackerId: participantId } }),
		prisma.participantSession.deleteMany({ where: { hackerId: participantId } }),
		prisma.claimToken.deleteMany({ where: { hackerId: participantId } }),
		prisma.cancellationCapability.deleteMany({ where: { hackerId: participantId } }),
		prisma.hacker.deleteMany({ where: { id: participantId } }),
		prisma.event.deleteMany({
			where: { id: { in: createdCheckInEvent ? [eventId, checkInEventId] : [eventId] } },
		}),
	]);
};

const prepareSyntheticJudge = async () => {
	const user = await prisma.user.create({
		data: { email: judgeEmail, name: "PWA Synthetic Judge", emailVerified: new Date() },
	});
	const round = await prisma.judgingRound.create({
		data: {
			id: judgingRoundId,
			name: "PWA synthetic judging round",
			state: "OPEN",
			rubricSnapshot: { en: rubricSnapshot("en"), fr: rubricSnapshot("fr") },
			generationWarnings: [],
			assignmentsPublishedAt: new Date(),
			openedAt: new Date(),
			createdById: "pwa-e2e",
		},
	});
	const judge = await prisma.judgingJudge.create({
		data: {
			roundId: round.id,
			name: "PWA Synthetic Judge",
			email: judgeEmail,
			expertise: [],
			exclusions: [],
		},
	});
	const assignments = [];
	for (const [index, projectInput] of [
		{ id: judgingProjectId, name: judgingProjectName, tableNumber: 999 },
		{ id: secondJudgingProjectId, name: secondJudgingProjectName, tableNumber: 1000 },
	].entries()) {
		const project = await prisma.judgingProject.create({
			data: {
				...projectInput,
				roundId: round.id,
				externalId: `devpost-${index + 1}-${judgeSuffix}`,
				room: "PWA Room",
				devpostUrl: `https://${judgeSuffix}-${index + 1}.devpost.com`,
				mainTrack: "GENERAL",
				categories: { create: { roundId: round.id, code: "FOSS" } },
			},
		});
		for (const scope of [
			{ categoryCode: "GENERAL", isMain: true },
			{ categoryCode: "FOSS", isMain: false },
		]) {
			assignments.push(
				await prisma.judgingAssignment.create({
					data: {
						roundId: round.id,
						projectId: project.id,
						judgeId: judge.id,
						...scope,
						assignmentReason: "PWA acceptance baseline",
						fieldTimestamps: {},
						fieldOperationIds: {},
					},
				}),
			);
		}
	}
	return { user, assignments };
};

const visit = async (page: Page, path: string) => {
	await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
};

const waitForOfflineContent = async (page: Page, path: string, locator: Locator) => {
	try {
		await locator.waitFor({ timeout: 10_000 });
	} catch {
		await visit(page, path);
		try {
			await locator.waitFor({ timeout: 30_000 });
		} catch (error) {
			console.error(
				JSON.stringify({
					url: page.url(),
					body: (await page.locator("body").innerText()).slice(0, 2000),
					controlled: await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
				}),
			);
			throw error;
		}
	}
};

const waitForCachedSchedule = async (page: Page, expectedEventNames: readonly string[]) => {
	await page.waitForFunction(
		async names => {
			const cache = await caches.open("public-schedule-data");
			const requests = await cache.keys();
			if (requests.length === 0) return false;
			for (const request of requests) {
				const response = await cache.match(request);
				if (!response) return false;
				const body = await response.text();
				if (!names.every(name => body.includes(name))) return false;
			}
			return true;
		},
		expectedEventNames,
		{ timeout: 20_000 },
	);
};

const waitForCachedRoutes = async (page: Page, cacheName: string, paths: readonly string[]) => {
	await page.waitForFunction(
		async ({ name, expectedPaths }) => {
			const cache = await caches.open(name);
			return (
				await Promise.all(
					expectedPaths.map(async path => Boolean(await cache.match(new URL(path, location.origin).href))),
				)
			).every(Boolean);
		},
		{ name: cacheName, expectedPaths: paths },
		{ timeout: 20_000 },
	);
};

try {
	await waitForReady();
	for (const url of publicPrecacheUrls) {
		const response = await fetch(`${baseUrl}${url}`);
		assert.equal(response.ok, true, `Precache URL ${url} returned ${response.status}`);
	}

	const eventStart = new Date(Date.now() + 60 * 60 * 1000);
	await prisma.event.create({
		data: {
			id: eventId,
			name: eventName,
			nameFr: eventNameFr,
			room: "PWA test room",
			roomFr: "Salle de test PWA",
			start: eventStart,
			end: new Date(eventStart.getTime() + 60 * 60 * 1000),
			description: "Available from the offline schedule cache.",
			descriptionFr: "Disponible depuis le cache de l’horaire hors ligne.",
			hidden: false,
			type: EventType.GENERAL,
			scannerEnabled: false,
			scannerWorkflow: ScannerWorkflow.ATTENDANCE,
		},
	});
	const visibleCheckInCount = await prisma.event.count({
		where: { hidden: false, scannerWorkflow: ScannerWorkflow.CHECK_IN },
	});
	assert.ok(visibleCheckInCount <= 1, "PWA acceptance requires at most one existing visible check-in event");
	if (visibleCheckInCount === 0) {
		await prisma.event.create({
			data: {
				id: checkInEventId,
				name: "Check-Ins",
				nameFr: "Enregistrements",
				room: "PWA test check-in",
				roomFr: "Enregistrement de test PWA",
				start: new Date(eventStart.getTime() - 60 * 60 * 1000),
				end: eventStart,
				description: "Canonical check-in fixture for participant access issuance.",
				descriptionFr: "Enregistrement canonique pour l’émission d’un accès participant.",
				hidden: false,
				type: EventType.GENERAL,
				scannerEnabled: true,
				scannerWorkflow: ScannerWorkflow.CHECK_IN,
				maxCheckIns: 1,
			},
		});
		createdCheckInEvent = true;
	}
	const provision = await fetch(`${baseUrl}/api/integrations/sheets/hackers`, {
		method: "POST",
		headers: integrationHeaders,
		body: JSON.stringify({ hackers: [participant] }),
	});
	assert.equal(provision.status, 200);
	assert.deepEqual(processedResponseSchema.parse(await provision.json()), { processed: 1 });

	const issueClaim = await fetch(`${baseUrl}/api/integrations/sheets/claim`, {
		method: "POST",
		headers: integrationHeaders,
		body: JSON.stringify(participant),
	});
	assert.equal(issueClaim.status, 200);
	const claimToken = new URL(claimResponseSchema.parse(await issueClaim.json()).claimUrl).hash.slice(1);

	browser = await chromium.launch({
		executablePath: await findChromium(),
		headless: true,
		args: ["--no-sandbox", "--disable-dev-shm-usage"],
	});
	const context = await browser.newContext();
	const activation = await context.request.post(`${baseUrl}/api/claim`, { data: { token: claimToken } });
	assert.equal(activation.status(), 200);

	const page = await context.newPage();
	await page.goto(`${baseUrl}/profile`, { waitUntil: "domcontentloaded" });
	await page.getByRole("heading", { name: "Your event pass" }).waitFor();
	await page.getByRole("heading", { name: "Your details" }).waitFor();
	const onlineQr = page.getByAltText("Your event QR code");
	await onlineQr.waitFor();
	const onlineQrSource = await onlineQr.getAttribute("src");
	assert.match(onlineQrSource ?? "", /^data:image\/png;base64,/);

	await page.waitForFunction(
		async () => (await navigator.serviceWorker.getRegistration())?.active?.state === "activated",
		undefined,
		{ timeout: 20_000 },
	);
	if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
	await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

	for (const locale of [
		{ prefix: "", event: eventName, floor: /^Floor / },
		{ prefix: "/fr", event: eventNameFr, floor: /^Niveau / },
	] as const) {
		await visit(page, `${locale.prefix}/schedule`);
		await page.getByText(locale.event, { exact: true }).waitFor();

		await visit(page, `${locale.prefix}/schedule/event?id=${eventId}`);
		await page.getByRole("heading", { name: locale.event }).waitFor();

		await visit(page, `${locale.prefix}/maps`);
		const floorHeadings = page.getByRole("heading", { name: locale.floor });
		await floorHeadings.first().waitFor();
		assert.equal(await floorHeadings.count(), 6);

		await visit(page, `${locale.prefix}/resources`);
		await page.getByRole("link", { name: "CGI" }).waitFor();

		const sponsorPath = `${locale.prefix}/sponsors/cgi`;
		await visit(page, sponsorPath);
		await waitForOfflineContent(page, sponsorPath, page.getByRole("heading", { name: "CGI", exact: true }));
		await waitForCachedRoutes(page, locale.prefix ? "public-pages-fr" : "public-pages-en", [
			`${locale.prefix}/schedule`,
			`${locale.prefix}/schedule/event?id=${eventId}`,
			`${locale.prefix}/maps`,
			`${locale.prefix}/resources`,
			`${locale.prefix}/sponsors/cgi`,
		]);
	}
	await waitForCachedSchedule(page, [eventName, eventNameFr]);
	await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

	await context.setOffline(true);
	for (const locale of [
		{
			prefix: "",
			event: eventName,
			floor: /^Floor /,
			offlineHeading: "You're offline",
			passHeading: "Your offline event pass",
			qrAlt: "Your event QR code",
		},
		{
			prefix: "/fr",
			event: eventNameFr,
			floor: /^Niveau /,
			offlineHeading: "Vous êtes hors ligne",
			passHeading: "Votre laissez-passer hors ligne",
			qrAlt: "Votre code QR pour l’événement",
		},
	] as const) {
		const schedulePath = `${locale.prefix}/schedule`;
		await visit(page, schedulePath);
		await waitForOfflineContent(page, schedulePath, page.getByText(locale.event, { exact: true }));

		await visit(page, `${locale.prefix}/schedule/event?id=${eventId}`);
		await page.getByRole("heading", { name: locale.event }).waitFor();

		await visit(page, `${locale.prefix}/maps`);
		const floorHeadings = page.getByRole("heading", { name: locale.floor });
		await floorHeadings.first().waitFor();
		assert.equal(await floorHeadings.count(), 6);
		const mapResponses = await page.evaluate(async () => {
			const paths = [
				"/assets/maps/floor0.svg",
				"/assets/maps/floor1.svg",
				"/assets/maps/floor2.svg",
				"/assets/maps/floor3.svg",
				"/assets/maps/floor4-current.svg",
				"/assets/maps/floor5.svg",
			];
			return Promise.all(paths.map(async path => ({ path, ok: (await fetch(path)).ok })));
		});
		assert.equal(
			mapResponses.every(response => response.ok),
			true,
			JSON.stringify(mapResponses),
		);

		await visit(page, `${locale.prefix}/resources`);
		await page.getByRole("link", { name: "CGI" }).waitFor();

		await visit(page, `${locale.prefix}/sponsors/cgi`);
		await page.getByRole("heading", { name: "CGI", exact: true }).waitFor();

		const profilePath = `${locale.prefix}/profile`;
		await visit(page, profilePath);
		await waitForOfflineContent(page, profilePath, page.getByRole("heading", { name: locale.passHeading }));
		const offlineQr = page.getByAltText(locale.qrAlt);
		await offlineQr.waitFor();
		assert.equal(
			await offlineQr.getAttribute("src"),
			onlineQrSource,
			"Offline pass must preserve the same QR payload",
		);
		const passBody = await page.locator("body").innerText();
		assert.doesNotMatch(
			passBody,
			/Your details|T-shirt size|Meal category|Your attendance|Vos informations|Taille de t-shirt|Catégorie de repas|Votre participation/,
		);

		for (const privatePath of [
			"/qr",
			"/services",
			"/hardware",
			"/latte-lab",
			"/internal/hardware",
			"/internal/latte-lab",
		]) {
			await visit(page, `${locale.prefix}${privatePath}`);
			await page.getByRole("heading", { name: locale.offlineHeading }).waitFor();
		}
	}

	await context.setOffline(false);

	const { user: judgeUser, assignments: judgeAssignments } = await prepareSyntheticJudge();
	const nextAuthSecret = process.env.NEXTAUTH_SECRET;
	if (!nextAuthSecret) throw new Error("NEXTAUTH_SECRET is required for the PWA E2E test.");
	const judgeToken = await encode({
		secret: nextAuthSecret,
		maxAge: 60 * 60,
		token: { sub: judgeUser.id, email: judgeEmail, name: judgeUser.name },
	});
	const judgeContext = await browser.newContext();
	await judgeContext.addCookies([
		{
			name: "next-auth.session-token",
			value: judgeToken,
			url: baseUrl,
			httpOnly: true,
			sameSite: "Lax",
		},
	]);
	const judgePage = await judgeContext.newPage();
	await visit(judgePage, "/judging");
	await judgePage.getByRole("heading", { name: judgingProjectName }).waitFor();
	await judgePage.getByText(/Available offline — updated/).waitFor();
	await judgePage.waitForFunction(
		async () => (await navigator.serviceWorker.getRegistration())?.active?.state === "activated",
		undefined,
		{ timeout: 20_000 },
	);
	if (!(await judgePage.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await judgePage.reload();
	await judgePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

	await judgeContext.setOffline(true);
	await judgePage.reload({ waitUntil: "domcontentloaded" });
	await judgePage.getByRole("heading", { name: judgingProjectName }).waitFor();
	for (const tableNumber of [999, 1000]) {
		await judgePage.getByRole("button", { name: new RegExp(`Table ${tableNumber}`) }).click();
		const mainGroup = judgePage.getByRole("group", { name: "General Challenge — Best Overall" });
		for (const criterion of [
			"Technical Execution",
			"Idea & Impact",
			"Design & Usability",
			"Learning & Technical Decisions",
			"Presentation",
		]) {
			await mainGroup
				.getByText(new RegExp(`^${criterion}`))
				.locator("..")
				.getByRole("button", { name: /^3\b/ })
				.click();
		}
		const fossGroup = judgePage.getByRole("group", { name: "Best FOSS Project" });
		await fossGroup.getByRole("button", { name: "Eligible", exact: true }).click();
		await fossGroup.getByRole("button", { name: "4", exact: true }).click();
	}
	await judgePage.getByText("Complete locally").first().waitFor();
	const beforeSync = await prisma.judgingAssignment.findMany({
		where: { id: { in: judgeAssignments.map(assignment => assignment.id) } },
	});
	assert.equal(
		beforeSync.every(assignment => assignment.completedAt === null),
		true,
		"Administrators must see local-only judging as incomplete",
	);

	await judgeContext.setOffline(false);
	await judgePage.bringToFront();
	await judgePage.getByText("All changes synced").waitFor({ timeout: 20_000 });
	await judgePage.getByText("All assigned judging is complete and synchronized.").waitFor();
	const afterSync = await prisma.judgingAssignment.findMany({
		where: { id: { in: judgeAssignments.map(assignment => assignment.id) } },
	});
	assert.equal(afterSync.length, 4);
	assert.equal(
		afterSync.every(assignment => assignment.completedAt !== null),
		true,
		"Every completed offline assignment must synchronize before it disappears from the judge workspace",
	);
	assert.equal(
		afterSync
			.filter(assignment => assignment.isMain)
			.every(
				assignment =>
					assignment.technicalLevel === 3 &&
					assignment.ideaLevel === 3 &&
					assignment.designLevel === 3 &&
					assignment.learningLevel === 3 &&
					assignment.presentationLevel === 3,
			),
		true,
	);
	assert.equal(
		afterSync
			.filter(assignment => !assignment.isMain)
			.every(assignment => assignment.miniEligibility === "ELIGIBLE" && assignment.miniScore === 4),
		true,
	);

	const cacheEvidence = await judgePage.evaluate(
		async secretValues => {
			const urls: string[] = [];
			const bodies: string[] = [];
			for (const cacheName of await caches.keys()) {
				const cache = await caches.open(cacheName);
				for (const request of await cache.keys()) {
					urls.push(request.url);
					const response = await cache.match(request);
					if (response) bodies.push(await response.clone().text());
				}
			}
			return {
				privateUrls: urls.filter(url => /^\/api\/|^\/internal(?:\/|$)/.test(new URL(url).pathname)),
				hasPrivateBody: bodies.some(body => secretValues.some(value => body.includes(value))),
			};
		},
		[judgeEmail, judgingProjectName, secondJudgingProjectName],
	);
	assert.deepEqual(
		cacheEvidence.privateUrls,
		[],
		`Private and API routes must remain absent from Cache Storage: ${cacheEvidence.privateUrls.join(", ")}`,
	);
	assert.equal(
		cacheEvidence.hasPrivateBody,
		false,
		"Personalized judging data must remain absent from Cache Storage",
	);

	await Promise.all([
		judgePage.waitForEvent("framenavigated", frame => frame === judgePage.mainFrame()),
		judgePage.getByRole("button", { name: "Sign Out" }).click(),
	]);
	await judgePage.getByRole("button", { name: "Organiser Sign In" }).waitFor();
	await judgePage.waitForLoadState("networkidle");
	const localJudgingCleared = await judgePage.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("track-the-hack-judging", 1);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const transaction = database.transaction(["snapshot", "outbox"], "readonly");
		const counts = await Promise.all(
			["snapshot", "outbox"].map(
				storeName =>
					new Promise<number>((resolve, reject) => {
						const request = transaction.objectStore(storeName).count();
						request.onsuccess = () => resolve(request.result);
						request.onerror = () => reject(request.error);
					}),
			),
		);
		database.close();
		return counts.every(count => count === 0);
	});
	assert.equal(localJudgingCleared, true, "Judge sign-out must clear local judging data");

	await judgePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
	const frenchJudgingShellReady = await judgePage.evaluate(async () => {
		for (const cacheName of await caches.keys()) {
			const cache = await caches.open(cacheName);
			for (const request of await cache.keys()) {
				if (new URL(request.url).pathname !== "/fr/judging/offline") continue;
				const response = await cache.match(request);
				if (response && (await response.clone().text()).includes("Évaluation des projets")) return true;
			}
		}
		return false;
	});
	assert.equal(frenchJudgingShellReady, true, "The precached French judging shell must be available");
	await judgeContext.setOffline(true);
	await visit(judgePage, "/fr/judging");
	await waitForOfflineContent(
		judgePage,
		"/fr/judging",
		judgePage.getByRole("heading", { name: "Évaluation des projets" }),
	);
	await judgePage.getByText(/L’évaluation hors ligne n’est pas encore disponible/).waitFor();
	await judgeContext.close();
	console.info(
		"PWA E2E passed: public EN/FR routes and the QR-only participant pass survived offline reloads; judging stayed private in Cache Storage, accepted offline scoring, synchronized on reconnect, and cleared local data on sign-out.",
	);
} catch (error) {
	console.error(serverOutput.join(""));
	throw error;
} finally {
	await closeBrowser();
	await cleanUp().catch(error => console.error("PWA E2E cleanup failed:", error));
	await prisma.$disconnect();
	await stopServer();
	if (process.env.NEXT_DIST_DIR === ".next-pwa-e2e") {
		await rm(join(process.cwd(), ".next-pwa-e2e"), { recursive: true, force: true });
	}
}
