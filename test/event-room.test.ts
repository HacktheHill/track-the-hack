import assert from "node:assert/strict";
import test from "node:test";
import { getEventRoom } from "@/utils/event-room";

const event = { room: "Auditorium", roomFr: "Amphithéâtre" };

void test("French event rooms use roomFr while English stays on room", () => {
	assert.equal(getEventRoom(event, "fr"), "Amphithéâtre");
	assert.equal(getEventRoom(event, "en"), "Auditorium");
});

void test("French event rooms fall back to room for legacy or blank roomFr values", () => {
	assert.equal(getEventRoom({ room: "Auditorium", roomFr: null }, "fr"), "Auditorium");
	assert.equal(getEventRoom({ room: "Auditorium", roomFr: "   " }, "fr"), "Auditorium");
});
