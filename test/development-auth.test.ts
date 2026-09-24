import assert from "node:assert/strict";
import test from "node:test";
import {
	canUseDevelopmentOrganizerAuth,
	canUseGoogleOrganizerAuth,
	DEVELOPMENT_AUTH_PROVIDER_ID,
	DEVELOPMENT_ORGANIZER_EMAIL,
	isDevelopmentOrganizerAuthEnabled,
	parseGoogleOrganizerProfile,
} from "@/server/lib/organizer-auth";

const localHost = "127.0.0.1:3000";
const localPeer = "127.0.0.1";

void test("development organizer auth requires an explicit flag and a local runtime", () => {
	assert.equal(
		isDevelopmentOrganizerAuthEnabled(
			{
				DEV_AUTH_ENABLED: "1",
				NODE_ENV: "development",
				NEXTAUTH_URL: "https://track.example",
			},
			localHost,
			localPeer,
		),
		false,
	);
	assert.equal(
		isDevelopmentOrganizerAuthEnabled(
			{
				DEV_AUTH_ENABLED: "1",
				NODE_ENV: "development",
				NEXTAUTH_URL: "http://localhost:3000",
			},
			localHost,
			localPeer,
		),
		true,
	);
	assert.equal(
		isDevelopmentOrganizerAuthEnabled(
			{
				DEV_AUTH_ENABLED: "1",
				NODE_ENV: "development",
				NEXTAUTH_URL: "http://localhost:3000",
			},
			"192.168.1.20:3000",
			localPeer,
		),
		false,
	);
	assert.equal(
		isDevelopmentOrganizerAuthEnabled(
			{
				DEV_AUTH_ENABLED: "1",
				NODE_ENV: "development",
				NEXTAUTH_URL: "http://localhost:3000",
			},
			"127.0.0.1:3000",
			localPeer,
		),
		true,
	);
	assert.equal(
		isDevelopmentOrganizerAuthEnabled(
			{
				DEV_AUTH_ENABLED: "1",
				NODE_ENV: "development",
				NEXTAUTH_URL: "http://127.0.0.1:3000",
			},
			localHost,
			localPeer,
		),
		true,
	);
	assert.equal(
		isDevelopmentOrganizerAuthEnabled(
			{
				DEV_AUTH_ENABLED: "1",
				NODE_ENV: "development",
				NEXTAUTH_URL: "http://[::1]:3000",
			},
			"[::1]:3000",
			"::1",
		),
		true,
	);
	assert.equal(
		isDevelopmentOrganizerAuthEnabled(
			{
				DEV_AUTH_ENABLED: "1",
				NODE_ENV: "development",
				NEXTAUTH_URL: "http://127.0.0.1:3000",
			},
			localHost,
			"192.168.1.20",
		),
		false,
		"A spoofed loopback Host must not authorize a remote peer",
	);
});

void test("development organizer auth stays disabled without both safeguards", () => {
	assert.equal(
		isDevelopmentOrganizerAuthEnabled(
			{
				DEV_AUTH_ENABLED: "0",
				NODE_ENV: "development",
				NEXTAUTH_URL: "http://localhost:3000",
			},
			localHost,
			localPeer,
		),
		false,
	);
	assert.equal(
		isDevelopmentOrganizerAuthEnabled(
			{
				DEV_AUTH_ENABLED: "1",
				NODE_ENV: "production",
				NEXTAUTH_URL: "http://localhost:3000",
			},
			localHost,
			localPeer,
		),
		false,
	);
	assert.equal(
		isDevelopmentOrganizerAuthEnabled(
			{
				DEV_AUTH_ENABLED: "1",
				NODE_ENV: "test",
				NEXTAUTH_URL: "http://localhost:3000",
			},
			localHost,
			localPeer,
		),
		false,
	);
});

