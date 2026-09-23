import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { z } from "zod";
import { appsScriptSource as source, sidebarSource } from "@root/test/helpers/google-sheets-harness";

const operationalRecordSchema = z
	.object({
		id: z.string(),
		tShirtSize: z.enum(["XS", "S", "M", "L", "XL", "XXL", "NONE"]),
		mealCategory: z.enum(["STANDARD", "VEGETARIAN", "VEGAN", "HALAL", "OTHER"]),
		acceptanceExpiry: z.string().datetime(),
		walkIn: z.boolean(),
	})
	.strict();
const trackConfigSchema = z.object({
	baseUrl: z.string().url(),
	apiKey: z.string().min(1),
	deadline: z.string().datetime(),
	accessClientId: z.string().min(1),
	accessClientSecret: z.string().min(1),
});
const rsvpRecordSchema = z.object({
	id: z.string(),
	confirmed: z.boolean(),
	cancellationLink: z.string().optional(),
});
const reconciliationResponseSchema = z.object({
	records: z.array(rsvpRecordSchema),
	missingIds: z.array(z.string()),
});
const claimResponseSchema = z.object({ claimUrl: z.string().url(), expiresAt: z.string().datetime() });
const adapterSchema = z.object({
	applicationRowToOperationalRecord_: z
		.function()
		.args(
			z.array(z.string()),
			z.array(z.union([z.string(), z.number(), z.boolean(), z.date()])),
			z.string(),
			z.union([z.string(), z.date()]),
			z.boolean().optional(),
		)
		.returns(operationalRecordSchema),
	createParticipantId_: z.function().args().returns(z.string()),
	trackConfig_: z.function().args().returns(trackConfigSchema),
	claimDisplayUrl_: z.function().args(z.string(), z.string()).returns(z.string().url()),
	apiPost_: z
		.function()
		.args(trackConfigSchema, z.string(), z.union([operationalRecordSchema, z.object({ ids: z.array(z.string()) })]))
		.returns(z.string()),
	rsvpReconciliationResponse_: z.function().args(z.string()).returns(reconciliationResponseSchema),
	claimResponse_: z.function().args(z.string()).returns(claimResponseSchema),
});

const requestSchema = z.object({
	method: z.literal("post"),
	contentType: z.literal("application/json"),
	headers: z
		.object({
			Authorization: z.string().startsWith("Bearer "),
			"CF-Access-Client-Id": z.string(),
			"CF-Access-Client-Secret": z.string(),
		})
		.strict(),
	payload: z.string(),
	muteHttpExceptions: z.literal(true),
});
type RequestOptions = z.infer<typeof requestSchema>;

const requests: Array<{ url: string; options: RequestOptions }> = [];
const scriptProperties: Record<string, string> = {};
const adapter = adapterSchema.parse(
	runInNewContext(
		`${source}\n({
		applicationRowToOperationalRecord_,
		createParticipantId_,
		apiPost_,
		rsvpReconciliationResponse_,
		claimResponse_,
		trackConfig_,
		claimDisplayUrl_,
	})`,
		{
			Date,
			Map,
			Utilities: { getUuid: () => "123e4567-e89b-42d3-a456-426614174000" },
			PropertiesService: {
				getScriptProperties: () => ({ getProperty: (name: string) => scriptProperties[name] }),
			},
			UrlFetchApp: {
				fetch: (url: string, options: unknown) => {
					requests.push({ url, options: requestSchema.parse(options) });
					return { getResponseCode: () => 200, getContentText: () => '{"ok":true}' };
				},
			},
		},
	),
);

void test("the response adapter sends only allow-listed operational data", () => {
	const headers = [
		"Submission ID",
		"Email address",
		"What unisex T-shirt size would you prefer?",
		"Select all that apply.",
	];
	const record = adapter.applicationRowToOperationalRecord_(
		headers,
		["tally-secret", "private@example.test", "XL", "Vegan"],
		"participant_012345678901234567890123",
		"2030-09-30T03:59:59.000Z",
		false,
	);

	assert.deepEqual(record, {
		id: "participant_012345678901234567890123",
		tShirtSize: "XL",
		mealCategory: "VEGAN",
		acceptanceExpiry: "2030-09-30T03:59:59.000Z",
		walkIn: false,
	});
	assert.doesNotMatch(JSON.stringify(record), /tally-secret|private@example.test/);
});

void test("English and French T-shirt opt-outs remain supported", () => {
	for (const [header, answer] of [
		["What unisex T-shirt size would you prefer?", "I do not want a T-shirt"],
		["Quelle taille de t-shirt unisexe préférez-vous?", "Je ne souhaite pas recevoir de t-shirt"],
	] as const) {
		const record = adapter.applicationRowToOperationalRecord_(
			[header],
			[answer],
			"participant_abcdefghijklmnopqrstuvwxyz",
			"2030-09-30T03:59:59.000Z",
			false,
		);
		assert.equal(record.tShirtSize, "NONE");
	}
});

