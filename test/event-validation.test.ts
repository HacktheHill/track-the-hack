import assert from "node:assert/strict";
import test from "node:test";
import { eventImageUrl, httpsUrl } from "@/server/lib/event-validation";

void test("event links accept only HTTPS URLs", () => {
	assert.equal(httpsUrl.parse("https://example.com/event"), "https://example.com/event");
	assert.throws(() => httpsUrl.parse("http://example.com/event"));
	assert.throws(() => httpsUrl.parse("javascript:alert(1)"));
});

void test("event images accept only local paths and configured HTTPS hosts", () => {
	assert.equal(eventImageUrl.parse("/assets/events/example.svg"), "/assets/events/example.svg");
	assert.equal(
		eventImageUrl.parse("https://cdn1.hackthehill.com/events/example.png"),
		"https://cdn1.hackthehill.com/events/example.png",
	);
	assert.throws(() => eventImageUrl.parse("//example.com/image.png"));
	assert.throws(() => eventImageUrl.parse("https://example.com/image.png"));
	assert.throws(() => eventImageUrl.parse("http://cdn1.hackthehill.com/image.png"));
	assert.throws(() => eventImageUrl.parse("https://cdn1.hackthehill.com:444/image.png"));
	assert.throws(() => eventImageUrl.parse("https://user@cdn1.hackthehill.com/image.png"));
});