void test("development organizer auth uses fixed non-production identity constants", () => {
	assert.equal(DEVELOPMENT_AUTH_PROVIDER_ID, "development");
	assert.equal(DEVELOPMENT_ORGANIZER_EMAIL, "dev-organizer@ctn-rtc.org");
});

void test("Google organizer profiles accept only valid, explicitly verified fields", () => {
	assert.deepEqual(
		parseGoogleOrganizerProfile({ email: "organizer@ctn-rtc.org", email_verified: true, hd: "ctn-rtc.org" }),
		{
			email: "organizer@ctn-rtc.org",
			emailVerified: true,
			hostedDomain: "ctn-rtc.org",
		},
	);
	assert.deepEqual(
		parseGoogleOrganizerProfile({ email: "organizer@ctn-rtc.org", email_verified: false, hd: "ctn-rtc.org" }),
		{
			email: "organizer@ctn-rtc.org",
			emailVerified: false,
			hostedDomain: "ctn-rtc.org",
		},
	);
	assert.equal(parseGoogleOrganizerProfile({ email: null, email_verified: true, hd: "ctn-rtc.org" }), undefined);
	assert.equal(
		parseGoogleOrganizerProfile({ email: "not-an-email", email_verified: true, hd: "ctn-rtc.org" }),
		undefined,
	);
	assert.equal(parseGoogleOrganizerProfile({ email: "organizer@ctn-rtc.org", email_verified: true }), undefined);
});

void test("Google organizer auth requires a verified CTN hosted-domain identity", () => {
	const valid = {
		provider: "google",
		profileEmail: "Daniel.Thorp@ctn-rtc.org",
		userEmail: "daniel.thorp@ctn-rtc.org",
		emailVerified: true,
		hostedDomain: "ctn-rtc.org",
	};
	assert.equal(canUseGoogleOrganizerAuth(valid), true);
	assert.equal(canUseGoogleOrganizerAuth({ ...valid, provider: "email" }), false);
	assert.equal(canUseGoogleOrganizerAuth({ ...valid, emailVerified: false }), false);
	assert.equal(canUseGoogleOrganizerAuth({ ...valid, hostedDomain: "example.com" }), false);
	assert.equal(canUseGoogleOrganizerAuth({ ...valid, profileEmail: "person@example.com" }), false);
	assert.equal(canUseGoogleOrganizerAuth({ ...valid, userEmail: "other@ctn-rtc.org" }), false);
});

void test("development organizer sign-in accepts only the fixed user without account switching", () => {
	const environment = {
		DEV_AUTH_ENABLED: "1",
		NODE_ENV: "development",
		NEXTAUTH_URL: "http://localhost:3000",
	};
	const input = {
		provider: DEVELOPMENT_AUTH_PROVIDER_ID,
		userId: "dev-user",
		userEmail: DEVELOPMENT_ORGANIZER_EMAIL,
		sessionUserId: undefined,
	};

	assert.equal(canUseDevelopmentOrganizerAuth(input, environment, localHost, localPeer), true);
	assert.equal(canUseDevelopmentOrganizerAuth({ ...input, userId: "" }, environment, localHost, localPeer), false);
	assert.equal(
		canUseDevelopmentOrganizerAuth({ ...input, provider: "google" }, environment, localHost, localPeer),
		false,
	);
	assert.equal(
		canUseDevelopmentOrganizerAuth({ ...input, userEmail: "other@ctn-rtc.org" }, environment, localHost, localPeer),
		false,
	);
	assert.equal(
		canUseDevelopmentOrganizerAuth({ ...input, sessionUserId: "other-user" }, environment, localHost, localPeer),
		false,
	);
	assert.equal(
		canUseDevelopmentOrganizerAuth({ ...input, sessionUserId: "" }, environment, localHost, localPeer),
		false,
	);
	assert.equal(
		canUseDevelopmentOrganizerAuth(input, { ...environment, DEV_AUTH_ENABLED: "0" }, localHost, localPeer),
		false,
	);
});