void test("configuration and API calls require both Cloudflare Access credentials", () => {
	Object.assign(scriptProperties, {
		TRACK_BASE_URL: "https://track.example/",
		SHEETS_INTEGRATION_API_KEY: "sheet-secret",
		RSVP_DEADLINE: "2030-09-30T03:59:59.000Z",
		CF_ACCESS_CLIENT_ID: "access-client",
		CF_ACCESS_CLIENT_SECRET: "access-secret",
	});
	const config = adapter.trackConfig_();
	assert.deepEqual(config, {
		baseUrl: "https://track.example",
		apiKey: "sheet-secret",
		deadline: "2030-09-30T03:59:59.000Z",
		accessClientId: "access-client",
		accessClientSecret: "access-secret",
	});

	adapter.apiPost_(config, "/api/integrations/sheets/rsvp-reconciliation", { ids: ["participant_id"] });
	assert.deepEqual(requests.at(-1), {
		url: "https://track.example/api/integrations/sheets/rsvp-reconciliation",
		options: {
			method: "post",
			contentType: "application/json",
			headers: {
				Authorization: "Bearer sheet-secret",
				"CF-Access-Client-Id": "access-client",
				"CF-Access-Client-Secret": "access-secret",
			},
			payload: '{"ids":["participant_id"]}',
			muteHttpExceptions: true,
		},
	});

	delete scriptProperties.CF_ACCESS_CLIENT_SECRET;
	assert.throws(() => adapter.trackConfig_(), /CF_ACCESS_CLIENT_SECRET/);
	delete scriptProperties.TRACK_BASE_URL;
});

void test("claim and reconciliation responses are validated at the Sheet boundary", () => {
	assert.equal(
		adapter.claimDisplayUrl_("https://track.example/claim#secret-token", "2030-09-15T00:05:00.000Z"),
		"https://track.example/claim/qr?expiresAt=2030-09-15T00%3A05%3A00.000Z#secret-token",
	);
	assert.throws(
		() => adapter.claimDisplayUrl_("http://track.example/claim#token", "2030-09-15T00:05:00.000Z"),
		/invalid claim URL/,
	);
	assert.throws(
		() => adapter.claimResponse_('{"claimUrl":"https://track.example/claim#token"}'),
		/invalid claim response/,
	);
	assert.throws(
		() => adapter.rsvpReconciliationResponse_('{"records":[{"id":1,"confirmed":true}],"missingIds":[]}'),
		/invalid RSVP reconciliation record/,
	);
});

void test("the menu exposes only the sidebar workflow", () => {
	assert.match(source, /addItem\("Open check-in sidebar", "showCheckInSidebar"\)/);
	assert.doesNotMatch(
		source,
		/Accept selected application|Set up operations tab|Issue access for selected participant/,
	);
	assert.match(sidebarSource, /Provision &amp; show QR/);
});

void test("one sidebar click opens the QR directly and later clicks reuse the display", () => {
	const script = sidebarSource.match(/<script>([\s\S]*?)<\/script>/)?.[1];
	assert.ok(script);
	const navigations: string[] = [];
	const targets: string[] = [];
	const display = {
		closed: false,
		document: { title: "", body: { textContent: "" } },
		location: { replace: (url: string) => navigations.push(url) },
		focus: () => undefined,
	};
	const button = { disabled: false, addEventListener: (_event: string, handler: () => void) => (click = handler) };
	const status = { className: "", textContent: "", appendChild: () => undefined };
	let click: () => void = () => undefined;
	let complete: (result: unknown) => void = () => undefined;
	const runner = {
		withSuccessHandler(handler: (result: unknown) => void) {
			complete = handler;
			return this;
		},
		withFailureHandler() {
			return this;
		},
		provisionSelectedParticipantAndIssueAccess: () => undefined,
	};
	runInNewContext(script, {
		document: {
			getElementById: (id: string) => (id === "issue" ? button : status),
			createElement: () => ({ href: "", target: "", rel: "", textContent: "" }),
		},
		window: {
			open: (_url: string, target: string) => {
				targets.push(target);
				return display;
			},
		},
		google: { script: { run: runner } },
	});

	click();
	assert.equal(button.disabled, true);
	assert.equal(display.document.body.textContent, "Preparing participant QR…");
	complete({ displayUrl: "https://track.example/claim/qr#one", rowNumber: 2, rsvpStatus: "PENDING" });
	assert.equal(button.disabled, false);
	assert.deepEqual(navigations, ["https://track.example/claim/qr#one"]);

	click();
	complete({ displayUrl: "https://track.example/claim/qr#two", rowNumber: 3, rsvpStatus: "CONFIRMED" });
	assert.deepEqual(navigations, [
		"https://track.example/claim/qr#one",
		"about:blank",
		"https://track.example/claim/qr#two",
	]);
	assert.equal(targets.length, 1);
	assert.match(status.textContent, /Row 3: QR ready/);
});
