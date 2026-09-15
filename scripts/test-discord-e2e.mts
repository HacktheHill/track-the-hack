import assert from "node:assert/strict";
import { execFileSync, fork, spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { access, mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { chromium, type Browser } from "playwright-core";
import { z } from "zod";
import { signDiscordLink, signDiscordRequest } from "@/server/lib/discord-proof";
import { assertLocalDevDatabase } from "./assert-local-dev-db.mjs";

assertLocalDevDatabase(process.env.DATABASE_URL);
const botRepo = resolve(process.env.DISCORD_BOT_REPO ?? "../track-the-hack-bot");
await access(resolve(botRepo, "test/fixtures/verification-server.mjs"));
await access(resolve(botRepo, "dist/verification-api.js"));
const secret = randomBytes(32).toString("base64url");
const runId = randomUUID();
const container = `track-discord-test-${runId}`;
const password = randomBytes(32).toString("hex");
const ids = Array.from({ length: 5 }, () => randomBytes(24).toString("base64url"));
const [participantId, otherId, retryId, concurrentId, secondConcurrentId] = ids;
assert.ok(participantId && otherId && retryId && concurrentId && secondConcurrentId);
const discordIds = [
	"123456789012345678",
	"223456789012345678",
	"323456789012345678",
	"423456789012345678",
	"523456789012345678",
];
const prisma = new PrismaClient();
const output: string[] = [];
const children: ChildProcess[] = [];
let browser: Browser | undefined;
let containerStarted = false;
const wait = (ms: number) => new Promise<void>(done => setTimeout(done, ms));
const capture = (child: ChildProcess) => {
	children.push(child);
	child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
	child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
};
const getPort = async () => {
	const server = createServer().listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	await new Promise<void>((done, reject) => server.close(error => (error ? reject(error) : done())));
	return address.port;
};
const stop = async (child: ChildProcess) => {
	if (child.exitCode !== null) return;
	child.kill("SIGTERM");
	await Promise.race([once(child, "exit"), wait(5000)]);
	if (child.exitCode === null) child.kill("SIGKILL");
};
const findChromium = async () => {
	for (const path of [
		process.env.CHROMIUM_PATH,
		"/usr/bin/chromium-browser",
		"/usr/bin/chromium",
		"/usr/bin/google-chrome",
		"/usr/bin/google-chrome-stable",
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	]) {
		if (!path) continue;
		try {
			await access(path);
			return path;
		} catch {
			/* Try the next installed browser. */
		}
	}
	throw new Error("Chromium not found. Set CHROMIUM_PATH to its executable.");
};

try {
	execFileSync(
		"docker",
		[
			"run",
			"--rm",
			"-d",
			"--name",
			container,
			"-p",
			"127.0.0.1::5432",
			"-e",
			`POSTGRES_PASSWORD=${password}`,
			"-e",
			"POSTGRES_DB=discord_verification_test",
			"postgres:17-alpine",
		],
		{ stdio: "pipe" },
	);
	containerStarted = true;
	const postgresPort = execFileSync("docker", ["port", container, "5432"], { encoding: "utf8" })
		.trim()
		.split(":")
		.at(-1);
	assert.ok(postgresPort);
	const bot = fork(resolve(botRepo, "test/fixtures/verification-server.mjs"), [], {
		cwd: botRepo,
		execArgv: [],
		silent: true,
		env: {
			...process.env,
			INTERNAL_API_SECRET: secret,
			VERIFICATION_TEST_DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${postgresPort}/discord_verification_test`,
		},
	});
	capture(bot);
	const readySchema = z.object({ ready: z.literal(true), port: z.number() });
	const ready = await Promise.race([
		once(bot, "message").then(([message]: unknown[]) => readySchema.parse(message)),
		once(bot, "exit").then(() => {
			throw new Error("Bot fixture exited before ready");
		}),
		wait(30_000).then(() => {
			throw new Error("Bot fixture readiness timed out");
		}),
	]);
	const botUrl = `http://127.0.0.1:${ready.port}`;
	const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
	bot.on("message", (message: unknown) => {
		const reply = z
			.object({ requestId: z.string(), result: z.unknown(), error: z.string().optional() })
			.parse(message);
		const entry = pending.get(reply.requestId);
		if (!entry) return;
		pending.delete(reply.requestId);
		if (reply.error) entry.reject(new Error(reply.error));
		else entry.resolve(reply.result);
	});
	const command = async (input: Record<string, string | boolean>) => {
		const requestId = randomUUID();
		try {
			return await new Promise<unknown>((done, reject) => {
				const timer = setTimeout(() => {
					pending.delete(requestId);
					reject(new Error("Bot command timed out"));
				}, 10_000);
				pending.set(requestId, {
					resolve: value => {
						clearTimeout(timer);
						done(value);
					},
					reject: error => {
						clearTimeout(timer);
						reject(error);
					},
				});
				bot.send({ ...input, requestId });
			});
		} finally {
			pending.delete(requestId);
		}
	};
	const baseUrl = `http://127.0.0.1:${await getPort()}`;
	const next = spawn(
		process.execPath,
		[
			"node_modules/next/dist/bin/next",
			"dev",
			"--webpack",
			"--hostname",
			"127.0.0.1",
			"--port",
			new URL(baseUrl).port,
		],
		{
			env: {
				...process.env,
				NEXT_DIST_DIR: ".next-discord-e2e",
				NEXTAUTH_URL: baseUrl,
				DEV_AUTH_ENABLED: "1",
				INTERNAL_API_SECRET: secret,
				DISCORD_BOT_URL: botUrl,
				NEXT_TELEMETRY_DISABLED: "1",
			},
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	capture(next);
	for (let attempt = 0; ; attempt++) {
		if (
			await fetch(`${baseUrl}/api/readyz`)
				.then(res => res.ok)
				.catch(() => false)
		)
			break;
		if (attempt > 120 || next.exitCode !== null) throw new Error("Track readiness failed");
		await wait(500);
	}
	const post = (path: string, body: unknown, cookie = "", headers: Record<string, string> = {}) =>
		fetch(`${baseUrl}${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Cookie: cookie, ...headers },
			body: JSON.stringify(body),
		});
	const claim = async (id: string) => {
		const response = await post(
			"/api/integrations/sheets/claim",
			{
				id,
				tShirtSize: "NONE",
				mealCategory: "STANDARD",
				acceptanceExpiry: new Date(Date.now() + 86400_000).toISOString(),
			},
			"",
			{ Authorization: `Bearer ${process.env.SHEETS_INTEGRATION_API_KEY ?? ""}` },
		);
		assert.equal(response.status, 200);
		const { claimUrl } = z.object({ claimUrl: z.string().url() }).parse(await response.json());
		const activated = await post("/api/claim", { token: new URL(claimUrl).hash.slice(1) });
		assert.equal(activated.status, 200);
		const cookie = activated.headers
			.getSetCookie()
			.find(value => value.startsWith("participant_session="))
			?.split(";")[0];
		assert.ok(cookie);
		return cookie;
	};
	const cookie = await claim(participantId);
	const otherCookie = await claim(otherId);
	const link = async (discordId: string, expired = false) =>
		z
			.string()
			.url()
			.parse(await command({ command: "link", baseUrl, discordId, expired }));
	const tokenOf = (link: string) => new URL(link).hash.slice(1);
	const personalLink = await link(discordIds[0] ?? "");
	const token = tokenOf(personalLink);
	const verify = (value: string, session = cookie) => post("/api/discord/verify", { token: value }, session);
	assert.equal(new URL(personalLink).search, "");
	assert.equal(personalLink.includes(discordIds[0] ?? "missing"), false);
	assert.equal((await fetch(`${baseUrl}/api/discord/verify`)).status, 405);
	assert.equal((await verify(token, "")).status, 401);
	assert.equal((await verify(token, "participant_session=forged")).status, 401);
	assert.equal((await post("/api/discord/verify", { token, hackerId: otherId }, cookie)).status, 400);
	assert.equal((await post("/api/discord/verify", { token, discordId: discordIds[0] }, cookie)).status, 400);
	assert.equal(
		(await post("/api/discord/verify", { token }, cookie, { Origin: "https://attacker.example" })).status,
		403,
	);
	assert.equal((await verify(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"))).status, 400);
	assert.equal((await verify(tokenOf(await link(discordIds[0] ?? "", true)))).status, 400);

	// Exercise both implementations over real HTTP, including signature failures.
	const direct = async (
		payload: unknown,
		signingSecret = secret,
		timestamp = String(Math.floor(Date.now() / 1000)),
	) => {
		const body = JSON.stringify(payload);
		return fetch(`${botUrl}/verify`, {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/json",
				"x-track-the-hack-timestamp": timestamp,
				"x-track-the-hack-signature": signDiscordRequest(body, timestamp, signingSecret),
			},
		});
	};
	assert.equal((await direct({ token, hackerId: participantId }, "wrong-secret")).status, 403);
	assert.equal((await direct({ token, hackerId: participantId }, secret, "1000000000")).status, 403);
	assert.equal((await direct({ discordId: discordIds[0] })).status, 400);
	const unknownToken = signDiscordLink(
		randomBytes(32).toString("base64url"),
		Math.floor(Date.now() / 1000) + 300,
		secret,
	);
	assert.equal((await direct({ token: unknownToken, hackerId: participantId })).status, 410);

	const stateSchema = z.object({
		mappings: z.array(z.object({ discord_id: z.string(), hacker_id: z.string() })),
		roles: z.array(z.string()),
	});
	assert.deepEqual(stateSchema.parse(await command({ command: "state" })).mappings, []);
	browser = await chromium.launch({
		executablePath: await findChromium(),
		headless: true,
		args: ["--no-sandbox", "--disable-dev-shm-usage"],
	});
	const anonymousContext = await browser.newContext();
	const anonymousPage = await anonymousContext.newPage();
	await anonymousPage.goto(personalLink);
	await anonymousPage.getByRole("button", { name: "Verify Discord account" }).click();
	await anonymousPage.getByRole("status").getByText("Open your day-of access link", { exact: false }).waitFor();
	await anonymousPage.getByRole("button", { name: "Organizer Sign In" }).click();
	await anonymousPage.waitForURL(url => url.pathname === "/auth/sign-in");
	assert.equal(new URL(anonymousPage.url()).searchParams.get("callbackUrl"), "/discord");
	await anonymousContext.close();
	const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
	await context.addCookies([
		{ name: "participant_session", value: cookie.slice("participant_session=".length), url: baseUrl },
	]);
	const page = await context.newPage();
	await page.goto(personalLink);
	assert.deepEqual(
		stateSchema.parse(await command({ command: "state" })).mappings,
		[],
		"GET must not bind a participant",
	);
	await page.getByRole("button", { name: "Verify Discord account" }).click();
	await page.getByRole("status").getByText("Your Discord account is verified.", { exact: false }).waitFor();
	assert.equal(new URL(page.url()).hash, "");
	await mkdir("artifacts/discord-verification", { recursive: true });
	await page.screenshot({ path: "artifacts/discord-verification/mobile-success.png", fullPage: true });
	assert.deepEqual(stateSchema.parse(await command({ command: "state" })).mappings, [
		{ discord_id: discordIds[0], hacker_id: participantId },
	]);
	assert.equal((await verify(token)).status, 200, "Same-pair replay must be safe");
	assert.equal((await verify(token, otherCookie)).status, 409);
	assert.equal((await verify(tokenOf(await link(discordIds[1] ?? "")))).status, 409);
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto(`${baseUrl}/fr/discord#${token}`);
	await page.getByRole("button", { name: "Vérifier le compte Discord" }).click();
	await page.getByRole("status").getByText("Votre compte Discord est vérifié.", { exact: false }).waitFor();
	await page.screenshot({ path: "artifacts/discord-verification/french-success.png", fullPage: true });
	await context.close();

	const replacementCookie = await claim(participantId);
	assert.equal((await verify(token, cookie)).status, 401, "Revoked device must fail");
	assert.equal((await verify(token, replacementCookie)).status, 200);
	await prisma.participantSession.updateMany({
		where: { hackerId: participantId },
		data: { expiresAt: new Date(0) },
	});
	assert.equal((await verify(token, replacementCookie)).status, 401, "Expired session must fail");
	// A real organizer session must not stand in for participant access.
	const organizerContext = await browser.newContext();
	const organizerPage = await organizerContext.newPage();
	await organizerPage.goto(`${baseUrl}/auth/sign-in?callbackUrl=${encodeURIComponent(`${baseUrl}/qr`)}`);
	await organizerPage.getByRole("button", { name: "Sign in as local organizer" }).click();
	await organizerPage.waitForURL(url => url.pathname === "/qr");
	const organizerCookie = (await organizerContext.cookies(baseUrl))
		.map(item => `${item.name}=${item.value}`)
		.join("; ");
	assert.equal((await verify(token, organizerCookie)).status, 401);
	await organizerContext.close();

	const retryCookie = await claim(retryId);
	const retryToken = tokenOf(await link(discordIds[1] ?? ""));
	await command({ command: "failure", enabled: true });
	assert.equal((await verify(retryToken, retryCookie)).status, 503);
	assert.equal((await verify(retryToken, otherCookie)).status, 409);
	await command({ command: "failure", enabled: false });
	assert.equal((await verify(retryToken, retryCookie)).status, 200);
	assert.equal(
		(await verify(tokenOf(await link(discordIds[1] ?? "")), retryCookie)).status,
		200,
		"A fresh link also resumes the same binding",
	);
	const concurrentCookie = await claim(concurrentId);
	const secondCookie = await claim(secondConcurrentId);
	const concurrentToken = tokenOf(await link(discordIds[2] ?? ""));
	await command({ command: "role", discordId: discordIds[2] ?? "" });
	const race = await Promise.all([verify(concurrentToken, concurrentCookie), verify(concurrentToken, secondCookie)]);
	assert.deepEqual(race.map(response => response.status).sort(), [200, 409]);
	const twoLinks = await Promise.all([link(discordIds[3] ?? ""), link(discordIds[4] ?? "")]);
	const otherRace = await Promise.all(twoLinks.map(value => verify(tokenOf(value), otherCookie)));
	assert.deepEqual(otherRace.map(response => response.status).sort(), [200, 409]);
	const state = stateSchema.parse(await command({ command: "state" }));
	assert.equal(state.mappings.length, 4);
	assert.equal(state.roles.length, 4);
	const logs = JSON.stringify(await prisma.log.findMany({ where: { sourceId: { in: ids } } }));
	const serverLogs = output.join("");
	for (const sensitive of [...discordIds, token, retryToken, secret]) {
		assert.equal(logs.includes(sensitive), false, "Track audit logs must not contain Discord IDs/proofs/secrets");
		assert.equal(serverLogs.includes(sensitive), false, "Server logs must not contain Discord IDs/proofs/secrets");
	}
	console.info(
		"Discord E2E passed: bot-generated link, real Track/MySQL session, bot HTTP/PostgreSQL mapping, EN/FR browser verification, role-boundary double, retries, conflicts, concurrent claims, rejected credentials, and log privacy.",
	);
} catch (error) {
	// Do not print server output: it is explicitly inspected for private data.
	console.error("Discord E2E failed", error);
	throw error;
} finally {
	await browser?.close();
	for (const child of children.reverse()) await stop(child);
	if (containerStarted) execFileSync("docker", ["stop", container], { stdio: "pipe" });
	await prisma.$transaction([
		prisma.log.deleteMany({ where: { sourceId: { in: ids } } }),
		prisma.participantSession.deleteMany({ where: { hackerId: { in: ids } } }),
		prisma.claimToken.deleteMany({ where: { hackerId: { in: ids } } }),
		prisma.hacker.deleteMany({ where: { id: { in: ids } } }),
	]);
	await prisma.$disconnect();
}
